# Asset Custodian Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement and review these tasks.

**Goal:** Register, assign, import, and reconcile reusable asset holders without requiring HR employees.

**Architecture:** Independent custodian directory and immutable assignment snapshots. Holder creation, assignment, reconciliation, and import mutations run in PostgreSQL transactions. Legacy employee assignment columns stay read-only for one compatibility release.

**Tech Stack:** TypeScript, Express, Drizzle ORM, PostgreSQL, ExcelJS, Next.js 16, React 19, node:test.

**Spec:** `docs/superpowers/specs/2026-09-10-asset-custodian-design.md`

## Global Constraints

- Authentication and user audit actors remain unchanged.
- Names alone never automatically link employees or merge people.
- Metadata mutations require SuperAdmin or ITAdmin; ITStaff can select holders for permitted lifecycle operations.
- Preserve legacy columns and read-only response aliases for one compatibility release. Destructive phase 4 follows a stable release, backfill verification, backup, and recovery rehearsal.
- Preserve pre-existing workspace edits, including API origin configuration and the inventory workbook.
- Work on local branch `feat/asset-custodians-2026-09-10`; no publication or deployment.

## Shared Interfaces

```ts
type ManualCustodianInput = {
  displayName: string;
  locationId?: number | null;
  unitText?: string | null;
  notes?: string | null;
  duplicateAcknowledged?: boolean;
};
type CustodianSelection = { custodianId: number; newCustodian?: never }
  | { custodianId?: never; newCustodian: ManualCustodianInput };
// Creation can omit both fields for unassigned inventory.
// Editing can send custodianId: null to explicitly return a holder's asset.
```

`backend/src/db/schema/assetCustodians.ts` exports `assetCustodians`. Add `assets.currentCustodianId` and history `custodianId`, `custodianNameSnapshot`, `locationNameSnapshot`.

`backend/src/domain/assetCustodian.ts` exports `normalizeCustodianName(name)`, `findCustodianCandidates(name, candidates)`, `manualCustodianSchema`, `CustodianError` (status, optional code/candidates), and `sendCustodianError(res, err)` (handled boolean).

`backend/src/services/assetCustodian.ts` exports `createManualCustodian(tx, input, actorUserId)`, `resolveEmployeeCustodian(tx, employeeId, actorUserId)`, `requireActiveCustodian(tx, custodianId)`, and `resolveCustodianSelection(tx, selection, actorUserId, canCreateManual)`; return a custodian row and use caller's transaction. Selection locks custodian against concurrent deactivation/merge.

Search: `GET /asset-custodians?search=&status=ACTIVE` returns `{ custodians, employees }`. Custodian rows expose camelCase schema fields plus employeeCode/locationName; employee candidates expose id/employeeCode/fullName/locationId/locationName/departmentName/custodianId (nullable). `POST /asset-custodians/resolve-employee` accepts `{ employeeId }` for lifecycle roles and returns a verified holder. Manual POST takes ManualCustodianInput; PATCH updates metadata or recordStatus. Link accepts `{ employeeId }`; merge accepts `{ targetCustodianId }`. Reconciliation returns `[{ custodian, matches: EmployeeCandidate[] }]`. Duplicate conflicts return 409 with `code: 'DUPLICATE_CANDIDATES'` and candidates, requiring explicit acknowledgement.

Asset responses expose currentCustodianId and nullable currentCustodian. Assign accepts selection plus existing location/condition/notes fields. Employee-shaped response aliases derive from current custodian/linked employee. Reject legacy assignment input fields rather than silently ignoring them.

Import asset rows expose `custodianResolution` with `action: 'REUSE' | 'CREATE_MANUAL' | 'LINK_EMPLOYEE' | 'UNASSIGNED' | 'ERROR'`, holder name and optional custodian/employee IDs. Code/name conflicts are errors. Name-only exact matches reuse a single active custodian; ambiguous exact matches error. Similar names warn and stay separate. Valid codes explicitly resolve verified custodians; names alone do not verify HR identity.

### Task 1: Custodian schema, directory, and reconciliation

**Files:** create backend schema/domain/service/controller/routes for assetCustodians, `backend/drizzle/0007_asset_custodians.sql`, matching tests; modify schema/assets.ts, db/index.ts, migration journal, app.ts.

