/**
 * Sync Package Processor
 *
 * Extracts and validates sync packages, then hands off to ingestor.
 */

import { existsSync, createReadStream } from 'fs';
import { readFile, rm, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { createInterface } from 'readline';
import extract from 'extract-zip';
import Database from 'better-sqlite3';
import { createLogger, sha256File, type Logger } from '@de-connect/shared';
import type { SyncManifest, SyncManifestFile } from '@de-connect/contracts';
import { EntityType } from '@de-connect/contracts';
import { ingestEntities } from './ingestor.js';

/**
 * Processor configuration
 */
export interface ProcessorConfig {
  /**
   * Database connection
   */
  db: Database.Database;

  /**
   * Temp directory for extraction
   */
  tempDir: string;

  /**
   * Logger
   */
  logger?: Logger;
}

/**
 * Processing result
 */
export interface ProcessingResult {
  success: boolean;
  packageId: string;
  counts: Record<string, number>;
  errors: string[];
  durationMs: number;
}

/**
 * Process a sync package
 */
export async function processSyncPackage(
  packageId: string,
  packagePath: string,
  config: ProcessorConfig
): Promise<ProcessingResult> {
  const logger = config.logger ?? createLogger('Processor');
  const startTime = Date.now();
  const errors: string[] = [];
  const counts: Record<string, number> = {};

  const extractDir = join(config.tempDir, packageId);

  try {
    // Update status to processing
    config.db.prepare(
      "UPDATE sync_packages SET status = 'processing' WHERE id = ?"
    ).run(packageId);

    logger.info('Processing sync package', { packageId, packagePath });

    // Verify file exists
    if (!existsSync(packagePath)) {
      throw new Error(`Package file not found: ${packagePath}`);
    }

    // Create extraction directory
    if (!existsSync(extractDir)) {
      await mkdir(extractDir, { recursive: true });
    }

    // Extract package
    logger.debug('Extracting package', { extractDir });
    await extract(packagePath, { dir: extractDir });

    // Read and validate manifest
    const manifestPath = join(extractDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error('Manifest not found in package');
    }

    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent) as SyncManifest;

    logger.debug('Manifest loaded', {
      practiceId: manifest.practiceId,
      sourceSystem: manifest.sourceSystem,
      fileCount: manifest.files.length,
    });

    // Validate file hashes
    for (const file of manifest.files) {
      const filePath = join(extractDir, file.filename);

      if (!existsSync(filePath)) {
        errors.push(`Missing file: ${file.filename}`);
        continue;
      }

      const actualHash = await sha256File(filePath);
      if (actualHash.toLowerCase() !== file.sha256.toLowerCase()) {
        errors.push(`Hash mismatch for ${file.filename}`);
        continue;
      }
    }

    if (errors.length > 0) {
      throw new Error(`Package validation failed: ${errors.join(', ')}`);
    }

    // Process each entity file
    for (const file of manifest.files) {
      const filePath = join(extractDir, file.filename);

      try {
        const count = await ingestEntities(
          config.db,
          manifest.practiceId,
          manifest.sourceSystem,
          file.entityType,
          filePath,
          logger
        );

        counts[file.entityType] = count;
        logger.debug('Ingested entities', {
          entityType: file.entityType,
          count,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to ingest ${file.entityType}: ${msg}`);
        logger.error('Ingestion error', error instanceof Error ? error : undefined, {
          entityType: file.entityType,
        });
      }
    }

    // Update package status
    if (errors.length === 0) {
      config.db.prepare(`
        UPDATE sync_packages
        SET status = 'completed', manifest = ?, processed_at = datetime('now')
        WHERE id = ?
      `).run(manifestContent, packageId);
    } else {
      config.db.prepare(`
        UPDATE sync_packages
        SET status = 'failed', error_message = ?, processed_at = datetime('now')
        WHERE id = ?
      `).run(errors.join('; '), packageId);
    }

    const durationMs = Date.now() - startTime;

    logger.info('Package processed', {
      packageId,
      success: errors.length === 0,
      counts,
      durationMs,
    });

    return {
      success: errors.length === 0,
      packageId,
      counts,
      errors,
      durationMs,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(msg);

    // Update status to failed
    config.db.prepare(`
      UPDATE sync_packages
      SET status = 'failed', error_message = ?, processed_at = datetime('now')
      WHERE id = ?
    `).run(msg, packageId);

    logger.error('Package processing failed', error instanceof Error ? error : undefined, {
      packageId,
    });

    return {
      success: false,
      packageId,
      counts,
      errors,
      durationMs: Date.now() - startTime,
    };
  } finally {
    // Cleanup extraction directory
    if (existsSync(extractDir)) {
      await rm(extractDir, { recursive: true, force: true });
    }
  }
}

/**
 * Get pending packages from database
 */
export function getPendingPackages(db: Database.Database): Array<{
  id: string;
  file_path: string;
  practice_id: string;
}> {
  return db.prepare(`
    SELECT id, file_path, practice_id
    FROM sync_packages
    WHERE status = 'pending'
    ORDER BY created_at ASC
  `).all() as Array<{ id: string; file_path: string; practice_id: string }>;
}
