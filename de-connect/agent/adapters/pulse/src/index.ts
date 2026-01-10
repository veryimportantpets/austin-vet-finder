/**
 * Pulse (Covetrus) Adapter
 *
 * Uses browser automation to trigger vendor-provided exports.
 * Does NOT scrape UI tables - only automates navigation to export functions.
 *
 * IMPORTANT: This adapter is for practices that have legitimate access to their
 * own data through Pulse. It automates the manual export process that users
 * would otherwise do themselves.
 */

import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import type {
  IAdapter,
  AdapterManifest,
  DetectedSystem,
  ValidationResult,
  ConnectionProfile,
  SyncRequest,
  SyncResult,
  SyncCursor,
  SyncWarning,
} from '@de-connect/contracts';
import {
  PimsKind,
  AcquisitionMode,
  ValidationStep,
  EntityType,
  SyncType,
  SyncErrorCode,
} from '@de-connect/contracts';
import { PackageBuilder } from '@de-connect/runner';

// Pulse URLs (would be configured per environment)
const PULSE_LOGIN_URL = 'https://pulse.covetrus.com/login';
const PULSE_REPORTS_URL = 'https://pulse.covetrus.com/reports';

/**
 * Browser session state
 */
interface BrowserSession {
  cookies: string;
  localStorage: Record<string, string>;
  lastValidated: string;
}

/**
 * Export configuration
 */
interface ExportConfig {
  reportName: string;
  entityType: EntityType;
  selectors: {
    menuItem: string[];
    exportButton: string[];
    downloadLink: string[];
  };
}

/**
 * Available exports in Pulse
 */
const PULSE_EXPORTS: ExportConfig[] = [
  {
    reportName: 'Client List',
    entityType: EntityType.Client,
    selectors: {
      menuItem: ['[data-testid="reports-clients"]', 'a:has-text("Client List")', '.reports-menu a[href*="clients"]'],
      exportButton: ['button:has-text("Export")', '[data-testid="export-btn"]', '.export-button'],
      downloadLink: ['a[download]', '.download-link', 'button:has-text("Download CSV")'],
    },
  },
  {
    reportName: 'Patient List',
    entityType: EntityType.Patient,
    selectors: {
      menuItem: ['[data-testid="reports-patients"]', 'a:has-text("Patient List")', '.reports-menu a[href*="patients"]'],
      exportButton: ['button:has-text("Export")', '[data-testid="export-btn"]', '.export-button'],
      downloadLink: ['a[download]', '.download-link', 'button:has-text("Download CSV")'],
    },
  },
  {
    reportName: 'Appointments',
    entityType: EntityType.Appointment,
    selectors: {
      menuItem: ['[data-testid="reports-appointments"]', 'a:has-text("Appointments")', '.reports-menu a[href*="appointments"]'],
      exportButton: ['button:has-text("Export")', '[data-testid="export-btn"]', '.export-button'],
      downloadLink: ['a[download]', '.download-link', 'button:has-text("Download CSV")'],
    },
  },
  {
    reportName: 'Reminders',
    entityType: EntityType.Reminder,
    selectors: {
      menuItem: ['[data-testid="reports-reminders"]', 'a:has-text("Reminders")', '.reports-menu a[href*="reminders"]'],
      exportButton: ['button:has-text("Export")', '[data-testid="export-btn"]', '.export-button'],
      downloadLink: ['a[download]', '.download-link', 'button:has-text("Download CSV")'],
    },
  },
];

/**
 * Pulse Adapter implementation
 */
class PulseAdapter implements IAdapter {
  private manifest: AdapterManifest = {
    adapterId: 'pulse-adapter',
    name: 'Pulse (Covetrus)',
    version: '1.0.0',
    supportedKinds: [PimsKind.Pulse],
    requiresX86: false,
    capabilities: {
      incrementalSync: true,
      autoDetect: false,
      realtime: false,
      dateRangeExport: true,
      entities: [
        EntityType.Client,
        EntityType.Patient,
        EntityType.Appointment,
        EntityType.Reminder,
        EntityType.Invoice,
      ],
      acquisitionModes: [AcquisitionMode.ExportAutomation, AcquisitionMode.ExportDrop],
    },
    minAgentVersion: '1.0.0',
    description: 'Pulse (Covetrus) cloud PIMS adapter using export automation.',
    author: 'DE Connect',
  };

  private browser: any = null;
  private context: any = null;

  getManifest(): AdapterManifest {
    return this.manifest;
  }

