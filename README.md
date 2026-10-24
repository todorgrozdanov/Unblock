# Unblock

Unblock is a single-host automation consultation scheduler built for the TeamLift internship challenge.

- **Frontend:** React and TypeScript, using Vite
- **Backend:** NestJS and TypeScript
- **Database:** PostgreSQL, connected through TypeORM in the backend

The frontend lists available consultation slots and submits bookings to the backend. Slot times and date groups use Europe/Skopje. `GET /api/health` checks the API process only, not database connectivity. The starter `GET /` endpoint returns `Hello World!` in backend-only development; the combined deployment serves React at `/` and the protected host interface at `/host`.

## Run locally

Prerequisite: Node.js 24 and npm. Run these commands from the repository root in two separate terminals.

The frontend defaults work without an environment file. The backend needs local database credentials. Copy each example only if its destination does not already exist:

```powershell
if (!(Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

The frontend uses `VITE_API_URL` (development default `http://localhost:3000`, production default same origin). Vite loads `frontend/.env` only during development; production builds ignore frontend environment files. All `VITE_` variables are public browser configuration, so never store secrets in them.

In development, the backend loads `backend/.env` relative to its configuration module, using Node's built-in environment-file support. Existing process environment variables take precedence. Production never loads that local file: configure the provider environment or explicitly use Node's `--env-file` with a separate ignored production file. `FRONTEND_ORIGIN` defaults to `http://localhost:5173` and must match the browser page's exact origin, with no trailing slash. `PORT` defaults to `3000`. Restart the affected development server after changing environment variables; frontend production values are set at build time. Real `.env` files are ignored by Git.

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

Migration commands use the standalone `dist/database/data-source.js` and compiled ESM JavaScript, not a TypeScript runtime loader. Rebuild after changing any entity or migration. NestJS and the migration DataSource share connection settings, entities, and migrations. During development both load `backend/.env` relative to the configuration module before reading settings; production uses only explicitly supplied environment variables. Keep passwords only in ignored environment files or backend deployment secrets.

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
  "confirmationMessage": "Welcome to Unblock! Your consultation is confirmed. Please bring one concrete example of a repetitive task to explore together.",
  "confirmationMessageSource": "fallback",
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

Booked slots disappear from `GET /api/slots` through its existing `NOT EXISTS` filter. The UNIQUE constraint protects each slot from duplicate bookings; the separate slots exclusion constraint prevents the single host from publishing overlapping sessions. No public booking-list endpoint or calendar integration is provided. The optional Gemini message is generated only after a successful save, as described below.

Booking HTTP tests use mocked repositories and cover validation, confirmation, missing/started/booked slots, the specific uniqueness violation, and generic handling of other save failures. A separate real PostgreSQL check sends simultaneous HTTP requests for an identified temporary slot, verifies one 201 and one 409 plus exactly one stored booking and availability exclusion, then deletes that test booking before its test slot.

## Frontend booking flow

Run the backend and frontend in separate terminals using the commands above, then open http://localhost:5173. If no slots exist, open Host access, sign in, and publish a future slot. Booking from the public page saves a real booking.

`BookingPage` owns availability, the selected slot, form details, loading/error states, pending submission, and confirmation. `SlotPicker` groups slots by calendar date in Europe/Skopje, `BookingForm` renders labelled fields with backend-matching limits, and `BookingConfirmation` displays the returned booking details. The API helper uses native fetch and `VITE_API_URL`; shared TypeScript types match the backend response shapes.

The booking flow shows date/time selection first, then the details form with a session summary and a Back action. Back preserves entered details. Availability can be refreshed or retried. Submission disables the form while pending. A 409 clears the selection, preserves details, and refreshes the calendar; other request failures preserve input too. Successful booking replaces the previous steps with confirmation and refreshes availability. **Book another session** resets the details and returns to selection. Focus moves between steps and to submission errors. Form details live only in React memory and are lost on a page reload.

## Host availability management

Use **Book a session** (`/#booking-panel`) for public booking and **Host access** (`/host`) for management. The legacy `/#manage` link still works. The wordmark returns to the hero (`/#book`); **How it works** links to the explanatory section. Management requires the single host password. Visitors can book without logging in. There is no registration, users table, or visitor account system. Changing pages unmounts the previous page, so unsent form input is not retained across navigation.

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

## Optional Gemini booking confirmation

### Local setup (backend only)

