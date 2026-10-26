# AMS Automated Development and Deployment Design

## Objective

Establish a repeatable development and release workflow for AMS in which:

- a laptop acts only as an IDE client over SSH;
- all development files and services run on the development server;
- GitHub is the source of truth for source code;
- GitHub Actions validates every proposed change;
- versioned Docker images are promoted to production;
- production remains reachable only through the local network;
- PostgreSQL development and production data remain fully separated; and
- production releases include backup, migration, health checks, and application rollback.

## Current Application

AMS is a monorepo containing:

- an Express 4 and TypeScript backend on port 5000;
- a Next.js 16 and React 19 frontend on port 3000;
- PostgreSQL accessed through Drizzle ORM; and
- root npm scripts that coordinate frontend and backend development and builds.

The repository currently has no Docker images, Compose topology, reverse proxy,
CI/CD workflows, automated database backups, or production deployment scripts.
The existing database migration runner is tied to a single SQL file and suppresses
some migration errors, so it must be replaced with journal-based Drizzle migrations.
Database credential fallbacks embedded in source configuration must also be removed.

## Target Architecture

### Developer laptop

The laptop stores no project data. It uses an SSH-capable IDE to open the source
workspace on the development server. Terminals, Git commands, dependency installs,
and application processes all execute remotely.

### Development server

The Ubuntu 22.04.5 LTS development server hosts:

- the Git working tree at `/srv/ams-app/workspace`;
- Docker Engine and Docker Compose;
- development frontend and backend containers with bind mounts and hot reload;
- a PostgreSQL development container with a named persistent volume; and
- a repository-scoped GitHub Actions self-hosted runner.

The development database is never shared with production. PostgreSQL is not
published outside the Docker network unless a deliberate local administration
binding is configured.

### GitHub and image registry

GitHub hosts the canonical repository, pull requests, CI/CD workflows, protected
production environment, and release history. GitHub Container Registry stores two
immutable release images:

```text
ghcr.io/<owner>/ams-frontend:<version>
ghcr.io/<owner>/ams-backend:<version>
```

Production deployment always references an explicit semantic version such as
`v1.2.0`. The mutable `latest` tag is not used to select a production release.

### Production server

The Ubuntu 22.04.5 LTS production server hosts:

- frontend and backend Docker containers;
- a reverse proxy that routes `/` to the frontend and `/api/v1` to the backend;
- native PostgreSQL managed by systemd;
- deployment configuration under `/opt/ams-app`;
- restricted production secrets under `/opt/ams-app/.env`; and
- PostgreSQL backups under `/var/backups/ams-app/postgres`.

Production does not accept connections from the public internet. The self-hosted
runner reaches it over the local network using a dedicated SSH deployment account.
Both servers may make outbound HTTPS connections to GitHub and GHCR.

## Application Containers

Frontend and backend use separate multi-stage Dockerfiles. Development targets
retain development dependencies and run hot-reload commands. Production targets
contain only build output and runtime dependencies and execute as non-root users.

Development Compose uses bind mounts for source code and named volumes for
`node_modules` and PostgreSQL data. Production Compose contains only the frontend
and backend; it connects the backend to native PostgreSQL through a controlled host
route. Production images are selected through an explicit `APP_VERSION` value.

Containers define health checks, restart policies, and bounded log rotation. The
backend readiness endpoint verifies database connectivity in addition to confirming
that the Express process is running.

## Configuration and Secrets

The repository contains documented `.env.example` files with safe placeholder
values. It never contains credentials, private keys, or deployable production
configuration.

Build-time configuration is separated from runtime secrets. Public frontend API
configuration points to the same-origin `/api/v1` route in production, avoiding a
hard-coded server address and unnecessary cross-origin exposure.

Production runtime secrets remain in `/opt/ams-app/.env`, owned by the deployment
administrator with mode `600`. They include the PostgreSQL connection string, JWT
secrets, and environment-specific application settings. GitHub stores only the
credentials needed to orchestrate deployment, including the production SSH key and
pinned SSH host key.

Database connection configuration has no usable credential default. Startup and
migration commands fail clearly when required variables are missing.

## Source Control Workflow

Daily work follows this sequence:

1. The developer connects to the development server using the SSH IDE.
2. Work starts on a `feature/*` or `fix/*` branch.
3. Development containers provide hot reload against the isolated development DB.
4. Schema changes generate versioned Drizzle migration files.
5. Local validation runs before changes are pushed.
6. GitHub CI validates the branch or pull request.
7. Changes merge into the protected `main` branch only after validation succeeds.

The development server is not the only copy of valuable source code. Work is
committed and pushed regularly, and release automation operates from Git refs rather
than from the uncommitted state of the development workspace.

## Continuous Integration

Pull requests and pushes to `main` run validation without access to production
secrets. The pipeline performs:

- deterministic dependency installation;
- backend TypeScript compilation;
- frontend linting and production compilation;
- creation and application of all Drizzle migrations against an ephemeral
  PostgreSQL service;
- backend health and database-readiness checks;
- production Docker image builds; and
- a Compose smoke test of frontend, backend, and ephemeral PostgreSQL.

