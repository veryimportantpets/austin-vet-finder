#!/usr/bin/env node
/**
 * DE Connect Ingestion Worker
 *
 * Polls for pending sync packages and processes them.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createLogger } from '@de-connect/shared';
import { processSyncPackage, getPendingPackages } from './processor.js';

const logger = createLogger('Worker', 'info');

// Configuration
const DATA_DIR = process.env.DATA_DIR ?? './data';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL ?? '5000', 10);
const TEMP_DIR = join(DATA_DIR, 'temp');

async function main(): Promise<void> {
  logger.info('Starting ingestion worker');

  // Ensure directories exist
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Connect to database
  const dbPath = join(DATA_DIR, 'de-connect.db');
  const db = new Database(dbPath);

  logger.info('Connected to database', { dbPath });

  // Processing state
  let isProcessing = false;
  let shouldStop = false;

  // Poll for pending packages
  const poll = async (): Promise<void> => {
    if (isProcessing || shouldStop) return;

    try {
      const pending = getPendingPackages(db);

      if (pending.length === 0) {
        return;
      }

      logger.info(`Found ${pending.length} pending package(s)`);

      isProcessing = true;

      for (const pkg of pending) {
        if (shouldStop) break;

        const result = await processSyncPackage(pkg.id, pkg.file_path, {
          db,
          tempDir: TEMP_DIR,
          logger: logger.child('processor'),
        });

        if (result.success) {
          logger.info('Package processed successfully', {
            packageId: pkg.id,
            counts: result.counts,
            durationMs: result.durationMs,
          });
        } else {
          logger.error('Package processing failed', undefined, {
            packageId: pkg.id,
            errors: result.errors,
          });
        }
      }
    } catch (error) {
      logger.error('Poll error', error instanceof Error ? error : undefined);
    } finally {
      isProcessing = false;
    }
  };

  // Start polling
  const pollTimer = setInterval(poll, POLL_INTERVAL_MS);

  // Initial poll
  await poll();

  logger.info(`Worker running, polling every ${POLL_INTERVAL_MS}ms`);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    shouldStop = true;
    clearInterval(pollTimer);

    // Wait for current processing to complete
    while (isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    db.close();
    logger.info('Worker stopped');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep process running
  await new Promise(() => {});
}

main().catch(error => {
  logger.error('Fatal error', error instanceof Error ? error : undefined);
  process.exit(1);
});
