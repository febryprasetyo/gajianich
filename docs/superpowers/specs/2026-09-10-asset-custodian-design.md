# Asset Custodian Decoupling Design

## Summary

The asset module must work before the organization supplies a complete HR employee master. IT staff must be able to register reusable asset holders manually, find them later, and reconcile them with official employee records when HR data becomes available.

Authentication remains unchanged. `users` represents application operators, `asset_custodians` represents asset holders, and `employees` remains the authoritative HR directory without being required by asset management.

## Goals

- Create and assign assets while `employees` is empty.
- Search existing holders or create one inline.
- Reuse manual holders rather than copying free text into every asset.
- Preserve historical holder identity after profile changes or reconciliation.
- Link or merge provisional holders with official employees without losing history.
- Resolve official or manual holders during XLSX import.
- Keep the authenticated IT operator separate from the asset holder.

## Non-goals

- Employee login, self-service, or an employee-facing portal.
- Implementing an HR synchronization transport or choosing an HR vendor.
- Replacing `employees` outside asset management.
- Automatically merging people based only on similar names.
- Redesigning unrelated asset categories, maintenance, disposal, accessories, or hardware specifications.

## Terminology

- **User:** Authenticated application operator in `users`, currently an IT role.
- **Employee:** Official HR-supplied or HR-verified person in `employees`.
- **Custodian:** Reusable asset-holder identity, created manually or linked to an employee.
- **Assignment:** Period during which an asset is held by a custodian.
- **Reconciliation:** Linking a custodian to an employee or merging duplicate custodians.

## Current Problem

`assets.assignedToEmployeeId` and `asset_assignment_history.employeeId` reference `employees`. Asset queries join employees directly, assignment rejects unknown employee IDs, and XLSX import resolves holders by employee code. Asset registration therefore depends on HR data even though only IT staff currently use the application.

The audit relationship is different and remains valid: `asset_assignment_history.assignedByUserId` identifies the authenticated IT operator. It must not be used as the asset holder.

## Architecture

Introduce `asset_custodians` as the sole asset-holder directory:

```text
users (authenticated IT operators)
  \_ create and audit asset operations

employees (official HR directory)
  \_ optional one-to-one link
       \_ asset_custodians (asset-holder directory)
            \_ assets.current_custodian_id
            \_ asset_assignment_history.custodian_id
```

Assets and assignment history do not require employees. An employee link enriches and verifies a custodian but does not determine whether that custodian can hold an asset.

## Data Model

### `asset_custodians`

| Column | Type and constraints | Purpose |
|---|---|---|
| `id` | bigint identity, primary key | Stable holder identity |
| `display_name` | varchar(150), not null | Name displayed by asset management |
| `normalized_name` | varchar(150), not null | Lower-cased, trimmed, whitespace-normalized search key |
| `origin` | varchar(20), not null | `MANUAL` or `HRD` |
| `verification_status` | varchar(20), not null | `UNVERIFIED` or `VERIFIED` |
| `employee_id` | bigint, nullable FK to `employees.id` | Optional official HR identity |
| `location_id` | bigint, nullable FK to `locations.id` | Best known location |
| `unit_text` | varchar(150), nullable | Free-text unit before master data is available |
| `notes` | text, nullable | IT-only context |
| `record_status` | varchar(20), not null | `ACTIVE`, `INACTIVE`, or `MERGED` |
| `merged_into_custodian_id` | bigint, nullable self FK | Canonical custodian after merge |
| `created_by_user_id` | bigint, nullable FK to `users.id` | Operator who created the record |
| `created_at` | timestamp, not null | Creation timestamp |
| `updated_at` | timestamp, not null | Last update timestamp |

Constraints and invariants:

- A partial unique index on non-null `employee_id` permits one active canonical custodian per employee.
- `merged_into_custodian_id` is required only when `record_status = 'MERGED'`.
- A custodian cannot merge into itself.
- Merged or inactive custodians cannot receive new assignments.
- `normalized_name` is indexed but not unique because different people can share a name.
- Linking a manual custodian changes `verification_status` to `VERIFIED` but retains `origin = 'MANUAL'`.

### `assets`

Add nullable `current_custodian_id`, referencing an active canonical custodian. Null means no person currently holds the asset. Existing location behavior remains unchanged.

