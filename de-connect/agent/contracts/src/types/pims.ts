/**
 * PIMS (Practice Information Management System) Type Definitions
 */

/**
 * Supported PIMS systems
 */
export enum PimsKind {
  AVImark = 'avimark',
  Cornerstone = 'cornerstone',
  Pulse = 'pulse',
  EzyVet = 'ezyvet',
  ExportDrop = 'export_drop',
  Demo = 'demo',
  Unknown = 'unknown',
}

/**
 * Display names for PIMS systems
 */
export const PIMS_DISPLAY_NAMES: Record<PimsKind, string> = {
  [PimsKind.AVImark]: 'AVImark',
  [PimsKind.Cornerstone]: 'Cornerstone',
  [PimsKind.Pulse]: 'Pulse (Covetrus)',
  [PimsKind.EzyVet]: 'ezyVet',
  [PimsKind.ExportDrop]: 'Export Drop (Manual)',
  [PimsKind.Demo]: 'Demo System',
  [PimsKind.Unknown]: 'Unknown',
};

/**
 * Acquisition mode for data extraction
 */
export enum AcquisitionMode {
  /**
   * Mode 1: Direct database or API access (best)
   */
  Direct = 'direct',

  /**
   * Mode 2: Browser automation for exports (no API but hands-off)
   */
  ExportAutomation = 'export_automation',

  /**
   * Mode 3: Manual file drop (universal fallback)
   */
  ExportDrop = 'export_drop',
}

/**
 * Evidence for PIMS detection
 */
export interface DetectionEvidence {
  type: 'file_path' | 'process' | 'registry' | 'network' | 'database' | 'env_var';
  description: string;
  path?: string;
  value?: string;
  confidence: number; // 0.0 - 1.0
}

/**
 * Detected PIMS system
 */
export interface DetectedSystem {
  kind: PimsKind;
  displayName: string;
  confidence: number; // 0.0 - 1.0 (aggregate of all evidence)
  evidence: DetectionEvidence[];
  acquisitionModes: AcquisitionMode[];
  recommendedMode: AcquisitionMode;
  connectionHints: ConnectionHints;
}

/**
 * Hints for establishing connection
 */
export interface ConnectionHints {
  /**
   * For on-prem: suggested data directory or server path
   */
  dataPath?: string;

  /**
   * For cloud: login URL
   */
  loginUrl?: string;

  /**
   * For API-based: API endpoint
   */
  apiEndpoint?: string;

  /**
   * Version info if detected
   */
  version?: string;

  /**
   * Additional notes for the user
   */
  notes?: string[];
}

/**
 * Connection profile for an adapter
 * Stores all info needed to connect and sync
 */
export interface ConnectionProfile {
  /**
   * Unique identifier for this profile
   */
  profileId: string;

  /**
   * PIMS system type
   */
  kind: PimsKind;

  /**
   * Display name for this connection
   */
  displayName: string;

  /**
   * Acquisition mode to use
   */
  acquisitionMode: AcquisitionMode;

  /**
   * Reference to stored secrets (never stored in plaintext)
   */
  secretsRef: string;

  /**
   * Non-sensitive configuration (JSON)
   */
  config: ConnectionConfig;

  /**
   * When this profile was created
   */
  createdAt: string;

  /**
   * When this profile was last modified
   */
  updatedAt: string;
}

/**
 * Non-sensitive connection configuration
 */
export interface ConnectionConfig {
  // On-prem (AVImark, Cornerstone)
  dataPath?: string;
  serverName?: string;
  databaseName?: string;

  // Cloud (Pulse, ezyVet)
  loginUrl?: string;
  practiceId?: string;

  // Export Drop
  watchFolder?: string;
  filePatterns?: string[];

  // Export Automation
  exportSchedule?: string; // cron expression
  browserProfile?: string;

  // General
  syncSchedule?: string; // cron expression for sync
  fullSyncDayOfWeek?: number; // 0-6, day for weekly full sync

  // Custom fields for adapter-specific config
  custom?: Record<string, unknown>;
}

/**
 * Stored secrets (encrypted at rest)
 */
export interface ConnectionSecrets {
  // Database credentials
  username?: string;
  password?: string;

  // API credentials
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;

  // Browser session
  sessionData?: string;
  cookies?: string;

  // Custom secrets
  custom?: Record<string, string>;
}
