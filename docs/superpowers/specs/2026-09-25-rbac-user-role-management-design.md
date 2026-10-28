# Design Specification: Dynamic RBAC & User-Role Access Management

**Document ID**: `SPEC-2026-09-25-RBAC-MGMT`  
**Date**: 2026-09-25  
**Status**: DRAFT - Ready for Review  
**Target Subsystems**: Backend (`users`, `roles`, `permissions`, `role_permissions`), Frontend (`/dashboard/access`)

---

## 1. Summary & Problem Statement

Sistem GAJIANICH-ITSM saat ini memiliki autentikasi berbasis JWT dengan role statis yang dicek melalui nama role hardcoded (`SuperAdmin`, `ITAdmin`, `ITStaff`, `Employee`, `Management`). Belum ada halaman antarmuka pengguna (UI) maupun API backend terpadu untuk:
1. Mengelola pengguna (tambah user, ubah data/role, toggle status aktif/nonaktif, reset password).
2. Menghubungkan akun user secara opsional dengan master data karyawan (`employees`).
3. Mengatur peran (roles) dan menentukan aksi/hak akses (permissions) secara visual dan dinamis per modul aplikasi (Assets, Tickets, Licenses, Infrastructure, HR/Attendance, Master Data, Access Control).

Dokumen ini mendefinisikan desain teknis lengkap untuk **Dynamic Role-Based Access Control (RBAC)** dan antarmuka manajemen pengguna & hak akses role pada backend dan frontend.

---

## 2. Goals & Non-Goals

### Goals
- **Granular Permission Catalog**: Mendefinisikan katalog permission terstruktur berbasis modul (`module.action`, e.g. `assets.view`, `assets.create`, `assets.edit`, `assets.delete`, `tickets.manage`, `users.manage`, dll.).
- **Dynamic Role-Permissions Matrix**: Memungkinkan pembuatan role baru serta pengaturan permission untuk masing-masing role melalui UI centang/toggle per modul.
- **User Management Lifecycle**: Mendukung CRUD pengguna, penugasan role, tautan opsional ke data karyawan (`employee_id`), penggantian status (active/inactive), dan reset password yang aman.
- **Relational Data Integrity**: Menggunakan tabel PostgreSQL relasional (`permissions`, `role_permissions`) dengan Drizzle ORM.
- **Safety Fallback & Anti-Lockout**: Role bawaan sistem (`SuperAdmin`) bersifat immutable/terproteksi (`is_system = true`), memiliki akses wildcard penuh (`*`), dan user SuperAdmin terakhir tidak dapat dinonaktifkan atau dihapus.
- **Unified Frontend UI**: Antarmuka terpadu di route `/dashboard/access` dengan 2 tab:
  1. Tab **Users**: Tabel pengguna, filter role/status, modal Add/Edit User, modal Reset Password, toggle Active/Inactive.
  2. Tab **Roles & Permissions**: Daftar role dengan label badge System/Custom, panel matriks permission modular dengan opsi "Select All" per modul dan tombol simpan interaktif.
- **Client & Server Permission Hooks**: Helper `hasPermission(code)` pada frontend context dan middleware `requirePermission(code)` pada backend Express.

### Non-Goals
- Tidak mencakup autentikasi multi-tenant / organisasi multi-entitas (single company scope).
- Tidak mencakup login via Single Sign-On (SSO / OAuth2 / SAML) pada fase ini (tetap email + password hash bcrypt).
- Tidak merombak token session yang sudah tersimpan tanpa relogin (perubahan role/permission user aktif akan diperbarui otomatis saat token direfresh atau via panggilan `/api/v1/auth/me`).

---

## 3. Data Model & Schema Diffs

### 3.1 Drizzle Schema Changes (`backend/src/db/schema/users.ts`)

