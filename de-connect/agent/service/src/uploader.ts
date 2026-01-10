/**
 * Package Uploader
 *
 * Handles uploading sync packages to the cloud with retry logic.
 */

import { createReadStream, existsSync, statSync } from 'fs';
import { rename, mkdir } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { createLogger, withRetry, type Logger } from '@de-connect/shared';

/**
 * Uploader configuration
 */
export interface UploaderConfig {
  /**
   * Cloud API base URL
   */
  apiBaseUrl: string;

  /**
   * Agent ID for authentication
   */
  agentId: string;

  /**
   * Auth token
   */
  authToken: string;

  /**
   * Directory for uploaded packages (archive)
   */
  archiveDir: string;

  /**
   * Directory for failed uploads
   */
  failedDir: string;

  /**
   * Max upload retries
   */
  maxRetries: number;

  /**
   * Logger instance
   */
  logger?: Logger;
}

/**
 * Upload result
 */
export interface UploadResult {
  success: boolean;
  packagePath: string;
  syncId?: string;
  error?: string;
  retries: number;
  durationMs: number;
}

/**
 * Package Uploader
 */
export class PackageUploader {
  private logger: Logger;

  constructor(private config: UploaderConfig) {
    this.logger = config.logger ?? createLogger('PackageUploader');
  }

  /**
   * Upload a sync package
   */
  async upload(packagePath: string): Promise<UploadResult> {
    const startTime = Date.now();
    let retries = 0;

    this.logger.info('Starting upload', {
      packagePath,
      fileName: basename(packagePath),
    });

    if (!existsSync(packagePath)) {
      return {
        success: false,
        packagePath,
        error: 'Package file not found',
        retries: 0,
        durationMs: Date.now() - startTime,
      };
    }

    const fileSize = statSync(packagePath).size;

    try {
      const syncId = await withRetry(
        async () => {
          retries++;
          return this.uploadFile(packagePath, fileSize);
        },
        {
          maxAttempts: this.config.maxRetries,
          initialDelayMs: 2000,
          maxDelayMs: 16000,
          onRetry: (attempt, error, delayMs) => {
            this.logger.warn('Upload retry', {
              attempt,
              error: error.message,
              delayMs,
            });
          },
        }
      );

      // Move to archive
      const archivedPath = await this.archivePackage(packagePath);

      this.logger.info('Upload completed', {
        syncId,
        archivedPath,
        retries,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        packagePath: archivedPath,
        syncId,
        retries,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Move to failed directory
      const failedPath = await this.moveToFailed(packagePath);

      this.logger.error('Upload failed', error instanceof Error ? error : undefined, {
        failedPath,
        retries,
      });

      return {
        success: false,
        packagePath: failedPath,
        error: errorMessage,
        retries,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Upload file to cloud API
   */
  private async uploadFile(filePath: string, fileSize: number): Promise<string> {
    const url = `${this.config.apiBaseUrl}/sync`;
    const fileName = basename(filePath);

    // Read file as buffer (for simplicity; in production, use streams)
    const { readFile } = await import('fs/promises');
    const fileBuffer = await readFile(filePath);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.authToken}`,
        'X-Agent-Id': this.config.agentId,
        'Content-Type': 'application/zip',
        'Content-Length': fileSize.toString(),
        'X-Filename': fileName,
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const result = await response.json() as { syncId: string };
    return result.syncId;
  }

  /**
   * Archive a successfully uploaded package
   */
  private async archivePackage(packagePath: string): Promise<string> {
    if (!existsSync(this.config.archiveDir)) {
      await mkdir(this.config.archiveDir, { recursive: true });
    }

    const fileName = basename(packagePath);
    const destPath = join(this.config.archiveDir, fileName);

    await rename(packagePath, destPath);
    return destPath;
  }

  /**
   * Move failed package to failed directory
   */
  private async moveToFailed(packagePath: string): Promise<string> {
    if (!existsSync(this.config.failedDir)) {
      await mkdir(this.config.failedDir, { recursive: true });
    }

    const fileName = basename(packagePath);
    const destPath = join(this.config.failedDir, fileName);

    await rename(packagePath, destPath);
    return destPath;
  }

  /**
   * Retry uploading failed packages
   */
  async retryFailed(): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    if (!existsSync(this.config.failedDir)) {
      return results;
    }

    const { readdir } = await import('fs/promises');
    const files = await readdir(this.config.failedDir);

    for (const file of files) {
      if (!file.endsWith('.zip')) continue;

      const filePath = join(this.config.failedDir, file);
      const result = await this.upload(filePath);
      results.push(result);
    }

    return results;
  }

  /**
   * Get pending uploads (packages waiting to be uploaded)
   */
  async getPendingUploads(packagesDir: string): Promise<string[]> {
    if (!existsSync(packagesDir)) {
      return [];
    }

    const { readdir } = await import('fs/promises');
    const files = await readdir(packagesDir);

    return files
      .filter(f => f.endsWith('.zip') && f.startsWith('sync_'))
      .map(f => join(packagesDir, f));
  }
}
