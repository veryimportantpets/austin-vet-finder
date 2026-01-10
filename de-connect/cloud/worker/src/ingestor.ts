/**
 * Entity Ingestor
 *
 * Ingests NDJSON entity files into canonical tables.
 */

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import Database from 'better-sqlite3';
import type { Logger } from '@de-connect/shared';
import { EntityType } from '@de-connect/contracts';

/**
 * Ingest entities from an NDJSON file
 */
export async function ingestEntities(
  db: Database.Database,
  practiceId: string,
  sourceSystem: string,
  entityType: EntityType,
  filePath: string,
  logger: Logger
): Promise<number> {
  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let count = 0;
  let batch: unknown[] = [];
  const batchSize = 100;

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entity = JSON.parse(line);
      batch.push(entity);

      if (batch.length >= batchSize) {
        await flushBatch(db, practiceId, sourceSystem, entityType, batch);
        count += batch.length;
        batch = [];
      }
    } catch (error) {
      logger.warn('Failed to parse entity line', { error: String(error) });
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await flushBatch(db, practiceId, sourceSystem, entityType, batch);
    count += batch.length;
  }

  return count;
}

/**
 * Flush a batch of entities to the database
 */
async function flushBatch(
  db: Database.Database,
  practiceId: string,
  sourceSystem: string,
  entityType: EntityType,
  entities: unknown[]
): Promise<void> {
  switch (entityType) {
    case EntityType.Client:
      upsertClients(db, entities);
      break;
    case EntityType.Patient:
      upsertPatients(db, entities);
      break;
    case EntityType.Appointment:
      upsertAppointments(db, entities);
      break;
    case EntityType.Reminder:
      upsertReminders(db, entities);
      break;
    case EntityType.Invoice:
      upsertInvoices(db, entities);
      break;
    default:
      // Skip unsupported entity types for now
      break;
  }
}

/**
 * Upsert clients
 */
function upsertClients(db: Database.Database, entities: unknown[]): void {
  const stmt = db.prepare(`
    INSERT INTO canonical_clients (
      practice_id, source_system, source_record_id,
      first_name, last_name, full_name, email,
      phone_primary, phone_mobile,
      address_line1, city, state, postal_code,
      email_opt_in, sms_opt_in, is_active,
      last_seen_at, source_created_at, source_updated_at, updated_at
    ) VALUES (
      @practice_id, @source_system, @source_record_id,
      @first_name, @last_name, @full_name, @email,
      @phone_primary, @phone_mobile,
      @address_line1, @city, @state, @postal_code,
      @email_opt_in, @sms_opt_in, @is_active,
      @last_seen_at, @source_created_at, @source_updated_at, datetime('now')
    )
    ON CONFLICT (practice_id, source_system, source_record_id)
    DO UPDATE SET
      first_name = @first_name,
      last_name = @last_name,
      full_name = @full_name,
      email = @email,
      phone_primary = @phone_primary,
      phone_mobile = @phone_mobile,
      address_line1 = @address_line1,
      city = @city,
      state = @state,
      postal_code = @postal_code,
      email_opt_in = @email_opt_in,
      sms_opt_in = @sms_opt_in,
      is_active = @is_active,
      last_seen_at = @last_seen_at,
      source_updated_at = @source_updated_at,
      updated_at = datetime('now')
  `);

  const insertMany = db.transaction((clients: any[]) => {
    for (const client of clients) {
      stmt.run({
        practice_id: client.practice_id,
        source_system: client.source_system,
        source_record_id: client.source_record_id,
        first_name: client.first_name ?? null,
        last_name: client.last_name ?? null,
        full_name: client.full_name ?? null,
        email: client.email ?? null,
        phone_primary: client.phone_primary ?? null,
        phone_mobile: client.phone_mobile ?? null,
        address_line1: client.address_line1 ?? null,
        city: client.city ?? null,
        state: client.state ?? null,
        postal_code: client.postal_code ?? null,
        email_opt_in: client.email_opt_in ? 1 : 0,
        sms_opt_in: client.sms_opt_in ? 1 : 0,
        is_active: client.is_active !== false ? 1 : 0,
        last_seen_at: client.last_seen_at,
        source_created_at: client.source_created_at ?? null,
        source_updated_at: client.source_updated_at ?? null,
      });
    }
  });

  insertMany(entities);
}