```typescript
import { pgTable, bigint, varchar, timestamp, boolean, text, primaryKey } from 'drizzle-orm/pg-core';
import { employees } from './employees';

export const permissions = pgTable('permissions', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  code: varchar('code', { length: 100 }).notNull().unique(), // e.g. 'assets.create'
  name: varchar('name', { length: 150 }).notNull(),          // e.g. 'Create Asset'
  module: varchar('module', { length: 50 }).notNull(),        // e.g. 'assets'
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
  role: varchar('role', { length: 50 }).default('SuperAdmin').notNull(), // kept in sync for backward compatibility
  employeeId: bigint('employee_id', { mode: 'number' }).references(() => employees.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 30 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 3.2 Standard Seeded Modules & Permissions Catalog

| Modul | Permission Code | Nama Permission | Deskripsi |
|---|---|---|---|
| `assets` | `assets.view` | View Assets | Melihat daftar inventaris aset dan detail |
| `assets` | `assets.create` | Create Asset | Menambahkan unit aset baru & import Excel |
| `assets` | `assets.edit` | Edit Asset | Memperbarui spesifikasi & detail aset |
| `assets` | `assets.delete` | Delete Asset | Menghapus atau mendisposisi aset |
| `assets` | `assets.assign` | Assign & Return | Melakukan serah terima & pengembalian aset |
| `tickets` | `tickets.view` | View Tickets | Melihat tiket service desk IT |
| `tickets` | `tickets.create` | Create Ticket | Membuat tiket permohonan / insiden baru |
| `tickets` | `tickets.manage` | Manage & Resolve | Mengubah status tiket, assignment teknisi, & resolusi |
| `licenses` | `licenses.view` | View Licenses | Melihat daftar lisensi software |
| `licenses` | `licenses.manage` | Manage Licenses | Tambah, alokasi kursi, & edit lisensi |
| `infrastructure` | `infrastructure.view` | View Infrastructure | Melihat monitoring server Accurate & database |
| `infrastructure` | `infrastructure.manage` | Manage Infrastructure | Konfigurasi node infrastruktur & sinkronisasi |
| `hardware_audits` | `hardware_audits.view` | View Hardware Audits | Melihat audit hardware dari agen |
| `hardware_audits` | `hardware_audits.manage` | Manage Audits | Tautkan audit ke aset & konversi unit baru |
| `attendance` | `attendance.view` | View Attendance | Melihat data absensi karyawan |
| `attendance` | `attendance.import` | Import Attendance | Melakukan impor file log absensi |
| `attendance` | `attendance.manage` | Manage Attendance | Koreksi data kartu & aktivitas absensi |
| `master` | `master.view` | View Master Data | Melihat departemen, lokasi, vendor, karyawan |
| `master` | `master.manage` | Manage Master Data | Tambah, ubah, dan hapus master data |
| `access` | `access.users.view` | View Users | Melihat daftar pengguna sistem |
| `access` | `access.users.manage` | Manage Users | Tambah user, edit status, reset password |
| `access` | `access.roles.manage` | Manage Roles | Membuat role & mengatur matriks hak akses |

---

## 4. Backend API Specifications & RBAC Middleware

### 4.1 RBAC Enforcement Layer (`backend/src/middleware/auth.ts`)

- Pengguna dengan role `SuperAdmin` (atau `role.code === 'super_admin'`) otomatis lolos semua pengecekan (`bypass / wildcard`).
- Helper middleware baru:
  ```typescript
  export function requirePermission(permissionCode: string) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      // 1. Cek token valid
      // 2. Jika SuperAdmin -> izinkan (next())
      // 3. Query role_permissions untuk roleId user
      // 4. Jika memiliki permissionCode -> next(), jika tidak -> res.status(403).json({ error: 'Forbidden: Missing required permission' })
    };
  }
  ```

### 4.2 Endpoint List

#### Users Management (`/api/v1/users`)
- `GET /api/v1/users` - Mengambil daftar pengguna, relasi role, dan employee info (Membutuhkan `access.users.view` atau `SuperAdmin`).
- `POST /api/v1/users` - Menambah pengguna baru dengan email, username, password, roleId, dan opsional employeeId (Membutuhkan `access.users.manage`).
- `PUT /api/v1/users/:id` - Mengubah username, email, roleId, status, dan employeeId (Membutuhkan `access.users.manage`).
- `PATCH /api/v1/users/:id/status` - Mengaktifkan / menonaktifkan akun user (Mencegah deaktivasi SuperAdmin terakhir).
- `POST /api/v1/users/:id/reset-password` - Mengatur ulang password akun tertentu dengan validasi kompleksitas (Membutuhkan `access.users.manage`).

#### Roles & Permissions (`/api/v1/roles`)
- `GET /api/v1/roles` - Mengambil daftar semua role beserta permission IDs yang dimilikinya (Membutuhkan `access.roles.manage` atau `SuperAdmin`).
- `POST /api/v1/roles` - Membuat role kustom baru (`code`, `name`, `description`).
- `PUT /api/v1/roles/:id` - Memperbarui nama dan deskripsi role (Role `is_system` tidak boleh diubah kodenya).
- `DELETE /api/v1/roles/:id` - Menghapus role kustom (Role `is_system` dilarang dihapus; role yang masih memiliki user dilarang dihapus).
- `GET /api/v1/roles/permissions` - Mengambil seluruh katalog permission yang dikelompokkan berdasarkan modul.
- `PUT /api/v1/roles/:id/permissions` - Menyimpan daftar `permissionIds: number[]` untuk role tertentu.

#### Auth Info Update (`/api/v1/auth/me` & `/api/v1/auth/login`)
- Response `/api/v1/auth/login` dan `/api/v1/auth/me` menyertakan array `permissions: string[]` yang aktif sehingga frontend langsung mengetahui kapabilitas aksi pengguna.

---

## 5. Frontend Architecture & UI/UX

### 5.1 Route & Layout Placement
- Path: `/dashboard/access`
- Sidebar Navigation: Ditempatkan di bawah grup baru **Administration** di `DashboardLayout.tsx`:
  - Item Navigasi: `{ name: 'Access Control', href: '/dashboard/access', icon: ShieldCheck, adminOnly: true }`
- Desain Visual:
  - Header halaman dengan judul **Access & Role Management**, deskripsi singkat, dan breadcrumb.
  - Tab Switcher:
    - **Users** (dengan badge counter total pengguna aktif)
    - **Roles & Permissions** (dengan badge counter total role)

### 5.2 Tab 1: Users Management
- **Statistik Cepat**: Total Users, Active Users, Inactive Users, Total Roles.
- **Search & Filter**: Pencarian berdasarkan nama/email/username, filter dropdown Role, dan filter Status.
- **Tabel Pengguna**:
  - Kolom: User Avatar + Nama/Username, Email, Assigned Role (Badge), Linked Employee (Badge info nama/NIP jika ada), Status (Active/Inactive toggle pill), Created Date, Actions.
  - Aksi: Edit User, Reset Password, Toggle Status, Delete (jika bukan akun sendiri / SuperAdmin).
- **Modal Add/Edit User**:
  - Input: Full Name / Username, Email, Password (hanya saat create), Role Dropdown (dinamis dari API), Employee Link Dropdown (pencarian autocomplete karyawan dari `/api/v1/employees`), Status Toggle.
- **Modal Reset Password**:
  - Input Password Baru dengan konfirmasi dan indikator kekuatan password.

### 5.3 Tab 2: Roles & Permissions Matrix
- **Layout Split**:
  - **Panel Kiri (Role Selector)**: List kartu role. Menampilkan nama role, kode, deskripsi, badge "System" / "Custom", dan jumlah permissions yang aktif. Tombol "Create New Role".
  - **Panel Kanan (Permission Matrix Panel)**:
    - Menampilkan detail role yang dipilih.
    - Tombol "Select All" dan "Clear All".
    - Pengelompokan kartu per Modul (Assets, Tickets, Licenses, Infrastructure, HR, Master Data, Access Control).
    - Tiap item permission memiliki switch/checkbox interaktif dengan label nama dan penjelasan singkat aksi.
    - Floating / Sticky Action Bar di bawah: Tombol "Save Changes" (dengan indikator status dirty state & loading spinner) dan tombol "Reset".

### 5.4 Client Auth Context Integration
- `useAuth()` diperluas dengan helper method:
  `hasPermission(permissionCode: string): boolean`
  - Mengembalikan `true` jika user adalah `SuperAdmin` atau array `user.permissions` memuat kode tersebut.
  - Komponen UI dapat menyembunyikan atau menonaktifkan tombol secara deklaratif (misal: `{hasPermission('assets.create') && <Button>Tambah Aset</Button>}`).

---

## 6. Security, Safety Guards & Edge Cases

1. **SuperAdmin Immutable Protection**:
   - Role `SuperAdmin` memiliki tanda `is_system = true`.
   - Backend memblokir penghapusan atau perubahan permission role SuperAdmin (selalu memiliki akses total).
2. **Anti-Lockout Rule**:
   - Sistem memblokir upaya admin menonaktifkan atau menurunkan role akunnya sendiri.
   - Sistem memvalidasi minimal harus ada 1 akun `SuperAdmin` aktif di sistem setiap saat.
3. **Role Deletion Guard**:
   - Role tidak dapat dihapus jika masih ada user yang terhubung ke role tersebut (mengembalikan error 400 informatif dengan daftar/jumlah user terkait).
4. **Password Security**:
   - Hash password menggunakan bcrypt dengan salt rounds 10.
   - Password baru wajib minimal 8 karakter.
5. **Database Transaction Boundary**:
   - Pembaruan hak akses role (`PUT /api/v1/roles/:id/permissions`) dijalankan di dalam atomic database transaction (hapus relasi lama + insert relasi baru) untuk mencegah state korup jika terjadi kegagalan jaringan.

---

## 7. Verification & Automated Testing Plan

1. **Backend Unit & Integration Tests**:
   - Test `backend/src/controllers/userController.test.ts`:
     - Test CRUD user, validasi email duplikat, enkripsi password.
     - Test pencegahan deaktivasi SuperAdmin terakhir.
   - Test `backend/src/controllers/roleController.test.ts`:
     - Test CRUD role kustom & pencegahan penghapusan system role.
     - Test update role permissions matrix atomic transaction.
   - Test RBAC middleware:
     - Test `requirePermission`: user dengan permission diizinkan (200), user tanpa permission ditolak (403), SuperAdmin selalu lolos (200).
2. **Frontend Typecheck & Lint**:
   - `npm run lint --prefix frontend`
   - `npx tsc --noEmit --project frontend/tsconfig.json`
3. **End-to-End Visual Verification**:
   - Navigasi ke `/dashboard/access`, verifikasi rendering tabel users dan matriks permissions.

