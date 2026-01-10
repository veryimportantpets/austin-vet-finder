/**
 * Demo Adapter
 *
 * Generates sample veterinary data for testing the DE Connect pipeline.
 */

import { randomUUID } from 'crypto';
import type {
  IAdapter,
  AdapterManifest,
  DetectedSystem,
  ValidationResult,
  ConnectionProfile,
  SyncRequest,
  SyncResult,
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

// Sample data generators
const FIRST_NAMES = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emily', 'Chris', 'Lisa', 'Tom', 'Amy'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor'];
const PET_NAMES = ['Max', 'Bella', 'Charlie', 'Luna', 'Cooper', 'Daisy', 'Buddy', 'Sadie', 'Rocky', 'Molly'];
const SPECIES = ['canine', 'feline'];
const DOG_BREEDS = ['Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'Bulldog', 'Beagle', 'Poodle'];
const CAT_BREEDS = ['Persian', 'Maine Coon', 'Siamese', 'Ragdoll', 'Bengal', 'British Shorthair'];
const APPOINTMENT_REASONS = ['Annual checkup', 'Vaccination', 'Dental cleaning', 'Illness', 'Injury', 'Spay/Neuter'];
const REMINDER_TYPES = ['vaccine', 'checkup', 'dental', 'heartworm', 'flea_tick'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomDate(daysBack: number, daysForward: number = 0): Date {
  const now = Date.now();
  const start = now - daysBack * 24 * 60 * 60 * 1000;
  const end = now + daysForward * 24 * 60 * 60 * 1000;
  return new Date(start + Math.random() * (end - start));
}

function generateClients(practiceId: string, count: number): Client[] {
  const clients: Client[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);

    clients.push({
      entity_type: 'client',
      practice_id: practiceId,
      source_system: 'demo',
      source_record_id: `client-${i + 1}`,
      last_seen_at: new Date().toISOString(),
      is_active: true,
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone_primary: `555-${String(1000 + i).padStart(4, '0')}`,
      address_line1: `${100 + i} Main Street`,
      city: 'Austin',
      state: 'TX',
      postal_code: '78701',
      email_opt_in: Math.random() > 0.3,
      sms_opt_in: Math.random() > 0.5,
      client_since: randomDate(365 * 3).toISOString(),
    });
  }

  return clients;
}

function generatePatients(practiceId: string, clients: Client[]): Patient[] {
  const patients: Patient[] = [];
  let patientId = 1;

  for (const client of clients) {
    const petCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < petCount; i++) {
      const species = randomItem(SPECIES);
      const breeds = species === 'canine' ? DOG_BREEDS : CAT_BREEDS;

      patients.push({
        entity_type: 'patient',
        practice_id: practiceId,
        source_system: 'demo',
        source_record_id: `patient-${patientId}`,
        source_client_id: client.source_record_id,
        last_seen_at: new Date().toISOString(),
        is_active: true,
        name: randomItem(PET_NAMES),
        species,
        breed: randomItem(breeds),
        sex: randomItem(['male', 'female', 'male_neutered', 'female_spayed']),
        date_of_birth: randomDate(365 * 10).toISOString().split('T')[0],
        is_deceased: false,
      });

      patientId++;
    }
  }

  return patients;
}

function generateAppointments(
  practiceId: string,
  patients: Patient[]
): Appointment[] {
  const appointments: Appointment[] = [];

  for (const patient of patients) {
    // Past appointments
    const pastCount = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < pastCount; i++) {
      const date = randomDate(365, 0);
      appointments.push({
        entity_type: 'appointment',
        practice_id: practiceId,
        source_system: 'demo',
        source_record_id: `apt-${appointments.length + 1}`,
        source_patient_id: patient.source_record_id,
        source_client_id: patient.source_client_id,
        last_seen_at: new Date().toISOString(),
        is_active: true,
        starts_at: date.toISOString(),
        status: 'completed',
        reason: randomItem(APPOINTMENT_REASONS),
        appointment_type: 'general',
      });
    }

    // Future appointments (some patients)
    if (Math.random() > 0.7) {
      const date = randomDate(0, 30);
      appointments.push({
        entity_type: 'appointment',
        practice_id: practiceId,
        source_system: 'demo',
        source_record_id: `apt-${appointments.length + 1}`,
        source_patient_id: patient.source_record_id,
        source_client_id: patient.source_client_id,
        last_seen_at: new Date().toISOString(),
        is_active: true,
        starts_at: date.toISOString(),
        status: 'scheduled',
        reason: randomItem(APPOINTMENT_REASONS),
        appointment_type: 'general',
      });
    }
  }

  return appointments;
}

function generateReminders(practiceId: string, patients: Patient[]): Reminder[] {
  const reminders: Reminder[] = [];

  for (const patient of patients) {
    // Each patient has 1-3 reminders
    const reminderCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < reminderCount; i++) {
      const dueDate = randomDate(-30, 90);
      const isPast = dueDate < new Date();

      reminders.push({
        entity_type: 'reminder',
        practice_id: practiceId,
        source_system: 'demo',
        source_record_id: `rem-${reminders.length + 1}`,
        source_patient_id: patient.source_record_id,
        source_client_id: patient.source_client_id,
        last_seen_at: new Date().toISOString(),
        is_active: true,
        due_date: dueDate.toISOString().split('T')[0]!,
        status: isPast ? (Math.random() > 0.5 ? 'completed' : 'overdue') : 'pending',
        reminder_type: randomItem(REMINDER_TYPES),
        service_name: 'Annual vaccination',
      });
    }
  }

  return reminders;
}