Failed validation prevents merge when the corresponding GitHub branch protection
rule is enabled.

## Release and Deployment

Production releases are triggered only by an annotated semantic version tag matching
`v*.*.*`. The tag must point to a commit reachable from the protected `main` branch.

The release workflow:

1. Repeats all release-critical validation.
2. Builds frontend and backend images from the tagged commit.
3. Publishes both images to GHCR under the immutable version tag.
4. Enters the protected GitHub `production` environment.
5. Waits for manual production approval.
6. Acquires a concurrency lock so only one production deployment can run.
7. Connects to production over local-network SSH using the pinned host key.
8. Verifies disk space, PostgreSQL readiness, current version, and required config.
9. Creates and verifies a pre-deployment PostgreSQL backup.
10. Pulls the tagged images.
11. Runs journal-based database migration once as a dedicated job.
12. Starts or replaces the application containers.
13. Checks backend readiness and frontend HTTP availability.
14. Records the successfully deployed version as `current-version`.

Deployment stops immediately if preflight checks, backup, image pull, or migration
fails. Secret values are never printed in workflow or shell output.

## Database Migration Policy

All production schema changes use committed, versioned Drizzle migrations. Direct
schema push is permitted only for disposable development experiments and is not part
of CI or production deployment.

Migrations must be backward-compatible with the previous application version.
Destructive changes use an expand-and-contract sequence:

1. add the new structure without removing the old structure;
2. deploy code that tolerates both forms;
3. backfill and validate data;
4. switch all consumers to the new structure; and
5. remove the old structure in a later release.

Database down-migrations are not run automatically during application rollback.
This ensures a failed application release can return to its preceding image without
automatically performing destructive data operations.

## Backup and Restore

Production uses native PostgreSQL backup tools. A backup is created before every
release, and a systemd timer creates scheduled daily backups independently of the
application deployment pipeline.

Each backup:

- uses PostgreSQL custom format;
- is written using a restricted service identity;
- receives a checksum;
- is considered successful only after integrity checks pass; and
- is subject to documented daily and weekly retention rules.

An off-host copy is sent to restricted storage on the development server initially.
This destination can later be replaced by dedicated backup or object storage without
changing application deployment.

Restore is intentionally manual. A restore script requires an explicit backup file
and target database and refuses to overwrite the active production database without
an operator-controlled recovery procedure. A scheduled verification restores a
selected backup into a temporary database and confirms that it can be queried.

## Rollback and Failure Handling

Before deployment, production records the current application version. If container
startup or post-deployment health checks fail, the deployment script restores the
previous frontend and backend image versions and repeats health checks.

Application rollback does not reverse an already successful database migration.
Backward-compatible migrations preserve compatibility with the preceding application
version. Data restoration is reserved for confirmed data incidents and requires a
manual operational decision.

The workflow produces clear non-secret logs for every stage. A failed rollback leaves
the deployment marked failed and prints the exact operator recovery command without
attempting further mutation.

## Security Controls

- The self-hosted runner is scoped to the AMS repository and executes only trusted
  workflows for jobs that can access deployment credentials.
- Pull request workflows, especially those from forks, never receive production
  secrets or use the production deployment runner context.
- Production deployment uses a dedicated `ams-deploy` SSH account rather than root.
- SSH host verification uses a pinned known-host entry; host checking is never
  disabled.
- The PostgreSQL application role receives only application-required privileges.
- PostgreSQL port 5432 is not exposed to the public network.
- Containers run as non-root users and do not mount the Docker socket.
- GitHub production environment protection supplies the manual approval gate.
- Production secrets remain runtime-only and are not embedded in container layers.

## Operational Documentation

Implementation includes concise runbooks for:

- preparing Ubuntu development and production servers;
- registering and securing the GitHub Actions self-hosted runner;
- configuring GitHub repository variables, secrets, environments, and protection;
- starting and resetting the development environment;
- creating and testing Drizzle migrations;
- creating a versioned production release;
- performing application rollback;
- restoring PostgreSQL data; and
- diagnosing failed builds, migrations, health checks, and deployments.

## Acceptance Criteria

The design is complete when the repository provides and documents a workflow where:

1. a clean development server can start AMS and its development PostgreSQL database
   through one documented command;
2. source edits made over SSH are reflected through frontend and backend hot reload;
3. pull requests receive automated build, lint, migration, and smoke validation;
4. no production secret or credential fallback exists in tracked source;
5. a version tag builds immutable frontend and backend images in GHCR;
6. production deployment requires GitHub Environment approval;
7. deployment performs a verified PostgreSQL backup before migration;
8. production runs only the explicitly selected image version;
9. failed application health checks return to the previously recorded image version;
10. scheduled PostgreSQL backups and a guarded restore procedure are documented and
    testable; and
11. production remains inaccessible from the public internet throughout the process.

## Deliberate Non-Goals

- Kubernetes or another container orchestrator.
- Automatic PostgreSQL failover or replication.
- Automatic restoration of production data.
- Copying unredacted production data into development.
- Deploying uncommitted development-server files directly to production.
- Using mutable image tags as the production source of truth.
