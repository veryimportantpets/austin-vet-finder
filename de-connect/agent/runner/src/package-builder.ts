/**
 * Package Builder
 *
 * Creates sync packages (ZIP files with NDJSON entities and manifest).
 */

import { createWriteStream, existsSync } from 'fs';
import { mkdir, rm, readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import archiver from 'archiver';
import type {
  SyncManifest,
  SyncManifestFile,
  EntityCounts,
  SyncStats,
  SyncType,
  SyncCursor,
} from '@de-connect/contracts';
import { EntityType, ENTITY_FILENAMES, MANIFEST_SCHEMA_VERSION } from '@de-connect/contracts';
import { sha256File, writeNdjsonFile, createLogger, type Logger } from '@de-connect/shared';

/**
 * Package builder configuration
 */
export interface PackageBuilderConfig {
  /**
   * Practice identifier
   */
  practiceId: string;

  /**
   * Agent identifier
   */
  agentId: string;

  /**
   * Source system name
   */
  sourceSystem: string;

  /**
   * Adapter version
   */
  adapterVersion: string;

  /**
   * Sync type
   */
  syncType: SyncType;

  /**
   * Output directory
   */
  outputDir: string;

  /**
   * Logger instance
   */
  logger?: Logger;
}

/**
 * Entity writer for streaming entities to NDJSON files
 */
export interface EntityWriter {
  /**
   * Write a single entity
   */
  write(entity: unknown): Promise<void>;

  /**
   * Flush and get count
   */
  close(): Promise<{ count: number; bytesWritten: number }>;
}

/**
 * Package Builder - creates sync packages
 */
export class PackageBuilder {
  private logger: Logger;
  private tempDir: string;
  private entities: Map<EntityType, unknown[]> = new Map();
  private startTime: Date;
  private phases: Map<string, number> = new Map();

  constructor(private config: PackageBuilderConfig) {
    this.logger = config.logger ?? createLogger('PackageBuilder');
    this.tempDir = join(config.outputDir, `temp_${Date.now()}`);
    this.startTime = new Date();
  }

  /**
   * Initialize the builder (creates temp directory)
   */
  async init(): Promise<void> {
    if (!existsSync(this.config.outputDir)) {
      await mkdir(this.config.outputDir, { recursive: true });
    }
    await mkdir(this.tempDir, { recursive: true });

    this.logger.debug('Initialized package builder', { tempDir: this.tempDir });
  }

  /**
   * Start timing a phase
   */
  startPhase(phaseName: string): void {
    this.phases.set(phaseName, Date.now());
  }

  /**
   * End timing a phase
   */
  endPhase(phaseName: string): number {
    const start = this.phases.get(phaseName);
    if (start) {
      const duration = Date.now() - start;
      this.phases.set(phaseName, duration);
      return duration;
    }
    return 0;
  }

  /**
   * Add an entity to the package
   */
  addEntity(entityType: EntityType, entity: unknown): void {
    let list = this.entities.get(entityType);
    if (!list) {
      list = [];
      this.entities.set(entityType, list);
    }
    list.push(entity);
  }

  /**
   * Add multiple entities
   */
  addEntities(entityType: EntityType, entities: unknown[]): void {
    for (const entity of entities) {
      this.addEntity(entityType, entity);
    }
  }

  /**
   * Build and finalize the package
   */
  async build(cursor?: SyncCursor): Promise<{
    packagePath: string;
    manifest: SyncManifest;
  }> {
    this.startPhase('write_files');

    // Write NDJSON files
    const files: SyncManifestFile[] = [];
    const counts: EntityCounts = {
      clients: 0,
      patients: 0,
      appointments: 0,
      reminders: 0,
      invoices: 0,
      invoiceLineItems: 0,
    };

    let totalBytes = 0;
    let totalRecords = 0;

    for (const [entityType, entities] of this.entities) {
      if (entities.length === 0) continue;

      const filename = ENTITY_FILENAMES[entityType];
      const filePath = join(this.tempDir, filename);

      const { count, bytesWritten } = await writeNdjsonFile(filePath, entities);
      const sha256 = await sha256File(filePath);
      const fileStat = await stat(filePath);

      files.push({
        filename,
        entityType,
        sha256,
        sizeBytes: fileStat.size,
        recordCount: count,
      });

      // Update counts
      switch (entityType) {
        case EntityType.Client:
          counts.clients = count;
          break;
        case EntityType.Patient:
          counts.patients = count;
          break;
        case EntityType.Appointment:
          counts.appointments = count;
          break;
        case EntityType.Reminder:
          counts.reminders = count;
          break;
        case EntityType.Invoice:
          counts.invoices = count;
          break;
        case EntityType.InvoiceLineItem:
          counts.invoiceLineItems = count;
          break;
      }

      totalBytes += bytesWritten;
      totalRecords += count;

      this.logger.debug('Wrote entity file', {
        entityType,
        count,
        bytesWritten,
      });
    }

    this.endPhase('write_files');

    // Build stats
    const completedAt = new Date();
    const stats: SyncStats = {
      startedAt: this.startTime.toISOString(),
      completedAt: completedAt.toISOString(),
      recordsProcessed: totalRecords,
      recordsSkipped: 0,
      bytesWritten: totalBytes,
      phases: Object.fromEntries(this.phases),
    };

    // Build manifest
    const manifest: SyncManifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      practiceId: this.config.practiceId,
      agentId: this.config.agentId,
      sourceSystem: this.config.sourceSystem,
      adapterVersion: this.config.adapterVersion,
      syncType: this.config.syncType,
      createdAt: completedAt.toISOString(),
      cursor,
      files,
      counts,
      stats,
    };

    // Write manifest
    const manifestPath = join(this.tempDir, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    this.startPhase('create_zip');

    // Create ZIP
    const timestamp = completedAt.toISOString().replace(/[:.]/g, '-');
    const zipFilename = `sync_${timestamp}.zip`;
    const packagePath = join(this.config.outputDir, zipFilename);

    await this.createZip(this.tempDir, packagePath);

    this.endPhase('create_zip');

    // Cleanup temp directory
    await rm(this.tempDir, { recursive: true, force: true });

    this.logger.info('Built sync package', {
      packagePath,
      totalRecords,
      totalBytes,
      fileCount: files.length,
    });

    return { packagePath, manifest };
  }

  /**
   * Create ZIP archive from directory
   */
  private async createZip(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  /**
   * Cleanup without building (for error cases)
   */
  async cleanup(): Promise<void> {
    if (existsSync(this.tempDir)) {
      await rm(this.tempDir, { recursive: true, force: true });
    }
  }
}
