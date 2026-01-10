/**
 * Validation Utilities for Canonical Data
 */

import { z } from 'zod';
import type { CanonicalEntity, Client, Patient, Appointment, Reminder, Invoice } from '../models/canonical.js';
import {
  ClientSchema,
  PatientSchema,
  AppointmentSchema,
  ReminderSchema,
  InvoiceSchema,
  InvoiceLineItemSchema
} from '../models/canonical.js';

/**
 * Validation error details
 */
export interface ValidationError {
  path: string[];
  message: string;
  code: string;
  value?: unknown;
}

/**
 * Validation result for a single record
 */
export interface RecordValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  sanitized?: CanonicalEntity;
}

/**
 * Convert Zod errors to our format
 */
function zodErrorsToValidationErrors(zodError: z.ZodError): ValidationError[] {
  return zodError.errors.map(err => ({
    path: err.path.map(String),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Validate a client record
 */
export function validateClient(data: unknown): RecordValidationResult {
  const result = ClientSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [], warnings: [], sanitized: result.data };
  }
  return {
    valid: false,
    errors: zodErrorsToValidationErrors(result.error),
    warnings: [],
  };
}

/**
 * Validate a patient record
 */
export function validatePatient(data: unknown): RecordValidationResult {
  const result = PatientSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [], warnings: [], sanitized: result.data };
  }
  return {
    valid: false,
    errors: zodErrorsToValidationErrors(result.error),
    warnings: [],
  };
}

/**
 * Validate an appointment record
 */
export function validateAppointment(data: unknown): RecordValidationResult {
  const result = AppointmentSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [], warnings: [], sanitized: result.data };
  }
  return {
    valid: false,
    errors: zodErrorsToValidationErrors(result.error),
    warnings: [],
  };
}

/**
 * Validate a reminder record
 */
export function validateReminder(data: unknown): RecordValidationResult {
  const result = ReminderSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [], warnings: [], sanitized: result.data };
  }
  return {
    valid: false,
    errors: zodErrorsToValidationErrors(result.error),
    warnings: [],
  };
}

/**
 * Validate an invoice record
 */
export function validateInvoice(data: unknown): RecordValidationResult {
  const result = InvoiceSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [], warnings: [], sanitized: result.data };
  }
  return {
    valid: false,
    errors: zodErrorsToValidationErrors(result.error),
    warnings: [],
  };
}

/**
 * Validate an invoice line item record
 */
export function validateInvoiceLineItem(data: unknown): RecordValidationResult {
  const result = InvoiceLineItemSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [], warnings: [], sanitized: result.data };
  }
  return {
    valid: false,
    errors: zodErrorsToValidationErrors(result.error),
    warnings: [],
  };
}

/**
 * Validate any canonical entity by type
 */
export function validateEntity(entityType: string, data: unknown): RecordValidationResult {
  switch (entityType) {
    case 'client':
      return validateClient(data);
    case 'patient':
      return validatePatient(data);
    case 'appointment':
      return validateAppointment(data);
    case 'reminder':
      return validateReminder(data);
    case 'invoice':
      return validateInvoice(data);
    case 'invoice_line_item':
      return validateInvoiceLineItem(data);
    default:
      return {
        valid: false,
        errors: [{ path: ['entity_type'], message: `Unknown entity type: ${entityType}`, code: 'unknown_type' }],
        warnings: [],
      };
  }
}

/**
 * Normalize phone number to E.164-ish format
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Remove all non-numeric characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.length === 0) return null;
  if (cleaned.length < 7) return null; // Too short to be valid

  // Add country code if missing (assuming US)
  if (cleaned.length === 10 && !cleaned.startsWith('+')) {
    return `+1${cleaned}`;
  }

  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  return cleaned;
}

/**
 * Normalize email address
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  const cleaned = email.trim().toLowerCase();

  // Basic email validation
  if (!cleaned.includes('@') || !cleaned.includes('.')) {
    return null;
  }

  return cleaned;
}

/**
 * Parse and normalize a date string to ISO format
 */
export function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0]!; // YYYY-MM-DD
  } catch {
    return null;
  }
}

/**
 * Parse and normalize a datetime string to ISO format
 */
export function normalizeDateTime(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Normalize species name
 */
export function normalizeSpecies(species: string | null | undefined): string | null {
  if (!species) return null;

  const lower = species.trim().toLowerCase();

  const mapping: Record<string, string> = {
    'dog': 'canine',
    'dogs': 'canine',
    'canine': 'canine',
    'k9': 'canine',
    'cat': 'feline',
    'cats': 'feline',
    'feline': 'feline',
    'bird': 'avian',
    'birds': 'avian',
    'avian': 'avian',
    'horse': 'equine',
    'horses': 'equine',
    'equine': 'equine',
    'rabbit': 'rabbit',
    'rabbits': 'rabbit',
    'bunny': 'rabbit',
    'hamster': 'hamster',
    'guinea pig': 'guinea_pig',
    'reptile': 'reptile',
    'snake': 'reptile',
    'lizard': 'reptile',
    'turtle': 'reptile',
    'fish': 'fish',
  };

  return mapping[lower] ?? species.trim();
}

/**
 * Normalize sex/gender
 */
export function normalizeSex(sex: string | null | undefined): 'male' | 'female' | 'male_neutered' | 'female_spayed' | 'unknown' {
  if (!sex) return 'unknown';

  const lower = sex.trim().toLowerCase();

  if (lower.includes('neuter') || lower === 'mn' || lower === 'm/n') {
    return 'male_neutered';
  }
  if (lower.includes('spay') || lower === 'fs' || lower === 'f/s') {
    return 'female_spayed';
  }
  if (lower === 'm' || lower === 'male' || lower === 'intact male') {
    return 'male';
  }
  if (lower === 'f' || lower === 'female' || lower === 'intact female') {
    return 'female';
  }

  return 'unknown';
}
