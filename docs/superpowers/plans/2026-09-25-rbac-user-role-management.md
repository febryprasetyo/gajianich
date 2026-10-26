# Dynamic RBAC & User-Role Access Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun antarmuka terpadu dan backend API untuk manajemen pengguna (Users CRUD, status, reset password, relasi karyawan) dan pengaturan hak akses peran dinamis (Roles & Granular Permissions Matrix per modul) dengan perlindungan SuperAdmin anti-lockout.

**Architecture:** Menggunakan PostgreSQL & Drizzle ORM dengan tabel `permissions` dan relasi many-to-many `role_permissions`. Backend Express menerapkan RBAC middleware `requirePermission` dan atomic transaction untuk sinkronisasi permissions. Frontend Next.js 16 / React 19 mengintegrasikan helper `hasPermission` pada AuthContext dan menghadirkan workspace `/dashboard/access` dengan antarmuka tabbed untuk Users dan Permissions Matrix.

**Tech Stack:** Express 4, Drizzle ORM, PostgreSQL (pg), Zod, bcrypt, Next.js 16 App Router, React 19, Tailwind CSS v4, Lucide React.

**Spec:** `docs/superpowers/specs/2026-09-25-rbac-user-role-management-design.md`

## Global Constraints

- Backend runtime: TypeScript dengan Node.js dan Drizzle ORM.
- Validasi input menggunakan Zod schemas di controller boundaries.
- Password di-hash menggunakan bcrypt dengan salt rounds minimal 10; panjang minimal 8 karakter.
- Role `SuperAdmin` (atau `super_admin`) bersifat sistem (`is_system = true`) dan memiliki wildcard akses penuh.
- Minimal 1 user `SuperAdmin` aktif harus selalu dipertahankan (anti-lockout).
- Komponen frontend mematuhi Tailwind CSS v4, aksesibilitas semantic HTML, dan clean responsive layout.

## Review Focus

1. **Anti-Lockout Protection**: Admin tidak boleh bisa menonaktifkan akun sendiri atau menurunkan role SuperAdmin jika merupakan SuperAdmin aktif terakhir.
2. **System Role Immutability**: Role dengan `is_system = true` dilarang dihapus atau diubah `code`-nya.
3. **Atomic Permissions Save**: Penyimpanan `role_permissions` harus menggunakan transaksi database sehingga kegagalan tidak meninggalkan data hak akses yang korup/setengah tersimpan.
4. **Foreign Key Integrity**: Role yang masih digunakan oleh akun pengguna tidak boleh dapat dihapus sebelum semua user dipindahkan ke role lain.
5. **Session Permission Sync**: Panggilan `/api/v1/auth/me` dan `/api/v1/auth/login` harus mengembalikan array permissions lengkap milik role pengguna saat ini.

---

### Task 1: Database Schema & Migration & Seed for Dynamic RBAC

**Files:**
- Modify: `backend/src/db/schema/users.ts`
- Modify: `backend/src/db/migrate.ts`
- Modify: `backend/src/db/seed.ts`
- Create: `backend/src/db/rbacSchema.test.ts`

**Interfaces:**
- Produces: Tables `permissions`, `rolePermissions`, updated `roles` with `isSystem`, updated `users` with `roleId`, `employeeId`.

- [x] **Step 1: Write the failing test for RBAC schema and seed**

Create `backend/src/db/rbacSchema.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './index';
import { permissions, roles, rolePermissions } from './schema/users';
import { eq } from 'drizzle-orm';

test('RBAC schema has permissions catalog and seeded system roles', async () => {
  const allRoles = await db.select().from(roles);
  assert.ok(allRoles.length > 0, 'Roles should exist');
  const superAdmin = allRoles.find((r) => r.code === 'super_admin');
  assert.ok(superAdmin, 'SuperAdmin role should exist');
  assert.equal(superAdmin?.isSystem, true, 'SuperAdmin must have isSystem = true');

  const allPerms = await db.select().from(permissions);
  assert.ok(allPerms.length >= 20, 'Should have at least 20 seeded catalog permissions');
  assert.ok(allPerms.some((p) => p.code === 'assets.view'));
  assert.ok(allPerms.some((p) => p.code === 'access.roles.manage'));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test --prefix backend -- src/db/rbacSchema.test.ts`
Expected: FAIL (schema columns or tables missing).

- [x] **Step 3: Update `backend/src/db/schema/users.ts` and `migrate.ts` / `seed.ts`**

