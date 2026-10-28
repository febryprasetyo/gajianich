# AMS Automated Development and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AMS reproducibly developable on the SSH development server and safely releasable to the local-only production server through tested, versioned, approval-gated automation.

**Architecture:** Frontend and backend run in Docker in both environments; development also runs PostgreSQL in Compose, while production connects to native PostgreSQL. GitHub Actions validates changes and a repository-scoped self-hosted runner builds GHCR images and deploys tagged releases to production over LAN SSH with backup, migration, health checks, and application rollback.

**Tech Stack:** Ubuntu 22.04.5 LTS, Docker Engine, Docker Compose v2, Node.js 20, Express 4, Next.js 16, PostgreSQL 16, Drizzle ORM, GitHub Actions, GHCR, Nginx, Bash, systemd.

**Spec:** `docs/superpowers/specs/2026-08-20-automated-development-deployment-design.md`

## Global Constraints

- The laptop is an SSH IDE client and stores no project data.
- Development and production PostgreSQL databases and credentials are fully separate.
- Production remains inaccessible from the public internet.
- Production deploys only explicit semantic-version image tags; never `latest`.
- Production migration uses committed Drizzle migrations; never `drizzle-kit push`.
- Production deployment requires GitHub Environment approval.
- Every release creates and verifies a PostgreSQL backup before migration.
- Migration rollback is never automatic; application rollback requires backward-compatible migrations.
- Existing user changes in the worktree must not be overwritten or included in unrelated commits.
- Secrets, SSH keys, database passwords, and usable credential defaults must never enter Git.

## File Map

- `backend/src/config/env.ts`: validate and expose backend runtime configuration.
- `backend/src/app.ts`: construct Express application independently from the listener.
- `backend/src/server.ts`: start and gracefully stop the HTTP server and database pool.
- `backend/src/utils/jwt.ts`: sign and verify tokens using validated runtime configuration.
- `backend/src/db/index.ts`: own PostgreSQL pool, Drizzle client, and readiness query.
- `backend/src/db/migrate.ts`: apply the complete Drizzle journal.
- `backend/src/app.test.ts`: backend health/readiness tests.
- `backend/Dockerfile`: backend development, build, migration, and production targets.
- `frontend/Dockerfile`: frontend development and standalone production targets.
- `frontend/next.config.ts`: enable standalone Next.js output.
- `compose.dev.yml`: hot-reload frontend/backend and isolated PostgreSQL development database.
- `.env.example`: documented non-secret Compose development values.
- `.dockerignore`, `backend/.dockerignore`, `frontend/.dockerignore`: control build contexts.
- `deploy/compose.prod.yml`: version-pinned production frontend/backend/reverse-proxy topology.
- `deploy/nginx.conf`: same-origin routing and proxy health behavior.
- `deploy/scripts/preflight.sh`: validate production prerequisites and configuration.
- `deploy/scripts/backup-postgres.sh`: create and verify one PostgreSQL custom-format backup.
- `deploy/scripts/deploy.sh`: migrate, replace containers, health-check, and rollback applications.
- `deploy/scripts/rollback.sh`: explicitly select and restore a preceding application version.
- `deploy/scripts/restore-postgres.sh`: guarded restore to a non-active target database.
- `deploy/scripts/verify-postgres-backup.sh`: restore the newest backup into an isolated verification database and query it.
- `deploy/systemd/ams-postgres-backup.service`: scheduled backup unit.
- `deploy/systemd/ams-postgres-backup.timer`: daily schedule.
- `deploy/systemd/ams-postgres-verify.service`: scheduled restore-verification unit.
- `deploy/systemd/ams-postgres-verify.timer`: weekly verification schedule.
- `scripts/validate-compose.sh`: render and assert development/production Compose invariants.
- `.github/workflows/ci.yml`: unprivileged pull-request and main-branch validation.
- `.github/workflows/release.yml`: tag validation, GHCR publication, approval, and LAN deployment.
- `docs/operations/development.md`: SSH development and migration workflow.
- `docs/operations/server-setup.md`: development/production host preparation.
- `docs/operations/release.md`: GitHub settings, versioning, deploy, and rollback.
- `docs/operations/database-recovery.md`: backup verification and guarded restore runbook.
- `README.md`: short entry points into the containerized workflow and runbooks.

