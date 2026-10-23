# Unblock

Unblock is a single-host automation consultation scheduler built for the TeamLift internship challenge.

- **Frontend:** React and TypeScript, using Vite
- **Backend:** NestJS and TypeScript
- **Planned database:** PostgreSQL (not connected yet)

The frontend checks `GET /api/health` and displays loading, connected, or connection-error feedback. This endpoint checks the API process only, not database connectivity. The starter `GET /` endpoint still returns `Hello World!`.

## Run locally

Prerequisite: Node.js 24 and npm. Run these commands from the repository root in two separate terminals.

The defaults work without environment files. To customize them, copy the safe examples from the repository root:

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
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

Build output is written to each application's dist directory and is ignored by Git. Backend tests use Vitest: the unit test checks the controller's greeting and the end-to-end tests check HTTP GET / and GET /api/health.
