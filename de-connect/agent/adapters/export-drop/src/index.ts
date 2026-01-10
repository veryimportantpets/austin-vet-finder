/**
 * Export Drop Adapter
 *
 * Universal fallback adapter that watches a folder for manually exported CSV files.
 * Works with any PIMS that can export CSV files.
 */

import { existsSync, readdirSync, statSync, renameSync, mkdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, basename } from 'path';
import { parse } from 'csv-parse/sync';
import type {
  IAdapter,
  AdapterManifest,
  DetectedSystem,
  ValidationResult,
  ConnectionProfile,
  SyncRequest,
  SyncResult,
  SyncCursor,
  SyncWarning,
  Client,
  Patient,
  Appointment,
  Reminder,
  Invoice,
} from '@de-connect/contracts';
import {
  PimsKind,
  AcquisitionMode,
  ValidationStep,
  EntityType,
  SyncType,
} from '@de-connect/contracts';
import { PackageBuilder } from '@de-connect/runner';

/**
 * File patterns for each entity type
 */
const FILE_PATTERNS: Record<EntityType, RegExp> = {
  [EntityType.Client]: /^clients?[\._-]/i,
  [EntityType.Patient]: /^patients?[\._-]/i,
  [EntityType.Appointment]: /^appointments?[\._-]/i,
  [EntityType.Reminder]: /^reminders?[\._-]/i,
  [EntityType.Invoice]: /^invoices?[\._-]/i,
  [EntityType.InvoiceLineItem]: /^invoice[\._-]?line[\._-]?items?[\._-]/i,
  [EntityType.Product]: /^products?[\._-]/i,
  [EntityType.Service]: /^services?[\._-]/i,
  [EntityType.Prescription]: /^prescriptions?[\._-]/i,
  [EntityType.MedicalRecord]: /^medical[\._-]?records?[\._-]/i,
};

/**
 * Column mappings for common PIMS exports
 */
const CLIENT_COLUMN_MAP: Record<string, keyof Client> = {
  'client_id': 'source_record_id',
  'clientid': 'source_record_id',
  'id': 'source_record_id',
  'first_name': 'first_name',
  'firstname': 'first_name',
  'first': 'first_name',
  'last_name': 'last_name',
  'lastname': 'last_name',
  'last': 'last_name',
  'name': 'full_name',
  'full_name': 'full_name',
  'email': 'email',
  'email_address': 'email',
  'phone': 'phone_primary',
  'phone_number': 'phone_primary',
  'primary_phone': 'phone_primary',
  'mobile': 'phone_mobile',
  'mobile_phone': 'phone_mobile',
  'cell': 'phone_mobile',
  'address': 'address_line1',
  'address1': 'address_line1',
  'street': 'address_line1',
  'city': 'city',
  'state': 'state',
  'zip': 'postal_code',
  'postal_code': 'postal_code',
  'zipcode': 'postal_code',
};

const PATIENT_COLUMN_MAP: Record<string, keyof Patient> = {
  'patient_id': 'source_record_id',
  'patientid': 'source_record_id',
  'pet_id': 'source_record_id',
  'id': 'source_record_id',
  'client_id': 'source_client_id',
  'clientid': 'source_client_id',
  'owner_id': 'source_client_id',
  'name': 'name',
  'pet_name': 'name',
  'patient_name': 'name',
  'species': 'species',
  'breed': 'breed',
  'sex': 'sex',
  'gender': 'sex',
  'dob': 'date_of_birth',
  'birth_date': 'date_of_birth',
  'date_of_birth': 'date_of_birth',
  'birthdate': 'date_of_birth',
  'weight': 'weight_kg',
  'weight_kg': 'weight_kg',
  'microchip': 'microchip_number',
  'chip': 'microchip_number',
};

/**
 * Parse CSV file into records
 */
async function parseCsvFile(filePath: string): Promise<Record<string, string>[]> {
  const content = await readFile(filePath, 'utf-8');

  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

/**
 * Map CSV columns to canonical fields
 */
function mapColumns(
  row: Record<string, string>,
  columnMap: Record<string, string>
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};

  for (const [csvCol, canonicalField] of Object.entries(columnMap)) {
    // Try exact match
    if (row[csvCol] !== undefined) {
      result[canonicalField] = row[csvCol] || undefined;
      continue;
    }

    // Try case-insensitive match
    const lowerCsvCol = csvCol.toLowerCase();
    for (const [key, value] of Object.entries(row)) {
      if (key.toLowerCase() === lowerCsvCol) {
        result[canonicalField] = value || undefined;
        break;
      }
    }
  }

  return result;
}

