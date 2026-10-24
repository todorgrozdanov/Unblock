# Unblock

Unblock is a single-host automation consultation scheduler built for the TeamLift internship challenge.

- **Frontend:** React and TypeScript, using Vite
- **Backend:** NestJS and TypeScript
- **Database:** PostgreSQL, connected through TypeORM in the backend

The frontend lists available consultation slots and submits bookings to the backend. Slot times and date groups use Europe/Skopje. `GET /api/health` checks the API process only, not database connectivity. The starter `GET /` endpoint still returns `Hello World!`.

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

The second migration, `PreventOverlappingSlots1792890000000`, adds the `EX_slots_no_overlap` PostgreSQL GiST exclusion constraint. It prevents any two slots from sharing time, including booked slots and concurrent inserts or updates. Each range includes its start and excludes its end: 10:00–11:00 and 11:00–11:30 are allowed. End times use UTC arithmetic so duration always means elapsed minutes, including across daylight-saving changes. No extra column or database extension is needed. The migration locks the slots table during its transaction, checks for existing overlaps, and aborts without modifying rows if it finds any. Resolve existing conflicts deliberately before retrying; never delete existing slots automatically.

For deployment, build the backend including `dist/database`, install runtime dependencies, provide the backend environment variables, and run `npm run migration:show` followed by `npm run migration:run` once as a controlled deployment step before starting the application. Use the deployment's PostgreSQL target explicitly and back up existing data first. Do not run migrations concurrently from multiple instances. Production migration commands work without TypeScript or Nest CLI because they execute compiled JavaScript with the runtime TypeORM dependency.

`npm run migration:revert` invokes the most recent migration's `down` method. **The initial down method drops bookings and slots and deletes their data.** It is documented for deliberate rollback only; it was not run during setup. Never use it to reset a database containing data you need. Editing an entity alone does not update existing tables while synchronization is disabled; future schema changes require a new reviewed migration.

## Slots API

Start the backend with `npm run start:dev` from `backend`. The existing greeting and health endpoints are unchanged.

### Create a slot: POST /api/slots

Send JSON containing exactly `startsAt` and `durationMinutes`:

- `startsAt`: a valid ISO 8601 date-time with an explicit timezone (`Z` or a numeric offset such as `+02:00`), strictly in the future when processed by the backend.
- `durationMinutes`: a JSON integer from 1 through 480. Numeric strings are rejected.

Missing, invalid, past-date, and unexpected properties return HTTP 400. Successful creation returns HTTP 201 with `id`, `startsAt`, `durationMinutes`, and `createdAt`. Dates are serialized in UTC. A time overlapping any existing slot returns HTTP 409 with `That time overlaps an existing slot. Choose another start time or duration.` The host form preserves the entered date, time, and duration so they can be adjusted. Back-to-back slots are allowed. GET /api/slots remains public; POST /api/slots requires the host cookie, an allowed Origin, and the session CSRF token.

```powershell
$body = @{
  startsAt = (Get-Date).ToUniversalTime().AddDays(1).ToString('o')
  durationMinutes = 30
} | ConvertTo-Json

# This is the request body. Publish it through the signed-in management page.
# A standalone POST without the host session and CSRF token returns 401/403.
```

Creating a slot through the management page persists it; it is not automatically removed.

### List available slots: GET /api/slots

Returns HTTP 200 with an array of future slots that have no booking, sorted by `startsAt` ascending. Each result contains only `id`, `startsAt`, `durationMinutes`, and `createdAt`; booking names and emails are never selected. Returns `[]` when no slots are available.

```powershell
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/slots'
```

`CreateSlotDto` defines accepted input. A shared global ValidationPipe validates it and rejects unknown properties. The controller delegates to `SlotsService`, which checks the future date and uses the injected TypeORM Slot repository. PostgreSQL enforces non-overlapping ranges; the service maps only error `23P01` from `EX_slots_no_overlap` to HTTP 409. Other save failures return a generic HTTP 500 without SQL or internal errors. Listing uses a parameterized future cutoff and a `NOT EXISTS` booking subquery.

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

Booked slots disappear from `GET /api/slots` through its existing `NOT EXISTS` filter. The UNIQUE constraint protects each slot from duplicate bookings; the separate slots exclusion constraint prevents the single host from publishing overlapping sessions. No public booking-list endpoint or external integrations are provided.

