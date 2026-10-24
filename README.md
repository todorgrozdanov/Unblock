# Unblock

Unblock is a single-host automation consultation scheduler built for the TeamLift internship challenge.

- **Frontend:** React and TypeScript, using Vite
- **Backend:** NestJS and TypeScript
- **Database:** PostgreSQL, connected through TypeORM in the backend

The frontend checks `GET /api/health` and displays loading, connected, or connection-error feedback. This endpoint checks the API process only, not database connectivity. The starter `GET /` endpoint still returns `Hello World!`.

## Run locally

Prerequisite: Node.js 24 and npm. Run these commands from the repository root in two separate terminals.

The frontend defaults work without an environment file. The backend needs local database credentials. Copy each example only if its destination does not already exist:

```powershell
if (!(Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

The frontend uses `VITE_API_URL` (default `http://localhost:3000`). Vite loads `frontend/.env`; all `VITE_` variables are public browser configuration, so never store secrets in them.

The backend loads `backend/.env` relative to its configuration module, using Node's built-in environment-file support. Existing process environment variables take precedence. `FRONTEND_ORIGIN` defaults to `http://localhost:5173` and must match the browser page's exact origin, with no trailing slash. `PORT` defaults to `3000`. Restart the affected development server after changing environment variables; frontend production values are set at build time. Real `.env` files are ignored by Git.

Terminal 1 — frontend:

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173. If that port is busy, Vite prints the alternative port it uses; update the backend's `FRONTEND_ORIGIN` to that origin and restart the backend.

Terminal 2 — backend:

```powershell
cd backend
npm run start:dev
```

Open http://localhost:3000. `GET /` returns `Hello World!`; `GET /api/health` returns `{"status":"ok","service":"Unblock API"}`. If you change `PORT`, update the frontend's `VITE_API_URL` too. Reload the frontend to check the connection again.

Stop either server with Ctrl+C.

## Local database configuration

The existing PostgreSQL database is `unblock`, owned by application role `unblock_app`. Edit `backend/.env` locally and set:

- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_NAME=unblock`
- `DB_USER=unblock_app`
- `DB_PASSWORD`: enter the password you set for this role directly in your editor. Quote it if it contains spaces or `#` characters, following Node's `.env` syntax.

Never paste the password into chat, commands, or frontend configuration. Do not commit `.env`; it is ignored by Git. The checked-in `.env.example` contains only a placeholder. Restart the backend after changing configuration. Run npm commands from the `backend` directory.

`DatabaseModule` configures TypeORM's PostgreSQL DataSource through a factory that reads the environment after `main.ts` loads `.env`. The DataSource manages the database connection pool and executes queries. NestJS initializes it during startup; the backend requires a working database connection to finish starting.

TypeORM uses `synchronize: false` and `migrationsRun: false`. The Slot and Booking entities describe the tables, but only explicitly running migrations changes the schema. Starting NestJS never automatically applies migrations.

After startup, open http://localhost:3000/api/health/database. It executes only `SELECT 1` and returns `{"status":"ok","database":"connected"}` on success. Query failures return HTTP 503 with a generic message. `/api/health` remains an API-process check and `/` still returns the greeting.

## Install dependencies after cloning

Each application has its own package.json and package-lock.json. There is no root npm package.

```powershell
cd frontend
npm ci
cd ../backend
npm ci
```

## Build and test

From the repository root:

```powershell
cd frontend
npm run build
cd ../backend
npm run build
npm test
npm run test:e2e
```

Build output is written to each application's dist directory and is ignored by Git. Backend tests use Vitest and override the database dependency, so no running PostgreSQL server or real credentials are needed. HTTP tests cover the greeting, API health, and database health success and failure responses. These automated tests do not verify a real database connection; checking the running database-health endpoint after local configuration does.

The backend has a scoped npm override for `@nestjs/platform-express` to use Multer 2.5.0 instead of its pinned 2.4.0, addressing CVE-2026-113872 (GHSA-q7qp-rjg7-q26m). Unblock does not currently use file uploads or asynchronous file filters. Remove the override once a compatible NestJS release includes the patched dependency.

## Database migrations

Run from `backend`, with PostgreSQL running and backend-only environment variables configured:

```powershell
npm run build
npm run migration:show
npm run migration:run
npm run migration:show
```

Migration commands use the standalone `dist/database/data-source.js` and compiled ESM JavaScript, not a TypeScript runtime loader. Rebuild after changing any entity or migration. NestJS and the migration DataSource share connection settings, entities, and migrations. Both load `backend/.env` relative to the configuration module before reading settings; existing process environment values take precedence. Keep passwords only in local `.env` or backend deployment secrets.

The first migration creates `public.slots` and `public.bookings`, using PostgreSQL's built-in `gen_random_uuid()` for IDs and `now()` for creation timestamps. Slots require a start time and a positive integer duration. Bookings require a name, email, and slot ID; task descriptions are nullable. A foreign key requires an existing slot and prevents deletion of booked slots. A UNIQUE constraint allows at most one booking per slot. There is no separate `isBooked` flag. TypeORM also maintains a `public.migrations` history table.

