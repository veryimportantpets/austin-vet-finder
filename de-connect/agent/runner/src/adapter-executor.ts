/**
 * Adapter Executor
 *
 * Executes adapter operations with proper error handling,
 * timeout management, and result packaging.
 */

import type {
  IAdapter,
  ConnectionProfile,
  SyncRequest,
  SyncResult,
  DetectedSystem,
  ValidationResult,
  SyncError,
  SyncErrorCode,
  SuggestedAction,
  EntityCounts,
  SyncStats,
  SyncWarning,
} from '@de-connect/contracts';
import { createLogger, type Logger } from '@de-connect/shared';
import { PackageBuilder } from './package-builder.js';

/**
 * Executor configuration
 */
export interface ExecutorConfig {
  /**
   * Default timeout for operations (ms)
   */
  defaultTimeoutMs: number;

  /**
   * Output directory for sync packages
   */
  outputDir: string;

  /**
   * Logger instance
   */
  logger?: Logger;
}

/**
 * Execution context for an operation
 */
export interface ExecutionContext {
  /**
   * Request ID for tracking
   */
  requestId: string;

  /**
   * Abort signal for cancellation
   */
  signal?: AbortSignal;

  /**
   * Operation timeout (ms)
   */
  timeoutMs?: number;
}

/**
 * Adapter Executor - runs adapter operations safely
 */
export class AdapterExecutor {
  private logger: Logger;

  constructor(private config: ExecutorConfig) {
    this.logger = config.logger ?? createLogger('AdapterExecutor');
  }

  /**
   * Run detection with timeout and error handling
   */
  async detect(
    adapter: IAdapter,
    ctx: ExecutionContext
  ): Promise<DetectedSystem[]> {
    const timeoutMs = ctx.timeoutMs ?? this.config.defaultTimeoutMs;

    this.logger.info('Starting detection', {
      requestId: ctx.requestId,
      adapterId: adapter.getManifest().adapterId,
    });

    try {
      const result = await this.withTimeout(
        adapter.detectAsync(ctx.signal),
        timeoutMs,
        'Detection'
      );

      this.logger.info('Detection completed', {
        requestId: ctx.requestId,
        systemsFound: result.length,
      });

      return result;
    } catch (error) {
      this.logger.error('Detection failed', error instanceof Error ? error : undefined, {
        requestId: ctx.requestId,
      });
      throw error;
    }
  }

  /**
   * Run validation with timeout and error handling
   */
  async validate(
    adapter: IAdapter,
    profile: ConnectionProfile,
    secrets: Record<string, string>,
    ctx: ExecutionContext
  ): Promise<ValidationResult[]> {
    const timeoutMs = ctx.timeoutMs ?? this.config.defaultTimeoutMs;

    this.logger.info('Starting validation', {
      requestId: ctx.requestId,
      adapterId: adapter.getManifest().adapterId,
      profileId: profile.profileId,
    });

    try {
      const result = await this.withTimeout(
        adapter.validateAsync(profile, secrets, ctx.signal),
        timeoutMs,
        'Validation'
      );

      const hasErrors = result.some(r => r.status === 'error' && !r.canProceed);

      this.logger.info('Validation completed', {
        requestId: ctx.requestId,
        stepCount: result.length,
        hasErrors,
      });

      return result;
    } catch (error) {
      this.logger.error('Validation failed', error instanceof Error ? error : undefined, {
        requestId: ctx.requestId,
      });
      throw error;
    }
  }

