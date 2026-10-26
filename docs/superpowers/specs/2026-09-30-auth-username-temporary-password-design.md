# Design Specification: Authentication Flow Revision (Username Login, Admin Password Reset & One-Time Temporary Password)

**Date:** 2026-09-30
**Status:** In Review
**Feature:** Username-based authentication, admin-managed password reset, and one-time temporary password with mandatory reset on first login

---

## 1. Summary & Problem Statement

Currently, the AMS platform authenticates users using email and password (`/auth/login`). Additionally, when creating users or resetting passwords:
- Administrators have to manually type and confirm passwords.
- Newly created accounts or admin-reset accounts can log in directly without being forced to change their temporary credentials, posing a security risk.
- The default SuperAdmin account was seeded with username `'System SuperAdmin'`, making username-based login awkward.

This feature revises the authentication lifecycle to:
1. Switch login credentials from **email** to **username** (case-insensitive).
2. Update the default SuperAdmin username to `admin`.
3. Auto-generate secure temporary passwords when an administrator creates a user or resets a user's password.
4. Display a copyable credential popup to the administrator immediately after creation or reset.
5. Require users logging in with a temporary password (`mustChangePassword: true`) to set their permanent password on a dedicated `/change-password` screen before accessing the dashboard.

---

## 2. Goals & Non-Goals

### Goals
- **Username Login**: Users log in using their unique `username` (case-insensitive) and password.
- **Admin Password Reset**: SuperAdmins / authorized administrators can reset any user's password with a single click, producing an auto-generated temporary password.
- **Auto-generated Temporary Password**: Both User Creation and Admin Password Reset automatically generate a strong, secure temporary password (e.g. 10 alphanumeric + special characters).
- **Admin Copy Modal**: Display the generated temporary password in a secure modal with a 1-click "Salin Password" button for easy handoff to the employee.
- **Mandatory First-Time Change**: Upon authenticating with a temporary password, the system intercepts access, sets `mustChangePassword: true`, and routes the user to `/change-password`.
- **Dashboard Gate**: Protected dashboard routes redirect users to `/change-password` if `mustChangePassword === true`.
- **Audit & Anti-Lockout**: Admins cannot deactivate or delete their own accounts, nor the last active SuperAdmin.

### Non-Goals
- Self-service email reset via SMTP/magic links (out of scope; resets are admin-managed).
- Multi-factor authentication (MFA/TOTP) (to be handled in future phases).
- Changing username after account creation (username remains unique and immutable or admin-only).

---

## 3. Data Model & Schema Diffs

### Database Schema (`backend/src/db/schema/users.ts`)

Add the column `must_change_password` to the `users` table:

```typescript
export const users = pgTable('users', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  mustChangePassword: boolean('must_change_password').default(false).notNull(), // <-- NEW COLUMN
  roleId: bigint('role_id', { mode: 'number' }).references(() => roles.id),
  role: varchar('role', { length: 50 }).default('SuperAdmin').notNull(),
  employeeId: bigint('employee_id', { mode: 'number' }).references(() => employees.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 30 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Migration Script
- Drizzle migration generated: `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false NOT NULL;`
- Data migration: Update default SuperAdmin account from `System SuperAdmin` to `admin`:
  ```sql
  UPDATE users SET username = 'admin' WHERE id = 1 AND username = 'System SuperAdmin';
  ```

---

## 4. API Specifications

### 4.1. Login Endpoint
- **Route:** `POST /api/auth/login`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "TemporaryOrPermanentPassword123!"
  }
  ```
- **Validation (Zod):**
  ```typescript
  const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
  });
  ```
- **Behavior:**
  - Performs case-insensitive lookup: `sql`lower(${users.username}) = lower(${parsed.username})``
  - Verifies status is `active`.
  - Compares password with `passwordHash` via `bcrypt.compare`.
  - Generates JWT token containing `userId`, `username`, `email`, `roleId`, `roleName`, `permissions`, and `mustChangePassword`.
- **Response (200 OK):**
  ```json
  {
    "message": "Login successful",
    "token": "jwt_token_here",
    "mustChangePassword": true,
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@company.com",
      "fullName": "admin",
      "roleId": 1,
      "roleName": "SuperAdmin",
      "permissions": ["*"],
      "mustChangePassword": true
    }
  }
  ```

### 4.2. Mandatory Change Password Endpoint
- **Route:** `POST /api/auth/change-password`
- **Auth:** Bearer Token (Authenticated user)
- **Request Body:**
  ```json
  {
    "newPassword": "MyNewSecurePassword88#",
    "confirmPassword": "MyNewSecurePassword88#"
  }
  ```
- **Validation (Zod):**
  - `newPassword`: minimum 8 characters.
  - `confirmPassword`: must match `newPassword`.