For deployment, build the backend including `dist/database`, install runtime dependencies, provide the backend environment variables, and run `npm run migration:show` followed by `npm run migration:run` once as a controlled deployment step before starting the application. Use the deployment's PostgreSQL target explicitly and back up existing data first. Do not run migrations concurrently from multiple instances. Production migration commands work without TypeScript or Nest CLI because they execute compiled JavaScript with the runtime TypeORM dependency.

`npm run migration:revert` invokes the most recent migration's `down` method. **The initial down method drops bookings and slots and deletes their data.** It is documented for deliberate rollback only; it was not run during setup. Never use it to reset a database containing data you need. Editing an entity alone does not update existing tables while synchronization is disabled; future schema changes require a new reviewed migration.

## Slots API

Start the backend with `npm run start:dev` from `backend`. The existing greeting and health endpoints are unchanged.

### Create a slot: POST /api/slots

Send JSON containing exactly `startsAt` and `durationMinutes`:

- `startsAt`: a valid ISO 8601 date-time with an explicit timezone (`Z` or a numeric offset such as `+02:00`), strictly in the future when processed by the backend.
- `durationMinutes`: a JSON integer from 1 through 480. Numeric strings are rejected.

Missing, invalid, past-date, and unexpected properties return HTTP 400. Successful creation returns HTTP 201 with `id`, `startsAt`, `durationMinutes`, and `createdAt`. Dates are serialized in UTC. There is no overlap prevention in this step, and these endpoints do not yet require authentication.

```powershell
$body = @{
  startsAt = (Get-Date).ToUniversalTime().AddDays(1).ToString('o')
  durationMinutes = 30
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/slots' `
  -ContentType 'application/json' -Body $body
```

This example creates a persistent slot; it is not automatically removed.

### List available slots: GET /api/slots

Returns HTTP 200 with an array of future slots that have no booking, sorted by `startsAt` ascending. Each result contains only `id`, `startsAt`, `durationMinutes`, and `createdAt`; booking names and emails are never selected. Returns `[]` when no slots are available.

```powershell
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/slots'
```

`CreateSlotDto` defines accepted input. A shared global ValidationPipe validates it and rejects unknown properties. The controller delegates to `SlotsService`, which checks the future date and uses the injected TypeORM Slot repository. Listing uses a parameterized future cutoff and a `NOT EXISTS` booking subquery. The schema and migrations remain unchanged.

The automated slots HTTP tests replace the repository, and the SQL-generation test builds TypeORM metadata without connecting to PostgreSQL. They do not require the local database. A separate real-database verification can create identified test records, check persistence and availability, and delete only those specific records afterward.

## Booking API

### Create a booking: POST /api/bookings

Send JSON with:

- `slotId`: a valid UUID identifying an existing slot.
- `name`: a string, trimmed before validation and storage, nonempty after trimming, maximum 100 characters.
- `email`: a valid email address, maximum 254 characters.
- `taskDescription`: optional string, maximum 2000 characters; omit it when not needed. Explicit `null` is rejected.

Unknown properties, missing required fields, and invalid values return HTTP 400. A missing slot returns 404. A slot that has started or is already booked returns 409. Successful creation returns HTTP 201 with this explicit confirmation shape:

```json
{
  "id": "booking-uuid",
  "name": "Alex Example",
  "email": "alex@example.com",
  "taskDescription": "Automate a weekly report",
  "slot": {
    "id": "slot-uuid",
    "startsAt": "2099-01-01T10:00:00.000Z",
    "durationMinutes": 30
  }
}
```

If the description is omitted, the confirmation contains `taskDescription: null`. UUID labels in this response illustration are placeholders; actual IDs are UUIDs.

PowerShell example using the first available slot (creates a persistent booking):

```powershell
$available = @(Invoke-RestMethod -Uri 'http://localhost:3000/api/slots')
if ($available.Count -eq 0) { throw 'Create a future slot first.' }
$body = @{
  slotId = $available[0].id
  name = 'Alex Example'
  email = 'alex@example.com'
  taskDescription = 'Automate a weekly report'
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/bookings' `
  -ContentType 'application/json' -Body $body
```

The controller delegates to `BookingsService`. The service uses injected Slot and Booking repositories to check the slot, check availability, and save the booking to PostgreSQL. The preliminary check improves feedback but cannot prevent a race: two simultaneous requests can both see an available slot. The existing database UNIQUE constraint on `bookings.slotId` allows only one insert. The service recognizes SQLSTATE `23505` specifically for `UQ_bookings_slotId` and returns a friendly 409; unrelated save errors receive a generic 500 without SQL or internal details.

Booked slots disappear from `GET /api/slots` through its existing `NOT EXISTS` filter. No public booking-list endpoint is provided. Authentication, overlap prevention, frontend changes, and external integrations are not part of this step. No schema changes or new migrations are required.

Booking HTTP tests use mocked repositories and cover validation, confirmation, missing/started/booked slots, the specific uniqueness violation, and generic handling of other save failures. A separate real PostgreSQL check sends simultaneous HTTP requests for an identified temporary slot, verifies one 201 and one 409 plus exactly one stored booking and availability exclusion, then deletes that test booking before its test slot.