---

### Task 1: Backend Configuration and Readiness Boundary

**Files:**
- Create: `backend/src/config/env.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/app.test.ts`
- Modify: `backend/src/db/index.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/src/utils/jwt.ts`
- Modify: `backend/src/controllers/infrastructureController.ts`
- Modify: `backend/package.json`
- Modify: `backend/tsconfig.json`

**Interfaces:**
- Produces: `loadEnv(source?: NodeJS.ProcessEnv): AppEnv` including the Accurate service URL.
- Produces: `checkDatabase(): Promise<void>` and `closeDatabase(): Promise<void>`.
- Produces: `createApp(databaseCheck?: () => Promise<void>): Express`.
- Produces: `GET /health/live` and `GET /health/ready`.

- [ ] **Step 1: Add a failing environment validation test**

Use Node's test runner in `backend/src/app.test.ts` and assert that `loadEnv({})`
throws a message naming `DATABASE_URL`, while a complete source returns typed port,
environment, and secrets.

```ts
test('loadEnv rejects missing required settings', () => {
  assert.throws(() => loadEnv({}), /DATABASE_URL/);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test --prefix backend -- --test-name-pattern="loadEnv"`

Expected: FAIL because `src/config/env.ts` does not exist.

- [ ] **Step 3: Implement strict environment loading**

Create `AppEnv` with `port`, `nodeEnv`, `databaseUrl`, `jwtSecret`,
`jwtRefreshSecret`, and `accurateLicenseServerUrl`. Reject missing values, invalid
URLs, and invalid ports; do not provide database, JWT, or local-network service
defaults. Add `"test": "tsx --test src/**/*.test.ts"` to backend scripts.

```ts
export interface AppEnv {
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  accurateLicenseServerUrl: string;
}
```

- [ ] **Step 4: Add failing liveness and readiness tests**

Start `createApp()` on an ephemeral port. Assert liveness returns 200, successful
database readiness returns 200, and a rejected database check returns 503 without
including the database error message.

```ts
assert.equal(live.status, 200);
assert.equal(ready.status, 200);
assert.equal(unready.status, 503);
assert.deepEqual(await unready.json(), { status: 'NOT_READY' });
```

- [ ] **Step 5: Extract app construction and database lifecycle**

Move middleware and routes to `createApp`. Export the PostgreSQL pool, implement
`checkDatabase` with `SELECT 1`, and implement `closeDatabase` with `pool.end()`.
Keep `server.ts` limited to loading config, listening, and handling `SIGTERM` and
`SIGINT` with graceful close. Inject the validated JWT secret into token helpers and
the validated Accurate URL into the infrastructure controller; remove both existing
fallback values.

- [ ] **Step 6: Run backend verification**

Run: `npm test --prefix backend && npm run build --prefix backend`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 7: Commit the backend boundary**

```bash
git add backend/src/config/env.ts backend/src/app.ts backend/src/app.test.ts backend/src/db/index.ts backend/src/server.ts backend/src/utils/jwt.ts backend/src/controllers/infrastructureController.ts backend/package.json backend/package-lock.json backend/tsconfig.json
git commit -m "feat(backend): add validated config and readiness checks"
```

### Task 2: Journal-Based Database Migration

**Files:**
- Create: `backend/src/db/migrate.test.ts`
- Modify: `backend/src/db/migrate.ts`
- Modify: `backend/drizzle.config.ts`
- Modify: `backend/package.json`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: required `DATABASE_URL` from `loadEnv`.
- Produces: `runMigrations(databaseUrl: string, migrationsFolder?: string): Promise<void>`.
- Produces: `npm run db:migrate` as the only production schema application command.

- [ ] **Step 1: Write a failing migration source test**

