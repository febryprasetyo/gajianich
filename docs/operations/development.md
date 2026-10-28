# GAJIANICH Development Environment Runbook

## Overview

The GAJIANICH development environment is hosted entirely on the Ubuntu development server (`gajianich-dev`). The developer laptop acts solely as an SSH IDE client (VS Code / Antigravity / Cursor over SSH) and stores no local project code or secrets.

---

## 1. Connecting to the Development Server

1. Open your SSH-capable IDE.
2. Connect to the development server:
   ```bash
   ssh <username>@<dev-server-ip>
   ```
3. Open the workspace directory at `/srv/gajianich/workspace` (or your clone location).

---

## 2. Initial Setup

1. Copy the development environment template:
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   ```
2. Review the `.env` files. The default development values connect to the isolated containerized PostgreSQL database (`gajianich_dev_db`).

---

## 3. Starting the Development Stack

Start the hot-reloading container stack (PostgreSQL, Express Backend, Next.js Frontend):
```bash
npm run dev:up
```

- **Frontend:** http://localhost:3000 (proxied through SSH port forwarding if developing remotely)
- **Backend API:** http://localhost:5000/api/v1
- **Health / Readiness:** http://localhost:5000/health/ready
- **PostgreSQL Database:** `127.0.0.1:5432` (database: `gajianich_dev_db`, user: `postgres`, password: `postgres`)

---

## 4. Managing Development Containers

- **View live streaming logs:**
  ```bash
  npm run dev:logs
  ```
- **Check container status and configuration:**
  ```bash
  npm run dev:check
  ```
- **Stop development containers:**
  ```bash
  npm run dev:down
  ```
- **Reset development database (wipes and recreates named volume):**
  ```bash
  docker compose -f compose.dev.yml down -v
  npm run dev:up
  npm run db:migrate --prefix backend
  ```

---

## 5. Database Schema & Migration Workflow

GAJIANICH strictly uses journal-based Drizzle migrations. Direct push (`db:push`) is prohibited.

1. **Modify Schema:**
   Edit schema files in `backend/src/db/schema/*.ts`.
2. **Generate Migration Files:**
   ```bash
   npm run db:generate --prefix backend
   ```
   This generates a versioned SQL file in `backend/drizzle/` and updates `backend/drizzle/meta/_journal.json`.
3. **Apply Migrations Locally:**
   ```bash
   npm run db:migrate --prefix backend
   ```
4. **Seed Initial Development Data (Optional):**
   ```bash
   npm run seed --prefix backend
   ```

---

## 6. Pre-Commit Validation

Before pushing any branch or creating a pull request, run the full validation suite locally:
```bash
npm run ci
```
This runs:
- Compose specification validation
- Backend unit and readiness tests (`npm test --prefix backend`)
- Backend TypeScript compilation (`npm run build --prefix backend`)
- Frontend ESLint checks (`npm run lint --prefix frontend`)
- Frontend standalone production compilation (`npm run build --prefix frontend`)
