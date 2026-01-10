/**
 * Cornerstone (IDEXX) Adapter
 *
 * On-premise PIMS adapter for Cornerstone.
 *
 * SCAFFOLD: This adapter requires proper database drivers and
 * understanding of the Cornerstone schema to function. The database
 * queries are placeholders and need to be implemented.
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
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
  DetectionEvidence,
} from '@de-connect/contracts';
import {
  PimsKind,
  AcquisitionMode,
  ValidationStep,
  EntityType,
  SyncType,
} from '@de-connect/contracts';
import { PackageBuilder } from '@de-connect/runner';

// Common Cornerstone installation paths
const CORNERSTONE_PATHS = [
  'C:\\Cornerstone',
  'C:\\Program Files\\IDEXX\\Cornerstone',
  'C:\\Program Files (x86)\\IDEXX\\Cornerstone',
  'C:\\IDEXX\\Cornerstone',
  'D:\\Cornerstone',
];

// Cornerstone database file indicators
const CORNERSTONE_FILES = ['cstone.db', 'cornerstone.db', 'Cornerstone.exe'];

/**
 * Check if Cornerstone is installed at a path
 */
function checkCornerstoneInstall(basePath: string): DetectionEvidence | null {
  if (!existsSync(basePath)) {
    return null;
  }

  try {
    const files = readdirSync(basePath);
    const hasExe = files.some(f => f.toLowerCase() === 'cornerstone.exe');
    const hasDb = files.some(f =>
      f.toLowerCase() === 'cstone.db' ||
      f.toLowerCase() === 'cornerstone.db'
    );

    // Check subdirectories
    let hasDataDir = false;
    for (const subdir of ['Data', 'Database', 'DB']) {
      const subdirPath = join(basePath, subdir);
      if (existsSync(subdirPath)) {
        try {
          const subFiles = readdirSync(subdirPath);
          if (subFiles.some(f => f.endsWith('.db') || f.endsWith('.mdf'))) {
            hasDataDir = true;
            break;
          }
        } catch {
          // Ignore permission errors
        }
      }
    }

    if (hasExe || hasDb || hasDataDir) {
      return {
        type: 'file_path',
        description: `Cornerstone installation found at ${basePath}`,
        path: basePath,
        confidence: hasExe && (hasDb || hasDataDir) ? 0.95 : 0.7,
      };
    }
  } catch {
    // Permission denied or other error
  }

  return null;
}

/**
 * Cornerstone Adapter implementation
 */
class CornerstoneAdapter implements IAdapter {
  private manifest: AdapterManifest = {
    adapterId: 'cornerstone-adapter',
    name: 'Cornerstone (IDEXX)',
    version: '1.0.0',
    supportedKinds: [PimsKind.Cornerstone],
    requiresX86: false,
    capabilities: {
      incrementalSync: true,
      autoDetect: true,
      realtime: false,
      dateRangeExport: true,
      entities: [
        EntityType.Client,
        EntityType.Patient,
        EntityType.Appointment,
        EntityType.Reminder,
        EntityType.Invoice,
      ],
      acquisitionModes: [AcquisitionMode.Direct, AcquisitionMode.ExportDrop],
    },
    minAgentVersion: '1.0.0',
    description: 'Cornerstone (IDEXX) on-premise PIMS adapter.',
    author: 'DE Connect',
  };

  getManifest(): AdapterManifest {
    return this.manifest;
  }

  async detectAsync(): Promise<DetectedSystem[]> {
    const systems: DetectedSystem[] = [];
    const evidence: DetectionEvidence[] = [];

    // Check common installation paths
    for (const path of CORNERSTONE_PATHS) {
      const result = checkCornerstoneInstall(path);
      if (result) {
        evidence.push(result);
      }
    }

    // Check for running Cornerstone services
    // TODO: Check for IDEXX services on Windows

    // Check for SQL Server instances that might be Cornerstone
    // TODO: Check for SQL Server with Cornerstone database

    if (evidence.length > 0) {
      const maxConfidence = Math.max(...evidence.map(e => e.confidence));

      systems.push({
        kind: PimsKind.Cornerstone,
        displayName: 'Cornerstone (IDEXX)',
        confidence: maxConfidence,
        evidence,
        acquisitionModes: [AcquisitionMode.Direct, AcquisitionMode.ExportDrop],
        recommendedMode: AcquisitionMode.Direct,
        connectionHints: {
          dataPath: evidence[0]?.path,
          notes: [
            'Cornerstone installation detected.',
            'Direct database access requires ODBC driver or SQL Server connection.',
            'Export Drop mode available as fallback.',
            'IDEXX Data Services API may also be available.',
          ],
        },
      });
    }

    return systems;
  }

