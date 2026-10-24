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

The backend loads `backend/.env` when started from its directory, using Node's built-in environment-file support. Existing process environment variables take precedence. `FRONTEND_ORIGIN` defaults to `http://localhost:5173` and must match the browser page's exact origin, with no trailing slash. `PORT` defaults to `3000`. Restart the affected development server after changing environment variables; frontend production values are set at build time. Real `.env` files are ignored by Git.

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

Never paste the password into chat, commands, or frontend configuration. Do not commit `.env`; it is ignored by Git. The checked-in `.env.example` contains only a placeholder. Restart the backend after changing configuration. Start it from the `backend` directory so its `.env` is found.

`DatabaseModule` configures TypeORM's PostgreSQL DataSource through a factory that reads the environment after `main.ts` loads `.env`. The DataSource manages the database connection pool and executes queries. NestJS initializes it during startup; the backend requires a working database connection to finish starting.

TypeORM uses `synchronize: false` and `migrationsRun: false`, with no entities or migrations. It does not automatically create or alter application tables. Disabling synchronization avoids unintended schema changes; schema changes will be introduced explicitly in a later step.

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
