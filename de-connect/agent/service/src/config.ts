/**
 * Service Configuration
 *
 * Handles configuration storage and loading.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir, platform } from 'os';
import type { ConnectionProfile, PimsKind, AcquisitionMode } from '@de-connect/contracts';

/**
 * Service configuration
 */
export interface ServiceConfig {
  /**
   * Unique agent ID (assigned on registration)
   */
  agentId: string | null;

  /**
   * Practice ID
   */
  practiceId: string | null;

  /**
   * Cloud API base URL
   */
  apiBaseUrl: string;

  /**
   * Connection profiles
   */
  profiles: ConnectionProfile[];

  /**
   * Active profile ID
   */
  activeProfileId: string | null;

  /**
   * Sync schedule (cron expression)
   */
  syncSchedule: string;

  /**
   * Heartbeat interval (ms)
   */
  heartbeatIntervalMs: number;

  /**
   * Max upload retries
   */
  maxUploadRetries: number;

  /**
   * Output directory for sync packages
   */
  outputDir: string;

  /**
   * Adapters directory
   */
  adaptersDir: string;

  /**
   * Log level
   */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Default configuration
 */
export function getDefaultConfig(): ServiceConfig {
  const dataDir = getDataDir();

  return {
    agentId: null,
    practiceId: null,
    apiBaseUrl: 'http://localhost:3001/v1',
    profiles: [],
    activeProfileId: null,
    syncSchedule: '0 2 * * *', // 2 AM daily
    heartbeatIntervalMs: 5 * 60 * 1000, // 5 minutes
    maxUploadRetries: 4,
    outputDir: join(dataDir, 'packages'),
    adaptersDir: join(dataDir, 'adapters'),
    logLevel: 'info',
  };
}

/**
 * Get platform-appropriate data directory
 */
export function getDataDir(): string {
  const p = platform();

  if (p === 'win32') {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'DEConnect');
  }

  if (p === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'DEConnect');
  }

  // Linux and others
  return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'de-connect');
}

/**
 * Get config file path
 */
export function getConfigPath(): string {
  return join(getDataDir(), 'config.json');
}

/**
 * Load configuration from disk
 */
export async function loadConfig(): Promise<ServiceConfig> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return getDefaultConfig();
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    const stored = JSON.parse(content) as Partial<ServiceConfig>;

    // Merge with defaults
    return {
      ...getDefaultConfig(),
      ...stored,
    };
  } catch (error) {
    console.error('Failed to load config, using defaults:', error);
    return getDefaultConfig();
  }
}

/**
 * Save configuration to disk
 */
export async function saveConfig(config: ServiceConfig): Promise<void> {
  const configPath = getConfigPath();
  const dir = dirname(configPath);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * Update specific config values
 */
export async function updateConfig(
  updates: Partial<ServiceConfig>
): Promise<ServiceConfig> {
  const current = await loadConfig();
  const updated = { ...current, ...updates };
  await saveConfig(updated);
  return updated;
}

/**
 * Get activation token path (written by setup wizard)
 */
export function getActivationTokenPath(): string {
  return join(getDataDir(), 'activation.token');
}

/**
 * Read activation token
 */
export async function readActivationToken(): Promise<string | null> {
  const tokenPath = getActivationTokenPath();

  if (!existsSync(tokenPath)) {
    return null;
  }

  try {
    const token = await readFile(tokenPath, 'utf-8');
    return token.trim();
  } catch {
    return null;
  }
}

/**
 * Create a new connection profile
 */
export function createProfile(params: {
  kind: PimsKind;
  displayName: string;
  acquisitionMode: AcquisitionMode;
  config: ConnectionProfile['config'];
}): ConnectionProfile {
  return {
    profileId: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: params.kind,
    displayName: params.displayName,
    acquisitionMode: params.acquisitionMode,
    secretsRef: '', // Will be set when secrets are stored
    config: params.config,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