  async validateAsync(
    profile: ConnectionProfile,
    secrets: Record<string, string>,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const dataPath = profile.config.dataPath;
    const serverName = profile.config.serverName;

    // Check connection method
    if (profile.acquisitionMode === AcquisitionMode.Direct) {
      // For direct mode, need either dataPath or serverName
      if (!dataPath && !serverName) {
        results.push({
          step: ValidationStep.Connection,
          status: 'error',
          message: 'Neither data path nor server name configured',
          canProceed: false,
          suggestedFix: 'Configure either dataPath or serverName',
        });
        return results;
      }

      if (serverName) {
        // SQL Server connection
        results.push({
          step: ValidationStep.Connection,
          status: 'warning',
          message: `SQL Server connection configured: ${serverName}`,
          canProceed: true,
          details: {
            note: 'SQL Server connection not implemented - scaffold only',
          },
        });

        // TODO: Test SQL Server connection
        results.push({
          step: ValidationStep.Authentication,
          status: 'warning',
          message: 'SQL Server authentication test not implemented',
          canProceed: true,
        });
      } else if (dataPath) {
        // File-based database
        if (!existsSync(dataPath)) {
          results.push({
            step: ValidationStep.Connection,
            status: 'error',
            message: `Data path does not exist: ${dataPath}`,
            canProceed: false,
          });
          return results;
        }

        results.push({
          step: ValidationStep.Connection,
          status: 'success',
          message: 'Cornerstone data path found',
          canProceed: true,
        });

        // Check for database files
        try {
          const files = readdirSync(dataPath);
          const hasDatabase = files.some(f =>
            f.toLowerCase().endsWith('.db') ||
            f.toLowerCase().endsWith('.mdf')
          );

          if (hasDatabase) {
            results.push({
              step: ValidationStep.DataAccess,
              status: 'success',
              message: 'Database files found',
              canProceed: true,
            });
          } else {
            results.push({
              step: ValidationStep.DataAccess,
              status: 'warning',
              message: 'No database files found in path',
              canProceed: true,
            });
          }
        } catch (error) {
          results.push({
            step: ValidationStep.DataAccess,
            status: 'error',
            message: `Cannot read directory: ${error instanceof Error ? error.message : String(error)}`,
            canProceed: false,
          });
        }
      }
    } else if (profile.acquisitionMode === AcquisitionMode.ExportDrop) {
      // Export Drop mode
      const watchFolder = profile.config.watchFolder;

      if (!watchFolder) {
        results.push({
          step: ValidationStep.FolderAccess,
          status: 'error',
          message: 'Watch folder not configured',
          canProceed: false,
        });
        return results;
      }

      if (!existsSync(watchFolder)) {
        results.push({
          step: ValidationStep.FolderAccess,
          status: 'warning',
          message: `Watch folder does not exist: ${watchFolder}`,
          canProceed: true,
          suggestedFix: 'Create the folder or select a different location',
        });
      } else {
        results.push({
          step: ValidationStep.FolderAccess,
          status: 'success',
          message: 'Watch folder accessible',
          canProceed: true,
        });
      }
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

    // Create package builder
    const builder = new PackageBuilder({
      practiceId: request.practiceId,
      agentId: request.agentId,
      sourceSystem: 'cornerstone',
      adapterVersion: this.manifest.version,
      syncType: request.syncType as SyncType,
      outputDir: request.outputDir,
    });

    await builder.init();

    try {
      if (profile.acquisitionMode === AcquisitionMode.Direct) {
        builder.startPhase('database_query');

        // SCAFFOLD: This is where database queries would be executed
        // The actual implementation would:
        // 1. Connect to the Cornerstone database (SQL Server or file-based)
        // 2. Query clients, patients, appointments, reminders, invoices
        // 3. Transform to canonical format
        // 4. Add to package builder

        warnings.push({
          code: 'NOT_IMPLEMENTED',
          message: 'Cornerstone database queries not implemented - scaffold only',
          details: {
            note: 'This adapter requires database driver integration',
            serverMode: profile.config.serverName ? 'SQL Server' : 'File-based',
          },
        });

        builder.endPhase('database_query');
      } else {
        // Export Drop mode - would delegate to ExportDrop adapter logic
        builder.startPhase('file_processing');

        warnings.push({
          code: 'EXPORT_DROP_MODE',
          message: 'Running in Export Drop mode',
        });

        builder.endPhase('file_processing');
      }

      // Build cursor
      const newCursor: SyncCursor = {
        lastSyncAt: new Date().toISOString(),
        entityCursors: {},
      };

      // Build package
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
    // Close any database connections
  }
}

/**
 * Factory function
 */
export function createAdapter(): IAdapter {
  return new CornerstoneAdapter();
}

export default { createAdapter };
