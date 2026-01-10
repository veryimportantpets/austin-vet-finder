/**
 * Sync Package Manifest Schema
 */

import { z } from 'zod';
import type { SyncManifest, SyncManifestFile, EntityCounts, SyncStats, SyncCursor, SyncType, DateRange } from '../types/sync.js';
import { EntityType } from '../types/adapter.js';

/**
 * Current manifest schema version
 */
export const MANIFEST_SCHEMA_VERSION = '1.0.0';

/**
 * Entity type to filename mapping
 */
export const ENTITY_FILENAMES: Record<EntityType, string> = {
  [EntityType.Client]: 'clients.ndjson',
  [EntityType.Patient]: 'patients.ndjson',
  [EntityType.Appointment]: 'appointments.ndjson',
  [EntityType.Reminder]: 'reminders.ndjson',
  [EntityType.Invoice]: 'invoices.ndjson',
  [EntityType.InvoiceLineItem]: 'invoice_line_items.ndjson',
  [EntityType.Product]: 'products.ndjson',
  [EntityType.Service]: 'services.ndjson',
  [EntityType.Prescription]: 'prescriptions.ndjson',
  [EntityType.MedicalRecord]: 'medical_records.ndjson',
};

/**
 * Zod schema for manifest file entry
 */
export const ManifestFileSchema = z.object({
  filename: z.string(),
  entityType: z.nativeEnum(EntityType),
  sha256: z.string().length(64),
  sizeBytes: z.number().int().nonnegative(),
  recordCount: z.number().int().nonnegative(),
});

/**
 * Zod schema for entity counts
 */
export const EntityCountsSchema = z.object({
  clients: z.number().int().nonnegative(),
  patients: z.number().int().nonnegative(),
  appointments: z.number().int().nonnegative(),
  reminders: z.number().int().nonnegative(),
  invoices: z.number().int().nonnegative(),
  invoiceLineItems: z.number().int().nonnegative(),
}).passthrough(); // Allow additional entity types

/**
 * Zod schema for sync stats
 */
export const SyncStatsSchema = z.object({
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  recordsProcessed: z.number().int().nonnegative(),
  recordsSkipped: z.number().int().nonnegative(),
  bytesWritten: z.number().int().nonnegative(),
  phases: z.record(z.string(), z.number()),
});

/**
 * Zod schema for cursor
 */
export const SyncCursorSchema = z.object({
  lastSyncAt: z.string().datetime(),
  entityCursors: z.record(z.string(), z.string()),
  custom: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Zod schema for date range
 */
export const DateRangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

/**
 * Full manifest schema
 */
export const SyncManifestSchema = z.object({
  schemaVersion: z.string(),
  practiceId: z.string().min(1),
  agentId: z.string().min(1),
  sourceSystem: z.string().min(1),
  adapterVersion: z.string(),
  syncType: z.enum(['full', 'incremental']),
  createdAt: z.string().datetime(),
  dataRange: DateRangeSchema.optional(),
  cursor: SyncCursorSchema.optional(),
  files: z.array(ManifestFileSchema),
  counts: EntityCountsSchema,
  stats: SyncStatsSchema,
});

/**
 * Create a new sync manifest
 */
export function createSyncManifest(params: {
  practiceId: string;
  agentId: string;
  sourceSystem: string;
  adapterVersion: string;
  syncType: SyncType;
  cursor?: SyncCursor;
  dataRange?: DateRange;
}): Omit<SyncManifest, 'files' | 'counts' | 'stats'> {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    practiceId: params.practiceId,
    agentId: params.agentId,
    sourceSystem: params.sourceSystem,
    adapterVersion: params.adapterVersion,
    syncType: params.syncType,
    createdAt: new Date().toISOString(),
    cursor: params.cursor,
    dataRange: params.dataRange,
  };
}

/**
 * Create empty entity counts
 */
export function createEmptyCounts(): EntityCounts {
  return {
    clients: 0,
    patients: 0,
    appointments: 0,
    reminders: 0,
    invoices: 0,
    invoiceLineItems: 0,
  };
}

/**
 * Create empty sync stats
 */
export function createEmptyStats(): SyncStats {
  const now = new Date().toISOString();
  return {
    startedAt: now,
    completedAt: now,
    recordsProcessed: 0,
    recordsSkipped: 0,
    bytesWritten: 0,
    phases: {},
  };
}

/**
 * Parse and validate a manifest
 */
export function parseManifest(json: unknown): SyncManifest {
  return SyncManifestSchema.parse(json) as SyncManifest;
}

/**
 * Safely parse manifest
 */
export function safeParseManifest(json: unknown): {
  success: boolean;
  data?: SyncManifest;
  error?: z.ZodError;
} {
  const result = SyncManifestSchema.safeParse(json);
  if (result.success) {
    return { success: true, data: result.data as SyncManifest };
  }
  return { success: false, error: result.error };
}

/**
 * Generate manifest filename with timestamp
 */
export function generateManifestFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `sync_${timestamp}.zip`;
}