Booking HTTP tests use mocked repositories and cover validation, confirmation, missing/started/booked slots, the specific uniqueness violation, and generic handling of other save failures. A separate real PostgreSQL check sends simultaneous HTTP requests for an identified temporary slot, verifies one 201 and one 409 plus exactly one stored booking and availability exclusion, then deletes that test booking before its test slot.

## Frontend booking flow

Run the backend and frontend in separate terminals using the commands above, then open http://localhost:5173. If no slots exist, open Host access, sign in, and publish a future slot. Booking from the public page saves a real booking.

`BookingPage` owns availability, the selected slot, form details, loading/error states, pending submission, and confirmation. `SlotPicker` groups slots by calendar date in Europe/Skopje, `BookingForm` renders labelled fields with backend-matching limits, and `BookingConfirmation` displays the returned booking details. The API helper uses native fetch and `VITE_API_URL`; shared TypeScript types match the backend response shapes.

The booking flow shows date/time selection first, then the details form with a session summary and a Back action. Back preserves entered details. Availability can be refreshed or retried. Submission disables the form while pending. A 409 clears the selection, preserves details, and refreshes the calendar; other request failures preserve input too. Successful booking replaces the previous steps with confirmation and refreshes availability. **Book another session** resets the details and returns to selection. Focus moves between steps and to submission errors. Form details live only in React memory and are lost on a page reload.

## Host availability management

Use **Book a session** (`#booking-panel`) for public booking and **Host access** (`#manage`) for management. The wordmark returns to the hero (`#book`); **How it works** links to the explanatory section. Management requires the single host password. Visitors can book without logging in. There is no registration, users table, or visitor account system. Changing pages unmounts the previous page, so unsent form input is not retained across navigation.

Enter a date, start time, and integer duration from 1 to 480 minutes. The scheduling timezone is always **Europe/Skopje**, independent of the browser's timezone. The page also displays the browser's timezone for clarity. Dates must resolve to a future instant. Creation uses the existing POST /api/slots endpoint, disables the form while pending, displays the returned slot, and refreshes GET /api/slots. Input is preserved on request failure. Availability has loading, empty, error, refresh, and retry states.

The focused `@js-temporal/polyfill` dependency provides explicit IANA-timezone conversion and daylight-saving disambiguation. `getTimeOptions` interprets a local date/time in Europe/Skopje and compares the earlier and later interpretations with the entered wall-clock time. A skipped spring-forward time is rejected. A repeated autumn time requires choosing the first or second occurrence, labelled with its actual UTC offset and exact instant. The selected instant is sent as an ISO UTC timestamp ending in `Z`; offsets are calculated from timezone rules rather than hardcoded. The browser's default timezone is never used to interpret the scheduling fields.

For example, under the timezone rules currently supplied by the runtime, `2027-10-31 02:30` in Skopje occurs twice: the choices correspond to `00:30Z` and `01:30Z`. A time of `2027-03-28 02:30` does not exist and is blocked.

The page lists only future **available** slots, not a complete booked schedule, and shows no attendee details. Overlap prevention checks all slots at the database level, including booked slots hidden from this list. No bookings-list endpoint or integrations are included.

Frontend checks (Node.js 24):

```powershell
cd frontend
npm run build
npm run lint
npm run test:timezone
```

The timezone tests use Node's built-in test runner and cover winter/summer conversion, skipped and repeated times, invalid input, and the future-time check. They can also be run with the process `TZ` set to another timezone to verify conversion independence, without changing system settings.

## Single-host access

Configure this locally; never paste the password or hash into chat or tracked files:

```powershell
cd backend
npm run build
npm run host:password
```

The helper prompts twice with hidden input (12–256 characters). Copy its generated `HOST_PASSWORD_HASH='...'` line directly into the ignored `backend/.env`, preserving your existing database settings. Only the salted scrypt hash is configured; the plaintext password is not stored. The hash format fixes scrypt at N=32768, r=8, p=3 and a 64-byte key. Restart the backend after setting/changing it. Missing or malformed configuration leaves host login unavailable (503) and slot creation protected; public booking still works. The example env file deliberately leaves this value blank. Do not use any `VITE_` variable for authentication secrets.

