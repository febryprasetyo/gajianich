# Applying database migrations

Run commands from `backend/`. `npm run db:migrate` applies the journal in this directory. The runtime API uses `DATABASE_URL`; the migration CLI uses `MIGRATION_DATABASE_URL` when set, otherwise `DATABASE_URL`.

## HR audit migration (0015)

Before applying 0015, provision a separate runtime PostgreSQL login through the deployment's credential management. Set `HR_AUDIT_RUNTIME_ROLE` to that role name and `MIGRATION_DATABASE_URL` to the migration owner's connection. The runtime role must not own the audit tables, be a member of the migration owner or any privileged role, or have SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, or BYPASSRLS.

Migration 0015 rejects a missing/unsafe runtime role and rolls back atomically. It grants the named role SELECT/INSERT on the three new tables and USAGE on the public schema. It does not create logins, assign passwords, change ownership of existing tables, or grant access to existing business tables. Provision the runtime login's existing business-table privileges separately, using the deployment's established grants. Do not run the application with migration credentials.

UPDATE/DELETE/TRUNCATE on audit events and targets are also rejected by ALWAYS statement triggers, including empty tables. Runtime roles cannot disable those triggers. Database administrators still control database objects; this is not protection against a DBA changing the schema. Audit mutation receipts have a unique actor/operation key; application-level retry handling follows in Task 2.

Existing installations receive the `hr.audit.view` permission and a grant for an existing `hr_attendance` application role. Other role grants are preserved. Fresh installations obtain the permission through the regular RBAC seed. Superadmin continues to use its existing wildcard permission handling.

Keep the custom trigger, grants and permission SQL in 0015 when regenerating schema snapshots. Drizzle does not manage those objects. Schema discovery excludes `*.test.ts` so generation never provisions test databases.

## Integration tests

Use PostgreSQL 16 or newer in a disposable local container. Explicitly set `HR_AUDIT_TEST_DATABASE_URL` to its loopback `gajianich_hr_audit_test` or `gajianich_ci_db` database using a test-only administrator with CREATEDB/CREATEROLE. No fallback to the application's `DATABASE_URL` is allowed. Each test fixture creates a randomly named database and unprivileged login, runs the real journal, tests as that login, then drops only its own database/role. Cleanup never disables audit triggers.

```sh
npx tsx --test src/db/schema/hrAudit.test.ts
npm test
npm run build
```

Missing test configuration fails the test; tests are not silently skipped. Never point this setting at a production cluster. The CI PostgreSQL service supplies the dedicated test instance.

## Deployment scripts

Production and LAN releases apply `deploy/compose.migrate.yml` only to the one-off migration container, so the running API never receives `MIGRATION_DATABASE_URL`. Both release scripts read `MIGRATION_DATABASE_URL` and `HR_AUDIT_RUNTIME_ROLE` from the deployment env file. Provision these before the first release containing 0015.

For LAN installations the PostgreSQL bootstrap role `gajianich_app` is an administrator. Create a different unprivileged login for the API, grant its business-table permissions, and set `DATABASE_URL` to that login. Set `HR_AUDIT_RUNTIME_ROLE` to its name and `MIGRATION_DATABASE_URL` to the bootstrap/migration owner's URL. LAN Compose accepts the explicit runtime `DATABASE_URL`; its legacy default is retained only for compatibility with older releases. `init` does not provision this database login. Fresh installations can start PostgreSQL first, provision the login, and then run `release` with these settings. No existing production credentials or role ownership are changed by Task 1.

The development smoke script provisions a test-only audit role and migrates before waiting for backend readiness. Run that script only against its disposable development stack: its existing cleanup removes the development volume. `npm test` also validates Compose credential separation using `docker compose config`, without starting application containers.