- **Behavior:**
  - Hashes new password with `bcrypt.hash(newPassword, 10)`.
  - Updates user record: `passwordHash = newHash`, `mustChangePassword = false`, `updatedAt = NOW()`.
  - Issues a refreshed JWT token with `mustChangePassword: false`.
- **Response (200 OK):**
  ```json
  {
    "message": "Password updated successfully",
    "token": "refreshed_jwt_token",
    "user": { ... }
  }
  ```

### 4.3. Admin Create User Endpoint
- **Route:** `POST /api/users`
- **Auth:** Bearer Token + `access.users.manage` permission
- **Request Body:**
  ```json
  {
    "username": "john.doe",
    "email": "john.doe@company.com",
    "roleId": 2,
    "employeeId": 10,
    "status": "active"
  }
  ```
  *(Note: Password field is optional / omitted from request body because the system generates it)*
- **Behavior:**
  - Generates secure random temporary password (e.g. 10 characters from uppercase, lowercase, numbers, safe symbols).
  - Hashes temporary password.
  - Inserts user record with `mustChangePassword = true`.
- **Response (201 Created):**
  ```json
  {
    "message": "User created successfully",
    "user": { "id": 15, "username": "john.doe", "email": "john.doe@company.com", ... },
    "temporaryPassword": "TempPasswordX7k!"
  }
  ```

### 4.4. Admin Reset Password Endpoint
- **Route:** `POST /api/users/:id/reset-password`
- **Auth:** Bearer Token + `access.users.manage` permission
- **Request Body:** `{}` (no body required)
- **Behavior:**
  - Checks user exists.
  - Generates secure random temporary password.
  - Hashes temporary password and updates user: `passwordHash = hash`, `mustChangePassword = true`, `updatedAt = NOW()`.
- **Response (200 OK):**
  ```json
  {
    "message": "User password reset successfully",
    "temporaryPassword": "TempPasswordY9w#"
  }
  ```

---

## 5. Frontend & UI/UX Design

### 5.1. Login Screen (`/login`)
- **Field Change**: "Work Email" replaced with "Username" (with `User` icon instead of `Mail` icon).
- **Auto-Fill SuperAdmin**: Sets username to `admin` and password to `Admin123!`.
- **Login Handler**: If response `mustChangePassword === true`, redirects directly to `/change-password` with toast alert: "Silakan buat password baru Anda sebelum melanjutkan."

### 5.2. Force Change Password Screen (`/change-password`)
- **Design Aesthetic**: Modern, premium card matching AMS design system with red accents and glassmorphism.
- **Fields**:
  - New Password (`input type="password"` with show/hide toggle, minimum 8 characters).
  - Confirm New Password (`input type="password"`).
  - Real-time password requirement checklist (at least 8 characters, passwords match).
- **Submission**: Calls `api.post('/auth/change-password')`, updates user context (`mustChangePassword: false`), and redirects to `/dashboard`.
- **Sign Out Action**: Option to cancel/sign out back to `/login`.

### 5.3. Admin Access Management (`/dashboard/access`)
- **User Creation Modal (`UserFormModal`)**:
  - Remove initial password text field.
  - Informative banner: "Password temporary akan dibuatkan otomatis oleh sistem untuk login pertama user."
  - On submit: open `TemporaryPasswordModal`.
- **Password Reset Modal / Action**:
  - When admin clicks the key icon on a user row, open a confirmation dialog: "Reset password untuk user **{username}**? Sistem akan membuatkan temporary password baru."
  - On confirm: calls `POST /api/users/:id/reset-password`, then opens `TemporaryPasswordModal`.
- **Temporary Password Modal (`TemporaryPasswordModal`)**:
  - Displays user's username, email, and the generated temporary password in a highlighted mono font box.
  - "Salin Password" button with instant clipboard copy feedback ("Tersalin!").
  - Clear notice: "Password ini hanya berlaku 1 kali saat login pertama. Pengguna akan diwajibkan membuat password baru."

### 5.4. Route Guard in Dashboard Layout & Auth Context
- If an authenticated session has `user.mustChangePassword === true`, any access to `/dashboard/*` is redirected to `/change-password`.

---

## 6. Security & Integrity

- **Secure Random Generation**: Temporary passwords generated via crypto-safe RNG containing mixed-case, digits, and special characters.
- **Immediate Invalidation**: The temporary password is replaced as soon as the user completes `/change-password`.
- **Case-Insensitive Username**: Usernames are trimmed and compared case-insensitively to prevent duplicate confusion.
- **Token Claims**: JWT includes `mustChangePassword`. Protected business endpoints can reject calls if `mustChangePassword === true`.
- **Zero Sensitive Leaks**: Temporary passwords are never logged to console or backend log files; returned only once in the HTTP response to the admin performing the action.