Retain `assigned_to_employee_id` during migration. New writes use `current_custodian_id`; removal occurs only after backfill verification and one stable compatibility release.

### `asset_assignment_history`

Add:

- `custodian_id`, nullable during migration and required for new person assignments;
- `custodian_name_snapshot`, required for new person assignments;
- `location_name_snapshot`, nullable;
- existing `assigned_by_user_id`, retained as the authenticated operator.

Snapshots are immutable. Editing, linking, deactivating, or merging a custodian does not rewrite historical display values. Retain `employee_id` during the compatibility period; new writes use custodian fields.

## Search and Manual Creation

Asset create/edit and assignment forms use one searchable custodian picker:

1. The operator enters a name or employee code.
2. The backend searches active custodians and official employees.
3. Results are grouped as `IT Custodians` and `HR-verified Employees`.
4. Selecting a custodian returns its stable ID.
5. Selecting an employee creates or returns its verified custodian.
6. If no suitable result exists, the operator selects `Add new holder`.
7. Manual creation requires a display name; location, unit, and notes are optional.
8. Exact and similar candidates are shown before confirmation. Similarity never triggers an automatic merge.
9. The new custodian is immediately reusable.

Asset create and assign accept exactly one selection form:

```ts
type CustodianSelection =
  | { custodianId: number; newCustodian?: never }
  | {
      custodianId?: never;
      newCustodian: {
        displayName: string;
        locationId?: number | null;
        unitText?: string | null;
        notes?: string | null;
      };
    };
```

Inline custodian creation, asset mutation, assignment history, and audit logging run in one transaction. Failed asset operations must not leave unused custodians.

## API Design

### Custodian endpoints

- `GET /asset-custodians?search=<term>&status=ACTIVE` searches custodian names and official employee codes/names and returns grouped results.
- `POST /asset-custodians` creates a reusable manual custodian after duplicate-candidate acknowledgement.
- `PATCH /asset-custodians/:id` updates current metadata without changing history snapshots.
- `POST /asset-custodians/:id/link-employee` links a custodian after conflict checks.
- `POST /asset-custodians/:id/merge` moves current references to a canonical custodian and marks the source as merged.
- `GET /asset-custodians/reconciliation-candidates` lists unverified custodians with possible HR matches.

Custodian create, update, link, deactivate, reactivate, and merge require `SuperAdmin` or `ITAdmin`. `ITStaff` may search and select custodians when existing lifecycle authorization permits assignment.

### Asset endpoints

- Create/edit responses expose `currentCustodian`.
- Assignment accepts `CustodianSelection` and rejects inactive or merged custodians.
- Unassignment closes active history and clears `current_custodian_id`.
- List/detail responses include custodian name, origin, verification, employee link, and location.
- History displays immutable custodian snapshots.

During one compatibility release, responses may include existing employee-shaped aliases. They are populated from the linked employee when available and otherwise from the custodian, are read-only, and are removed during cleanup.

## XLSX Import

The standard workbook retains `Employee Code` and `Employee Name`, but resolves them to custodians:

1. A valid employee code resolves or proposes the employee's verified custodian.
2. Without a code, an exact normalized employee-name match reuses an active custodian.
3. Without an exact match, preview proposes an unverified manual custodian.
4. Similar names produce warnings and remain separate without explicit reconciliation.
5. Blank code and name leave the asset unassigned.
6. Conflicting code and name produce an error.

Preview is read-only and labels each row `REUSE`, `CREATE_MANUAL`, `LINK_EMPLOYEE`, `UNASSIGNED`, or `ERROR`. Commit reparses and revalidates against current database state, then creates custodians and assets in one transaction.

This permits the supplied legacy inventory to be converted without first obtaining HR employee codes, while preserving later reconciliation.

## HR Reconciliation

1. Existing employee import or a future HR integration upserts official employees.
2. The reconciliation view lists unverified custodians with possible matches using normalized name and available unit/location context.
3. An administrator explicitly chooses link, merge, or keep separate.
4. Link attaches `employee_id` and marks the custodian verified.
5. Merge transfers current asset references, preserves history snapshots, marks the source `MERGED`, and writes an audit event.
6. Employee updates may refresh explicitly defined current custodian fields but never assignment snapshots.

