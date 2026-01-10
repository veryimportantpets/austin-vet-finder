/**
 * AVImark Adapter
 *
 * On-premise PIMS adapter for AVImark (Covetrus).
 * Uses CarsonDB library for database access.
 *
 * SCAFFOLD: This adapter requires the CarsonDB library and proper
 * AVImark database drivers to function. The database queries are
 * placeholders and need to be implemented based on the actual schema.
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

// Common AVImark installation paths
const AVIMARK_PATHS = [
  'C:\\AVImark',
  'C:\\Program Files\\AVImark',
  'C:\\Program Files (x86)\\AVImark',
  'D:\\AVImark',
];

// AVImark database file indicators
const AVIMARK_FILES = ['AVImark.exe', 'AVImark.mdb', 'AVImarkData'];

/**
 * Check if AVImark is installed at a path
 */
function checkAvimarkInstall(basePath: string): DetectionEvidence | null {
  if (!existsSync(basePath)) {
    return null;
  }

  try {
    const files = readdirSync(basePath);
    const hasExe = files.some(f => f.toLowerCase() === 'avimark.exe');
    const hasData = files.some(f =>
      f.toLowerCase().includes('avimark') &&
      (f.endsWith('.mdb') || f.endsWith('.accdb'))
    );

    if (hasExe || hasData) {
      return {
        type: 'file_path',
        description: `AVImark installation found at ${basePath}`,
        path: basePath,
        confidence: hasExe && hasData ? 0.95 : 0.7,
      };
    }
  } catch {
    // Permission denied or other error
  }

  return null;
}

/**
 * AVImark Adapter implementation
 */
class AvimarkAdapter implements IAdapter {
  private manifest: AdapterManifest = {
    adapterId: 'avimark-adapter',
    name: 'AVImark',
    version: '1.0.0',
    supportedKinds: [PimsKind.AVImark],
    requiresX86: true, // AVImark uses 32-bit database drivers
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
    description: 'AVImark on-premise PIMS adapter. Uses CarsonDB for database access.',
    author: 'DE Connect',
  };

  getManifest(): AdapterManifest {
    return this.manifest;
  }

  async detectAsync(): Promise<DetectedSystem[]> {
    const systems: DetectedSystem[] = [];
    const evidence: DetectionEvidence[] = [];

    // Check common installation paths
    for (const path of AVIMARK_PATHS) {
      const result = checkAvimarkInstall(path);
      if (result) {
        evidence.push(result);
      }
    }

    // Check for running AVImark process (Windows only)
    // TODO: Use process listing on Windows

    // Check for network shares that might contain AVImark data
    // TODO: Check mapped network drives

    if (evidence.length > 0) {
      // Calculate aggregate confidence
      const maxConfidence = Math.max(...evidence.map(e => e.confidence));

      systems.push({
        kind: PimsKind.AVImark,
        displayName: 'AVImark',
        confidence: maxConfidence,
        evidence,
        acquisitionModes: [AcquisitionMode.Direct, AcquisitionMode.ExportDrop],
        recommendedMode: AcquisitionMode.Direct,
        connectionHints: {
          dataPath: evidence[0]?.path,
          notes: [
            'AVImark installation detected.',
            'Direct database access requires CarsonDB library.',
            'If direct access fails, Export Drop mode is available as fallback.',
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

    // Check data path
    if (!dataPath) {
      results.push({
        step: ValidationStep.Connection,
        status: 'error',
        message: 'AVImark data path not configured',
        canProceed: false,
        suggestedFix: 'Set the dataPath in the connection profile',
      });
      return results;
    }

    if (!existsSync(dataPath)) {
      results.push({
        step: ValidationStep.Connection,
        status: 'error',
        message: `Data path does not exist: ${dataPath}`,
        canProceed: false,
        suggestedFix: 'Check the AVImark installation path',
      });
      return results;
    }

    results.push({
      step: ValidationStep.Connection,
      status: 'success',
      message: 'AVImark data path found',
      canProceed: true,
    });

    // Check for database files
    try {
      const files = readdirSync(dataPath);
      const hasDatabase = files.some(f =>
        f.toLowerCase().includes('avimark') &&
        (f.endsWith('.mdb') || f.endsWith('.accdb'))
      );

      if (hasDatabase) {
        results.push({
          step: ValidationStep.DataAccess,
          status: 'success',
          message: 'AVImark database files found',
          canProceed: true,
        });
      } else {
        results.push({
          step: ValidationStep.DataAccess,
          status: 'warning',
          message: 'AVImark database files not found in data path',
          canProceed: true,
          suggestedFix: 'The database may be in a subdirectory',
        });
      }
    } catch (error) {
      results.push({
        step: ValidationStep.DataAccess,
        status: 'error',
        message: `Cannot read data directory: ${error instanceof Error ? error.message : String(error)}`,
        canProceed: false,
      });
    }

    // TODO: Test actual database connection using CarsonDB
    results.push({
      step: ValidationStep.Permissions,
      status: 'warning',
      message: 'Database connection test not implemented - CarsonDB library required',
      canProceed: true,
      details: {
        note: 'Full implementation requires CarsonDB integration',
      },
    });

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
      sourceSystem: 'avimark',
      adapterVersion: this.manifest.version,
      syncType: request.syncType as SyncType,
      outputDir: request.outputDir,
    });

    await builder.init();

    try {
      builder.startPhase('database_query');

      // SCAFFOLD: This is where CarsonDB queries would be executed
      // The actual implementation would:
      // 1. Connect to the AVImark database using CarsonDB
      // 2. Query clients, patients, appointments, reminders, invoices
      // 3. Transform to canonical format
      // 4. Add to package builder

      warnings.push({
        code: 'NOT_IMPLEMENTED',
        message: 'AVImark database queries not implemented - scaffold only',
        details: {
          requiredLibrary: 'CarsonDB',
          note: 'This adapter requires the CarsonDB library for database access',
        },
      });

      // Emit zero records for now
      builder.endPhase('database_query');

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
  return new AvimarkAdapter();
}

export default { createAdapter };