Test that the migration module imports `migrate` from
`drizzle-orm/node-postgres/migrator`, targets the complete `drizzle` directory, and
contains no reference to `0000_elite_ares.sql` or ignored PostgreSQL error codes.

- [ ] **Step 2: Confirm the migration test fails**

Run: `npm test --prefix backend -- --test-name-pattern="migration runner"`

Expected: FAIL because the current runner parses a single SQL file and suppresses
errors.

- [ ] **Step 3: Replace the custom SQL parser with Drizzle migrator**

Implement `runMigrations` using a short-lived `Pool`, `drizzle(pool)`, and
`migrate(db, { migrationsFolder })`; always close the pool in `finally`. Resolve the
default folder from the project root so the compiled production command can find
`/app/drizzle`.

- [ ] **Step 4: Remove credential fallbacks**

Make `drizzle.config.ts` require `DATABASE_URL` and throw a clear configuration error
when absent. Update `backend/.env.example` with placeholders only. Retain `db:push`
but label it development-only in documentation.

- [ ] **Step 5: Verify the migration journal on ephemeral PostgreSQL**

Run PostgreSQL 16 temporarily, set a test `DATABASE_URL`, run `npm run db:migrate
--prefix backend` twice, and query `__drizzle_migrations` to prove the second run is
idempotent.

Expected: both migration commands exit 0 and the journal contains one applied entry.

- [ ] **Step 6: Commit migration safety**

```bash
git add backend/src/db/migrate.ts backend/src/db/migrate.test.ts backend/drizzle.config.ts backend/package.json backend/.env.example
git commit -m "fix(db): use journal-based Drizzle migrations"
```

### Task 3: Reproducible Development Containers

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`
- Create: `.dockerignore`
- Create: `compose.dev.yml`
- Create: `.env.example`
- Create: `scripts/validate-compose.sh`
- Modify: `package.json`

**Interfaces:**
- Consumes: backend `GET /health/ready`.
- Produces: `npm run dev:up`, `dev:down`, `dev:logs`, and `dev:check`.
- Produces: Compose services `postgres`, `backend`, and `frontend`.

- [ ] **Step 1: Write a failing Compose contract checker**

Create `scripts/validate-compose.sh` that runs `docker compose config` and asserts:
the dev database has a health check and named volume; backend waits for healthy
PostgreSQL; source directories are bind-mounted; and no literal production secret
appears in the rendered model.

- [ ] **Step 2: Run the contract checker and confirm failure**

Run: `bash scripts/validate-compose.sh dev`

Expected: FAIL because `compose.dev.yml` does not exist.

- [ ] **Step 3: Add multi-stage backend and frontend Dockerfiles**

Use `node:20-bookworm-slim`, deterministic `npm ci`, and non-root runtime users.
Backend targets: `development`, `build`, `migrate`, `production`. Frontend targets:
`development`, `build`, `production`. Do not copy `.env` files into any stage.

- [ ] **Step 4: Add development Compose**

Define PostgreSQL 16 with named volume and `pg_isready`; backend with source bind
mount, isolated `node_modules`, port 5000, and readiness health check; frontend with
source bind mount, isolated `node_modules`, port 3000, and dependency on backend.
Use environment substitutions documented in root `.env.example`.

- [ ] **Step 5: Add root development commands**

```json
{
  "dev:up": "docker compose --env-file .env -f compose.dev.yml up --build -d",
  "dev:down": "docker compose --env-file .env -f compose.dev.yml down",
  "dev:logs": "docker compose --env-file .env -f compose.dev.yml logs -f",
  "dev:check": "bash scripts/validate-compose.sh dev"
}
```

- [ ] **Step 6: Verify rendered Compose and hot-reload topology**

Run: `cp .env.example .env && npm run dev:check && docker compose --env-file .env -f compose.dev.yml build`

Expected: contract checker exits 0 and all development images build.

- [ ] **Step 7: Commit development containers**

```bash
git add .dockerignore .env.example compose.dev.yml scripts/validate-compose.sh package.json backend/Dockerfile backend/.dockerignore frontend/Dockerfile frontend/.dockerignore
git commit -m "feat(dev): add containerized AMS environment"
```

### Task 4: Production Images and Same-Origin Routing

**Files:**
- Modify: `frontend/next.config.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `deploy/compose.prod.yml`
- Create: `deploy/nginx.conf`
- Create: `deploy/.env.example`
- Modify: `scripts/validate-compose.sh`