Names alone never auto-confirm a match, preventing different employees with identical or similar names from being combined.

## Validation and Error Handling

- Reject empty names.
- Use one normalization function for search, exact matching, and import.
- Reject assignment to inactive or merged custodians.
- Reject linking when the employee already belongs to another active custodian and direct the operator to merge.
- Prevent deactivation while a custodian holds an active asset.
- Protect concurrent employee linking with the partial unique index and return a conflict response.
- Warn about concurrent duplicate-like manual creation without silently merging people.
- Use transactions for assignment, unassignment, reconciliation, and import.
- Return 4xx for expected validation/conflict failures and 500 without database details for unexpected failures.

## Audit Requirements

Audit logs record manual creation, metadata changes, employee links, merges, asset assignment/unassignment, and XLSX import decisions. Every event identifies the authenticated `users.id` operator. The holder is recorded separately by custodian ID and immutable history snapshots.

## Migration and Rollout

### Phase 1: Additive schema

- Create `asset_custodians`, constraints, and indexes.
- Add nullable custodian and snapshot columns.
- Create a verified custodian for every employee referenced by existing assets or assignments.
- Backfill current and historical custodian references and snapshots.
- Verify counts and orphan checks before cutover.

### Phase 2: Application cutover

- Add custodian domain/service operations and endpoints.
- Switch asset list/detail/create/edit and lifecycle operations to custodians.
- Add the searchable picker and inline manual creation.
- Update XLSX preview and commit resolution.
- Keep read-only compatibility aliases and legacy columns for one stable release.

### Phase 3: HR reconciliation UI

- Add candidate listing, employee linking, and explicit merge controls.
- Exercise reconciliation with imported inventory and representative HR records.

### Phase 4: Legacy cleanup

- Confirm no code writes legacy employee assignment fields.
- Back up the database and run documented recovery checks.
- Remove compatibility aliases and direct employee assignment columns in a separate migration.
- Retain `employees` and all user/audit relationships.

## Testing Strategy

### Domain and service

- Normalize names consistently across manual entry, search, and import.
- Detect exact and similar candidates without automatic merging.
- Resolve an official employee to one verified custodian.
- Reject linking one employee to two active custodians.
- Merge current references while preserving snapshots.
- Reject assignment to inactive or merged custodians.

### Controllers and integration

- Create and assign an asset with an empty employee table.
- Atomically create an inline custodian and assignment.
- Roll back custodian creation when the asset mutation fails.
- Search manual custodians and official employees.
- Enforce authorization and conflicts for link and merge.
- Preserve snapshots after edits and merges.

### Import

- Resolve a valid employee code.
- Reuse an exact manual custodian.
- Propose and create a manual custodian from a name.
- Warn on similar names.
- Reject conflicting code/name data.
- Keep preview read-only.
- Roll back commit on stale or invalid resolution.

### Frontend

- Search, select, and clear a custodian.
- Create a manual holder inline.
- Show duplicate warnings and require acknowledgement.
- Display `UNVERIFIED` and `VERIFIED` badges.
- Disable invalid assignment and reconciliation actions.
- Display snapshot names in history.

### Release verification

- Run backend tests and TypeScript build.
- Run frontend unit tests, lint, and production build.
- Run migration validation and the repository release workflow.
- Rehearse database backup and recovery before destructive cleanup.

## Success Criteria

- IT can create and assign assets with zero employees.
- Manual custodians are searchable and reusable.
- Similar names are visible without being auto-merged.
- History retains the original holder name after edits, links, or merges.
- HR data can verify custodians without rewriting history.
- Duplicate custodians can merge without losing current references or auditability.
- XLSX import supports employee-code resolution and manual-name creation.
- Authenticated IT users remain audit actors and are never treated as holders.
- Migration, backend, frontend, build, and release checks pass.


## Approved implementation amendment

The user subsequently requested that Computer Hardware Specifications must not be mandatory. All hardware fields are optional individually: a computer can have no specifications or a partially populated specification. Blank values remain unknown (null); supplied numeric sizes and slot counts must still be positive integers. Apply this consistently to asset create/edit, database constraints, and XLSX import. An entirely empty specification is represented by no specification row.
