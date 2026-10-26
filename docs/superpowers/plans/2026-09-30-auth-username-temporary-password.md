# Implementation Plan: Username Login, Admin Password Reset & One-Time Temporary Password

**Date:** 2026-09-30
**Spec Reference:** `docs/superpowers/specs/2026-09-30-auth-username-temporary-password-design.md`
**Branch:** `feat/hr-attendance-frontend`

---

## 1. Overview & Verification Commands

This implementation plan details the step-by-step tasks to revise the authentication and credential lifecycle:
- Login using unique **Username** instead of Email.
- SuperAdmin default username updated to `admin`.
- Auto-generation of secure temporary passwords for new user creation and admin password resets.
- Presentation of a copyable temporary password modal to the administrator.
- Mandatory password change on first sign-in via `/change-password` before dashboard access is permitted.

### Key Verification Commands
```bash
# Backend verification
npm test --prefix backend
npm run build --prefix backend

# Frontend verification
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

---

## 2. Shared Types & Contracts

### Backend Auth & User Payloads
```typescript
// Login Payload
export interface LoginRequestBody {
  username: string;
  password: string;
}

export interface LoginResponseBody {
  message: string;
  token: string;
  mustChangePassword: boolean;
  user: {
    id: number;
    username: string;
    email: string;
    fullName: string;
    roleId?: number;
    roleName: string;
    permissions: string[];
    mustChangePassword: boolean;
  };
}

// Change Password Payload
export interface ChangePasswordRequestBody {
  newPassword: string;
  confirmPassword: string;
}

// Admin Reset Password Response
export interface ResetPasswordResponseBody {
  message: string;
  temporaryPassword: string;
}

// Admin Create User Response
export interface CreateUserResponseBody {
  message: string;
  user: any;
  temporaryPassword: string;
}
```

---

## 3. Phase-by-Phase Task Checklist

### Phase 1: Database Schema & Migration
- [ ] **Task 1.1**: Update `backend/src/db/schema/users.ts` to add `mustChangePassword: boolean('must_change_password').default(false).notNull()`.
- [ ] **Task 1.2**: Generate and run Drizzle migration adding `must_change_password` column to `users` table.
- [ ] **Task 1.3**: Update `backend/src/db/seed.ts` and run SQL migration to update existing SuperAdmin user's username to `admin` (where id = 1).
- [ ] **Task 1.4**: Run and verify migration with `npm run --prefix backend db:migrate`.

### Phase 2: Backend Routes, Services & Automated Tests (TDD)
- [ ] **Task 2.1**: Write automated unit tests for:
  - Username-based login (case-insensitive matching, rejection of deactivated accounts, invalid password handling).
  - Admin user creation with auto-generated temporary password and `mustChangePassword = true`.
  - Admin password reset generating new temporary password and setting `mustChangePassword = true`.
  - User mandatory password change (`/auth/change-password`) clearing `mustChangePassword` to `false`.
- [ ] **Task 2.2**: Update `backend/src/controllers/authController.ts`:
  - Update `login`: accept `username` instead of `email`, query `users.username` case-insensitively, include `mustChangePassword` in JWT and response.
  - Implement `changePassword`: validate `newPassword` (min 8 chars), hash password, set `mustChangePassword = false`, issue fresh JWT.
- [ ] **Task 2.3**: Update `backend/src/controllers/userController.ts`:
  - Create helper `generateTemporaryPassword()` (secure 10-char alphanumeric + symbol).
  - Update `createUser`: auto-generate temporary password if not provided, save hash, set `mustChangePassword: true`, return `temporaryPassword` in response.
  - Update `resetPassword`: auto-generate temporary password, save hash, set `mustChangePassword: true`, return `temporaryPassword` in response.
- [ ] **Task 2.4**: Update `backend/src/routes/authRoutes.ts` to register `POST /change-password` with `authenticateToken`.
- [ ] **Task 2.5**: Run backend test suite: `npm test --prefix backend`.

### Phase 3: Frontend UI Components, Forms & Route Guards
- [ ] **Task 3.1**: Update `frontend/src/context/AuthContext.tsx`:
  - Update `User` interface to include `username` and `mustChangePassword?: boolean`.
  - Handle `mustChangePassword` token refresh and state updates.
- [ ] **Task 3.2**: Update `frontend/src/app/login/page.tsx`:
  - Replace "Work Email" input with "Username" input.
  - Update Quick Demo button to fill username `admin` and password `Admin123!`.
  - On successful login: if `mustChangePassword` is true, redirect to `/change-password`; otherwise redirect to `/dashboard`.
- [ ] **Task 3.3**: Create `frontend/src/app/change-password/page.tsx`:
  - Dedicated page for mandatory password change.
  - Input for New Password and Confirm Password with visibility toggles and requirements checklist.
  - Calls `api.post('/auth/change-password')`, updates user context, redirects to `/dashboard`.
- [ ] **Task 3.4**: Add route protection in `frontend/src/components/layout/DashboardLayout.tsx`:
  - If `user?.mustChangePassword` is `true`, redirect user to `/change-password`.
- [ ] **Task 3.5**: Update `frontend/src/app/dashboard/access/page.tsx` & components:
  - Create `TemporaryPasswordModal.tsx` showing the generated credentials with a "Salin Password" button.
  - Update `UserFormModal.tsx`: remove manual initial password input, inform admin that a temporary password will be auto-generated.
  - Update `ResetPasswordModal.tsx`: change into a confirm-reset modal that triggers auto-generation.
  - Display `TemporaryPasswordModal` upon successful user creation or password reset.
- [ ] **Task 3.6**: Write frontend unit tests for temporary password modal, login redirect logic, and password validation.

### Phase 4: Full Verification Loop
- [ ] **Task 4.1**: Run backend tests (`npm test --prefix backend`).
- [ ] **Task 4.2**: Run backend TypeScript build (`npm run build --prefix backend`).
- [ ] **Task 4.3**: Run frontend unit tests (`npm test --prefix frontend`).
- [ ] **Task 4.4**: Run frontend linter (`npm run lint --prefix frontend`).
- [ ] **Task 4.5**: Run frontend production build (`npm run build --prefix frontend`).
- [ ] **Task 4.6**: Manual end-to-end verification (login as admin, create user with temp password, login as user with temp password, forced change password, login with permanent password, reset password by admin).

---

## 4. Git Commit Milestone Strategy
1. `feat(auth): add must_change_password column and update superadmin username to admin`
2. `feat(auth): implement username login and mandatory change password api with tests`
3. `feat(users): auto-generate temporary password on user creation and reset in admin api`
4. `feat(frontend): update login with username and build change-password page with route guards`
5. `feat(frontend): integrate temporary password copy modal in user management`