  /**
   * Run sync with timeout, error handling, and package building
   */
  async runSync(
    adapter: IAdapter,
    profile: ConnectionProfile,
    secrets: Record<string, string>,
    request: SyncRequest,
    ctx: ExecutionContext
  ): Promise<SyncResult> {
    const timeoutMs = ctx.timeoutMs ?? this.config.defaultTimeoutMs * 5; // Sync gets more time
    const startTime = Date.now();

    this.logger.info('Starting sync', {
      requestId: ctx.requestId,
      adapterId: adapter.getManifest().adapterId,
      profileId: profile.profileId,
      syncType: request.syncType,
    });

    try {
      const result = await this.withTimeout(
        adapter.runSyncAsync(profile, secrets, request, ctx.signal),
        timeoutMs,
        'Sync'
      );

      const durationMs = Date.now() - startTime;

      this.logger.info('Sync completed', {
        requestId: ctx.requestId,
        success: result.success,
        recordCount: result.stats.recordsProcessed,
        durationMs,
      });

      return {
        ...result,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const syncError = this.toSyncError(error);

      this.logger.error('Sync failed', error instanceof Error ? error : undefined, {
        requestId: ctx.requestId,
        errorCode: syncError.code,
      });

      return {
        success: false,
        requestId: ctx.requestId,
        counts: createEmptyCounts(),
        durationMs,
        warnings: [],
        error: syncError,
        stats: createEmptyStats(startTime, Date.now()),
      };
    }
  }

  /**
   * Wrap a promise with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Convert any error to SyncError
   */
  private toSyncError(error: unknown): SyncError {
    const err = error instanceof Error ? error : new Error(String(error));

    // Detect error type from message
    const message = err.message.toLowerCase();

    if (message.includes('timeout')) {
      return {
        code: SyncErrorCode.Timeout,
        message: err.message,
        retryable: true,
        suggestedAction: SuggestedAction.Retry,
      };
    }

    if (message.includes('auth') || message.includes('login') || message.includes('credential')) {
      return {
        code: SyncErrorCode.AuthenticationFailed,
        message: err.message,
        retryable: false,
        suggestedAction: SuggestedAction.Reconnect,
      };
    }

    if (message.includes('session') || message.includes('expired')) {
      return {
        code: SyncErrorCode.SessionExpired,
        message: err.message,
        retryable: false,
        suggestedAction: SuggestedAction.Reconnect,
      };
    }

    if (message.includes('mfa') || message.includes('two-factor') || message.includes('2fa')) {
      return {
        code: SyncErrorCode.MfaRequired,
        message: err.message,
        retryable: false,
        suggestedAction: SuggestedAction.Reconnect,
      };
    }

    if (message.includes('connection') || message.includes('network')) {
      return {
        code: SyncErrorCode.ConnectionFailed,
        message: err.message,
        retryable: true,
        suggestedAction: SuggestedAction.Retry,
      };
    }

    if (message.includes('permission') || message.includes('access denied')) {
      return {
        code: SyncErrorCode.DataAccessDenied,
        message: err.message,
        retryable: false,
        suggestedAction: SuggestedAction.Reconnect,
      };
    }

    if (message.includes('browser') || message.includes('playwright')) {
      return {
        code: SyncErrorCode.BrowserCrashed,
        message: err.message,
        retryable: true,
        suggestedAction: SuggestedAction.Retry,
      };
    }

    if (message.includes('selector') || message.includes('element')) {
      return {
        code: SyncErrorCode.SelectorNotFound,
        message: err.message,
        retryable: false,
        suggestedAction: SuggestedAction.UpdateAdapter,
      };
    }

    return {
      code: SyncErrorCode.Unknown,
      message: err.message,
      retryable: true,
      suggestedAction: SuggestedAction.Retry,
      details: {
        stack: err.stack,
      },
    };
  }
}

function createEmptyCounts(): EntityCounts {
  return {
    clients: 0,
    patients: 0,
    appointments: 0,
    reminders: 0,
    invoices: 0,
    invoiceLineItems: 0,
  };
}

function createEmptyStats(startTime: number, endTime: number): SyncStats {
  return {
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date(endTime).toISOString(),
    recordsProcessed: 0,
    recordsSkipped: 0,
    bytesWritten: 0,
    phases: {},
  };
}