**Interfaces:**
- Produces: standalone Next.js runtime image.
- Produces: production services `proxy`, `frontend`, and `backend`.
- Produces: same-origin browser API route `/api/v1`.

- [ ] **Step 1: Add failing production Compose assertions**

Extend the contract checker to assert explicit `${APP_VERSION:?}` image tags,
non-root/read-only settings where supported, health checks, bounded `json-file` log
rotation, no PostgreSQL container, and no published backend/frontend ports.

- [ ] **Step 2: Confirm the production contract fails**

Run: `bash scripts/validate-compose.sh prod`

Expected: FAIL because production topology does not exist.

- [ ] **Step 3: Enable standalone frontend output and same-origin API**

Set `output: 'standalone'` in Next config. Change the browser fallback API base from
`http://localhost:5000/api/v1` to `/api/v1`; development supplies
`NEXT_PUBLIC_API_URL=http://<dev-host>:5000/api/v1` through Compose when needed.

- [ ] **Step 4: Define production proxy and Compose topology**

Nginx routes `/api/v1/` to `backend:5000/api/v1/`, `/health/backend` to backend
readiness, and all other requests to `frontend:3000`. Compose pulls versioned GHCR
images, publishes only proxy port 8080 by default, and connects backend to native
PostgreSQL using `host.docker.internal:host-gateway`.

- [ ] **Step 5: Verify production rendering and images**

Run: `APP_VERSION=v0.0.0 GHCR_OWNER=test bash scripts/validate-compose.sh prod`

Run: `docker build --target production -t ams-backend:test backend && docker build --target production -t ams-frontend:test frontend`

Expected: contract checker and both production builds exit 0.

- [ ] **Step 6: Commit production topology**

```bash
git add frontend/next.config.ts frontend/src/lib/api.ts deploy/compose.prod.yml deploy/nginx.conf deploy/.env.example scripts/validate-compose.sh
git commit -m "feat(deploy): add versioned production topology"
```

### Task 5: Unprivileged Continuous Integration

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `scripts/smoke-test.sh`
- Modify: `package.json`

**Interfaces:**
- Consumes: development Compose and application health endpoints.
- Produces: required GitHub status check `ci / validate`.

- [ ] **Step 1: Add a failing local CI command**

Add `npm run ci` to perform backend tests/build, frontend lint/build, and both Compose
contract checks. Run it before defining the supporting workflow and record the first
failure.

- [ ] **Step 2: Create the CI workflow**

Trigger on pull requests and pushes to `main`. Use a GitHub-hosted Ubuntu runner for
untrusted validation, PostgreSQL 16 service credentials dedicated to CI, Node 20,
`npm ci` in root/backend/frontend, migration twice, application checks, image builds,
and `scripts/smoke-test.sh`. Grant `contents: read` only and no production environment.

- [ ] **Step 3: Implement the smoke test with cleanup trap**

Start the Compose stack under a unique project name, wait with bounded retries for
backend readiness and frontend HTTP 200, and always run `docker compose down -v` from
an EXIT trap. Print container logs only after failure.

- [ ] **Step 4: Run the full local CI equivalent**

Run: `npm run ci`

Expected: all unit, build, Compose contract, migration, image, and smoke checks pass.

- [ ] **Step 5: Commit CI**

```bash
git add .github/workflows/ci.yml scripts/smoke-test.sh package.json
git commit -m "ci: validate AMS builds migrations and containers"
```

### Task 6: Production Backup and Guarded Restore

