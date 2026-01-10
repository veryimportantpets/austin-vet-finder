/**
 * Database Layer
 *
 * Uses SQLite for simplicity (can be swapped for PostgreSQL in production).
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

let db: Database.Database | null = null;

/**
 * Get or create database connection
 */
export function getDatabase(): Database.Database {
  if (db) return db;

  const dataDir = process.env.DATA_DIR ?? './data';
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, 'de-connect.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Initialize schema
  initSchema(db);

  return db;
}

/**
 * Initialize database schema
 */
function initSchema(db: Database.Database): void {
  db.exec(`
    -- Practices
    CREATE TABLE IF NOT EXISTS practices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      activation_token TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Agents (installed connectors)
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      practice_id TEXT NOT NULL REFERENCES practices(id),
      machine_fingerprint TEXT NOT NULL,
      auth_token_hash TEXT NOT NULL,
      agent_version TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT
    );

    -- Heartbeats
    CREATE TABLE IF NOT EXISTS heartbeats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      status TEXT NOT NULL,
      agent_version TEXT,
      system_info TEXT,
      last_sync_info TEXT,
      issues TEXT,
      resources TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Sync packages (raw uploads)
    CREATE TABLE IF NOT EXISTS sync_packages (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      practice_id TEXT NOT NULL REFERENCES practices(id),
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      manifest TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      processed_at TEXT
    );

    -- Canonical entities: Clients
    CREATE TABLE IF NOT EXISTS canonical_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_id TEXT NOT NULL,
      source_system TEXT NOT NULL,
      source_record_id TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      full_name TEXT,
      email TEXT,
      phone_primary TEXT,
      phone_mobile TEXT,
      address_line1 TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      email_opt_in INTEGER,
      sms_opt_in INTEGER,
      is_active INTEGER DEFAULT 1,
      last_seen_at TEXT NOT NULL,
      source_created_at TEXT,
      source_updated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(practice_id, source_system, source_record_id)
    );

    -- Canonical entities: Patients
    CREATE TABLE IF NOT EXISTS canonical_patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_id TEXT NOT NULL,
      source_system TEXT NOT NULL,
      source_record_id TEXT NOT NULL,
      source_client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      species TEXT,
      breed TEXT,
      sex TEXT,
      date_of_birth TEXT,
      weight_kg REAL,
      microchip_number TEXT,
      is_deceased INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      last_seen_at TEXT NOT NULL,
      source_created_at TEXT,
      source_updated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(practice_id, source_system, source_record_id)
    );

    -- Canonical entities: Appointments
    CREATE TABLE IF NOT EXISTS canonical_appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_id TEXT NOT NULL,
      source_system TEXT NOT NULL,
      source_record_id TEXT NOT NULL,
      source_client_id TEXT,
      source_patient_id TEXT,
      starts_at TEXT NOT NULL,
      ends_at TEXT,
      status TEXT NOT NULL,
      reason TEXT,
      appointment_type TEXT,
      provider_name TEXT,
      is_active INTEGER DEFAULT 1,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(practice_id, source_system, source_record_id)
    );

    -- Canonical entities: Reminders
    CREATE TABLE IF NOT EXISTS canonical_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_id TEXT NOT NULL,
      source_system TEXT NOT NULL,
      source_record_id TEXT NOT NULL,
      source_client_id TEXT,
      source_patient_id TEXT,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL,
      reminder_type TEXT,
      service_name TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(practice_id, source_system, source_record_id)
    );

    -- Canonical entities: Invoices
    CREATE TABLE IF NOT EXISTS canonical_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_id TEXT NOT NULL,
      source_system TEXT NOT NULL,
      source_record_id TEXT NOT NULL,
      source_client_id TEXT NOT NULL,
      source_patient_id TEXT,
      invoice_number TEXT,
      invoice_date TEXT NOT NULL,
      subtotal_cents INTEGER NOT NULL,
      tax_cents INTEGER DEFAULT 0,
      total_cents INTEGER NOT NULL,
      paid_cents INTEGER DEFAULT 0,
      balance_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(practice_id, source_system, source_record_id)
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_heartbeats_agent ON heartbeats(agent_id);
    CREATE INDEX IF NOT EXISTS idx_sync_packages_agent ON sync_packages(agent_id);
    CREATE INDEX IF NOT EXISTS idx_sync_packages_status ON sync_packages(status);
    CREATE INDEX IF NOT EXISTS idx_clients_practice ON canonical_clients(practice_id);
    CREATE INDEX IF NOT EXISTS idx_patients_practice ON canonical_patients(practice_id);
    CREATE INDEX IF NOT EXISTS idx_patients_client ON canonical_patients(practice_id, source_client_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_practice ON canonical_appointments(practice_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_practice ON canonical_reminders(practice_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_practice ON canonical_invoices(practice_id);
  `);
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Practice CRUD
export interface Practice {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  activation_token?: string;
  created_at: string;
  updated_at: string;
}

export function createPractice(practice: Omit<Practice, 'created_at' | 'updated_at'>): Practice {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO practices (id, name, email, phone, activation_token, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(practice.id, practice.name, practice.email, practice.phone, practice.activation_token, now, now);

  return { ...practice, created_at: now, updated_at: now };
}

export function getPracticeByToken(token: string): Practice | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM practices WHERE activation_token = ?').get(token) as Practice | undefined;
  return row ?? null;
}

export function getPracticeById(id: string): Practice | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM practices WHERE id = ?').get(id) as Practice | undefined;
  return row ?? null;
}