Update `backend/src/db/schema/users.ts`:
```typescript
import { pgTable, bigint, varchar, timestamp, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { employees } from './employees';

export const permissions = pgTable('permissions', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  code: varchar('code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  module: varchar('module', { length: 50 }).notNull(),
  description: varchar('description', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const roles = pgTable('roles', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
  roleId: bigint('role_id', { mode: 'number' }).notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: bigint('permission_id', { mode: 'number' }).notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
}));

export const users = pgTable('users', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  roleId: bigint('role_id', { mode: 'number' }).references(() => roles.id),
  role: varchar('role', { length: 50 }).default('SuperAdmin').notNull(),
  employeeId: bigint('employee_id', { mode: 'number' }).references(() => employees.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 30 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

Update `backend/src/db/migrate.ts` and `backend/src/db/seed.ts` to create the DDL if not exists and seed standard permissions (Assets, Tickets, Licenses, Infrastructure, Hardware Audits, Attendance, Master, Access). Ensure SuperAdmin user has `roleId` assigned to the `super_admin` role.

- [x] **Step 4: Run test to verify it passes**

Run: `npm run seed --prefix backend && npm test --prefix backend -- src/db/rbacSchema.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/db/schema/users.ts backend/src/db/migrate.ts backend/src/db/seed.ts backend/src/db/rbacSchema.test.ts
git commit -m "feat(backend): add dynamic RBAC permissions schema, roles, and seeds"
```

---

### Task 2: Backend RBAC Middleware & Token Enrichment

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/controllers/authController.ts`
- Create: `backend/src/middleware/rbacAuth.test.ts`

**Interfaces:**
- Produces: `requirePermission(permissionCode: string)`, `getUserPermissions(userId: number, roleId?: number): Promise<string[]>`
- Consumes: `users`, `roles`, `permissions`, `rolePermissions`

- [x] **Step 1: Write failing test for `requirePermission` middleware and auth enrichment**

Create `backend/src/middleware/rbacAuth.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePermission } from './auth';

test('requirePermission allows SuperAdmin regardless of explicit permissions', async () => {
  const middleware = requirePermission('assets.delete');
  let nextCalled = false;
  const req: any = {
    user: { userId: 1, roleName: 'SuperAdmin', roleId: 1 },
  };
  const res: any = {
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  };
  await middleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true, 'SuperAdmin should bypass permission check');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test --prefix backend -- src/middleware/rbacAuth.test.ts`
Expected: FAIL (`requirePermission` not exported or implemented).

- [x] **Step 3: Implement `requirePermission` and enrich `authController.ts`**

In `backend/src/middleware/auth.ts`:
- Implement `requirePermission(permissionCode: string)`.
- If `req.user.roleName === 'SuperAdmin'` or normalized role is `'superadmin'`, call `next()`.
- Otherwise query `rolePermissions` join `permissions` for `req.user.roleId`. If found, `next()`, else return `res.status(403).json({ error: 'Forbidden: Missing permission ' + permissionCode })`.
- In `backend/src/controllers/authController.ts`: include `permissions: string[]` in the JSON response of `login` and `me`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test --prefix backend -- src/middleware/rbacAuth.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/middleware/auth.ts backend/src/controllers/authController.ts backend/src/middleware/rbacAuth.test.ts
git commit -m "feat(backend): add requirePermission RBAC middleware and auth permission enrichment"
```

---

### Task 3: Backend Roles & Permissions Management Controller & Routes

**Files:**
- Create: `backend/src/controllers/roleController.ts`
- Create: `backend/src/routes/roleRoutes.ts`
- Modify: `backend/src/app.ts`
- Create: `backend/src/controllers/roleController.test.ts`

**Interfaces:**
- Produces: Endpoints `GET /api/v1/roles`, `GET /api/v1/roles/permissions`, `POST /api/v1/roles`, `PUT /api/v1/roles/:id`, `DELETE /api/v1/roles/:id`, `PUT /api/v1/roles/:id/permissions`
- Consumes: `requirePermission('access.roles.manage')`

- [x] **Step 1: Write failing test for roleController**

Create `backend/src/controllers/roleController.test.ts`:
- Test listing roles and permissions catalog.
- Test creating a custom role.
- Test updating role permissions in a transaction.
- Test deleting system role is blocked with 400/403.
- Test deleting custom role that has users is blocked.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test --prefix backend -- src/controllers/roleController.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement `roleController.ts` and `roleRoutes.ts`**

- Implement `getRoles`: select roles and aggregate their assigned permission IDs.
- Implement `getPermissions`: select all permissions grouped by `module`.
- Implement `createRole`: Zod validation for `code`, `name`, `description`. Check code uniqueness.
- Implement `updateRole`: Zod validation. Protect `is_system` role code changes.
- Implement `deleteRole`: Prevent deleting `is_system` roles. Check if any user references this `roleId` or `role.name`; if so, return error 400.
- Implement `updateRolePermissions`: Use `db.transaction`: delete existing `role_permissions` for `roleId`, insert new pairs.
- Mount `roleRoutes` at `/api/v1/roles` in `backend/src/app.ts`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test --prefix backend -- src/controllers/roleController.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/controllers/roleController.ts backend/src/routes/roleRoutes.ts backend/src/app.ts backend/src/controllers/roleController.test.ts
git commit -m "feat(backend): add roles and permissions catalog management API"
```

