# Implementation Plan: HR Attendance Employee Master Import & Export Integration

- **Feature**: HR Attendance Employee Master Import & Export
- **Design Spec**: `docs/superpowers/specs/2026-09-30-hr-attendance-employee-import-export-design.md`
- **Goal**: Enable Excel Import & Export on `/dashboard/attendance/master/employees`, update backend permissions for HR roles, and sync live employee data.

---

## Phase 1: Backend RBAC Expansion for Employee Endpoints
- [ ] Task 1.1: Enhance `requirePermission` in `backend/src/middleware/auth.ts` to support `string | string[]` (OR check).
- [ ] Task 1.2: Add unit tests in `backend/src/middleware/auth.test.ts` verifying array permission check.
- [ ] Task 1.3: Update `backend/src/routes/employeeRoutes.ts` to allow `attendance.view`, `attendance.manage`, and `attendance.import` on employee routes.
- [ ] Task 1.4: Verify all backend unit and integration tests pass (`npm test`).

## Phase 2: Frontend Attendance Repository Live Sync
- [ ] Task 2.1: Add `sync_employees` command in `frontend/src/lib/attendance/types.ts` and `frontend/src/lib/attendance/commands.ts`.
- [ ] Task 2.2: Add unit tests in `frontend/src/lib/attendance/domain.test.mjs` verifying `sync_employees` command behavior.
- [ ] Task 2.3: Update `frontend/src/lib/attendance/repository.ts` to fetch and hydrate live employees/departments from `/api/v1/employees` and `/api/v1/master/departments`.

## Phase 3: Frontend UI on Attendance Directory Page
- [ ] Task 3.1: Add Export Excel button in `AttendanceDirectoryPage.tsx` for `mode === 'employees'`.
- [ ] Task 3.2: Add Import Excel button and integrate `EmployeeImportModal` in `AttendanceDirectoryPage.tsx`.
- [ ] Task 3.3: Wire `onSuccess` callback to execute `sync_employees` and refresh table.
- [ ] Task 3.4: Verify frontend tests and build (`npm test` and `npm run build`).

## Phase 4: Verification & Docker Dev Hot-Reload
- [ ] Task 4.1: Verify in Docker containers (`gajianich_backend_dev` & `gajianich_frontend_dev`).
- [ ] Task 4.2: Verify curl endpoints with HR role auth.
- [ ] Task 4.3: Git commit with conventional commit message.