/**
 * Upsert patients
 */
function upsertPatients(db: Database.Database, entities: unknown[]): void {
  const stmt = db.prepare(`
    INSERT INTO canonical_patients (
      practice_id, source_system, source_record_id, source_client_id,
      name, species, breed, sex, date_of_birth,
      weight_kg, microchip_number, is_deceased, is_active,
      last_seen_at, source_created_at, source_updated_at, updated_at
    ) VALUES (
      @practice_id, @source_system, @source_record_id, @source_client_id,
      @name, @species, @breed, @sex, @date_of_birth,
      @weight_kg, @microchip_number, @is_deceased, @is_active,
      @last_seen_at, @source_created_at, @source_updated_at, datetime('now')
    )
    ON CONFLICT (practice_id, source_system, source_record_id)
    DO UPDATE SET
      source_client_id = @source_client_id,
      name = @name,
      species = @species,
      breed = @breed,
      sex = @sex,
      date_of_birth = @date_of_birth,
      weight_kg = @weight_kg,
      microchip_number = @microchip_number,
      is_deceased = @is_deceased,
      is_active = @is_active,
      last_seen_at = @last_seen_at,
      source_updated_at = @source_updated_at,
      updated_at = datetime('now')
  `);

  const insertMany = db.transaction((patients: any[]) => {
    for (const patient of patients) {
      stmt.run({
        practice_id: patient.practice_id,
        source_system: patient.source_system,
        source_record_id: patient.source_record_id,
        source_client_id: patient.source_client_id,
        name: patient.name,
        species: patient.species ?? null,
        breed: patient.breed ?? null,
        sex: patient.sex ?? null,
        date_of_birth: patient.date_of_birth ?? null,
        weight_kg: patient.weight_kg ?? null,
        microchip_number: patient.microchip_number ?? null,
        is_deceased: patient.is_deceased ? 1 : 0,
        is_active: patient.is_active !== false ? 1 : 0,
        last_seen_at: patient.last_seen_at,
        source_created_at: patient.source_created_at ?? null,
        source_updated_at: patient.source_updated_at ?? null,
      });
    }
  });

  insertMany(entities);
}

/**
 * Upsert appointments
 */
function upsertAppointments(db: Database.Database, entities: unknown[]): void {
  const stmt = db.prepare(`
    INSERT INTO canonical_appointments (
      practice_id, source_system, source_record_id,
      source_client_id, source_patient_id,
      starts_at, ends_at, status, reason, appointment_type,
      provider_name, is_active, last_seen_at, updated_at
    ) VALUES (
      @practice_id, @source_system, @source_record_id,
      @source_client_id, @source_patient_id,
      @starts_at, @ends_at, @status, @reason, @appointment_type,
      @provider_name, @is_active, @last_seen_at, datetime('now')
    )
    ON CONFLICT (practice_id, source_system, source_record_id)
    DO UPDATE SET
      source_client_id = @source_client_id,
      source_patient_id = @source_patient_id,
      starts_at = @starts_at,
      ends_at = @ends_at,
      status = @status,
      reason = @reason,
      appointment_type = @appointment_type,
      provider_name = @provider_name,
      is_active = @is_active,
      last_seen_at = @last_seen_at,
      updated_at = datetime('now')
  `);

  const insertMany = db.transaction((appointments: any[]) => {
    for (const apt of appointments) {
      stmt.run({
        practice_id: apt.practice_id,
        source_system: apt.source_system,
        source_record_id: apt.source_record_id,
        source_client_id: apt.source_client_id ?? null,
        source_patient_id: apt.source_patient_id ?? null,
        starts_at: apt.starts_at,
        ends_at: apt.ends_at ?? null,
        status: apt.status,
        reason: apt.reason ?? null,
        appointment_type: apt.appointment_type ?? null,
        provider_name: apt.provider_name ?? null,
        is_active: apt.is_active !== false ? 1 : 0,
        last_seen_at: apt.last_seen_at,
      });
    }
  });

  insertMany(entities);
}