**Files:**
- Create: `deploy/scripts/lib.sh`
- Create: `deploy/scripts/backup-postgres.sh`
- Create: `deploy/scripts/restore-postgres.sh`
- Create: `deploy/scripts/verify-postgres-backup.sh`
- Create: `deploy/tests/backup-restore.bats`
- Create: `deploy/systemd/ams-postgres-backup.service`
- Create: `deploy/systemd/ams-postgres-backup.timer`
- Create: `deploy/systemd/ams-postgres-verify.service`
- Create: `deploy/systemd/ams-postgres-verify.timer`

**Interfaces:**
- Produces: `backup-postgres.sh` printing the verified backup path on stdout.
- Produces: `restore-postgres.sh BACKUP_FILE TARGET_DATABASE` refusing the configured active DB.
- Produces: `verify-postgres-backup.sh` using a temporary database with cleanup trap.
- Consumes: `/opt/gajianich/.env` and `BACKUP_DIR`.

- [ ] **Step 1: Write failing backup/restore shell tests**

Using Bats with stubbed `pg_dump`, `pg_restore`, and `sha256sum`, verify restrictive
umask, custom-format dump, checksum creation, integrity verification, cleanup after
failure, off-host transfer after verification, explicit target requirement, refusal
to restore into `POSTGRES_DB`, and verification-database cleanup after success or
failure.

- [ ] **Step 2: Run tests and confirm failure**

Run: `bats deploy/tests/backup-restore.bats`

Expected: FAIL because backup and restore scripts do not exist.

- [ ] **Step 3: Implement shared safe shell helpers and backup**

Use `set -Eeuo pipefail`, `umask 077`, explicit required-variable checks, timestamped
`.dump` files, `pg_dump --format=custom`, `pg_restore --list`, SHA-256 sidecars, and
atomic rename from a temporary file. Retain 14 daily and 8 weekly copies according to
documented filename classes without deleting the newly created backup. After local
verification, copy the dump and checksum to the pinned `OFFSITE_BACKUP_TARGET` over
SSH using `OFFSITE_SSH_HOST_KEY`; an off-host copy failure makes the job fail visibly
but never deletes the valid local backup.

- [ ] **Step 4: Implement guarded restore**

Require an existing dump and a non-empty target database unequal to `POSTGRES_DB`.
Verify checksum and archive listing before invoking `createdb`/`pg_restore`; refuse
implicit overwrite and never drop any database.

- [ ] **Step 5: Implement scheduled restore verification**

Select the newest checksum-valid backup, create a uniquely named temporary database,
restore it, query the Drizzle migration journal and representative AMS schema tables,
then drop only that exact temporary database in an EXIT trap. Refuse any temporary
database name that does not start with `ams_restore_verify_`.

- [ ] **Step 6: Add systemd backup and verification schedules**

The backup service runs `/opt/gajianich/deploy/scripts/backup-postgres.sh` as the
restricted backup identity with `EnvironmentFile=/opt/gajianich/.env`. Its timer uses
`OnCalendar=daily`, `Persistent=true`, and randomized delay. A separate service and
timer run `verify-postgres-backup.sh` weekly; both scripts use the same explicit
`flock` file to prevent overlap.

- [ ] **Step 7: Run backup tests and shell validation**

Run: `bats deploy/tests/backup-restore.bats && shellcheck deploy/scripts/*.sh`

Expected: all Bats tests pass and ShellCheck reports no errors.

- [ ] **Step 8: Commit backup tooling**

```bash
git add deploy/scripts/lib.sh deploy/scripts/backup-postgres.sh deploy/scripts/restore-postgres.sh deploy/scripts/verify-postgres-backup.sh deploy/tests/backup-restore.bats deploy/systemd/ams-postgres-backup.service deploy/systemd/ams-postgres-backup.timer deploy/systemd/ams-postgres-verify.service deploy/systemd/ams-postgres-verify.timer
git commit -m "feat(ops): add verified PostgreSQL backup and restore"
```

### Task 7: Transactional Application Deployment and Rollback

**Files:**
- Create: `deploy/scripts/preflight.sh`
- Create: `deploy/scripts/deploy.sh`
- Create: `deploy/scripts/rollback.sh`
- Create: `deploy/tests/deploy.bats`

