/**
 * Folder Watcher
 *
 * Watches a directory for new export files (Mode 3: Export Drop).
 */

import { watch as fsWatch, existsSync } from 'fs';
import { readdir, stat, rename, rm } from 'fs/promises';
import { join, basename, extname } from 'path';
import { EventEmitter } from 'events';
import { createLogger, type Logger } from '@de-connect/shared';

/**
 * Watcher configuration
 */
export interface WatcherConfig {
  /**
   * Directory to watch
   */
  watchDir: string;

  /**
   * File patterns to match (glob-like)
   */
  patterns: string[];

  /**
   * Directory to move processed files
   */
  processedDir: string;

  /**
   * Directory to move failed files
   */
  failedDir: string;

  /**
   * Minimum file age before processing (ms)
   */
  minFileAgeMs: number;

  /**
   * Polling interval (ms)
   */
  pollIntervalMs: number;

  /**
   * Logger instance
   */
  logger?: Logger;
}

/**
 * Detected file info
 */
export interface DetectedFile {
  path: string;
  name: string;
  size: number;
  modifiedAt: Date;
  matchedPattern: string;
}

/**
 * Watcher events
 */
export interface WatcherEvents {
  'file:detected': (file: DetectedFile) => void;
  'file:ready': (file: DetectedFile) => void;
  'file:processed': (file: DetectedFile, destinationPath: string) => void;
  'file:failed': (file: DetectedFile, error: Error) => void;
  'error': (error: Error) => void;
}

/**
 * Folder Watcher for Export Drop mode
 */
export class FolderWatcher extends EventEmitter {
  private logger: Logger;
  private pollTimer: NodeJS.Timeout | null = null;
  private processing: Set<string> = new Set();
  private isRunning = false;

  constructor(private config: WatcherConfig) {
    super();
    this.logger = config.logger ?? createLogger('FolderWatcher');
  }

  /**
   * Start watching the directory
   */
  start(): void {
    if (this.isRunning) return;

    if (!existsSync(this.config.watchDir)) {
      this.emit('error', new Error(`Watch directory does not exist: ${this.config.watchDir}`));
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting folder watcher', {
      watchDir: this.config.watchDir,
      patterns: this.config.patterns,
    });

    // Initial scan
    this.scan();

    // Start polling
    this.pollTimer = setInterval(() => {
      this.scan();
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.logger.info('Stopped folder watcher');
  }

  /**
   * Scan directory for matching files
   */
  private async scan(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const entries = await readdir(this.config.watchDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (this.processing.has(entry.name)) continue;

        const matchedPattern = this.matchesPattern(entry.name);
        if (!matchedPattern) continue;

        const filePath = join(this.config.watchDir, entry.name);
        const fileStat = await stat(filePath);
        const now = Date.now();
        const fileAge = now - fileStat.mtimeMs;

        const file: DetectedFile = {
          path: filePath,
          name: entry.name,
          size: fileStat.size,
          modifiedAt: new Date(fileStat.mtimeMs),
          matchedPattern,
        };

        this.emit('file:detected', file);

        // Check if file is old enough (to avoid partial uploads)
        if (fileAge < this.config.minFileAgeMs) {
          this.logger.debug('File too recent, waiting', {
            file: entry.name,
            ageMs: fileAge,
            minAgeMs: this.config.minFileAgeMs,
          });
          continue;
        }

        // File is ready for processing
        this.processing.add(entry.name);
        this.emit('file:ready', file);
      }
    } catch (error) {
      this.logger.error('Error scanning directory', error instanceof Error ? error : undefined);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Check if filename matches any pattern
   */
  private matchesPattern(filename: string): string | null {
    const lowerName = filename.toLowerCase();

    for (const pattern of this.config.patterns) {
      const lowerPattern = pattern.toLowerCase();

      // Simple glob matching
      if (lowerPattern.startsWith('*')) {
        const suffix = lowerPattern.slice(1);
        if (lowerName.endsWith(suffix)) return pattern;
      } else if (lowerPattern.endsWith('*')) {
        const prefix = lowerPattern.slice(0, -1);
        if (lowerName.startsWith(prefix)) return pattern;
      } else if (lowerPattern.includes('*')) {
        const [prefix, suffix] = lowerPattern.split('*');
        if (prefix && suffix && lowerName.startsWith(prefix) && lowerName.endsWith(suffix)) {
          return pattern;
        }
      } else if (lowerName === lowerPattern) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Mark file as processed (move to processed directory)
   */
  async markProcessed(file: DetectedFile): Promise<string> {
    const destPath = join(this.config.processedDir, file.name);

    try {
      // Ensure processed directory exists
      if (!existsSync(this.config.processedDir)) {
        const { mkdir } = await import('fs/promises');
        await mkdir(this.config.processedDir, { recursive: true });
      }

      await rename(file.path, destPath);
      this.processing.delete(file.name);

      this.logger.info('File processed', {
        file: file.name,
        destination: destPath,
      });

      this.emit('file:processed', file, destPath);
      return destPath;
    } catch (error) {
      this.processing.delete(file.name);
      throw error;
    }
  }

  /**
   * Mark file as failed (move to failed directory)
   */
  async markFailed(file: DetectedFile, error: Error): Promise<void> {
    try {
      // Ensure failed directory exists
      if (!existsSync(this.config.failedDir)) {
        const { mkdir } = await import('fs/promises');
        await mkdir(this.config.failedDir, { recursive: true });
      }

      const destPath = join(this.config.failedDir, file.name);
      await rename(file.path, destPath);
      this.processing.delete(file.name);

      this.logger.warn('File marked as failed', {
        file: file.name,
        error: error.message,
      });

      this.emit('file:failed', file, error);
    } catch (moveError) {
      this.processing.delete(file.name);
      this.logger.error('Failed to move file to failed directory',
        moveError instanceof Error ? moveError : undefined,
        { file: file.name }
      );
    }
  }

  /**
   * Release a file from processing (allows re-detection)
   */
  releaseFile(file: DetectedFile): void {
    this.processing.delete(file.name);
  }
}

/**
 * Helper to create watcher with default config
 */
export function createExportDropWatcher(
  watchDir: string,
  options: Partial<Omit<WatcherConfig, 'watchDir'>> = {}
): FolderWatcher {
  return new FolderWatcher({
    watchDir,
    patterns: options.patterns ?? [
      'clients*.csv',
      'patients*.csv',
      'appointments*.csv',
      'reminders*.csv',
      'invoices*.csv',
    ],
    processedDir: options.processedDir ?? join(watchDir, '_processed'),
    failedDir: options.failedDir ?? join(watchDir, '_failed'),
    minFileAgeMs: options.minFileAgeMs ?? 5000, // 5 seconds
    pollIntervalMs: options.pollIntervalMs ?? 10000, // 10 seconds
    logger: options.logger,
  });
}