  async detectAsync(): Promise<DetectedSystem[]> {
    // Pulse is a cloud PIMS, no local detection possible
    return [];
  }

  async validateAsync(
    profile: ConnectionProfile,
    secrets: Record<string, string>,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check for stored session
    if (secrets.sessionData) {
      results.push({
        step: ValidationStep.BrowserSession,
        status: 'success',
        message: 'Browser session found',
        canProceed: true,
      });

      // TODO: Validate session is still active
      // This would involve launching browser and checking if we're logged in
    } else {
      results.push({
        step: ValidationStep.BrowserSession,
        status: 'warning',
        message: 'No browser session found. Login required.',
        canProceed: true,
        suggestedFix: 'Run first-time setup to log in to Pulse',
      });
    }

    // Check acquisition mode
    if (profile.acquisitionMode === AcquisitionMode.ExportAutomation) {
      results.push({
        step: ValidationStep.ExportCapability,
        status: 'success',
        message: 'Export Automation mode configured',
        canProceed: true,
        details: {
          note: 'Browser automation will be used to trigger exports',
        },
      });
    } else if (profile.acquisitionMode === AcquisitionMode.ExportDrop) {
      results.push({
        step: ValidationStep.ExportCapability,
        status: 'success',
        message: 'Export Drop mode configured',
        canProceed: true,
        details: {
          note: 'Manual file drops will be processed',
        },
      });
    }

    return results;
  }

  async runSyncAsync(
    profile: ConnectionProfile,
    secrets: Record<string, string>,
    request: SyncRequest,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const warnings: SyncWarning[] = [];

    // For Export Drop mode, delegate to the export-drop adapter logic
    if (profile.acquisitionMode === AcquisitionMode.ExportDrop) {
      return this.runExportDropSync(profile, request, warnings, startTime);
    }

    // Export Automation mode
    return this.runExportAutomationSync(profile, secrets, request, warnings, startTime);
  }