Open Host access, sign in, publish slots, and use **Log out** when finished. `GET /api/host/session` returns login status, a CSRF token, and expiry with `Cache-Control: no-store`. Anonymous CSRF sessions last ten minutes; a successful `POST /api/host/login` verifies the password hash with Node's async scrypt and a timing-safe comparison, rotates the opaque session cookie and CSRF token, and starts a fixed one-hour session. Password input is cleared after attempts; the frontend keeps CSRF state only in memory, not localStorage. No password or password hash is returned by the API.

The cookie is HttpOnly, SameSite=Lax, host-only, and path `/`, with a one-hour maximum age after login. In `NODE_ENV=production` it is also Secure and uses the `__Host-` prefix. The server checks expiry independently of cookie expiry. Logout validates CSRF, destroys the server session, and expires the cookie. Restarting the backend invalidates all sessions.

`HostAuthGuard` protects POST /api/slots. Unauthorized requests return 401 before reaching slot persistence. Authenticated creation, login, and logout require the session's synchronizer token in `X-CSRF-Token` and an exact Origin match with `FRONTEND_ORIGIN`; failures return 403. Login itself obtains its CSRF token from the anonymous session first. Cookies use `credentials: include`, and CORS permits credentials only for the configured frontend origin. GET /api/slots, POST /api/bookings, and health endpoints remain public.

Login is limited to five attempts per remote IP per fifteen minutes (including successful attempts), across cookies. Limits use the socket address, ignoring untrusted X-Forwarded-For. Rejected attempts return 429 with Retry-After; at most two password verifications run concurrently. Session and rate-limit maps are bounded and expired entries are cleaned up.

For deployment, use HTTPS and `NODE_ENV=production`, set the host hash through backend secrets, and set `FRONTEND_ORIGIN` to the frontend's exact origin. Frontend/API must be same-site (for example, one origin via a reverse proxy or HTTPS sibling subdomains) for the SameSite cookie; unrelated frontend/backend hosting domains will not support host login with this setup. Do not weaken cookie or CSRF settings to work around that. For this single-process demo, sessions and rate limits are in memory and reset on restart. Multiple backend instances require a shared session/rate-limit store. Behind a proxy, clients share the socket-IP limit until proxy trust/edge rate limiting is explicitly configured for the deployment. No server or database settings are changed automatically.

Backend tests use mocked repositories, a test-only password hash, and cookie-aware HTTP agents. They cover authorization, CSRF on login and host writes, password failures, rotation, expiration, logout invalidation, production cookie attributes, rate limiting, and missing configuration without needing PostgreSQL.

## Calendar and visual design

The booking and host pages share near-black backgrounds, warm off-white text, electric lavender, and restrained yellow accents through ordinary CSS. Shared palette variables and control styles live in `index.css`; `landing/landing.css` contains the approved header and hero composition. Space Grotesk loads through Google Fonts with system fallbacks. Layouts stack on mobile. No UI framework or animation library is used.

`SiteHeader` provides navigation, `Hero` introduces the consultation and explains how it works, and `WorkflowGraphic` uses decorative CSS blocks that separate and settle in under five seconds. Reduced-motion preferences disable that animation and control transitions.

`MonthCalendar` renders Monday-first months and previous/next controls. Only dates with API-provided slots are enabled; Tab and Enter work on native buttons, and arrow keys/Home/End move focus among available dates in the displayed month. `SlotPicker` owns the chosen date and displays time buttons with durations. Choosing a time opens the details step; changing the date or month clears time selection. Refresh reloads availability, and booking success and 409 conflicts clear the selected slot. Repeated DST times display their offsets to distinguish occurrences within Europe/Skopje.

`calendar.ts` provides timezone-aware date keys and date-only month arithmetic using the existing Temporal dependency. `LiveClock` displays ticking time in Europe/Skopje, independently of booking state. Its one-second interval is cleared on unmount, and its changing content is not a live announcement region.

Run the focused calendar checks from `frontend` with `node --test tests/calendar.test.mjs`, alongside the build, lint, and existing timezone checks. They cover Skopje date boundaries, repeated autumn times, leap-year month cells, and year-boundary navigation.
