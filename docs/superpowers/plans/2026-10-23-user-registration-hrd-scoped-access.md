# Implementation Plan: User Registration Flow Refinement & HRD Scoped Employee Access

- **Date:** 2026-10-23
- **Spec:** `docs/superpowers/specs/2026-10-23-user-registration-hrd-scoped-access-design.md`
- **Status:** COMPLETED (Selesai & Terverifikasi di 1d84a35)

---

## 1. Shared Types & Schema Interfaces

### Backend DTO & Schema Updates (`backend/src/controllers/userController.ts`)
```typescript
const createUserSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email().max(255).optional().or(z.literal("")),
  password: z.string().optional(),
  roleId: z.number().int().positive(),
  employeeId: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});
```

### Frontend Form Types (`frontend/src/lib/access/types.ts`)
```typescript
export interface UserFormData {
  username: string;
  email?: string;
  password?: string;
  roleId: number;
  employeeId?: number | null;
  status: "active" | "inactive";
}
```

---

## 2. Phase-by-Phase Tasks

### Phase 1: Database & Seed Configuration
- [x] **1.1. Schema & Migration:** Update `backend/src/db/schema/users.ts` to make `email` nullable (`varchar("email", { length: 255 }).unique()`). Create migration script `ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`.
- [x] **1.2. RBAC Seed:** Update `backend/src/domain/rbac.ts` and `backend/src/db/seed.ts` to grant `access.users.view` and `access.users.manage` to the `hr_attendance` role.
- [x] **1.3. Verification:** Run migration test `npm test -- backend/src/db/migrate.test.ts` to verify schema integrity.

### Phase 2: Backend Scoped RBAC & TDD
- [x] **2.1. TDD Test Cases:** Add tests in `backend/src/controllers/userController.test.ts` covering:
  - HRD calling `getUsers` returns only users with role `employee`.
  - HRD calling `createUser` with role `employee` succeeds without requiring an email.
  - HRD calling `createUser` with role `it_admin` returns 403 Forbidden.
  - HRD calling `updateUser` on non-employee user returns 403 Forbidden.
  - HRD calling `updateUser` attempting to change role to non-employee returns 403 Forbidden.
  - HRD calling `toggleUserStatus`, `resetPassword`, `deleteUser` on non-employee returns 403 Forbidden.
  - SuperAdmin continues to have unrestricted access to all users.
- [x] **2.2. Controller Implementation:**
  - Implement `isCallerHrd(req)` helper in `userController.ts`.
  - Enforce role scoping in `getUsers`, `createUser`, `updateUser`, `toggleUserStatus`, `resetPassword`, and `deleteUser`.
  - Ensure fallback email generation remains resilient if `email` is omitted.
- [x] **2.3. Verification:** Run `npx -y tsx --test backend/src/controllers/userController.test.ts` until all tests pass.

### Phase 3: Frontend UI, Registration Flow & Route Protection
- [x] **3.1. Route Permissions:** Update `frontend/src/lib/access/routes.ts` to remove `adminOnly: true` from `/dashboard/access` so users with `access.users.view` can visit.
- [x] **3.2. Sidebar Navigation:** Verify `DashboardLayout.tsx` shows the navigation item to users with `access.users.view` (including HRD).
- [x] **3.3. Page Tab Scoping:** In `frontend/src/app/dashboard/access/page.tsx`, conditionally render the "Roles & Permissions Matrix" tab only if the user has `access.roles.manage` (hiding it from HRD).
- [x] **3.4. UserFormModal Refinement:**
  - Set default `roleId` to role `Employee`.
  - Set default `status` to `active`.
  - Completely remove the `Email Address` input field.
  - When user is HRD, lock/restrict role assignment to `Employee`.
  - Keep employee autocomplete picker with auto-filling clean username.
- [x] **3.5. UserTable Display:** Remove redundant email display and highlight employee name and NIK.

### Phase 4: Verification & Git Commit
- [x] **4.1. Automated Verification:** Run full test suites (`npm test` in backend).
- [x] **4.2. Frontend Build / Typecheck:** Run `npm run build` or typecheck in frontend.
- [x] **4.3. Git Commit:** Commit verified changes using conventional commit:
  `feat(access): refine user registration flow and add scoped employee access for hrd`.
