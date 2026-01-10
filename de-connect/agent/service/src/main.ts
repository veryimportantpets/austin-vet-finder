#!/usr/bin/env node
/**
 * DE Connect Sync Service Entry Point
 */

import { createLogger } from '@de-connect/shared';
import { SyncService } from './service.js';

const logger = createLogger('de-service', 'info');

async function main(): Promise<void> {
  const service = new SyncService();

  // Handle shutdown signals
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down...`);
    await service.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason instanceof Error ? reason : undefined);
    process.exit(1);
  });

  try {
    await service.start();
    logger.info('Service is running. Press Ctrl+C to stop.');

    // Keep the process running
    await new Promise(() => {});
  } catch (error) {
    logger.error('Failed to start service', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

main();
