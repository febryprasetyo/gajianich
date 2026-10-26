# Employee Master Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver safe employee master-data pages for create, detail, edit, lifecycle status, filtering, and conditional deletion using the approved Talenta field contract.

**Architecture:** Keep employee record mapping and validation in the existing backend CRUD surface. Build the frontend around a shared employee form and a small pure directory helper, then add three route pages that use those units. Lifecycle values stay in the existing `employees.status` field, while Talenta Status Employee stays in `employees.employmentStatus`.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Express, Drizzle ORM, Zod, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-30-employee-master-pages-design.md`

## Global Constraints

- Implement the exact 33 Talenta fields, with Barcode optional and defaulting to Employee ID when blank.
- Required fields are Employee ID, Full Name, Department, and Status Employee. Email is optional and unique only when supplied.
- Employee ID is the employee code and must be unique.
- Department is selected from the department master. The employee form cannot create departments.
- Keep employment type (`employmentStatus`) separate from lifecycle status (`Active`, `Inactive`, `Resigned`).
- Show active and historical employees in separate tabs. The historical tab contains Inactive and Resigned records.
- Do not permanently delete an employee if attendance history exists. If attendance history cannot be authoritatively checked, reject deletion.
- Do not make asset, licence, ticket, or custodian behaviour part of this feature.
- Preserve the user’s existing uncommitted employee-module edits. Reconcile them with this plan instead of replacing them.

## Review Focus

- Blank Barcode saves the Employee ID as Barcode, including after an Employee ID is edited before submit.
- Blank optional Email is accepted, while duplicate non-blank Email is rejected without treating empty strings as duplicates.
- The archive tab keeps an Inactive record separate from a Resigned record when its status filter changes.
- An Employee ID matching only part of another code does not create an incorrect filter result.
- The delete route rejects the request when attendance history is present or its availability cannot be established.

---

### Task 1: Normalize employee lifecycle and Talenta input on the backend

**Files:**
- Modify: `backend/src/controllers/employeeController.ts`
- Modify: `backend/src/db/schema/employees.ts`
- Create: `backend/drizzle/<generated-email-nullable-migration>.sql`
- Create: `backend/src/domain/employeeInput.ts`
- Test: `backend/src/domain/employeeInput.test.ts`

**Interfaces:**
- Produces `normalizeEmployeeInput(input: EmployeeInput): EmployeeInput` and `isLifecycleStatus(value: string): value is LifecycleStatus`.
- `normalizeEmployeeInput` converts blank optional strings to `null`, applies Barcode fallback to `employeeCode`, and preserves text identifiers exactly.
- The controller uses the normalized value before create and update persistence.

- [ ] **Step 1: Write failing backend-domain tests**

Cover blank Barcode fallback, optional email normalization, each permitted lifecycle value, and a rejected unknown lifecycle status.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test --prefix backend -- src/domain/employeeInput.test.ts`

Expected: FAIL because the employee input domain module does not exist.

- [ ] **Step 3: Implement the input domain module and update the create and update schemas**

Use `Active`, `Inactive`, and `Resigned` as lifecycle values. Require Department and Status Employee, allow a missing email, and enforce unique non-null email values. Make Barcode inherit Employee ID when blank.

- [ ] **Step 4: Make email nullable in the database schema and generate the corresponding Drizzle migration**

The database column must match the approved optional-email contract. Do not add employee fields.

- [ ] **Step 5: Run backend type checking and focused tests**

Run: `npm run build --prefix backend && npm test --prefix backend -- src/domain/employeeInput.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the backend input contract**

```bash
git add backend/src/domain/employeeInput.ts backend/src/domain/employeeInput.test.ts backend/src/controllers/employeeController.ts backend/src/db/schema/employees.ts backend/drizzle/
git commit -m "feat: normalize employee master data"
```

### Task 2: Enforce safe permanent deletion

**Files:**
- Create: `backend/src/domain/employeeDeletion.ts`
- Create: `backend/src/domain/employeeDeletion.test.ts`
- Modify: `backend/src/controllers/employeeController.ts`
- Test: `backend/src/controllers/employeeController.test.ts`

**Interfaces:**
- Produces `assessEmployeeDeletion(input: { attendanceCheck: 'clear' | 'has-history' | 'unavailable' }): { allowed: boolean; message?: string }`.
- `deleteEmployee` calls an authoritative attendance-history adapter before database deletion and returns a conflict response when deletion is not allowed.

- [ ] **Step 1: Write failing domain tests for deletion assessment**

Assert that `clear` permits deletion, while `has-history` and `unavailable` reject it with distinct user-safe messages.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test --prefix backend -- src/domain/employeeDeletion.test.ts`