**Interfaces:**
- Consumes: `deploy/compose.prod.yml`, `/opt/gajianich/.env`, GHCR login, and backup script.
- Produces: `deploy.sh VERSION` and `rollback.sh VERSION`.
- Produces: `/opt/gajianich/current-version` only after successful health checks.

- [ ] **Step 1: Write failing deployment state-machine tests**

Stub Docker, curl, SSH-independent filesystem operations, and backup commands. Verify
invalid version rejection, preflight-before-mutation ordering, backup-before-migration,
migration-before-up, current-version update only after health, and rollback to the
recorded preceding version after failed health checks.

- [ ] **Step 2: Confirm deployment tests fail**

Run: `bats deploy/tests/deploy.bats`

Expected: FAIL because deployment scripts do not exist.

- [ ] **Step 3: Implement preflight checks**

Validate semantic version format, required files and variables, Docker/Compose,
available disk threshold, PostgreSQL `pg_isready`, GHCR image manifests, and current
version readability. Do not alter containers or the database.

- [ ] **Step 4: Implement deployment state machine**

Acquire `flock`, call preflight, record the prior version, create verified backup,
pull exact images, run the backend `migrate` target once, start Compose, and poll
frontend/backend health with bounded retries. Atomically write `current-version` only
after success. On application health failure, restore the preceding version and
re-check it. Do not run down-migrations or database restore.

- [ ] **Step 5: Implement explicit rollback command**

Validate the requested explicit tag exists in GHCR, pull it, start that version,
verify health, and atomically record it. Require operator confirmation when stdin is
interactive and `--yes` for non-interactive use.

- [ ] **Step 6: Run deployment tests and shell validation**

Run: `bats deploy/tests/deploy.bats && shellcheck deploy/scripts/*.sh`

Expected: all tests pass and ShellCheck exits 0.

- [ ] **Step 7: Commit deployment tooling**

```bash
git add deploy/scripts/preflight.sh deploy/scripts/deploy.sh deploy/scripts/rollback.sh deploy/tests/deploy.bats
git commit -m "feat(deploy): add health-gated release and rollback"
```

### Task 8: Approval-Gated GitHub Release Workflow

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `scripts/validate-release-workflow.sh`

**Interfaces:**
- Consumes: annotated tag `v*.*.*`, GitHub `production` environment, GHCR, and LAN SSH.
- Produces: immutable frontend/backend GHCR images and approved production deployment.

- [ ] **Step 1: Write a failing workflow policy checker**

Assert the workflow triggers only on `v*.*.*`, declares `contents: read` and
`packages: write`, uses a concurrency group, associates deployment with environment
`production`, scans the production host into a temporary known-hosts file, and never
contains `StrictHostKeyChecking=no`.

- [ ] **Step 2: Confirm the policy checker fails**

Run: `bash scripts/validate-release-workflow.sh`

Expected: FAIL because release workflow does not exist.

- [ ] **Step 3: Implement validation and image publication jobs**

Verify the tag is annotated, semantic, and its commit is reachable from `origin/main`.
Reuse the same release-critical commands as CI. Authenticate with `${{ github.token }}`
and publish both images under `${{ github.ref_name }}` without publishing `latest`.

- [ ] **Step 4: Implement approved LAN deployment job**

Target labels `[self-hosted, linux, x64, ams-dev]`, depend on successful image
publication, declare `environment: production`, and set a deployment concurrency
group. Build a pinned known-hosts file from the `PROD_SSH_HOST_KEY` secret and invoke
`deploy.sh <tag>` over SSH. Never make production SSH secrets available to build jobs.

- [ ] **Step 5: Validate workflow policy**

Run: `bash scripts/validate-release-workflow.sh`

Expected: PASS with no forbidden mutable tag or disabled SSH verification.

- [ ] **Step 6: Commit release workflow**

```bash
git add .github/workflows/release.yml scripts/validate-release-workflow.sh
git commit -m "ci: publish and deploy approved AMS releases"
```