/**
 * Upsert reminders
 */
function upsertReminders(db: Database.Database, entities: unknown[]): void {
  const stmt = db.prepare(`
    INSERT INTO canonical_reminders (
      practice_id, source_system, source_record_id,
      source_client_id, source_patient_id,
      due_date, status, reminder_type, service_name, description,
      is_active, last_seen_at, updated_at
    ) VALUES (
      @practice_id, @source_system, @source_record_id,
      @source_client_id, @source_patient_id,
      @due_date, @status, @reminder_type, @service_name, @description,
      @is_active, @last_seen_at, datetime('now')
    )
    ON CONFLICT (practice_id, source_system, source_record_id)
    DO UPDATE SET
      source_client_id = @source_client_id,
      source_patient_id = @source_patient_id,
      due_date = @due_date,
      status = @status,
      reminder_type = @reminder_type,
      service_name = @service_name,
      description = @description,
      is_active = @is_active,
      last_seen_at = @last_seen_at,
      updated_at = datetime('now')
  `);

  const insertMany = db.transaction((reminders: any[]) => {
    for (const rem of reminders) {
      stmt.run({
        practice_id: rem.practice_id,
        source_system: rem.source_system,
        source_record_id: rem.source_record_id,
        source_client_id: rem.source_client_id ?? null,
        source_patient_id: rem.source_patient_id ?? null,
        due_date: rem.due_date,
        status: rem.status,
        reminder_type: rem.reminder_type ?? null,
        service_name: rem.service_name ?? null,
        description: rem.description ?? null,
        is_active: rem.is_active !== false ? 1 : 0,
        last_seen_at: rem.last_seen_at,
      });
    }
  });

  insertMany(entities);
}

/**
 * Upsert invoices
 */
function upsertInvoices(db: Database.Database, entities: unknown[]): void {
  const stmt = db.prepare(`
    INSERT INTO canonical_invoices (
      practice_id, source_system, source_record_id,
      source_client_id, source_patient_id,
      invoice_number, invoice_date,
      subtotal_cents, tax_cents, total_cents, paid_cents, balance_cents,
      status, is_active, last_seen_at, updated_at
    ) VALUES (
      @practice_id, @source_system, @source_record_id,
      @source_client_id, @source_patient_id,
      @invoice_number, @invoice_date,
      @subtotal_cents, @tax_cents, @total_cents, @paid_cents, @balance_cents,
      @status, @is_active, @last_seen_at, datetime('now')
    )
    ON CONFLICT (practice_id, source_system, source_record_id)
    DO UPDATE SET
      source_client_id = @source_client_id,
      source_patient_id = @source_patient_id,
      invoice_number = @invoice_number,
      invoice_date = @invoice_date,
      subtotal_cents = @subtotal_cents,
      tax_cents = @tax_cents,
      total_cents = @total_cents,
      paid_cents = @paid_cents,
      balance_cents = @balance_cents,
      status = @status,
      is_active = @is_active,
      last_seen_at = @last_seen_at,
      updated_at = datetime('now')
  `);

  const insertMany = db.transaction((invoices: any[]) => {
    for (const inv of invoices) {
      stmt.run({
        practice_id: inv.practice_id,
        source_system: inv.source_system,
        source_record_id: inv.source_record_id,
        source_client_id: inv.source_client_id,
        source_patient_id: inv.source_patient_id ?? null,
        invoice_number: inv.invoice_number ?? null,
        invoice_date: inv.invoice_date,
        subtotal_cents: inv.subtotal_cents,
        tax_cents: inv.tax_cents ?? 0,
        total_cents: inv.total_cents,
        paid_cents: inv.paid_cents ?? 0,
        balance_cents: inv.balance_cents,
        status: inv.status,
        is_active: inv.is_active !== false ? 1 : 0,
        last_seen_at: inv.last_seen_at,
      });
    }
  });

  insertMany(entities);
}
