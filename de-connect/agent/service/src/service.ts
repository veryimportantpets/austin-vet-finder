/**
 * Main Sync Service
 *
 * Orchestrates all components: scheduling, syncing, uploading, and health monitoring.
 */

import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createLogger, generateMachineFingerprint, type Logger } from '@de-connect/shared';
import { AdapterRegistry, AdapterExecutor, PackageBuilder } from '@de-connect/runner';
import type {
  ConnectionProfile,
  SyncRequest,
  SyncType,
  SyncResult,
  LastSyncInfo,
} from '@de-connect/contracts';
import {
  loadConfig,
  saveConfig,
  updateConfig,
  readActivationToken,
  getDataDir,
  type ServiceConfig,
} from './config.js';
import { SecretsManager } from './secrets.js';
import { SyncScheduler, type JobContext } from './scheduler.js';
import { PackageUploader } from './uploader.js';
import { HealthMonitor } from './health.js';

/**
 * Service state
 */
export enum ServiceState {
  Stopped = 'stopped',
  Starting = 'starting',
  Running = 'running',
  Stopping = 'stopping',
  Error = 'error',
}

/**
 * Main Sync Service
 */
export class SyncService {
  private logger: Logger;
  private config!: ServiceConfig;
  private state: ServiceState = ServiceState.Stopped;

  // Components
  private registry!: AdapterRegistry;
  private executor!: AdapterExecutor;
  private secrets!: SecretsManager;
  private scheduler!: SyncScheduler;
  private uploader!: PackageUploader;
  private health!: HealthMonitor;

  // State
  private authToken: string | null = null;
  private lastSyncCursor: Record<string, unknown> | null = null;

  constructor() {
    this.logger = createLogger('SyncService', 'info');
  }

