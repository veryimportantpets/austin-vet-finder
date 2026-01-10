/**
 * Sync Operation Types
 */

import type { EntityType } from './adapter.js';

/**
 * Sync request parameters
 */
export interface SyncRequest {
  /**
   * Unique practice identifier
   */
  practiceId: string;

  /**
   * Agent identifier
   */
  agentId: string;

  /**
   * Request ID for tracking
   */
  requestId: string;

  /**
   * Full sync or incremental
   */
  syncType: SyncType;

  /**
   * Cursor/watermark from previous sync (for incremental)
   */
  cursor?: SyncCursor;

  /**
   * Date range filter (optional)
   */
  dateRange?: DateRange;

  /**
   * Which entities to sync (empty = all supported)
   */
  entities?: EntityType[];

  /**
   * Output directory for sync package
   */
  outputDir: string;
}

export enum SyncType {
  Full = 'full',
  Incremental = 'incremental',
}

/**
 * Cursor for incremental sync
 */
export interface SyncCursor {
  /**
   * Last sync timestamp
   */
  lastSyncAt: string;

  /**
   * Per-entity cursors (e.g., last modified timestamp, last ID)
   */
  entityCursors: Record<string, string>;

  /**
   * Adapter-specific cursor data
   */
  custom?: Record<string, unknown>;
}

/**
 * Date range for filtered sync
 */
export interface DateRange {
  from: string; // ISO 8601
  to: string;   // ISO 8601
}

/**
 * Sync result
 */
export interface SyncResult {
  /**
   * Was sync successful
   */
  success: boolean;

  /**
   * Request ID (echoed back)
   */
  requestId: string;

  /**
   * Path to output package (zip file)
   */
  outputPackagePath?: string;

  /**
   * New cursor for next incremental sync
   */
  newCursor?: SyncCursor;

  /**
   * Record counts per entity
   */
  counts: EntityCounts;

  /**
   * Sync duration in milliseconds
   */
  durationMs: number;

  /**
   * Warnings (non-fatal issues)
   */
  warnings: SyncWarning[];

  /**
   * Error if sync failed
   */
  error?: SyncError;

  /**
   * Sync statistics
   */
  stats: SyncStats;
}

/**
 * Entity counts
 */
export interface EntityCounts {
  clients: number;
  patients: number;
  appointments: number;
  reminders: number;
  invoices: number;
  invoiceLineItems: number;
  [key: string]: number;
}

/**
 * Sync warning (non-fatal)
 */
export interface SyncWarning {
  code: string;
  message: string;
  entity?: EntityType;
  recordId?: string;
  details?: Record<string, unknown>;
}

/**
 * Sync error (fatal)
 */
export interface SyncError {
  code: SyncErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  suggestedAction?: SuggestedAction;
}

export enum SyncErrorCode {
  // Connection errors
  ConnectionFailed = 'CONNECTION_FAILED',
  AuthenticationFailed = 'AUTH_FAILED',
  SessionExpired = 'SESSION_EXPIRED',

  // Data errors
  DataAccessDenied = 'DATA_ACCESS_DENIED',
  DataCorrupted = 'DATA_CORRUPTED',
  SchemaChanged = 'SCHEMA_CHANGED',

  // Export errors
  ExportFailed = 'EXPORT_FAILED',
  ExportTimeout = 'EXPORT_TIMEOUT',
  FileNotFound = 'FILE_NOT_FOUND',

  // Browser automation errors
  BrowserCrashed = 'BROWSER_CRASHED',
  PageNotFound = 'PAGE_NOT_FOUND',
  SelectorNotFound = 'SELECTOR_NOT_FOUND',
  MfaRequired = 'MFA_REQUIRED',

  // General errors
  Timeout = 'TIMEOUT',
  OutOfMemory = 'OUT_OF_MEMORY',
  Unknown = 'UNKNOWN',
}

/**
 * Suggested action for error recovery
 */
export enum SuggestedAction {
  Retry = 'retry',
  Reconnect = 'reconnect',
  SwitchToExportDrop = 'switch_to_export_drop',
  ContactSupport = 'contact_support',
  UpdateAdapter = 'update_adapter',
}

/**
 * Sync statistics
 */
export interface SyncStats {
  /**
   * Start timestamp
   */
  startedAt: string;

  /**
   * End timestamp
   */
  completedAt: string;

  /**
   * Records processed
   */
  recordsProcessed: number;

  /**
   * Records skipped (e.g., duplicates)
   */
  recordsSkipped: number;

  /**
   * Bytes written to package
   */
  bytesWritten: number;

  /**
   * Per-phase timing
   */
  phases: Record<string, number>;
}

/**
 * Sync package manifest
 */
export interface SyncManifest {
  /**
   * Schema version for this manifest
   */
  schemaVersion: string;

  /**
   * Practice identifier
   */
  practiceId: string;

  /**
   * Agent identifier
   */
  agentId: string;

  /**
   * Source system
   */
  sourceSystem: string;

  /**
   * Adapter version
   */
  adapterVersion: string;

  /**
   * Sync type
   */
  syncType: SyncType;

  /**
   * When sync was created
   */
  createdAt: string;

  /**
   * Date range covered (for data, not sync time)
   */
  dataRange?: DateRange;

  /**
   * Cursor info
   */
  cursor?: SyncCursor;

  /**
   * Files in this package with their hashes
   */
  files: SyncManifestFile[];

  /**
   * Entity counts
   */
  counts: EntityCounts;

  /**
   * Stats
   */
  stats: SyncStats;
}

/**
 * File entry in sync manifest
 */
export interface SyncManifestFile {
  /**
   * Filename (relative to package root)
   */
  filename: string;

  /**
   * Entity type this file contains
   */
  entityType: EntityType;

  /**
   * SHA-256 hash of file contents
   */
  sha256: string;

  /**
   * File size in bytes
   */
  sizeBytes: number;

  /**
   * Record count in this file
   */
  recordCount: number;
}
