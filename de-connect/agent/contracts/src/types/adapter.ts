/**
 * Adapter Interface Definitions
 */

import type { PimsKind, AcquisitionMode, DetectedSystem, ConnectionProfile } from './pims.js';
import type { SyncRequest, SyncResult } from './sync.js';

/**
 * Adapter capability flags
 */
export interface AdapterCapabilities {
  /**
   * Supports incremental sync (vs full sync only)
   */
  incrementalSync: boolean;

  /**
   * Can detect system presence automatically
   */
  autoDetect: boolean;

  /**
   * Supports real-time/webhook updates
   */
  realtime: boolean;

  /**
   * Can export specific date ranges
   */
  dateRangeExport: boolean;

  /**
   * Entities this adapter can extract
   */
  entities: EntityType[];

  /**
   * Acquisition modes supported
   */
  acquisitionModes: AcquisitionMode[];
}

/**
 * Entity types that can be extracted
 */
export enum EntityType {
  Client = 'client',
  Patient = 'patient',
  Appointment = 'appointment',
  Reminder = 'reminder',
  Invoice = 'invoice',
  InvoiceLineItem = 'invoice_line_item',
  Product = 'product',
  Service = 'service',
  Prescription = 'prescription',
  MedicalRecord = 'medical_record',
}

/**
 * Adapter manifest - describes an adapter's capabilities
 */
export interface AdapterManifest {
  /**
   * Unique adapter identifier
   */
  adapterId: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Version string (semver)
   */
  version: string;

  /**
   * PIMS systems this adapter supports
   */
  supportedKinds: PimsKind[];

  /**
   * Requires 32-bit process (for legacy DB drivers)
   */
  requiresX86: boolean;

  /**
   * Capabilities
   */
  capabilities: AdapterCapabilities;

  /**
   * Minimum agent version required
   */
  minAgentVersion: string;

  /**
   * Description for users
   */
  description: string;

  /**
   * Author/maintainer
   */
  author: string;
}

/**
 * Validation step result
 */
export interface ValidationResult {
  /**
   * Which step was validated
   */
  step: ValidationStep;

  /**
   * Result status
   */
  status: 'success' | 'warning' | 'error';

  /**
   * Human-readable message
   */
  message: string;

  /**
   * Technical details (for diagnostics)
   */
  details?: Record<string, unknown>;

  /**
   * Suggested fix if status is error
   */
  suggestedFix?: string;

  /**
   * Can proceed despite this result?
   */
  canProceed: boolean;
}

/**
 * Validation steps
 */
export enum ValidationStep {
  Connection = 'connection',
  Authentication = 'authentication',
  Permissions = 'permissions',
  DataAccess = 'data_access',
  ExportCapability = 'export_capability',
  FolderAccess = 'folder_access',
  BrowserSession = 'browser_session',
}

/**
 * The core adapter interface
 * All adapters must implement this
 */
export interface IAdapter {
  /**
   * Get adapter manifest
   */
  getManifest(): AdapterManifest;

  /**
   * Detect if this PIMS system is present
   * Returns empty array if not detected
   */
  detectAsync(signal?: AbortSignal): Promise<DetectedSystem[]>;

  /**
   * Validate a connection profile
   * Returns validation results for each step
   */
  validateAsync(
    profile: ConnectionProfile,
    secrets: Record<string, string>,
    signal?: AbortSignal
  ): Promise<ValidationResult[]>;

  /**
   * Run a sync operation
   * Produces a sync package (zip file with NDJSON entities)
   */
  runSyncAsync(
    profile: ConnectionProfile,
    secrets: Record<string, string>,
    request: SyncRequest,
    signal?: AbortSignal
  ): Promise<SyncResult>;

  /**
   * Cleanup resources (called before adapter unload)
   */
  disposeAsync(): Promise<void>;
}

/**
 * Factory function type for adapter creation
 */
export type AdapterFactory = () => IAdapter;

/**
 * Adapter registration info (for plugin discovery)
 */
export interface AdapterRegistration {
  manifest: AdapterManifest;
  factory: AdapterFactory;
}