  /**
   * Run sync using Export Automation (browser automation)
   */
  private async runExportAutomationSync(
    profile: ConnectionProfile,
    secrets: Record<string, string>,
    request: SyncRequest,
    warnings: SyncWarning[],
    startTime: number
  ): Promise<SyncResult> {
    // Create package builder
    const builder = new PackageBuilder({
      practiceId: request.practiceId,
      agentId: request.agentId,
      sourceSystem: 'pulse',
      adapterVersion: this.manifest.version,
      syncType: request.syncType as SyncType,
      outputDir: request.outputDir,
    });

    await builder.init();

    try {
      // Check for valid session
      if (!secrets.sessionData) {
        throw new Error('SESSION_EXPIRED: No browser session. Please log in again.');
      }

      builder.startPhase('browser_setup');

      // Import Playwright dynamically
      const { chromium } = await import('playwright');

      // Parse stored session
      const session = JSON.parse(secrets.sessionData) as BrowserSession;

      // Launch browser with persistent context
      const userDataDir = join(request.outputDir, '.browser-profile');
      if (!existsSync(userDataDir)) {
        mkdirSync(userDataDir, { recursive: true });
      }

      this.context = await chromium.launchPersistentContext(userDataDir, {
        headless: true, // Run headless for scheduled syncs
        viewport: { width: 1280, height: 720 },
      });

      // Restore cookies if available
      if (session.cookies) {
        try {
          const cookies = JSON.parse(session.cookies);
          await this.context.addCookies(cookies);
        } catch {
          warnings.push({
            code: 'COOKIE_RESTORE_FAILED',
            message: 'Failed to restore session cookies',
          });
        }
      }

      builder.endPhase('browser_setup');
      builder.startPhase('navigate_and_export');

      const page = await this.context.newPage();

      // Navigate to reports page
      await page.goto(PULSE_REPORTS_URL, { waitUntil: 'networkidle' });

      // Check if we're redirected to login
      if (page.url().includes('login')) {
        await page.close();
        await this.context.close();
        throw new Error('SESSION_EXPIRED: Redirected to login. Please log in again.');
      }

      // Download directory
      const downloadDir = join(request.outputDir, 'downloads');
      if (!existsSync(downloadDir)) {
        mkdirSync(downloadDir, { recursive: true });
      }

      // Process each export
      for (const exportConfig of PULSE_EXPORTS) {
        try {
          // Navigate to report
          let found = false;
          for (const selector of exportConfig.selectors.menuItem) {
            try {
              await page.click(selector, { timeout: 5000 });
              found = true;
              break;
            } catch {
              // Try next selector
            }
          }

          if (!found) {
            warnings.push({
              code: 'SELECTOR_NOT_FOUND',
              message: `Could not find menu item for ${exportConfig.reportName}`,
              entity: exportConfig.entityType,
            });
            continue;
          }

          // Wait for page to load
          await page.waitForLoadState('networkidle');

          // Click export button
          found = false;
          for (const selector of exportConfig.selectors.exportButton) {
            try {
              await page.click(selector, { timeout: 5000 });
              found = true;
              break;
            } catch {
              // Try next selector
            }
          }

          if (!found) {
            warnings.push({
              code: 'EXPORT_BUTTON_NOT_FOUND',
              message: `Could not find export button for ${exportConfig.reportName}`,
              entity: exportConfig.entityType,
            });
            continue;
          }

          // Wait for download
          const download = await page.waitForEvent('download', { timeout: 30000 });
          const filePath = join(downloadDir, download.suggestedFilename());
          await download.saveAs(filePath);

          // TODO: Parse the downloaded file and add to builder
          // This would use similar logic to the ExportDrop adapter
          warnings.push({
            code: 'DOWNLOAD_SUCCESS',
            message: `Downloaded ${exportConfig.reportName}`,
            entity: exportConfig.entityType,
            details: { filePath },
          });

        } catch (error) {
          warnings.push({
            code: 'EXPORT_FAILED',
            message: `Failed to export ${exportConfig.reportName}: ${error instanceof Error ? error.message : String(error)}`,
            entity: exportConfig.entityType,
          });
        }
      }

      builder.endPhase('navigate_and_export');

      // Close browser
      await page.close();
      await this.context.close();

      // Build cursor
      const newCursor: SyncCursor = {
        lastSyncAt: new Date().toISOString(),
        entityCursors: {},
      };

      // Build package
      const { packagePath, manifest } = await builder.build(newCursor);

      return {
        success: warnings.filter(w => w.code === 'EXPORT_FAILED').length === 0,
        requestId: request.requestId,
        outputPackagePath: packagePath,
        newCursor,
        counts: manifest.counts,
        durationMs: Date.now() - startTime,
        warnings,
        stats: manifest.stats,
      };
    } catch (error) {
      await builder.cleanup();

      // Check for specific error types
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('SESSION_EXPIRED')) {
        return {
          success: false,
          requestId: request.requestId,
          counts: { clients: 0, patients: 0, appointments: 0, reminders: 0, invoices: 0, invoiceLineItems: 0 },
          durationMs: Date.now() - startTime,
          warnings,
          error: {
            code: SyncErrorCode.SessionExpired,
            message: 'Browser session expired. Please log in again.',
            retryable: false,
            suggestedAction: 'reconnect' as any,
          },
          stats: {
            startedAt: new Date(startTime).toISOString(),
            completedAt: new Date().toISOString(),
            recordsProcessed: 0,
            recordsSkipped: 0,
            bytesWritten: 0,
            phases: {},
          },
        };
      }

      throw error;
    }
  }

  /**
   * Run sync using Export Drop (manual file processing)
   */
  private async runExportDropSync(
    profile: ConnectionProfile,
    request: SyncRequest,
    warnings: SyncWarning[],
    startTime: number
  ): Promise<SyncResult> {
    // Delegate to ExportDrop adapter logic
    // This is a simplified version - in production, would reuse the actual adapter

    const builder = new PackageBuilder({
      practiceId: request.practiceId,
      agentId: request.agentId,
      sourceSystem: 'pulse',
      adapterVersion: this.manifest.version,
      syncType: request.syncType as SyncType,
      outputDir: request.outputDir,
    });

    await builder.init();

    try {
      const watchFolder = profile.config.watchFolder;

      if (!watchFolder || !existsSync(watchFolder)) {
        warnings.push({
          code: 'NO_WATCH_FOLDER',
          message: 'Watch folder not configured or does not exist',
        });
      }

      // Build empty package
      const newCursor: SyncCursor = {
        lastSyncAt: new Date().toISOString(),
        entityCursors: {},
      };

      const { packagePath, manifest } = await builder.build(newCursor);

      return {
        success: true,
        requestId: request.requestId,
        outputPackagePath: packagePath,
        newCursor,
        counts: manifest.counts,
        durationMs: Date.now() - startTime,
        warnings,
        stats: manifest.stats,
      };
    } catch (error) {
      await builder.cleanup();
      throw error;
    }
  }

  async disposeAsync(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * Factory function
 */
export function createAdapter(): IAdapter {
  return new PulseAdapter();
}

export default { createAdapter };
