# Design Spec: User Registration Flow Refinement & HRD Scoped Employee Access

- **Date:** 2026-10-23
- **Author:** Fastpec Engineering
- **Status:** Draft / Pending Approval

---

## 1. Summary & Problem Statement

Aplikasi GAJIANICH saat ini menyediakan modul manajemen pengguna (*Access Control*) yang utamanya ditujukan untuk administrator teknis (SuperAdmin / ITAdmin). Seiring berjalannya operasional absensi mobile mandiri bagi karyawan, HRD membutuhkan kemampuan untuk mendaftarkan dan mengelola akun pengguna karyawan secara mandiri tanpa harus meminta bantuan IT.

Namun, terdapat beberapa kendala dan kebutuhan spesifik:
1. **Flow Pendaftaran Akun Terlalu Rumit / Tidak Relevan:**
   - Field `email` saat ini masih ada di form atau diwajibkan secara teknis, padahal karyawan umumnya tidak menggunakan email kantor untuk login (sistem login menggunakan `username` dan `password`).
   - Role default belum otomatis terarah ke `Employee`.
   - Status akun harus selalu default `Active` (*Aktif*).
   - Akun login harus terintegrasi langsung dengan profil master data karyawan (`employees`).
2. **Keamanan & Boundary Hak Akses HRD (Scoped RBAC):**
   - HRD membutuhkan hak untuk melihat (view) dan mengubah (edit/manage) akun karyawan.
   - **Namun HRD dilarang keras melihat atau mengakses akun non-karyawan** (seperti SuperAdmin, IT Admin, IT Staff, GA Staff, Management, dll.) demi menjaga kerahasiaan hak akses infrastruktur & tata kelola IT.
   - HRD dilarang membuat atau menaikkan hak akses (privilege escalation) ke peran selain `Employee`.
   - Tab pengelolaan Roles & Permissions Matrix di UI harus disembunyikan bagi HRD.

---

## 2. Goals & Non-Goals

### Goals
- **Penyederhanaan Form Register/Tambah User:**
  - Menentukan `username` (nama akun login unik, auto-suggest dari nama karyawan).
  - Memilih profil karyawan dari master data (`employeeId`) dengan integrasi pencarian cepat.
  - Role default otomatis terpilih `Employee`.
  - Field `email address` dihapus sepenuhnya dari form input.
  - Status akun default `Active` (*Aktif*).
- **Penambahan Izin Akses HRD (`hr_attendance` / `hrd`):**
  - Memberikan permission `access.users.view` dan `access.users.manage` ke role `hr_attendance`.
  - Mengizinkan HRD mengakses menu dan halaman Users Directory (`/dashboard/access`).
- **Enforcement Scoped RBAC (Employee Only):**
  - Backend API membatasi akses HRD:
    - `GET /api/v1/users`: HRD hanya menerima daftar user yang memiliki peran `employee`.
    - `POST /api/v1/users`: HRD hanya diizinkan membuat user dengan peran `employee`.
    - `PUT /api/v1/users/:id`: HRD hanya dapat mengedit user bertipe `employee` dan tidak dapat mengubah role ke selain `employee`.
    - `PATCH /api/v1/users/:id/status`, `POST /api/v1/users/:id/reset-password`, `DELETE /api/v1/users/:id`: Dibatasi secara ketat hanya untuk akun bertipe `employee`.
  - Frontend UI membatasi tampilan:
    - HRD hanya melihat tab "Users Directory" (tab "Roles & Permissions Matrix" disembunyikan).
    - Dropdown Role pada form terkunci/hanya menampilkan pilihan `Employee` saat dibuka oleh HRD.
- **Konsistensi Desain GAJIANICH / Emerald Enterprise:**
  - Mengikuti panduan `DESIGN.md` dan `UI_DESIGN_SYSTEM_GUIDE.md` dengan status badge emerald/slate, modal shell bersih, dan animasi halus.

### Non-Goals
- Tidak mengubah alur otentikasi login inti (`POST /api/v1/auth/login`), yang tetap berbasis `username` dan `password`.
- Tidak memberikan izin kepada HRD untuk mengedit permission catalog atau role definition (hanya SuperAdmin).
- Tidak menghapus kolom historis di database bila masih dibutuhkan oleh audit atau sistem luar; kolom `users.email` dijadikan nullable dengan fallback internal jika diperlukan.

---

## 3. Data Model & Schema Diffs

### Database Schema (`users` table)
Di database PostgreSQL saat ini:
```sql
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
```
Di Drizzle schema (`backend/src/db/schema/users.ts`):
- `email: varchar('email', { length: 255 }).unique()` (menghapus `.notNull()`).
- Tetap mempertahankan fallback internal (e.g. `${username.toLowerCase()}@gajianich.internal`) jika ada integrasi eksternal yang mengharuskan string email tidak kosong.

### Default Permissions Seed (`backend/src/domain/rbac.ts` & `backend/src/db/seed.ts`)
Tambahkan permission untuk `hr_attendance`:
```typescript
hr_attendance: [
  'hr.audit.view',
  'attendance.view',
  'attendance.import',
  'attendance.manage',
  'access.users.view',   // Diperluas dengan scoped filter di controller
  'access.users.manage', // Diperluas dengan scoped filter di controller
],
```

---

## 4. API Specifications & Security Boundary