The supported SDK is Google's [`@google/genai`](https://ai.google.dev/gemini-api/docs/libraries), installed only in `backend`. The selected model is the stable [`gemini-3.5-flash-lite`](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), suitable for short text generation. Checked on 24 October 2026: Google's [pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists free input and output tokens for this model. Project quotas vary; inspect the actual request/token/day limits in [AI Studio](https://aistudio.google.com/usage?tab=rate-limit), rather than assuming a fixed free allowance. Quotas apply per project, not per key, and provider errors or exhausted quota use Unblock's fallback. No search, grounding, files, chat history, or other tools are enabled.

1. Open [Google AI Studio API keys](https://aistudio.google.com/api-keys), sign in, and create a key in a project showing the Free tier. Do not enable or attach billing for this exercise.
2. Add these settings directly to the ignored `backend/.env`, preserving database and host settings:

   ```dotenv
   GEMINI_API_KEY=your_key_entered_locally_only
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```

3. Restart the backend. Do not paste the key into chat, commands, README, `.env.example`, or frontend variables. Neither setting is exposed through React; never use a `VITE_` secret.
4. After building, run `npm run ai:check` from `backend` only when you intend to make one live request. It uses synthetic session timing, never reads a booking, never writes a database record, never prints the key, and reports the message and its source. On fallback it reports only a safe failure category and HTTP status when available, never raw provider errors, credentials, or request data. These diagnostics are not included in API responses. A fallback exits with a nonzero status so it cannot be mistaken for verified live generation. This command is separate from automated tests.

Google's [additional terms](https://ai.google.dev/gemini-api/terms) say unpaid-service prompts/responses may improve Google products and may be reviewed by humans; EEA/Swiss/UK data-use exceptions apply. Do not submit sensitive or personal information. The terms also require Paid Services when making API clients available to users in the EEA, Switzerland, or UK. This step does not enable billing or deploy the app; review those terms before public use with a free-tier key.

### Data sent and request flow

`BookingsService` validates availability and **saves the booking first**, then calls `AiService.generateConfirmation()` directly. No backend-to-backend HTTP request and no database transaction surrounds the AI call. Invalid, missing-slot, started-slot, and conflicting bookings never invoke Gemini. The existing booking response fields remain, with `confirmationMessage` (plain text) and `confirmationMessageSource` (`"ai"` or `"fallback"`) added.

The only per-session context in the Google prompt is:

```json
{
  "date": "15 January 2030",
  "time": "10:30 GMT+1",
  "durationMinutes": 30,
  "timezone": "Europe/Skopje"
}
```

The request also includes fixed instructions and an output schema. Names, emails, task descriptions, booking/slot IDs, credentials, and other database records are **never included in the prompt**. A new timing-only object is built explicitly instead of serializing an entity. No model responses or AI fields are stored in PostgreSQL, and provider errors/requests are not logged. Google still receives the SDK authentication and normal network/request metadata needed to provide the service.

Gemini returns a one-sentence welcome and one-sentence preparation suggestion in constrained JSON. Unblock validates sentence count/length and rejects markup, links, numbers, extra fields, and unsupported scheduling/email/completion claims. It inserts the authoritative session date, time, duration, and timezone as the middle sentence, producing three plain-text sentences. This keeps session facts out of the model's control. Unsafe, truncated, blocked, empty, or malformed output uses the deterministic fallback instead. The frontend renders text normally, displays **AI-generated** only for source `"ai"`, and retains the authoritative confirmation details and existing booking controls. No generation is triggered by rendering or a React effect.

Unblock waits at most ten seconds, using an abort signal and an independent deadline. The SDK HTTP timeout is also ten seconds because it sets Google's server deadline, which rejects values below ten seconds. Output is capped at 256 tokens, and automatic provider retries are disabled. Cancellation stops waiting locally but does not guarantee Google stops processing the request. Missing key/model, timeout, provider errors, invalid output, and local AI capacity limits all return a friendly fallback. A defensive catch in `BookingsService` also ensures an unexpected AI exception cannot turn a saved booking into a failed booking. The client never automatically retries the booking POST.

### Protected generation endpoint and limits

`POST /api/ai/booking-confirmation` accepts only `{ "bookingId": "a-valid-booking-uuid" }`. It requires the existing host session cookie, matching `Origin`, and `X-CSRF-Token`; the shared ValidationPipe rejects invalid IDs and extra properties. It looks up **only** the linked session timing with a parameterized query and calls the same `AiService`. It returns HTTP 200 with the two message fields, 404 for an unknown booking, 401/403 for failed authentication/CSRF, and 429 when limited. It accepts no user prompt and is not a public LLM proxy. Responses have `Cache-Control: no-store`.

Public `POST /api/bookings` is limited to 10 attempts per socket IP per 15 minutes, including invalid attempts. Host generation is limited to 5 attempts per socket IP per minute after authentication. Limits follow the existing bounded in-memory host-login approach, ignore untrusted forwarded-IP headers, and send `Retry-After` with 429 responses. `AiService` additionally caps actual provider calls at 10 per minute and two concurrent calls across both entry points, returning fallback at capacity. These application limits are not Google's quotas. Like the existing login limit, they reset on restart and require a shared store/explicit trusted-proxy policy before scaling deployment. Login's existing limits are unchanged.

`AiModule` registers the protected controller, service, and Booking repository and is imported by `BookingsModule`, which receives the exported service. The shared `RateLimitModule` provides bounded endpoint counters. No database migration or host-authentication changes are needed for this feature.

### Verification

Both backend Vitest configurations load `test/gemini.mock.ts`, replacing the SDK for **every automated test**, even if a real key exists locally. AI unit and HTTP tests cover valid generation, missing configuration, timeouts/errors, unsafe or empty output, fallback, save-before-generation, successful booking despite AI failure, no generation on invalid/conflicting bookings, host authentication/CSRF, validation, and request limits. They require neither Google access nor PostgreSQL. Run `npm test` and `npm run test:e2e` from `backend`, plus both builds, frontend lint, and the existing frontend timezone/calendar tests. A successful `npm run ai:check` is a separate, explicitly requested live-provider check; passing mocked tests does not prove a key/model is available to your project.

## Public demo and deployment

**Deployment status:** prepared locally; no public URL has been verified yet. Replace this status with the actual URL only after HTTPS checks pass. Google Calendar integration is intentionally deferred.

### Architecture and no-cost limits

The proposed demo uses one **Render Free web service** in Frankfurt and one separate **Neon Free PostgreSQL project** in the closest available region. These are among the providers suggested by TeamLift. No local database contents are uploaded, and the local PostgreSQL server is never exposed.

```text
Browser --HTTPS--> Render (one NestJS process)
                     |-- / and /host: built React app
                     |-- /assets/*: built CSS/JavaScript
                     |-- /api/*: NestJS controllers
                     |-- verified TLS --> dedicated Neon PostgreSQL
                     `-- optional HTTPS --> Gemini (timing only)
```

Render terminates HTTPS and forwards requests to the app, which listens on `0.0.0.0` and the platform's `PORT`. React calls relative `/api` URLs; no production backend URL or secret is compiled into the frontend. Only `/`, `/host`, and `/host/` receive the SPA fallback. Unknown APIs, missing assets, environment paths, and other unknown routes remain 404 responses. The development API greeting is preserved when `SERVE_FRONTEND=false`.

Checked 24 October 2026: [Render Free](https://render.com/docs/free) sleeps after 15 minutes idle, takes about a minute to wake, and provides 750 service hours per workspace/month. Builds and bandwidth have account allowances; without a payment method, excess usage suspends service/builds rather than purchasing more. Free services can restart and have no persistent disk, shell, one-off jobs, or scaling. Monitor the dashboard allowances; do not add payment details. Render's free Postgres expires after 30 days, so it is not used here.

[Neon's current pricing](https://neon.com/pricing) lists Free at $0 with no credit card or time limit, 100 CU-hours/month/project and 1 GB storage/project; confirm the current dashboard limits before creating resources, because older documentation lists smaller storage allowances. Its [free compute scales to zero](https://neon.com/docs/introduction/scale-to-zero) after five minutes idle and resumes on connection. Sleep/wake adds latency. Database rows live in Neon independently of app restarts. Neither free service is an uptime guarantee or a substitute for a production backup plan.

**AI limitation:** the local Gemini integration is implemented and live-tested, but [Google's terms](https://ai.google.dev/gemini-api/terms) require Paid Services for API clients offered to EEA/Swiss/UK users. For a broadly accessible demo without billing, leave production `GEMINI_API_KEY` unset and use the deterministic confirmation fallback. This does not disable local AI. Public live AI verification remains pending until the account/use terms are resolved; do not label fallback as AI-generated or enable billing automatically.

### Reproducible build and runtime

Node is pinned in `.node-version` to the locally verified 24.15.0. Run from the repository root:

```powershell
# Existing dependencies: build both apps without changing your local .env files.
node scripts/build.mjs

# Clean deployment install/build; --prune removes backend development dependencies.
# This second command is for the deployment environment, not daily development.
node scripts/build.mjs --install --prune
```

Each application retains its own npm lockfile; `--install` uses `npm ci --include=dev` so TypeScript/Vite/Nest build tools are available even with `NODE_ENV=production`. Frontend environment files are disabled for production builds, and the root script explicitly sets the public API base to the current origin. Only the backend dependency tree is needed at runtime. Local Vite and Nest watch commands above remain unchanged.

The runtime command is `node scripts/start.mjs`, or with an explicitly prepared production environment file:

```powershell
node --env-file=backend/.env.production scripts/start.mjs
```

The script starts compiled JavaScript, not the Nest CLI. It runs no migrations. Production startup requires an exact HTTPS origin, verified database TLS, a valid host hash, and a random session secret. Graceful shutdown hooks close the database connection pool.

### Production settings and private credential setup

First build, then run this **yourself in a private local terminal**:

```powershell
node scripts/prepare-production-env.mjs
```

It asks for a new production host password with hidden input and creates ignored `backend/.env.production` from the safe example. It writes the scrypt hash and a fresh cryptographically random `SESSION_SECRET` directly to that file without printing either. It refuses to overwrite an existing file. Choose a password different from local development. Open the file privately to complete the remaining settings and transfer values directly to Render's environment dashboard. Never paste the file or values into chat, commit it, screenshot it, or copy the entire development `.env`.

| Variable | Production setting |
| --- | --- |
| `NODE_ENV` | `production` |
| `SERVE_FRONTEND` | `true` |
| `PORT` | Provided by Render; do not override it |
| `FRONTEND_ORIGIN` | Actual assigned `https://...onrender.com` origin, no path or trailing slash |
| `DB_HOST` | Neon **direct**, non-pooled hostname, without a URL scheme or credentials |
| `DB_PORT` | `5432` |
| `DB_NAME` | New dedicated `unblock` database |
| `DB_USER` | Dedicated production role owning that database, such as `unblock_app` |
| `DB_PASSWORD` | That role's production password, entered privately |
| `DB_SSL` | `true`; Node verifies the public CA chain and hostname |
| `HOST_PASSWORD_HASH` | New production hash from the local helper; paste only the value, without .env quotes |
| `SESSION_SECRET` | New 64-character hexadecimal value from the local helper |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` |
| `GEMINI_API_KEY` | Unset for the no-billing public demo pending Google's regional terms |

No `DATABASE_URL` is used; split the Neon connection information into the actual `DB_*` names above. No production secret uses a `VITE_` prefix. TLS uses `ssl: { rejectUnauthorized: true }` and Node's trusted public certificates, as supported by [Neon's verified TLS connections](https://neon.com/docs/connect/connect-securely). Never set `NODE_TLS_REJECT_UNAUTHORIZED=0` or `rejectUnauthorized:false`. The pool is limited to three connections, with short idle timeouts.

Host cookies are signed with HMAC-SHA256 using `SESSION_SECRET` and still contain only an opaque random session ID plus its signature. They are HttpOnly, Secure in production, SameSite=Lax, host-only, and expire after one hour. Every privileged write still requires the server-side session, exact configured Origin, and synchronizer CSRF token. Signing is not a replacement for those checks. Local development uses a process-local signing key if none is configured. This update invalidates previously issued cookies; sign in again.

**Single-instance limitation:** sessions, login/booking/generation counters, and AI concurrency limits are in memory. Run exactly one process/instance, without PM2 clustering. Sleep, restart, or redeploy signs hosts out and resets counters, but does not delete database records. `trust proxy` deliberately remains `false`: [Express requires a verified proxy topology](https://expressjs.com/en/guide/behind-proxies/) before trusting forwarded headers. Secure cookies do not require proxy trust here. Behind Render, visitors may share proxy-IP rate buckets and temporarily share limits. Spoofed forwarding headers cannot select a different bucket. Do not use `trust proxy:true`; establish and test a trusted proxy policy before changing IP attribution or scaling. This conservative limit is suitable only for this small review demo.

### Dashboard setup and migration release

1. Sign in to [Neon](https://console.neon.tech) and [Render](https://dashboard.render.com) using Free plans without a payment method. Complete provider login/terms/permissions yourself when required.
2. In Neon, create a new Free project named `unblock-demo`, choose PostgreSQL 18 (17 also supports these migrations) and the closest region to Render Frankfurt. Do not import or restore local data. In **Roles**, create a dedicated `unblock_app` role; in **Databases**, create `unblock` owned by it. If either already exists, inspect before changing anything. Store its password privately. In **Connect**, select this database/role and turn connection pooling off. Transfer the hostname, database, role and password directly into the separate local production file and provider environment.
3. In Render, choose **New > Web Service**, connect only the Unblock GitHub repository when granting GitHub access, and select branch `main`, Node runtime, Frankfurt, and **Free**. Keep the root directory blank. Review the configuration below **before** selecting Create Web Service. Use the proposed service name's assigned HTTPS origin for `FRONTEND_ORIGIN`; if Render changes the name, update the origin to match. Leave automatic deploys off so pushes do not bypass migration review.
4. Before the first public deploy, run the controlled migration release below against the new Neon database. The code checks the Neon hostname and verified TLS, acquires a PostgreSQL advisory lock to serialize this project's release commands, applies only pending `up` migrations in a transaction, and reports only their count. It never calls `down`, resets a database, imports data, or runs at application startup. Unexpected existing schema conflicts fail rather than deleting data. Check the dedicated database and investigate before retrying.

   ```powershell
   node --env-file=backend/.env.production scripts/release.mjs
   ```

5. Once the migration release succeeds and the reviewed code is on `origin/main`, enter the secret values directly into Render's **Environment** fields and create/deploy the service. `render.yaml` contains the same settings as a reviewable Blueprint; it provisions no database or paid resource. Its `sync:false` fields request private dashboard entry. Do not use the local file as a build artifact.

| Render field | Exact value |
| --- | --- |
| Runtime | Node |
| Plan | Free |
| Region | Frankfurt |
| Branch | `main` |
| Root directory | Blank (repository root) |
| Build command | `node scripts/build.mjs --install --prune` |
| Start command | `node scripts/start.mjs` |
| Health check | `/api/health` |
| Auto-deploy | Off |
| Pre-deploy command | Blank (unavailable on Free) |

[Render's pre-deploy hook is paid-only](https://render.com/docs/deploys). The separate local release command is the no-cost alternative; **do not** run migrations during every cold start or embed production secrets in the build command. Compiled migration imports and TypeORM's CLI use runtime dependencies, so they work after pruning development dependencies.

For redeployment: review code/migrations, run both builds and all tests/lint, push the reviewed commit, run the release command once if schema changed, then use Render **Manual Deploy > Deploy latest commit**. For code-only releases no migration command is needed. Never run local `migration:revert` against production. On failure keep the previous working release and investigate; do not reset Neon. Database backups/exports are a separate owner responsibility.

### Acceptance checks and reviewer access

Before declaring deployment successful, verify the **actual HTTPS URL**: landing/assets/mobile layout, direct `/host`, process/database health, public available-only listing, booking and confirmation, host login/session/logout, protected slot creation and unauthenticated rejection, overlap rejection, and concurrent requests yielding one 201 and one 409. Check persistence after redeploy using an identified synthetic record, then remove only that verification booking followed by its verification slot. Check a fallback confirmation separately; public live AI is pending the terms decision described above. Never fetch or publish an attendee list. Do not delete existing rows to clear tests.

Backend production HTTP tests use mocked databases to check SPA/API separation, assets/404s, CORS, signed Secure cookies, login/session/logout, and tampering. Unit tests check TLS enforcement and production settings without connecting to PostgreSQL. These are not substitutes for hosted database and browser checks. Frontend checks remain `npm run lint` and `node --test tests/scheduling.test.mjs tests/calendar.test.mjs`.

Reviewers can book publicly. To publish availability, ask the project owner privately for the **demo host password** and visit `/host`; the password is deliberately absent from GitHub, public documentation, screenshots, and sample requests. No registration, visitor accounts, public attendee listing, meeting link, or email delivery exists.

### Implemented features, AI tools, and remaining work

Implemented: single-host availability, overlap prevention, atomic double-booking protection, public booking, Europe/Skopje calendar/DST handling, responsive interfaces, protected host access with CSRF and rate limits, and optional Gemini confirmation with a deterministic fallback. OpenAI Codex/ChatGPT assisted implementation, explanations, tests, debugging, and deployment preparation; Gemini is the optional runtime text provider. No attendee details are sent to Gemini.

Known limitations: public deployment and hosted acceptance checks remain pending until provider accounts/secrets are configured; public Gemini is subject to the terms decision above; cold starts and quotas affect availability; in-memory sessions/rate limits require a single instance; proxy clients may share rate limits; there is no cancellation/rescheduling or complete host booked-session view. Google Calendar is intentionally deferred. With more time, add an approved shared session/rate-limit store and tested proxy attribution, operational backups/monitoring, and the deferred calendar integration.