---

### Task 4: Backend Users Management Controller & Routes

**Files:**
- Create: `backend/src/controllers/userController.ts`
- Create: `backend/src/routes/userRoutes.ts`
- Modify: `backend/src/app.ts`
- Create: `backend/src/controllers/userController.test.ts`

**Interfaces:**
- Produces: Endpoints `GET /api/v1/users`, `POST /api/v1/users`, `PUT /api/v1/users/:id`, `PATCH /api/v1/users/:id/status`, `POST /api/v1/users/:id/reset-password`, `DELETE /api/v1/users/:id`
- Consumes: `requirePermission('access.users.view')`, `requirePermission('access.users.manage')`

- [x] **Step 1: Write failing test for userController**

Create `backend/src/controllers/userController.test.ts`:
- Test listing users with role and employee details.
- Test creating user with password hashing and duplicate email checks.
- Test updating user.
- Test anti-lockout: deactivating current user or last SuperAdmin is blocked with 400.
- Test reset password.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test --prefix backend -- src/controllers/userController.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement `userController.ts` and `userRoutes.ts`**

- `getUsers`: select users join roles and optional employees (id, name, employeeCode). Exclude `passwordHash`.
- `createUser`: Zod validation (`username`, `email`, `password` min 8, `roleId`, `employeeId`). Hash with bcrypt.
- `updateUser`: update username, email, roleId, employeeId.
- `toggleUserStatus`: check if target is last active SuperAdmin; if so, reject.
- `resetPassword`: validate new password min 8 characters, hash with bcrypt, update.
- `deleteUser`: check if target is self or last active SuperAdmin; if so, reject.
- Mount `userRoutes` at `/api/v1/users` in `backend/src/app.ts`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test --prefix backend -- src/controllers/userController.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/controllers/userController.ts backend/src/routes/userRoutes.ts backend/src/app.ts backend/src/controllers/userController.test.ts
git commit -m "feat(backend): add user management CRUD and anti-lockout lifecycle API"
```

---

### Task 5: Frontend AuthContext Enhancement & Access Types

**Files:**
- Modify: `frontend/src/context/AuthContext.tsx`
- Create: `frontend/src/lib/access/types.ts`
- Create: `frontend/src/lib/access/permissions.ts`
- Create: `frontend/src/lib/access/permissions.test.mjs`

**Interfaces:**
- Produces: `hasPermission(permissionCode: string): boolean`, `User` with `permissions: string[]`, TypeScript types for Users & Roles.

- [x] **Step 1: Write failing test for frontend permission checking**

Create `frontend/src/lib/access/permissions.test.mjs`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkUserPermission } from './permissions.js';

test('checkUserPermission allows SuperAdmin regardless of array', () => {
  const user = { roleName: 'SuperAdmin', permissions: [] };
  assert.equal(checkUserPermission(user, 'assets.delete'), true);
});

test('checkUserPermission checks permission array for regular user', () => {
  const user = { roleName: 'ITStaff', permissions: ['assets.view', 'tickets.create'] };
  assert.equal(checkUserPermission(user, 'assets.view'), true);
  assert.equal(checkUserPermission(user, 'assets.delete'), false);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test frontend/src/lib/access/permissions.test.mjs`
Expected: FAIL.

- [x] **Step 3: Implement `permissions.ts`, `types.ts`, and update `AuthContext.tsx`**

- In `frontend/src/lib/access/types.ts`: define `UserItem`, `RoleItem`, `PermissionItem`, `ModuleGroup`, `RoleFormData`, `UserFormData`.
- In `frontend/src/lib/access/permissions.ts`: implement `checkUserPermission(user, code)`.
- In `frontend/src/context/AuthContext.tsx`:
  - Update `User` interface to include `permissions?: string[]` and `roleId?: number`.
  - Add `hasPermission: (code: string) => boolean` to `AuthContextType`.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test frontend/src/lib/access/permissions.test.mjs`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/lib/access/ frontend/src/context/AuthContext.tsx
git commit -m "feat(frontend): add permissions evaluator and AuthContext hasPermission helper"
```

---

### Task 6: Frontend Users Management Tab & Modals

**Files:**
- Create: `frontend/src/components/access/UserStatsCard.tsx`
- Create: `frontend/src/components/access/UserTable.tsx`
- Create: `frontend/src/components/access/UserFormModal.tsx`
- Create: `frontend/src/components/access/ResetPasswordModal.tsx`