  /**
   * Initialize and start the service
   */
  async start(): Promise<void> {
    if (this.state !== ServiceState.Stopped) {
      throw new Error(`Cannot start service in state: ${this.state}`);
    }

    this.state = ServiceState.Starting;
    this.logger.info('Starting sync service...');

    try {
      // Load configuration
      this.config = await loadConfig();

      // Ensure directories exist
      await this.ensureDirectories();

      // Initialize components
      await this.initializeComponents();

      // Register with cloud if needed
      if (!this.config.agentId) {
        await this.register();
      } else {
        // Use stored credentials
        this.authToken = await this.loadAuthToken();
      }

      // Start components
      this.scheduler.start();
      this.health.start();

      this.state = ServiceState.Running;
      this.logger.info('Sync service started', {
        agentId: this.config.agentId,
        practiceId: this.config.practiceId,
      });
    } catch (error) {
      this.state = ServiceState.Error;
      this.logger.error('Failed to start service', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    if (this.state !== ServiceState.Running) {
      return;
    }

    this.state = ServiceState.Stopping;
    this.logger.info('Stopping sync service...');

    // Stop scheduler and wait for jobs
    this.scheduler.stop();
    await this.scheduler.waitForCompletion(30000);

    // Stop health monitor
    this.health.stop();

    // Unload adapters
    await this.registry.unloadAll();

    this.state = ServiceState.Stopped;
    this.logger.info('Sync service stopped');
  }

  /**
   * Get current service state
   */
  getState(): ServiceState {
    return this.state;
  }

  /**
   * Trigger a sync immediately
   */
  async triggerSync(syncType: SyncType = 'incremental'): Promise<SyncResult | null> {
    if (this.state !== ServiceState.Running) {
      throw new Error('Service is not running');
    }

    const profile = this.getActiveProfile();
    if (!profile) {
      this.logger.warn('No active profile configured');
      return null;
    }

    return this.runSync(profile, syncType);
  }

  /**
   * Initialize all components
   */
  private async initializeComponents(): Promise<void> {
    // Adapter registry
    this.registry = new AdapterRegistry({
      adaptersDir: this.config.adaptersDir,
      agentVersion: '1.0.0',
      logger: this.logger.child('registry'),
    });

    // Adapter executor
    this.executor = new AdapterExecutor({
      defaultTimeoutMs: 60000,
      outputDir: this.config.outputDir,
      logger: this.logger.child('executor'),
    });

    // Secrets manager
    this.secrets = new SecretsManager();
    await this.secrets.init();

    // Scheduler
    this.scheduler = new SyncScheduler({
      syncSchedule: this.config.syncSchedule,
      logger: this.logger.child('scheduler'),
    });

    // Add sync job
    this.scheduler.addJob(
      'nightly-sync',
      'Nightly Data Sync',
      this.config.syncSchedule,
      async (ctx: JobContext) => {
        await this.handleScheduledSync(ctx);
      }
    );

    // Note: Uploader and Health monitor will be initialized after registration
  }

  /**
   * Register with cloud
   */
  private async register(): Promise<void> {
    const token = await readActivationToken();

    if (!token) {
      throw new Error(
        'No activation token found. Please run the setup wizard first.'
      );
    }

    const fingerprint = await generateMachineFingerprint();

    this.logger.info('Registering with cloud...');

    const response = await fetch(`${this.config.apiBaseUrl}/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activationToken: token,
        machineFingerprint: fingerprint,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Registration failed: ${response.status} - ${text}`);
    }

    const result = await response.json() as {
      agentId: string;
      practiceId: string;
      authToken: string;
    };

    // Update config
    await updateConfig({
      agentId: result.agentId,
      practiceId: result.practiceId,
    });

    this.config.agentId = result.agentId;
    this.config.practiceId = result.practiceId;
    this.authToken = result.authToken;

    // Store auth token securely
    await this.secrets.storeSecrets('auth', {
      accessToken: result.authToken,
    });

    // Initialize uploader and health monitor now that we have credentials
    this.initializeAuthenticatedComponents();

    this.logger.info('Registration successful', {
      agentId: result.agentId,
      practiceId: result.practiceId,
    });
  }

  /**
   * Load stored auth token
   */
  private async loadAuthToken(): Promise<string | null> {
    const secrets = await this.secrets.getSecrets('auth.enc');
    return secrets?.accessToken ?? null;
  }

  /**
   * Initialize components that require authentication
   */
  private initializeAuthenticatedComponents(): void {
    if (!this.config.agentId || !this.config.practiceId || !this.authToken) {
      throw new Error('Missing authentication credentials');
    }

    // Package uploader
    this.uploader = new PackageUploader({
      apiBaseUrl: this.config.apiBaseUrl,
      agentId: this.config.agentId,
      authToken: this.authToken,
      archiveDir: join(getDataDir(), 'archive'),
      failedDir: join(getDataDir(), 'failed'),
      maxRetries: this.config.maxUploadRetries,
      logger: this.logger.child('uploader'),
    });

    // Health monitor
    this.health = new HealthMonitor({
      apiBaseUrl: this.config.apiBaseUrl,
      agentId: this.config.agentId,
      practiceId: this.config.practiceId,
      authToken: this.authToken,
      agentVersion: '1.0.0',
      heartbeatIntervalMs: this.config.heartbeatIntervalMs,
      logger: this.logger.child('health'),
    });
  }

  /**
   * Handle scheduled sync
   */
  private async handleScheduledSync(ctx: JobContext): Promise<void> {
    const profile = this.getActiveProfile();
    if (!profile) {
      this.logger.warn('No active profile for scheduled sync');
      return;
    }

    // Determine sync type (full on specified day, incremental otherwise)
    const now = new Date();
    const syncType: SyncType =
      now.getDay() === (this.config.profiles[0]?.config.fullSyncDayOfWeek ?? 0)
        ? 'full'
        : 'incremental';

    await this.runSync(profile, syncType);
  }

  /**
   * Run a sync operation
   */
  private async runSync(
    profile: ConnectionProfile,
    syncType: SyncType
  ): Promise<SyncResult | null> {
    this.logger.info('Starting sync', {
      profileId: profile.profileId,
      syncType,
    });

    try {
      // Get adapter
      const loaded = await this.registry.getAdapterForKind(profile.kind);
      if (!loaded) {
        throw new Error(`No adapter found for PIMS: ${profile.kind}`);
      }

      // Get secrets
      const secretsMap = await this.secrets.getSecretsMap(profile.secretsRef);

      // Create sync request
      const request: SyncRequest = {
        practiceId: this.config.practiceId!,
        agentId: this.config.agentId!,
        requestId: randomUUID(),
        syncType,
        outputDir: this.config.outputDir,
      };

      // Run sync
      const result = await this.executor.runSync(
        loaded.instance,
        profile,
        secretsMap,
        request,
        { requestId: request.requestId }
      );

      // Update health
      const lastSyncInfo: LastSyncInfo = {
        completedAt: new Date().toISOString(),
        success: result.success,
        errorMessage: result.error?.message,
        errorCode: result.error?.code,
        recordCount: result.stats.recordsProcessed,
        durationMs: result.durationMs,
      };
      this.health.updateLastSync(lastSyncInfo);

      // Upload if successful
      if (result.success && result.outputPackagePath) {
        const uploadResult = await this.uploader.upload(result.outputPackagePath);

        if (!uploadResult.success) {
          this.logger.warn('Upload failed, will retry later', {
            error: uploadResult.error,
          });
        }
      }

      // Handle specific error types
      if (result.error) {
        if (
          result.error.code === 'SESSION_EXPIRED' ||
          result.error.code === 'MFA_REQUIRED'
        ) {
          await this.health.requestReconnect(
            result.error.code,
            result.error.message
          );
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Sync failed', error instanceof Error ? error : undefined);

      this.health.updateLastSync({
        completedAt: new Date().toISOString(),
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        recordCount: 0,
        durationMs: 0,
      });

      return null;
    }
  }

  /**
   * Get active connection profile
   */
  private getActiveProfile(): ConnectionProfile | null {
    if (!this.config.activeProfileId) {
      return this.config.profiles[0] ?? null;
    }

    return (
      this.config.profiles.find(p => p.profileId === this.config.activeProfileId) ??
      null
    );
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.config.outputDir,
      this.config.adaptersDir,
      join(getDataDir(), 'archive'),
      join(getDataDir(), 'failed'),
      join(getDataDir(), 'logs'),
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }
  }
}