Expected: FAIL because the deletion domain module does not exist.

- [ ] **Step 3: Implement the deletion assessment and an attendance-history adapter**

Use the persisted attendance source if it exists. In the current application, attendance data is browser-side mock data, not an authoritative backend source. Until a persisted source is introduced, return `unavailable` and reject deletion. Do not fall back to a successful hard delete.

- [ ] **Step 4: Update the employee delete handler and its controller test**

Verify the handler returns a conflict without executing deletion when history exists or cannot be checked, and permits a confirmed delete only for a clear attendance result.

- [ ] **Step 5: Run backend tests and type checking**

Run: `npm run build --prefix backend && npm test --prefix backend`

Expected: PASS.

- [ ] **Step 6: Commit safe deletion enforcement**

```bash
git add backend/src/domain/employeeDeletion.ts backend/src/domain/employeeDeletion.test.ts backend/src/controllers/employeeController.ts backend/src/controllers/employeeController.test.ts
git commit -m "feat: protect employee attendance history"
```

### Task 3: Complete the shared employee form and create/edit routes

**Files:**
- Modify: `frontend/src/components/master/EmployeeFormFields.tsx`
- Create: `frontend/src/components/master/EmployeeFormPage.tsx`
- Create: `frontend/src/app/dashboard/master/employees/new/page.tsx`
- Create: `frontend/src/app/dashboard/master/employees/[id]/edit/page.tsx`
- Modify: `frontend/src/lib/employeeTypes.ts`

**Interfaces:**
- `EmployeeFormPage({ mode: 'create' | 'edit', employeeId?: number })` fetches departments and, for edit, the employee record.
- `EmployeeFormFields` renders all 33 Talenta fields and reports values through its existing `onChange` contract.

- [ ] **Step 1: Add a failing pure frontend test for the form payload helper**

Create a helper that produces the create or update payload. Assert it applies Barcode fallback, converts optional blank values to null, and omits no Talenta field.

- [ ] **Step 2: Run the frontend test to verify it fails**

Run: `npm test --prefix frontend -- src/lib/employeeForm.test.mjs`

Expected: FAIL because the form helper does not exist.

- [ ] **Step 3: Implement the payload helper and complete the shared form**

Make Department and Status Employee visibly required. Make lifecycle status read-only or default Active on create, because lifecycle actions are handled from detail. Keep Location as an existing non-Talenta optional field only if the current employee contract requires it, and do not let it displace any Talenta field.

- [ ] **Step 4: Implement the new and edit route pages through `EmployeeFormPage`**

The create page posts to `/employees`, and the edit page reads then puts to `/employees/:id`. Both pages redirect to `/dashboard/master/employees/:id` on success and show in-place validation or API errors.

- [ ] **Step 5: Run frontend tests, lint, and type build**

Run: `npm test --prefix frontend && npm run lint --prefix frontend && npm run build --prefix frontend`

Expected: PASS.

- [ ] **Step 6: Commit shared form and route pages**

```bash
git add frontend/src/components/master/EmployeeFormFields.tsx frontend/src/components/master/EmployeeFormPage.tsx frontend/src/app/dashboard/master/employees/new/page.tsx frontend/src/app/dashboard/master/employees/[id]/edit/page.tsx frontend/src/lib/employeeTypes.ts frontend/src/lib/employeeForm.*
git commit -m "feat: add employee create and edit pages"
```

### Task 4: Add the employee detail page and lifecycle actions

**Files:**
- Create: `frontend/src/components/master/EmployeeDetailPage.tsx`
- Create: `frontend/src/app/dashboard/master/employees/[id]/page.tsx`
- Modify: `frontend/src/lib/employeeTypes.ts`

**Interfaces:**
- `EmployeeDetailPage({ employeeId: number })` loads an `EmployeeItem` and renders all approved field groups.
- Lifecycle update sends a partial employee update with `status: 'Inactive'` or `status: 'Resigned'`.

- [ ] **Step 1: Add a failing pure test for detail field grouping**