**Interfaces:**
- Produces: User listing table, filter bars, status toggle, Add/Edit User modal, Reset Password modal.
- Consumes: `/api/v1/users`, `/api/v1/roles`, `/api/v1/employees`

- [x] **Step 1: Create `UserStatsCard.tsx`**
  - Metric cards: Total Users, Active Users, Inactive Users, Roles Count.
- [x] **Step 2: Create `UserFormModal.tsx`**
  - Form with inputs: Username, Email, Password (only when creating), Role selector (fetched from `/api/v1/roles`), Employee selector (fetched from `/api/v1/employees`), Status radio/toggle.
- [x] **Step 3: Create `ResetPasswordModal.tsx`**
  - Form with New Password, Confirm Password, password strength indicator, submit button.
- [x] **Step 4: Create `UserTable.tsx`**
  - Search input (filter by name/email), Role filter dropdown, Status filter dropdown.
  - Table showing: Avatar + Name, Email, Role badge, Linked Employee badge, Status toggle pill, Created date, Action menu (Edit, Reset Password, Delete).
- [x] **Step 5: Typecheck & verify**

Run: `npx tsc --noEmit --project frontend/tsconfig.json`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add frontend/src/components/access/UserStatsCard.tsx frontend/src/components/access/UserTable.tsx frontend/src/components/access/UserFormModal.tsx frontend/src/components/access/ResetPasswordModal.tsx
git commit -m "feat(frontend): create user management table, stats cards, and action modals"
```

---

### Task 7: Frontend Roles & Permissions Matrix Tab & Modals

**Files:**
- Create: `frontend/src/components/access/RoleListPanel.tsx`
- Create: `frontend/src/components/access/RoleFormModal.tsx`
- Create: `frontend/src/components/access/PermissionMatrixPanel.tsx`

**Interfaces:**
- Produces: Left role list selector, custom role create modal, right-side permission matrix by module with Select All and sticky Save bar.
- Consumes: `/api/v1/roles`, `/api/v1/roles/permissions`, `PUT /api/v1/roles/:id/permissions`

- [x] **Step 1: Create `RoleFormModal.tsx`**
  - Modal to create custom role (`code`, `name`, `description`).
- [x] **Step 2: Create `RoleListPanel.tsx`**
  - List of roles with active highlight, System / Custom badge, permission count badge, and "+ Create Role" button.
- [x] **Step 3: Create `PermissionMatrixPanel.tsx`**
  - Header: Role title, description, and "Select All" / "Deselect All" buttons.
  - Body: Module cards (Assets, Tickets, Licenses, Infrastructure, Attendance, Master, Access).
  - Each module card contains permission switches with name and description, plus a module-level "Toggle All" link.
  - Bottom sticky bar: "Save Changes" button (with dirty state detection & loading spinner) and "Reset" button.
- [x] **Step 4: Typecheck & verify**

Run: `npx tsc --noEmit --project frontend/tsconfig.json`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/access/RoleListPanel.tsx frontend/src/components/access/RoleFormModal.tsx frontend/src/components/access/PermissionMatrixPanel.tsx
git commit -m "feat(frontend): create role selector and interactive permissions matrix panel"
```

---

### Task 8: Frontend Unified Access Workspace & Navigation Integration

**Files:**
- Create: `frontend/src/app/dashboard/access/page.tsx`
- Modify: `frontend/src/components/layout/DashboardLayout.tsx`

**Interfaces:**
- Produces: Route `/dashboard/access` with tabbed workspace (Users vs Roles & Permissions), sidebar navigation item under "Administration".

- [x] **Step 1: Implement `frontend/src/app/dashboard/access/page.tsx`**
  - Header with title "Access & Role Management" and breadcrumbs.
  - Tab Switcher: "Users" (with user count) and "Roles & Permissions" (with role count).
  - Render Tab 1 (`UserTable` + `UserStatsCard`) or Tab 2 (`RoleListPanel` + `PermissionMatrixPanel`).
  - Toast / notification feedback on successful actions.
- [x] **Step 2: Update `frontend/src/components/layout/DashboardLayout.tsx`**
  - Add navigation group `Administration`:
    ```typescript
    {
      title: 'Administration',
      items: [
        { name: 'Access Control', href: '/dashboard/access', icon: ShieldCheck, adminOnly: true },
      ],
    },
    ```
- [x] **Step 3: Run full verification suite**

Run:
```bash
npm test --prefix backend
npx tsc --noEmit --project backend/tsconfig.json
npm test --prefix frontend
npm run lint --prefix frontend
npx tsc --noEmit --project frontend/tsconfig.json
```
Expected: All tests pass and zero linter/typecheck errors.

- [x] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/access/page.tsx frontend/src/components/layout/DashboardLayout.tsx
git commit -m "feat(frontend): integrate unified access control page and administration navigation"
```

