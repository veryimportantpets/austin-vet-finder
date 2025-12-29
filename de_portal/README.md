# DE Portal

A local-first web application for Digital Empathy to manage WordPress website build projects with a client-facing portal and an internal designer/admin dashboard.

## Features

- **Multi-tenant Architecture**: Each client organization is isolated
- **Role-based Access**: Admin, Designer, and Client roles
- **Task Cards**: Clients complete tasks with text and file uploads
- **Page Review Workflow**: Approve/request changes on page previews
- **Project Chat**: Threaded messaging with triage states
- **Internal Inbox**: "Needs DE Response" triage for fast response
- **Notifications**: In-app, email, and Slack webhook notifications
- **Google Drive Integration**: Optional cloud storage for file uploads
- **Schedule Management**: Build schedule with blocking detection
- **Change Requests**: Client-initiated scope change requests

## Tech Stack

- Python 3.11+
- Django 5.x
- Server-rendered templates + HTMX
- Bootstrap 5 (CDN)
- SQLite (default, Postgres-ready)

## Quick Start

### 1. Clone and Setup

```bash
cd de_portal
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings (the defaults work for local development)
```

### 3. Initialize Database

```bash
python manage.py migrate
python manage.py loaddata fixtures/page_types.json
python manage.py loaddata fixtures/project_templates.json
python manage.py createsuperuser
```

### 4. Run the Server

```bash
python manage.py runserver
```

Visit http://127.0.0.1:8000/admin/ to log in and set up your first project.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | Auto-generated for dev |
| `DEBUG` | Debug mode | `1` (enabled) |
| `ALLOWED_HOSTS` | Comma-separated hosts | `127.0.0.1,localhost` |
| `EMAIL_BACKEND` | Email backend | Console (prints to terminal) |
| `DEFAULT_FROM_EMAIL` | Sender email | `portal@digitalempathy.local` |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | (empty) |
| `STORAGE_BACKEND` | `local` or `gdrive` | `local` |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_PATH` | Path to service account JSON | (empty) |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Drive folder for uploads | (empty) |
| `CREDENTIALS_ENCRYPTION_KEY` | Fernet key for credential storage | (empty) |

### Generate Encryption Key

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Setting Up Google Drive Integration

1. Create a Google Cloud project
2. Enable the Google Drive API
3. Create a service account and download the JSON key
4. Set `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_PATH` to the path of the JSON file
5. Either:
   - Set `GOOGLE_DRIVE_ROOT_FOLDER_ID` to a folder ID, OR
   - Set `GOOGLE_DRIVE_SHARED_DRIVE_ID` for a shared drive
6. Share the folder/drive with the service account email
7. Set `STORAGE_BACKEND=gdrive`

If Drive is not configured, the app falls back to local storage automatically.

## Setting Up Slack Notifications

1. Create a Slack app with incoming webhooks
2. Add a webhook to your desired channel
3. Copy the webhook URL to `SLACK_WEBHOOK_URL`

Slack notifications are sent for:
- New client messages (needs_de)
- Client task submissions
- Overdue task daily summary
- Page approvals

## Creating Your First Project

1. Log in to `/admin/`
2. Create a ClientOrg (organization)
3. Create a User with role=client and add them to the org via Membership
4. Create a Project assigned to the org
5. Create a User with role=designer and assign them to the project
6. The client can now log in and see their project

## User Roles

- **Admin**: Full access, can create projects and manage templates
- **Designer**: Manages assigned projects, creates pages/cards, reviews submissions
- **Client**: Sees portal, completes tasks, uploads files, reviews pages

## Project Workflow

1. **Discovery Phase**
   - Client completes onboarding tasks
   - Designer creates sitemap
   - Client approves sitemap (triggers schedule generation)

2. **Creative Phase**
   - Designer builds pages
   - Content collection cards are created per page
   - Client provides content and uploads images
   - Designer marks pages ready for review
   - Client approves pages

3. **Launch Phase**
   - Client provides domain credentials
   - Client gives final approval
   - Designer launches the site

## URL Structure

### Client-Facing
- `/home/` - Dashboard with progress and next steps
- `/tasks/` - Task list
- `/pages/` - Page list with review status
- `/messages/` - Project chat
- `/card/<id>/` - Task detail

### Designer/Admin
- `/dashboard/` - Inbox and schedule overview
- `/inbox/` - All threads with triage states
- `/projects/` - Project list
- `/project/<id>/` - Project overview
- `/project/<id>/sitemap/` - Sitemap editor
- `/project/<id>/schedule/` - Build schedule

## Management Commands

```bash
# Create migrations after model changes
python manage.py makemigrations

# Run migrations
python manage.py migrate

# Create a superuser
python manage.py createsuperuser

# Load seed data
python manage.py loaddata fixtures/page_types.json
python manage.py loaddata fixtures/project_templates.json
```

## Development Notes

- Magic link auth sends emails to console by default
- File uploads go to `./media/` by default
- HTMX is used for in-place updates without page reloads
- All templates extend `base.html`

## Future Enhancements (Not in MVP)

- Email reply-to-thread ingestion
- @mentions in messages
- Full audit trail
- Bulk actions
- Complex dependency graphs
- Celery/Redis for background tasks
- Postgres for production

## License

Proprietary - Digital Empathy