function generateInvoices(
  practiceId: string,
  appointments: Appointment[]
): Invoice[] {
  const invoices: Invoice[] = [];

  // Generate invoices for completed appointments
  const completed = appointments.filter(a => a.status === 'completed');

  for (const apt of completed) {
    if (Math.random() > 0.3) continue; // Not all appointments have invoices

    const subtotal = Math.floor(Math.random() * 30000) + 5000; // $50-$350
    const tax = Math.floor(subtotal * 0.0825);
    const total = subtotal + tax;
    const paid = Math.random() > 0.1 ? total : 0;

    invoices.push({
      entity_type: 'invoice',
      practice_id: practiceId,
      source_system: 'demo',
      source_record_id: `inv-${invoices.length + 1}`,
      source_client_id: apt.source_client_id!,
      source_patient_id: apt.source_patient_id,
      last_seen_at: new Date().toISOString(),
      is_active: true,
      invoice_number: `INV-${String(invoices.length + 1).padStart(5, '0')}`,
      invoice_date: apt.starts_at.split('T')[0]!,
      subtotal_cents: subtotal,
      tax_cents: tax,
      total_cents: total,
      paid_cents: paid,
      balance_cents: total - paid,
      status: paid === total ? 'paid' : paid > 0 ? 'partial' : 'open',
    });
  }

  return invoices;
}

/**
 * Demo Adapter implementation
 */
class DemoAdapter implements IAdapter {
  private manifest: AdapterManifest = {
    adapterId: 'demo-adapter',
    name: 'Demo Adapter',
    version: '1.0.0',
    supportedKinds: [PimsKind.Demo],
    requiresX86: false,
    capabilities: {
      incrementalSync: false,
      autoDetect: true,
      realtime: false,
      dateRangeExport: false,
      entities: [
        EntityType.Client,
        EntityType.Patient,
        EntityType.Appointment,
        EntityType.Reminder,
        EntityType.Invoice,
      ],
      acquisitionModes: [AcquisitionMode.Direct],
    },
    minAgentVersion: '1.0.0',
    description: 'Demo adapter for testing. Generates sample veterinary data.',
    author: 'DE Connect',
  };

  getManifest(): AdapterManifest {
    return this.manifest;
  }

  async detectAsync(): Promise<DetectedSystem[]> {
    // Demo adapter is always "detected"
    return [
      {
        kind: PimsKind.Demo,
        displayName: 'Demo System',
        confidence: 1.0,
        evidence: [
          {
            type: 'env_var',
            description: 'Demo adapter is always available',
            confidence: 1.0,
          },
        ],
        acquisitionModes: [AcquisitionMode.Direct],
        recommendedMode: AcquisitionMode.Direct,
        connectionHints: {
          notes: ['This is a demo adapter that generates sample data.'],
        },
      },
    ];
  }

  async validateAsync(
    profile: ConnectionProfile,
  ): Promise<ValidationResult[]> {
    // Demo adapter always validates successfully
    return [
      {
        step: ValidationStep.Connection,
        status: 'success',
        message: 'Demo system connection validated',
        canProceed: true,
      },
      {
        step: ValidationStep.DataAccess,
        status: 'success',
        message: 'Demo data generation ready',
        canProceed: true,
      },
    ];
  }

  async runSyncAsync(
    profile: ConnectionProfile,
    secrets: Record<string, string>,
    request: SyncRequest,
  ): Promise<SyncResult> {
    const startTime = Date.now();

    // Create package builder
    const builder = new PackageBuilder({
      practiceId: request.practiceId,
      agentId: request.agentId,
      sourceSystem: 'demo',
      adapterVersion: this.manifest.version,
      syncType: request.syncType as SyncType,
      outputDir: request.outputDir,
    });

    await builder.init();

    try {
      builder.startPhase('generate_data');

      // Generate sample data
      const clientCount = 50;
      const clients = generateClients(request.practiceId, clientCount);
      const patients = generatePatients(request.practiceId, clients);
      const appointments = generateAppointments(request.practiceId, patients);
      const reminders = generateReminders(request.practiceId, patients);
      const invoices = generateInvoices(request.practiceId, appointments);

      builder.endPhase('generate_data');

      // Add to package
      builder.addEntities(EntityType.Client, clients);
      builder.addEntities(EntityType.Patient, patients);
      builder.addEntities(EntityType.Appointment, appointments);
      builder.addEntities(EntityType.Reminder, reminders);
      builder.addEntities(EntityType.Invoice, invoices);

      // Build package
      const { packagePath, manifest } = await builder.build();

      return {
        success: true,
        requestId: request.requestId,
        outputPackagePath: packagePath,
        counts: manifest.counts,
        durationMs: Date.now() - startTime,
        warnings: [],
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
  return new DemoAdapter();
}

export default { createAdapter };