/**
 * Parse clients from CSV
 */
function parseClients(
  rows: Record<string, string>[],
  practiceId: string,
  sourceSystem: string
): { clients: Client[]; warnings: SyncWarning[] } {
  const clients: Client[] = [];
  const warnings: SyncWarning[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const mapped = mapColumns(row, CLIENT_COLUMN_MAP);

    if (!mapped.source_record_id) {
      warnings.push({
        code: 'MISSING_ID',
        message: `Row ${i + 1}: Missing client ID`,
        entity: EntityType.Client,
      });
      continue;
    }

    clients.push({
      entity_type: 'client',
      practice_id: practiceId,
      source_system: sourceSystem,
      source_record_id: mapped.source_record_id,
      last_seen_at: new Date().toISOString(),
      is_active: true,
      first_name: mapped.first_name as string | undefined,
      last_name: mapped.last_name as string | undefined,
      full_name: mapped.full_name as string | undefined,
      email: mapped.email as string | undefined,
      phone_primary: mapped.phone_primary as string | undefined,
      phone_mobile: mapped.phone_mobile as string | undefined,
      address_line1: mapped.address_line1 as string | undefined,
      city: mapped.city as string | undefined,
      state: mapped.state as string | undefined,
      postal_code: mapped.postal_code as string | undefined,
    });
  }

  return { clients, warnings };
}

/**
 * Parse patients from CSV
 */
function parsePatients(
  rows: Record<string, string>[],
  practiceId: string,
  sourceSystem: string
): { patients: Patient[]; warnings: SyncWarning[] } {
  const patients: Patient[] = [];
  const warnings: SyncWarning[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const mapped = mapColumns(row, PATIENT_COLUMN_MAP);

    if (!mapped.source_record_id) {
      warnings.push({
        code: 'MISSING_ID',
        message: `Row ${i + 1}: Missing patient ID`,
        entity: EntityType.Patient,
      });
      continue;
    }

    if (!mapped.source_client_id) {
      warnings.push({
        code: 'MISSING_CLIENT_ID',
        message: `Row ${i + 1}: Missing client ID for patient`,
        entity: EntityType.Patient,
      });
      continue;
    }

    patients.push({
      entity_type: 'patient',
      practice_id: practiceId,
      source_system: sourceSystem,
      source_record_id: mapped.source_record_id,
      source_client_id: mapped.source_client_id,
      last_seen_at: new Date().toISOString(),
      is_active: true,
      name: mapped.name as string || 'Unknown',
      species: mapped.species as string | undefined,
      breed: mapped.breed as string | undefined,
      sex: (mapped.sex as Patient['sex']) || undefined,
      date_of_birth: mapped.date_of_birth as string | undefined,
      weight_kg: mapped.weight_kg ? parseFloat(mapped.weight_kg) : undefined,
      microchip_number: mapped.microchip_number as string | undefined,
      is_deceased: false,
    });
  }

  return { patients, warnings };
}

/**
 * Detect entity type from filename
 */
function detectEntityType(filename: string): EntityType | null {
  for (const [entityType, pattern] of Object.entries(FILE_PATTERNS)) {
    if (pattern.test(filename)) {
      return entityType as EntityType;
    }
  }
  return null;
}

/**
 * Export Drop Adapter implementation
 */
class ExportDropAdapter implements IAdapter {
  private manifest: AdapterManifest = {
    adapterId: 'export-drop-adapter',
    name: 'Export Drop',
    version: '1.0.0',
    supportedKinds: [PimsKind.ExportDrop],
    requiresX86: false,
    capabilities: {
      incrementalSync: true,
      autoDetect: false,
      realtime: false,
      dateRangeExport: false,
      entities: [
        EntityType.Client,
        EntityType.Patient,
        EntityType.Appointment,
        EntityType.Reminder,
        EntityType.Invoice,
      ],
      acquisitionModes: [AcquisitionMode.ExportDrop],
    },
    minAgentVersion: '1.0.0',
    description: 'Universal fallback adapter. Watches a folder for manually exported CSV files.',
    author: 'DE Connect',
  };

  getManifest(): AdapterManifest {
    return this.manifest;
  }

  async detectAsync(): Promise<DetectedSystem[]> {
    // Export Drop doesn't auto-detect; it's always available as a fallback
    return [];
  }

