# DE Connect - Veterinary PIMS Data Connector

A product-grade data connector platform for veterinary Practice Information Management Systems (PIMS). Supports multiple acquisition modes for maximum compatibility.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Practice Machine                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ Setup Wizard│───▶│  Sync Service   │───▶│ Adapter Runner  │  │
│  └─────────────┘    └────────┬────────┘    └────────┬────────┘  │
│                              │                      │            │
│                              │              ┌───────┴───────┐   │
│                              │              │   Adapters    │   │
│                              │              ├───────────────┤   │
│                              │              │ • AVImark     │   │
│                              │              │ • Cornerstone │   │
│                              │              │ • Pulse       │   │
│                              │              │ • ezyVet      │   │
│                              │              │ • ExportDrop  │   │
│                              │              └───────────────┘   │
└──────────────────────────────┼──────────────────────────────────┘
                               │ HTTPS (mTLS/JWT)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          DE Cloud                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │  Cloud API  │───▶│ Ingestion Worker│───▶│    Database     │  │
│  └─────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     Admin Dashboard                          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Acquisition Modes

### Mode 1: Direct/Supported (Best)
- On-prem: Read local database directly (AVImark via CarsonDB, Cornerstone)
- Cloud: Use official API when available (ezyVet)

### Mode 2: Export Automation (No API but hands-off)
- Browser automation triggers vendor-provided exports (CSV/ZIP)
- Connector parses exports → normalizes → uploads
- More stable than DOM scraping

### Mode 3: Export Drop (Universal fallback)
- User manually exports files to a watched folder
- Connector validates + uploads automatically
- Works everywhere, even locked-down environments

## Quick Start

```bash
# Install dependencies
cd de-connect
npm install

# Start development
npm run dev:api      # Cloud API on :3001
npm run dev:service  # Sync service
npm run dev:wizard   # Setup wizard on :3002
```

## Directory Structure

```
de-connect/
├── agent/
│   ├── contracts/     # Adapter interfaces and canonical models
│   ├── runner/        # Adapter execution engine
│   ├── service/       # Background sync service
│   └── adapters/      # PIMS-specific adapters
│       ├── demo/
│       ├── export-drop/
│       ├── pulse/
│       ├── avimark/
│       └── cornerstone/
├── cloud/
│   ├── api/           # Registration, ingestion, health endpoints
│   ├── worker/        # Sync package processing
│   └── migrations/    # Database migrations
├── wizard/            # Web-based setup wizard
├── shared/            # Common utilities
└── sample-data/       # Demo data for testing
```

## Canonical Data Model

All adapters emit data in this standardized format:

- **Client**: source_client_id, first_name, last_name, email, phone, address
- **Patient**: source_patient_id, source_client_id, name, species, breed, dob, sex
- **Appointment**: source_appointment_id, starts_at, status, reason
- **Reminder**: due_date, reminder_type, description
- **Invoice**: invoice_date, total, line_items

Every record includes:
- `practice_id` - Unique practice identifier
- `source_system` - PIMS type (avimark/cornerstone/pulse/ezyvet)
- `source_record_id` - Original ID from source system
- `last_seen_at` - Timestamp of last sync

## Sync Package Format

```
sync_2024-01-15T02-00-00Z.zip
├── manifest.json       # Metadata + integrity hashes
├── clients.ndjson
├── patients.ndjson
├── appointments.ndjson
├── reminders.ndjson
└── invoices.ndjson
```

## License

Proprietary - All rights reserved