Assert all 33 Talenta field keys are assigned to exactly one display group and an empty optional value formats as `Belum diisi`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test --prefix frontend -- src/lib/employeeDetail.test.mjs`

Expected: FAIL because the detail grouping helper does not exist.

- [ ] **Step 3: Implement the detail grouping helper and detail component**

Show the employee header, department name, lifecycle badge, all 33 fields, edit link, and lifecycle controls. Keep sensitive values out of directory views but visible here as the approved specification requires.

- [ ] **Step 4: Add missing-data, load-failure, and lifecycle-update states**

The page has a clear route back to the directory when the employee is absent. It retains the detail view when an action fails and states the result of a lifecycle change.

- [ ] **Step 5: Run frontend tests, lint, and build**

Run: `npm test --prefix frontend && npm run lint --prefix frontend && npm run build --prefix frontend`

Expected: PASS.

- [ ] **Step 6: Commit detail and lifecycle UI**

```bash
git add frontend/src/components/master/EmployeeDetailPage.tsx frontend/src/app/dashboard/master/employees/[id]/page.tsx frontend/src/lib/employeeDetail.* frontend/src/lib/employeeTypes.ts
git commit -m "feat: add employee detail and lifecycle actions"
```

### Task 5: Split the directory into Active and Archive tabs

**Files:**
- Create: `frontend/src/lib/employeeDirectory.ts`
- Create: `frontend/src/lib/employeeDirectory.test.mjs`
- Modify: `frontend/src/app/dashboard/master/employees/page.tsx`

**Interfaces:**
- Produces `filterEmployees(employees, { tab, employeeIdQuery, departmentId, archiveStatus })` where `tab` is `active` or `archive`.
- The directory consumes `EmployeeItem[]` and produces a table view for the selected lifecycle subset.

- [ ] **Step 1: Write failing directory helper tests**

Cover exact and partial Employee ID matching, department filtering, Active isolation, Archive isolation, and the Inactive versus Resigned archive status filter.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test --prefix frontend -- src/lib/employeeDirectory.test.mjs`

Expected: FAIL because the directory helper does not exist.

- [ ] **Step 3: Implement the pure directory helper and replace inline filtering**

Filter by Employee ID, not email or sensitive data. Use case-insensitive matching for the employee code and normalized lifecycle values.

- [ ] **Step 4: Implement two accessible directory tabs and row actions**

Start on Karyawan Aktif. Provide the archive status selector only on Nonaktif & Resign. Keep view and edit links. Open permanent-delete confirmation only when the backend authorizes deletion; otherwise show the returned attendance-safety explanation and lifecycle alternatives.

- [ ] **Step 5: Run frontend tests, lint, and build**

Run: `npm test --prefix frontend && npm run lint --prefix frontend && npm run build --prefix frontend`

Expected: PASS.

- [ ] **Step 6: Commit directory tabs and filters**

```bash
git add frontend/src/lib/employeeDirectory.ts frontend/src/lib/employeeDirectory.test.mjs frontend/src/app/dashboard/master/employees/page.tsx
git commit -m "feat: separate active and archived employees"
```

### Task 6: Run end-to-end verification and audit the finished UI

**Files:**
- Modify: only files required to correct verified defects
- Create: `anti-slop/audit-001-2026-09-30.md`

**Interfaces:**
- Consumes the complete employee master flow from Tasks 1 through 5.
- Produces a verified implementation and a post-build anti-slop audit. The user selected audit-after mode, so do not change UI items from this audit until they select findings.

- [ ] **Step 1: Run the full backend and frontend suites**

Run: `npm test --prefix backend && npm run build --prefix backend && npm test --prefix frontend && npm run lint --prefix frontend && npm run build --prefix frontend`

Expected: PASS.

- [ ] **Step 2: Run a browser verification of the directory, create, detail, edit, lifecycle, and deletion flows**

Use a local test employee. Verify the 33 fields round trip and status tab movement. Do not use production data.

- [ ] **Step 3: Create the post-build anti-slop audit**

Record numbered UI findings, if any, in `anti-slop/audit-001-2026-09-30.md`. Do not modify audit findings until the user selects them.

- [ ] **Step 4: Commit verification artifacts and approved defect fixes**

```bash
git add anti-slop/audit-001-2026-09-30.md
git commit -m "test: verify employee master data flow"
```