### Scoped RBAC Helper (`backend/src/controllers/userController.ts`)
```typescript
function isCallerHrd(req: AuthenticatedRequest): boolean {
  const normRole = (req.user?.roleName || '').toLowerCase().replace(/[\s_-]+/g, '');
  return normRole === 'hrattendance' || normRole === 'hrd';
}
```

### Endpoints
1. **`GET /api/v1/users`**
   - Permission: `access.users.view`
   - Perilaku:
     - Jika pemanggil adalah SuperAdmin / ITAdmin: Mengembalikan semua pengguna.
     - Jika pemanggil adalah HRD (`isCallerHrd`): Menambahkan klausa filter database `where(eq(roles.code, 'employee'))`. Akun selain employee tidak akan terkirim dalam payload.

2. **`POST /api/v1/users`**
   - Permission: `access.users.manage`
   - Request Body:
     ```json
     {
       "username": "budi.santoso",
       "roleId": 5,
       "employeeId": 12,
       "status": "active"
     }
     ```
     *(Catatan: field `email` opsional / dihilangkan dari payload form).*
   - Perilaku:
     - Jika pemanggil adalah HRD:
       - Validasi role target: Role ID yang dikirimkan **wajib** merupakan role dengan `code === 'employee'`. Jika bukan, tolak dengan HTTP 403 Forbidden (`HRD is only permitted to create Employee accounts`).

3. **`PUT /api/v1/users/:id`**
   - Permission: `access.users.manage`
   - Perilaku:
     - Jika pemanggil adalah HRD:
       - Cek akun target yang akan diubah: Jika role akun yang diedit bukan `employee`, tolak dengan HTTP 403 Forbidden (`Forbidden: You can only edit Employee accounts`).
       - Cek role baru yang akan diassign: Jika mencoba mengganti role ke selain `employee`, tolak dengan HTTP 403 Forbidden.

4. **`PATCH /api/v1/users/:id/status` & `POST /api/v1/users/:id/reset-password` & `DELETE /api/v1/users/:id`**
   - Permission: `access.users.manage`
   - Perilaku:
     - Jika pemanggil adalah HRD:
       - Pastikan akun target memiliki role `employee`. Jika bukan, tolak dengan HTTP 403 Forbidden.

---

## 5. Frontend & UI/UX Specifications

### 1. `frontend/src/components/access/UserFormModal.tsx`
- **Field Karyawan (Linked Employee):** Berada di urutan teratas form dengan autocomplete searchable dropdown (nama, NIK, departemen). Saat dipilih, jika username kosong, otomatis mengisi username yang bersih.
- **Field Username:** Menentukan ID login user.
- **Field Email Address:** Dihapus sepenuhnya dari UI form.
- **Field Role Assignment:**
  - Nilai awal default selalu role `Employee` (bukan role pertama dari array / admin).
  - Jika yang login adalah HRD: Dropdown hanya menampilkan role `Employee` dan terkunci/disabled sehingga HRD tidak dapat memilih role lain.
- **Field Status Akun:**
  - Default: `Active` (*Aktif*).
- **Temporary Password Callout:** Tetap menampilkan info bahwa password sementara acak akan digenerate otomatis dan disajikan di modal pop-up setelah simpan.

### 2. `frontend/src/components/access/UserTable.tsx`
- Kolom tabel difokuskan pada:
  - **Pengguna / Karyawan**: Avatar inisial, username, NIK, dan Nama Lengkap Karyawan (tanpa email address dummy).
  - **Role**: Badge peran (`Employee` dengan emerald badge).
  - **Status**: Badge aktif / nonaktif.
  - **Aksi**: Edit, Reset Password, Toggle Status, Hapus.

### 3. `frontend/src/app/dashboard/access/page.tsx`
- **Tab Header:**
  - Jika yang login tidak memiliki hak kelola role (misal HRD), tab "Roles & Permissions Matrix" disembunyikan. HRD hanya disajikan tab Users Directory.
- **Stats Card:**
  - Menampilkan ringkasan total pengguna karyawan yang dikelola.

### 4. Route Protection & Sidebar (`routes.ts` & `DashboardLayout.tsx`)
- Di `frontend/src/lib/access/routes.ts`:
  - Ubah rule `/dashboard/access` agar tidak lagi memiliki `adminOnly: true` (cukup mengandalkan `permission: 'access.users.view'`), sehingga HRD dapat mengakses rute ini secara legal.
- Di `frontend/src/components/layout/DashboardLayout.tsx`:
  - Pastikan menu navigasi muncul untuk pengguna yang memiliki permission `access.users.view` (termasuk HRD).

---

## 6. Verification & Test Plan

1. **Unit & Integration Tests (Backend):**
   - `backend/src/controllers/userController.test.ts`:
     - Test HRD memanggil `getUsers`: hanya mengembalikan user dengan role `employee`.
     - Test HRD memanggil `createUser` dengan role `employee`: berhasil.
     - Test HRD memanggil `createUser` dengan role `it_admin` / selain employee: ditolak HTTP 403.
     - Test HRD memanggil `updateUser` pada user non-employee: ditolak HTTP 403.
     - Test HRD memanggil `toggleUserStatus` dan `resetPassword` pada user employee: berhasil.
     - Test SuperAdmin memanggil `getUsers`: tetap menerima semua user tanpa filter.
2. **Frontend Tests / Typechecks:**
   - `npm run build` / `npx tsc --noEmit` di backend dan frontend.
   - Verifikasi bahwa modal UserFormModal memiliki role default `Employee`, status default `Active`, dan tanpa field email.