### Task 9: Operator Runbooks and End-to-End Acceptance

**Files:**
- Create: `docs/operations/development.md`
- Create: `docs/operations/server-setup.md`
- Create: `docs/operations/release.md`
- Create: `docs/operations/database-recovery.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: all commands and file locations produced by Tasks 1–8.
- Produces: complete setup, daily development, release, rollback, and recovery procedures.

- [ ] **Step 1: Write the development runbook**

Document SSH IDE connection, repository clone, `.env` creation, `npm run dev:up`, log
inspection, migration generation/application, branch workflow, and safe teardown.
Explicitly state that development source must be committed/pushed regularly.

- [ ] **Step 2: Write the server setup runbook**

Provide exact Ubuntu 22.04 commands for Docker repository setup, Compose plugin,
native PostgreSQL 16 production role/database, firewall bindings, `ams-deploy` account,
`/opt/gajianich` permissions, GHCR login, self-hosted runner labels, systemd timer
installation, and pinned SSH host key acquisition.

- [ ] **Step 3: Write GitHub and release runbook**

List exact repository variables/secrets, production Environment reviewer setup,
branch protection check name, annotated tag commands, workflow observation, current
version inspection, rollback invocation, and response to each deployment failure stage.

- [ ] **Step 4: Write database recovery runbook**

Document backup listing/checksum/archive verification, restore into a new temporary
database, application validation against restored data, planned switchover requiring
maintenance approval, and explicit prohibition on blind automated production restore.

- [ ] **Step 5: Update root README entry points**

Replace outdated direct-run production guidance with Docker development quick start
and links to all four operational runbooks. Keep a short native command reference for
diagnostics only.

- [ ] **Step 6: Run full acceptance verification**

Run:

```bash
npm run ci
bats deploy/tests/backup-restore.bats deploy/tests/deploy.bats
shellcheck scripts/*.sh deploy/scripts/*.sh
bash scripts/validate-release-workflow.sh
git diff --check
```

Expected: every command exits 0. Manually confirm no tracked `.env`, key, dump, or
credential appears in `git status` or `git grep`.

- [ ] **Step 7: Commit operations documentation**

```bash
git add README.md docs/operations/development.md docs/operations/server-setup.md docs/operations/release.md docs/operations/database-recovery.md
git commit -m "docs: add AMS development and release runbooks"
```

### Task 10: Clean-Host Dress Rehearsal

**Files:**
- Modify only files proven defective by the rehearsal; each correction must include a regression test in the owning task's test suite.

**Interfaces:**
- Consumes: complete repository, disposable development host/VM, and staging database.
- Produces: recorded evidence that the documented process works without undocumented state.

- [ ] **Step 1: Recreate development from a clean checkout**

On disposable Ubuntu 22.04, follow `docs/operations/development.md` without additional
commands. Verify frontend, backend readiness, PostgreSQL persistence across container
restart, hot reload, and migration idempotency.

- [ ] **Step 2: Exercise a non-production release against staging**

Create a temporary semantic tag, publish images, configure a staging GitHub
Environment and local-network target, approve it, and verify backup-before-migration,
container replacement, health checks, and `current-version` recording.

- [ ] **Step 3: Prove application rollback**

Deploy a deliberately unhealthy application image to staging and verify the script
returns to the preceding healthy image without restoring or down-migrating PostgreSQL.

- [ ] **Step 4: Prove backup recovery away from production**

Restore a verified staging backup into a new database, run migrations/readiness, and
query representative AMS tables. Record command outputs in the release checklist;
do not commit database contents or secrets.

- [ ] **Step 5: Fix rehearsal defects using regression tests**

For each defect, first add a failing test to the owning Bats, Node, or validation
suite; make the smallest fix; rerun the focused suite and then the full acceptance
commands from Task 9.

- [ ] **Step 6: Commit only if rehearsal exposed defects**

```bash
git add --patch
git commit -m "fix(ops): address clean-host rehearsal findings"
```

If no defects are found, do not create an empty commit.
