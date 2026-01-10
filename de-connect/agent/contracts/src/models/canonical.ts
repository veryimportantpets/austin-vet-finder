/**
 * Canonical Data Models
 *
 * All adapters must transform source data into these standardized formats.
 * This ensures consistent data structure regardless of source PIMS.
 */

import { z } from 'zod';

// ============================================================================
// Base Record Schema
// ============================================================================

/**
 * Every canonical record must include these fields
 */
export const BaseRecordSchema = z.object({
  /**
   * Unique practice identifier
   */
  practice_id: z.string().min(1),

  /**
   * Source PIMS system (avimark, cornerstone, pulse, ezyvet, etc.)
   */
  source_system: z.string().min(1),

  /**
   * Original record ID from source system
   */
  source_record_id: z.string().min(1),

  /**
   * When this record was last seen during sync
   */
  last_seen_at: z.string().datetime(),

  /**
   * When this record was created in source (if available)
   */
  source_created_at: z.string().datetime().optional(),

  /**
   * When this record was last updated in source (if available)
   */
  source_updated_at: z.string().datetime().optional(),

  /**
   * Is this record active/current (not deleted/archived)
   */
  is_active: z.boolean().default(true),
});

export type BaseRecord = z.infer<typeof BaseRecordSchema>;

// ============================================================================
// Client (Pet Owner)
// ============================================================================

export const ClientSchema = BaseRecordSchema.extend({
  entity_type: z.literal('client'),

  // Name
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  full_name: z.string().optional(), // For systems that don't split names

  // Contact
  email: z.string().email().optional().nullable(),
  phone_primary: z.string().optional().nullable(),
  phone_secondary: z.string().optional().nullable(),
  phone_mobile: z.string().optional().nullable(),

  // Address
  address_line1: z.string().optional().nullable(),
  address_line2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  country: z.string().optional().nullable(),

  // Preferences
  preferred_contact_method: z.enum(['email', 'phone', 'sms', 'mail', 'none']).optional(),
  email_opt_in: z.boolean().optional(),
  sms_opt_in: z.boolean().optional(),

  // Metadata
  client_since: z.string().datetime().optional(),
  last_visit_date: z.string().datetime().optional(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),

  // Balance
  account_balance: z.number().optional(),
});

export type Client = z.infer<typeof ClientSchema>;

// ============================================================================
// Patient (Pet)
// ============================================================================

