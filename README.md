# Unblock

Unblock is a single-host automation consultation scheduler built for the TeamLift internship challenge.

- **Frontend:** React and TypeScript, using Vite
- **Backend:** NestJS and TypeScript
- **Planned database:** PostgreSQL (not connected yet)

This foundation contains a simple frontend heading and the NestJS starter endpoint. The applications run independently; they are not connected yet.

## Run locally

Prerequisite: Node.js 24 and npm. Run these commands from the repository root in two separate terminals.

Terminal 1 — frontend:

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173. If that port is busy, Vite prints the alternative port it uses.

Terminal 2 — backend:

```powershell
cd backend
npm run start:dev
```

Open http://localhost:3000. `GET /` returns `Hello World!`. The backend uses port 3000 unless the `PORT` environment variable is set.

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

Build output is written to each application's dist directory and is ignored by Git. Backend tests use Vitest: the unit test checks the controller's greeting and the end-to-end test checks HTTP GET /.