- [x] Test normalized whitespace, exact/similar candidates, one canonical employee holder, authorization, duplicates, deactivation conflicts, and merge/link snapshot preservation.
- [x] Add schema/indexes; backfill referenced employees and snapshots; fail migration on unresolved references/count mismatches. Preserve physical legacy column assets.current_user_id.
- [x] Implement shared contracts with row locks, conflict mapping, admin authorization, and operator audit entries.
- [x] Run targeted tests and backend build; validate migration on an isolated test database.

### Task 2: Asset CRUD and lifecycle cutover

**Files:** assetController.ts, assetLifecycleController.ts, new services/assetAssignment.ts and controller integration tests.

- [x] Add HTTP regressions for inline manual holder without HR, asset-detail failure rolling back holder, staff inline rejection, inactive holder rejection, and immutable history.
- [x] Resolve selections within create/update/assignment transactions; lock assets, close prior history, insert snapshots, and audit authenticated actor.
- [x] Hydrate currentCustodian and compatibility aliases for all asset responses. Display snapshots in history. Clear holder atomically on return.
- [x] Verify no production assignment writes use legacy employee columns; run backend tests/build.

### Task 3: XLSX holder resolution

**Files:** services/assetImport.ts, controllers/assetImportController.ts, services/assetWorkbook.ts and tests.

- [x] Test all resolution labels, normalized exact names, ambiguous/similar holders, code/name conflict, no-HR assignment, stale commit, and rollback.
- [x] Preview reads active custodians and uses shared normalization, keeping workbook headers and unrelated equipment validation.
- [x] Commit reparses/reloads data in one transaction, creates/reuses custodians, writes snapshot history, and audits each decision without legacy assignment writes.
- [x] Run import/workbook tests and backend TypeScript build.

### Task 4: Picker, inventory, and reconciliation UI

**Files:** new components/assets/CustodianPicker.tsx, lib/assetCustodian.ts and tests, dashboard/master/asset-custodians/page.tsx; modify inventory list/detail, form/import helpers, API helpers, navigation, test script.

- [x] Test selection/clear payloads, manual validation, duplicate acknowledgement, inactive rejection, and roles.
- [x] Build grouped searchable picker with inline manual name/location/unit/notes, duplicate acknowledgement, and verification badges.
- [x] Integrate create/edit/assign without employee-directory prerequisite; show current holders, snapshot history, and import resolution decisions.
- [x] Add metadata edit/activation controls, reconciliation matches, explicit employee link and canonical merge confirmation, and keep-separate dismissal.
- [x] Run frontend tests, lint, and production build.

### Task 5: Integrated review and release validation

**Files:** new docs/operations/asset-custodian-rollout.md; update this plan.

- [x] Review integrated API/UI contracts and concurrency invariants, then fix evidence-backed findings.
- [x] Run all tests/builds, frontend lint, migration validation, Compose/release workflow validation, and relevant deployment shell tests.
- [x] Document additive rollout, verification SQL, compatibility boundaries, and future cleanup prerequisites.

## Execution decisions and progress

- Baseline: backend 47/47 tests and frontend 12/12 tests pass.
- Ruling: implement phases 1–3 and document phase 4, because the spec requires one stable compatibility release before destructive cleanup.
- Ruling: existing user work stays in place on a new local feature branch; no clean/reset/stash operations.
- Ruling: independent directory, import, and frontend work can run concurrently with explicit file ownership; root owns CRUD/lifecycle integration.
- Ruling: a lifecycle-authorized resolve-employee endpoint implements selecting an HR employee, without allowing ITStaff to create manual profiles or reconcile existing profiles.


- User amendment: every computer hardware specification field is optional; blank or partial entries are valid in forms and XLSX. Retain positive-integer checks for supplied numbers. Add migration 0008 to drop only the four hardware NOT NULL constraints.
- Task 1: complete, including schema 0007 backfill and 0008 optional hardware columns; migration and directory tests pass.
- Task 2: complete; custodian CRUD, lifecycle cutover, and immutable assignment snapshots pass.
- Task 3: complete; XLSX preview and commit with custodian resolution and optional hardware specs pass.
- Task 4: complete; CustodianPicker, Asset Custodians master management and reconciliation UI pass tests and production build.
- Task 5: complete; integrated review, rollout documentation, full test suites (backend 70/70, frontend 22/22), frontend lint (0 errors), and TypeScript builds verified.
