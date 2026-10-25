# Unblock — Automation Clinic

A single-host automation consultation scheduler built for the TeamLift Product Engineer Internship Challenge. Bring one repetitive task and explore a simpler way to work.

**Stack:** React + TypeScript (Vite), NestJS + TypeScript, PostgreSQL + TypeORM.

## Try the demo

- **Book a session:** https://unblock-todorgrozdanov.onrender.com
- **Publish availability:** https://unblock-todorgrozdanov.onrender.com/host
- **Demo host password:** Unblock123456

Booking is public. To try the host view, enter the demo password and click **Sign in**, choose a future date, time, and duration, then click **Publish slot**. Use **Log out** when finished. This is a shared demo: published slots and bookings are saved and visible through availability changes. Host access requires no username or registration.

The free hosting service may take about a minute to wake. All scheduling uses **Europe/Skopje**.

## What I built

- Host availability publishing with validation, overlap prevention, and password-protected sessions.
- A responsive booking calendar, available times, details form, and confirmation.
- Persistent bookings with database-enforced protection against double booking.
- Timezone/DST handling, loading and error states, retries, and conflict recovery.
- Optional backend Gemini confirmation messages with a deterministic fallback.

## Set up locally

You need **Node.js 24**, npm, Git, and a running **PostgreSQL 17 or 18** server. The commands below use PowerShell and start from the repository root unless stated otherwise.

### 1. Clone and install

```powershell
git clone https://github.com/todorgrozdanov/Unblock.git
cd Unblock
npm --prefix frontend ci
npm --prefix backend ci
```

### 2. Create a local database

For a fresh setup, open **SQL Shell (psql)** and connect as your local PostgreSQL administrator (usually `postgres`). Run:

```sql
CREATE ROLE unblock_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
\password unblock_app
CREATE DATABASE unblock OWNER unblock_app;
```

Enter the database role's password at the hidden `\password` prompts. If this database/role already exists, reuse its settings; do not reset or delete existing data.

### 3. Configure the backend

Copy the example only if you do not already have a local environment file:

```powershell
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

Edit `backend/.env` privately:

| Setting                   | Local value                                  |
| ------------------------- | -------------------------------------------- |
| `DB_HOST` / `DB_PORT`     | `localhost` / `5432`                         |
| `DB_NAME` / `DB_USER`     | `unblock` / `unblock_app`                    |
| `DB_PASSWORD`             | The database role password you chose         |
| `DB_SSL`                  | `false` for the usual local PostgreSQL setup |
| `FRONTEND_ORIGIN`         | `http://localhost:5173`                      |
| `PORT` / `SERVE_FRONTEND` | `3000` / `false`                             |

Create your own **local host login password** (12–256 characters):

```powershell
npm --prefix backend run build
npm --prefix backend run host:password
```

The helper asks twice with hidden input. Copy its generated `HOST_PASSWORD_HASH='...'` line into `backend/.env`. Log in using the password you chose, not the hash. `SESSION_SECRET` can stay blank locally; production requires a separate random secret. Real environment files are ignored by Git. Keep database credentials, API keys, and session secrets out of the frontend and repository.

### 4. Apply migrations

```powershell
npm --prefix backend run migration:run
npm --prefix backend run migration:show
```

These commands use the backend build from the previous step. They apply pending migrations for slots, bookings, and overlap protection. Schema synchronization and automatic startup migrations are disabled.

### 5. Run both apps

**Terminal 1 — backend:**

```powershell
cd backend
npm run start:dev
```

**Terminal 2 — frontend:**

```powershell
cd frontend
npm run dev
```

Open **http://localhost:5173**. Sign in at `/host` with your local host password, publish a slot, then return to **Book a session**. The backend runs at **http://localhost:3000**; `/api/health` checks the process and `/api/health/database` checks PostgreSQL.

The frontend needs no environment file by default. To change the API address, set `VITE_API_URL` in `frontend/.env` and restart Vite. If its port changes, update `FRONTEND_ORIGIN` and restart the backend. Stop either app with **Ctrl+C**.

## Optional Gemini setup

The app works without Gemini. For local AI messages, create a Google AI Studio key and set `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.5-flash-lite` only in `backend/.env`, then restart the backend. Only session date, time, duration, and timezone are sent as booking context; attendee details are excluded.

**The public demo uses fallback messages.** Local Gemini generation was verified separately. Google's regional terms affect public free-tier use; see the [AI setup and terms notes](docs/implementation.md#optional-gemini-booking-confirmation) before enabling it publicly. Missing configuration, provider errors, or timeouts never invalidate a saved booking.

## Build and test

From the repository root:

```powershell
node scripts/build.mjs
npm --prefix backend test
npm --prefix backend run test:e2e
npm --prefix frontend run lint
node --test frontend/tests/scheduling.test.mjs frontend/tests/calendar.test.mjs
```

The build command builds both applications. Backend tests mock database and Gemini dependencies; frontend tests run without a live API. These tests need no real credentials and make no live AI calls.

## AI tools used

I used **OpenAI Codex/ChatGPT** to help plan and explain implementation steps, write and review code, develop tests, debug issues, and prepare deployment. **Gemini** is the optional runtime provider for booking confirmation text.

## Limitations and improvements

- Google Calendar integration is **not implemented**. With more time, I would use calendar busy intervals to hide conflicting slots.
- Add cancellation/rescheduling and a protected view of booked sessions.
- Free hosting has cold starts; sessions and rate limits currently require a single instance and hosts may need to sign in again after restarts.
- Harden production database permissions, add shared session/rate-limit storage with verified proxy handling, and improve backups/monitoring.

The deployment serves React and NestJS from one Render origin, with PostgreSQL on Neon. Detailed API contracts, security explanations, and migration/deployment procedures are preserved in [implementation notes](docs/implementation.md).
