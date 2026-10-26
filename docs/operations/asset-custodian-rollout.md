# Asset custodian rollout

Asset holders now live in `asset_custodians`. HR employees are optional; authenticated application users remain audit actors. Manual and verified holders can be selected from inventory forms and managed at **Master Data → Asset Custodians**.

Computer Hardware Specifications are optional, including individual fields. Empty values remain unknown, partial data is accepted, and supplied numeric values must be positive integers.

## Migrations and application cutover

1. Back up the database using the [database recovery runbook](database-recovery.md).
2. Stop application writes while applying the additive migration and deploying the matching application version.
3. From the backend directory, run `npm run db:migrate`.
4. Run the queries below and resume application traffic with the custodian-aware version.
5. Check manual creation/assignment, employee selection, return, XLSX preview/commit, and reconciliation.

Migration `0007_asset_custodians` creates the holder directory and nullable references/snapshots, backfills employees referenced by existing assets or person-assignment history, then checks source/target counts and aborts on unresolved legacy references. It deliberately leaves unreferenced HR employees out of the new directory. Historical location snapshots use the asset's location at cutover because the old history table did not record locations; they cannot reconstruct earlier locations.

Migration `0008_optional_computer_specs` removes the four mandatory hardware constraints (CPU, RAM capacity, RAM slot count, primary disk capacity). Existing data and positive-value checks remain intact.

The implementation was rehearsed on a separate PostgreSQL database. Migration fixture tests additionally exercise backfill, historical snapshots, orphan rejection, and optional hardware fields inside transactions that roll back.

## Verification queries

Immediately after migration, before accepting new writes, these queries should return zero:

```sql
SELECT count(*) AS missing_current_backfill
FROM assets WHERE current_user_id IS NOT NULL AND current_custodian_id IS NULL;

SELECT count(*) AS missing_history_backfill
FROM asset_assignment_history
WHERE employee_id IS NOT NULL
  AND (custodian_id IS NULL OR custodian_name_snapshot IS NULL);
```

After cutover, legacy employee values are intentionally frozen and can differ from current assignments. Use the following ongoing integrity checks instead; each should return zero:

```sql
SELECT count(*) AS invalid_current_holders
FROM assets a LEFT JOIN asset_custodians c ON c.id = a.current_custodian_id
WHERE a.current_custodian_id IS NOT NULL
  AND (c.id IS NULL OR c.record_status <> 'ACTIVE');

SELECT count(*) AS incomplete_person_history
FROM asset_assignment_history
WHERE custodian_id IS NOT NULL AND custodian_name_snapshot IS NULL;

SELECT count(*) AS duplicate_active_employee_links
FROM (
  SELECT employee_id FROM asset_custodians
  WHERE employee_id IS NOT NULL AND record_status = 'ACTIVE'
  GROUP BY employee_id HAVING count(*) > 1
) duplicates;
```

Compare pre-migration counts of distinct referenced employees, assigned assets, and person-history rows with the backfilled custodian counts in a migration rehearsal. Do not run the immediate-backfill comparison after ordinary holder reassignment or return.

## API compatibility

- Inventory reads and writes expose `currentCustodianId` and `currentCustodian`.
- New writes select `custodianId` or `newCustodian`. Create can omit both for unassigned inventory; edit can send `custodianId: null` to return the asset.
- `assignedToEmployeeId` and `currentCustodianId` are read-only input fields and are rejected if sent in mutation payloads.
- Employee-shaped response aliases derive from the current holder and linked employee. A manual holder has a display-name alias and a null employee-ID/code alias.
- The physical legacy column is `assets.current_user_id` (the previous TypeScript property was `assignedToEmployeeId`). `asset_assignment_history.employee_id` also remains in place.
- Directory search and official-employee resolution require IT lifecycle roles. Manual creation, editing, activation, linking, and merging require SuperAdmin or ITAdmin.
- Directory notes are IT-only and are omitted from inventory holder objects.
- Selecting an HR employee uses `POST /asset-custodians/resolve-employee` with `{ employeeId }`. This creates or returns its canonical verified holder. It never automatically links a manual profile by name.
- Duplicate-like manual creation returns `409 DUPLICATE_CANDIDATES`. The UI shows candidates and requires explicit acknowledgement to create a different person.
- XLSX preview labels decisions `REUSE`, `CREATE_MANUAL`, `LINK_EMPLOYEE`, `UNASSIGNED`, or `ERROR`. Code/name conflicts and ambiguous exact names require workbook correction. Commit revalidates the uploaded workbook against current data inside a transaction.

All holder-affecting transactions acquire the same PostgreSQL transaction advisory lock before asset/custodian row locks. This serializes assignment, reconciliation, and import to keep concurrent duplicate warnings reliable and prevent inverse lock ordering.

## Recovery and later cleanup

Keep the additive columns and old assignment columns for at least one stable compatibility release. After new writes begin, rolling back only the application binary to the employee-only version would show stale assignments because old columns are no longer maintained. Recover the database and matching application version together using the documented backup/restore procedure, or roll forward with a fix.

Phase 4 is intentionally a later migration: verify no code writes legacy fields, take a fresh backup, rehearse an isolated restore, and then remove legacy aliases and direct employee assignment columns. Do not remove `employees`, custodian employee links, authenticated users, or assignment/audit snapshots.
