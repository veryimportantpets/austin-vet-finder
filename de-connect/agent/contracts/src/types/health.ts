/**
 * Health and Telemetry Types
 */

/**
 * Agent health status
 */
export enum AgentStatus {
  /**
   * Agent is running and healthy
   */
  Healthy = 'healthy',

  /**
   * Agent is running but has warnings
   */
  Degraded = 'degraded',

  /**
   * Agent needs user attention (e.g., reconnect required)
   */
  NeedsAttention = 'needs_attention',

  /**
   * Agent is not responding
   */
  Offline = 'offline',

  /**
   * Agent is in error state
   */
  Error = 'error',
}

/**
 * Heartbeat payload sent to cloud
 */
export interface AgentHeartbeat {
  /**
   * Agent identifier
   */
  agentId: string;

  /**
   * Practice identifier
   */
  practiceId: string;

  /**
   * Current status
   */
  status: AgentStatus;

  /**
   * Heartbeat timestamp
   */
  timestamp: string;

  /**
   * Agent version
   */
  agentVersion: string;

  /**
   * Loaded adapter versions
   */
  adapterVersions: Record<string, string>;

  /**
   * System info
   */
  system: SystemInfo;

  /**
   * Last sync info
   */
  lastSync?: LastSyncInfo;

  /**
   * Current issues/warnings
   */
  issues: AgentIssue[];

  /**
   * Resource usage
   */
  resources: ResourceUsage;
}

/**
 * System information
 */
export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  hostname: string;
  uptime: number; // seconds
  timezone: string;
}

/**
 * Last sync information
 */
export interface LastSyncInfo {
  /**
   * When last sync completed
   */
  completedAt: string;

  /**
   * Was it successful
   */
  success: boolean;

  /**
   * Error message if failed
   */
  errorMessage?: string;

  /**
   * Error code if failed
   */
  errorCode?: string;

  /**
   * Records synced
   */
  recordCount: number;

  /**
   * Duration in ms
   */
  durationMs: number;
}

/**
 * Agent issue
 */
export interface AgentIssue {
  /**
   * Issue code
   */
  code: string;

  /**
   * Severity
   */
  severity: 'info' | 'warning' | 'error';

  /**
   * Human-readable message
   */
  message: string;

  /**
   * When issue was first detected
   */
  firstSeenAt: string;

  /**
   * Suggested user action
   */
  suggestedAction?: string;

  /**
   * Can be auto-resolved
   */
  autoResolvable: boolean;
}

/**
 * Resource usage
 */
export interface ResourceUsage {
  /**
   * Memory usage in MB
   */
  memoryMb: number;

  /**
   * CPU usage percentage
   */
  cpuPercent: number;

  /**
   * Disk space available in MB
   */
  diskFreeMb: number;
}

/**
 * Reconnect request (sent when session expires)
 */
export interface ReconnectRequest {
  agentId: string;
  practiceId: string;
  reason: ReconnectReason;
  message: string;
  details?: Record<string, unknown>;
}

export enum ReconnectReason {
  SessionExpired = 'session_expired',
  MfaRequired = 'mfa_required',
  PasswordChanged = 'password_changed',
  PermissionDenied = 'permission_denied',
  VendorUiChanged = 'vendor_ui_changed',
  Unknown = 'unknown',
}

/**
 * Update check response
 */
export interface UpdateInfo {
  /**
   * Is update available
   */
  available: boolean;

  /**
   * New version
   */
  version?: string;

  /**
   * Download URL
   */
  downloadUrl?: string;

  /**
   * SHA-256 of update package
   */
  sha256?: string;

  /**
   * Release notes
   */
  releaseNotes?: string;

  /**
   * Is update mandatory
   */
  mandatory: boolean;
}