export const PatientSchema = BaseRecordSchema.extend({
  entity_type: z.literal('patient'),

  // Owner reference
  source_client_id: z.string().min(1),

  // Basic info
  name: z.string().min(1),
  species: z.string().optional().nullable(),
  breed: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  sex: z.enum(['male', 'female', 'male_neutered', 'female_spayed', 'unknown']).optional(),

  // Dates
  date_of_birth: z.string().optional().nullable(), // YYYY-MM-DD or ISO
  date_of_death: z.string().optional().nullable(),
  estimated_age_years: z.number().optional(),

  // Physical
  weight_kg: z.number().optional().nullable(),
  weight_date: z.string().optional().nullable(),

  // Medical
  microchip_number: z.string().optional().nullable(),
  rabies_tag: z.string().optional().nullable(),
  is_deceased: z.boolean().default(false),

  // Metadata
  notes: z.string().optional().nullable(),
  alerts: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export type Patient = z.infer<typeof PatientSchema>;

// ============================================================================
// Appointment
// ============================================================================

export const AppointmentSchema = BaseRecordSchema.extend({
  entity_type: z.literal('appointment'),

  // References
  source_client_id: z.string().optional(),
  source_patient_id: z.string().optional(),

  // Timing
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().optional(),
  duration_minutes: z.number().optional(),

  // Details
  status: z.enum([
    'scheduled',
    'confirmed',
    'checked_in',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
    'rescheduled',
    'unknown'
  ]),
  reason: z.string().optional().nullable(),
  appointment_type: z.string().optional().nullable(),

  // Provider
  provider_name: z.string().optional().nullable(),
  provider_id: z.string().optional().nullable(),

  // Location
  room: z.string().optional().nullable(),
  location: z.string().optional().nullable(),

  // Notes
  notes: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
});

export type Appointment = z.infer<typeof AppointmentSchema>;

// ============================================================================
// Reminder / Due Service
// ============================================================================

export const ReminderSchema = BaseRecordSchema.extend({
  entity_type: z.literal('reminder'),

  // References
  source_client_id: z.string().optional(),
  source_patient_id: z.string().optional(),

  // Due date
  due_date: z.string(), // YYYY-MM-DD

  // Status
  status: z.enum(['pending', 'sent', 'completed', 'cancelled', 'overdue']),

  // Content
  reminder_type: z.string().optional(), // e.g., 'vaccine', 'checkup', 'dental'
  service_name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),

  // Notification tracking
  last_sent_at: z.string().datetime().optional(),
  send_count: z.number().default(0),
  next_send_at: z.string().datetime().optional(),

  // Notes
  notes: z.string().optional().nullable(),
});

export type Reminder = z.infer<typeof ReminderSchema>;

// ============================================================================
// Invoice
// ============================================================================

export const InvoiceSchema = BaseRecordSchema.extend({
  entity_type: z.literal('invoice'),

  // References
  source_client_id: z.string().min(1),
  source_patient_id: z.string().optional(),

  // Invoice info
  invoice_number: z.string().optional(),
  invoice_date: z.string(), // YYYY-MM-DD or ISO

  // Amounts (in cents or smallest currency unit for precision)
  subtotal_cents: z.number(),
  tax_cents: z.number().default(0),
  discount_cents: z.number().default(0),
  total_cents: z.number(),
  paid_cents: z.number().default(0),
  balance_cents: z.number(),

  // Status
  status: z.enum(['draft', 'open', 'paid', 'partial', 'void', 'refunded', 'unknown']),

  // Payment
  payment_method: z.string().optional().nullable(),
  paid_at: z.string().datetime().optional(),

  // Notes
  notes: z.string().optional().nullable(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;

// ============================================================================
// Invoice Line Item
// ============================================================================

export const InvoiceLineItemSchema = BaseRecordSchema.extend({
  entity_type: z.literal('invoice_line_item'),

  // References
  source_invoice_id: z.string().min(1),
  source_patient_id: z.string().optional(),

  // Item info
  line_number: z.number().optional(),
  item_code: z.string().optional().nullable(),
  item_name: z.string(),
  item_type: z.enum(['service', 'product', 'medication', 'lab', 'other']).optional(),
  description: z.string().optional().nullable(),

  // Quantity and pricing
  quantity: z.number(),
  unit_price_cents: z.number(),
  discount_cents: z.number().default(0),
  tax_cents: z.number().default(0),
  total_cents: z.number(),

  // Provider
  provider_name: z.string().optional().nullable(),
  provider_id: z.string().optional().nullable(),

  // Date performed
  service_date: z.string().optional(), // YYYY-MM-DD
});

export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;

// ============================================================================
// Union Type for All Entities
// ============================================================================

export const CanonicalEntitySchema = z.discriminatedUnion('entity_type', [
  ClientSchema,
  PatientSchema,
  AppointmentSchema,
  ReminderSchema,
  InvoiceSchema,
  InvoiceLineItemSchema,
]);

export type CanonicalEntity = z.infer<typeof CanonicalEntitySchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create base record fields for an entity
 */
export function createBaseRecord(
  practiceId: string,
  sourceSystem: string,
  sourceRecordId: string
): BaseRecord {
  return {
    practice_id: practiceId,
    source_system: sourceSystem,
    source_record_id: sourceRecordId,
    last_seen_at: new Date().toISOString(),
    is_active: true,
  };
}

/**
 * Parse and validate a canonical entity from JSON
 */
export function parseCanonicalEntity(json: unknown): CanonicalEntity {
  return CanonicalEntitySchema.parse(json);
}

/**
 * Safely parse entity, returning errors instead of throwing
 */
export function safeParseCanonicalEntity(json: unknown): {
  success: boolean;
  data?: CanonicalEntity;
  error?: z.ZodError;
} {
  const result = CanonicalEntitySchema.safeParse(json);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Get entity type from a canonical entity
 */
export function getEntityType(entity: CanonicalEntity): string {
  return entity.entity_type;
}

/**
 * Get unique key for an entity
 */
export function getEntityKey(entity: CanonicalEntity): string {
  return `${entity.practice_id}:${entity.source_system}:${entity.entity_type}:${entity.source_record_id}`;
}