export function getAllPractices(): Practice[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM practices ORDER BY created_at DESC').all() as Practice[];
}

// Agent CRUD
export interface Agent {
  id: string;
  practice_id: string;
  machine_fingerprint: string;
  auth_token_hash: string;
  agent_version?: string;
  status: string;
  created_at: string;
  last_seen_at?: string;
}

export function createAgent(agent: Omit<Agent, 'created_at' | 'status'>): Agent {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO agents (id, practice_id, machine_fingerprint, auth_token_hash, agent_version, status, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(agent.id, agent.practice_id, agent.machine_fingerprint, agent.auth_token_hash, agent.agent_version, now, now);

  return { ...agent, status: 'active', created_at: now, last_seen_at: now };
}

export function getAgentById(id: string): Agent | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Agent | undefined;
  return row ?? null;
}

export function updateAgentLastSeen(id: string): void {
  const db = getDatabase();
  db.prepare('UPDATE agents SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), id);
}

// Heartbeat
export interface Heartbeat {
  id?: number;
  agent_id: string;
  status: string;
  agent_version?: string;
  system_info?: string;
  last_sync_info?: string;
  issues?: string;
  resources?: string;
  created_at?: string;
}

export function createHeartbeat(heartbeat: Omit<Heartbeat, 'id' | 'created_at'>): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO heartbeats (agent_id, status, agent_version, system_info, last_sync_info, issues, resources)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    heartbeat.agent_id,
    heartbeat.status,
    heartbeat.agent_version,
    heartbeat.system_info,
    heartbeat.last_sync_info,
    heartbeat.issues,
    heartbeat.resources
  );

  updateAgentLastSeen(heartbeat.agent_id);
}

export function getLatestHeartbeat(agentId: string): Heartbeat | null {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT * FROM heartbeats WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(agentId) as Heartbeat | undefined;
  return row ?? null;
}

// Sync Package
export interface SyncPackage {
  id: string;
  agent_id: string;
  practice_id: string;
  filename: string;
  file_path: string;
  file_size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  manifest?: string;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

export function createSyncPackage(pkg: Omit<SyncPackage, 'created_at' | 'status'>): SyncPackage {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO sync_packages (id, agent_id, practice_id, filename, file_path, file_size, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(pkg.id, pkg.agent_id, pkg.practice_id, pkg.filename, pkg.file_path, pkg.file_size, now);

  return { ...pkg, status: 'pending', created_at: now };
}

export function getSyncPackageById(id: string): SyncPackage | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM sync_packages WHERE id = ?').get(id) as SyncPackage | undefined;
  return row ?? null;
}

export function getPendingSyncPackages(): SyncPackage[] {
  const db = getDatabase();
  return db.prepare(
    "SELECT * FROM sync_packages WHERE status = 'pending' ORDER BY created_at ASC"
  ).all() as SyncPackage[];
}

export function updateSyncPackageStatus(
  id: string,
  status: SyncPackage['status'],
  manifest?: string,
  errorMessage?: string
): void {
  const db = getDatabase();
  const processedAt = status === 'completed' || status === 'failed' ? new Date().toISOString() : null;

  db.prepare(`
    UPDATE sync_packages
    SET status = ?, manifest = ?, error_message = ?, processed_at = ?
    WHERE id = ?
  `).run(status, manifest, errorMessage, processedAt, id);
}