  async validateAsync(
    profile: ConnectionProfile,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const watchFolder = profile.config.watchFolder;

    // Check folder exists
    if (!watchFolder) {
      results.push({
        step: ValidationStep.FolderAccess,
        status: 'error',
        message: 'Watch folder not configured',
        canProceed: false,
        suggestedFix: 'Set the watchFolder in the connection profile',
      });
      return results;
    }

    if (!existsSync(watchFolder)) {
      results.push({
        step: ValidationStep.FolderAccess,
        status: 'error',
        message: `Watch folder does not exist: ${watchFolder}`,
        canProceed: false,
        suggestedFix: 'Create the folder or select a different location',
      });
      return results;
    }

    // Check for CSV files
    const files = readdirSync(watchFolder).filter(f => f.endsWith('.csv'));

    if (files.length === 0) {
      results.push({
        step: ValidationStep.FolderAccess,
        status: 'warning',
        message: 'No CSV files found in watch folder',
        canProceed: true,
        suggestedFix: 'Export files from your PIMS and place them in the watch folder',
      });
    } else {
      results.push({
        step: ValidationStep.FolderAccess,
        status: 'success',
        message: `Found ${files.length} CSV file(s) in watch folder`,
        canProceed: true,
      });

      // Check if we can detect entity types
      const detectedTypes = files
        .map(f => detectEntityType(f))
        .filter(Boolean);

      if (detectedTypes.length > 0) {
        results.push({
          step: ValidationStep.DataAccess,
          status: 'success',
          message: `Detected entity types: ${[...new Set(detectedTypes)].join(', ')}`,
          canProceed: true,
        });
      }
    }

    return results;
  }

  async runSyncAsync(
    profile: ConnectionProfile,
    secrets: Record<string, string>,
    request: SyncRequest,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const warnings: SyncWarning[] = [];
    const watchFolder = profile.config.watchFolder!;
    const sourceSystem = profile.config.custom?.sourceSystem as string ?? 'export_drop';

    // Create package builder
    const builder = new PackageBuilder({
      practiceId: request.practiceId,
      agentId: request.agentId,
      sourceSystem,
      adapterVersion: this.manifest.version,
      syncType: request.syncType as SyncType,
      outputDir: request.outputDir,
    });

    await builder.init();

    try {
      // Get list of CSV files
      const files = readdirSync(watchFolder)
        .filter(f => f.endsWith('.csv'))
        .map(f => ({
          name: f,
          path: join(watchFolder, f),
          stat: statSync(join(watchFolder, f)),
          entityType: detectEntityType(f),
        }))
        .filter(f => f.entityType !== null);

      // Filter by cursor if incremental
      let filesToProcess = files;
      if (request.syncType === 'incremental' && request.cursor?.lastSyncAt) {
        const lastSync = new Date(request.cursor.lastSyncAt);
        filesToProcess = files.filter(f => f.stat.mtime > lastSync);
      }

      builder.startPhase('parse_files');

      // Process each file
      for (const file of filesToProcess) {
        try {
          const rows = await parseCsvFile(file.path);

          switch (file.entityType) {
            case EntityType.Client: {
              const { clients, warnings: w } = parseClients(rows, request.practiceId, sourceSystem);
              builder.addEntities(EntityType.Client, clients);
              warnings.push(...w);
              break;
            }
            case EntityType.Patient: {
              const { patients, warnings: w } = parsePatients(rows, request.practiceId, sourceSystem);
              builder.addEntities(EntityType.Patient, patients);
              warnings.push(...w);
              break;
            }
            // Add more entity types as needed
          }

          // Move file to processed folder
          const processedDir = join(watchFolder, '_processed');
          if (!existsSync(processedDir)) {
            mkdirSync(processedDir, { recursive: true });
          }
          renameSync(file.path, join(processedDir, file.name));

        } catch (error) {
          warnings.push({
            code: 'PARSE_ERROR',
            message: `Failed to parse ${file.name}: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }

      builder.endPhase('parse_files');

      // Build cursor
      const newCursor: SyncCursor = {
        lastSyncAt: new Date().toISOString(),
        entityCursors: {},
      };

      // Build package
      const { packagePath, manifest } = await builder.build(newCursor);

      return {
        success: true,
        requestId: request.requestId,
        outputPackagePath: packagePath,
        newCursor,
        counts: manifest.counts,
        durationMs: Date.now() - startTime,
        warnings,
        stats: manifest.stats,
      };
    } catch (error) {
      await builder.cleanup();
      throw error;
    }
  }

  async disposeAsync(): Promise<void> {
    // Nothing to dispose
  }
}

/**
 * Factory function
 */
export function createAdapter(): IAdapter {
  return new ExportDropAdapter();
}

export default { createAdapter };
