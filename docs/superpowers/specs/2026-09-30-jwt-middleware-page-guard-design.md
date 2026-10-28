# Design Specification: Comprehensive JWT & Middleware Route Protection Across All Pages

**Document ID**: `SPEC-2026-09-30-PAGE-GUARD`  
**Date**: 2026-09-30  
**Status**: DRAFT - In Review  
**Target Subsystems**: Next.js Frontend Routing & Middleware (`frontend/src/middleware.ts`, `frontend/src/app/dashboard/layout.tsx`, `frontend/src/components/layout/DashboardLayout.tsx`), Backend Express Middleware (`backend/src/middleware/auth.ts`, `backend/src/routes/*.ts`)

---

## 1. Summary & Problem Statement

Saat ini, sistem GAJIANICH-ITSM belum menerapkan proteksi JWT dan middleware secara konsisten di seluruh halaman frontend Next.js:
1. **Tidak adanya layout level guard (`src/app/dashboard/layout.tsx`)**: Setiap halaman di `/dashboard` memanggil `<DashboardLayout>` secara manual. Jika user (misal ber-role `HRD` atau `hr_attendance`) mengakses URL terlarang (seperti `/dashboard/assets`, `/dashboard/licenses`, `/dashboard/infrastructure`), komponen halaman tetap termuat (`mount`) dan tetap menjalankan panggilan API (`api.get(...)`) sebelum verifikasi hak akses selesai, menghasilkan error alert dan tampilan yang bocor.
2. **Next.js `src/middleware.ts` belum aktif/tersinkronisasi**: Token JWT pada frontend disimpan di `localStorage`, sedangkan Next.js Server Middleware membaca cookie HTTP (`request.cookies.get('token')`). Ketika cookie tidak sinkron atau hilang, middleware tidak dapat memverifikasi JWT dan role permissions secara akurat.
3. **Aturan Hak Akses Master Data Terlalu Luas**: Role HRD (`hr_attendance`) saat ini memiliki izin umum `master.view`, sehingga user HRD dapat mengakses dan melihat master data khusus IT seperti *IT Equipment Types*, *Vendors*, dan *Asset Custodians*. Padahal HRD seharusnya hanya diizinkan mengakses master data relevan HR (*Departments*, *Employees*, *Locations*).
4. **Login Redirect Kurang Presisi**: Saat login berhasil, pengecekan `master.view` dievaluasi sebelum pengecekan modul HR/Attendance, sehingga user HRD langsung diarahkan ke `/dashboard/master/departments` alih-alih `/dashboard/attendance`.

Dokumen ini menetapkan spesifikasi desain untuk penerapan proteksi JWT dan Middleware komprehensif di seluruh halaman frontend dan API backend.

---

## 2. Goals & Non-Goals

### Goals
- **Strict Server-Side & Client-Side Route Guarding**:
  - Terapkan Next.js Server Middleware (`src/middleware.ts`) yang memvalidasi token JWT dari cookie dan mencocokkan permission pengguna terhadap katalog rute sebelum halaman dirender.
  - Terapkan centralized `src/app/dashboard/layout.tsx` yang memblokir rendering halaman terlarang di tingkat layout sebelum komponen halaman atau API hook dieksekusi.
- **Bi-directional Token Synchronization**:
  - Sinkronkan JWT token antara `localStorage` dan cookie `token` (`SameSite=Lax; Path=/; Max-Age=86400`) saat login, session restore (`initializeAuth`), dan logout.
- **Granular Route-to-Permission Mapping**:
  - Definisikan peta rute yang ketat:
    - `/dashboard/assets/**` -> membutuhkan `assets.view`
    - `/dashboard/hardware-audits/**` -> membutuhkan `hardware_audits.view`
    - `/dashboard/licenses/**` -> membutuhkan `licenses.view`
    - `/dashboard/tickets/**` -> membutuhkan `tickets.view`
    - `/dashboard/infrastructure/**` -> membutuhkan `infrastructure.view`
    - `/dashboard/attendance/**` -> membutuhkan `attendance.view` (sub-halaman seperti `/access` butuh `attendance.manage`)
    - `/dashboard/access/**` -> membutuhkan `access.users.view` atau `access.roles.manage` (Admin/SuperAdmin only)
    - `/dashboard/master/departments` -> membutuhkan `master.view`
    - `/dashboard/master/employees` -> membutuhkan `master.view`
    - `/dashboard/master/locations` -> membutuhkan `master.view`
    - `/dashboard/master/equipment-types` -> membutuhkan `master.view` DAN role IT (`superadmin`, `itadmin`, `itstaff`) atau permission `assets.view`
    - `/dashboard/master/vendors` -> membutuhkan `master.view` DAN role IT (`superadmin`, `itadmin`, `itstaff`) atau permission `assets.view` / `licenses.view`
    - `/dashboard/master/asset-custodians/**` -> membutuhkan `master.manage` DAN role IT Admin
- **Consistent Unauthorized UX**:
  - User yang tidak memiliki izin untuk halaman tertentu diarahkan ke halaman `/dashboard/unauthorized?from=<pathname>` atau secara elegan menampilkan 403 Forbidden screen tanpa membocorkan data modul.
- **Backend API Defense-in-Depth**:
  - Pastikan seluruh endpoint backend di `/api/v1/*` mewajibkan `authenticateToken` dan `requirePermission(...)` sehingga pemanggilan API via curl/fetch dari luar tetap terlindungi 100%.

### Non-Goals
- Tidak mengubah skema tabel database `users`, `roles`, atau `permissions`.
- Tidak mengubah format tanda tangan JWT atau algoritma enkripsi token.

---

## 3. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│                   Next.js Request                      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
          ┌──────────────────────────────────┐
          │  Next.js Server Middleware       │
          │  (src/middleware.ts)             │
          └────────────────┬─────────────────┘
                           │
             ┌─────────────┴─────────────┐
        Token Valid?                No Token?
             │                           │
             ▼                           ▼
    Permission Matched?             Redirect to
             │                      /login?redirect=...
      ┌──────┴──────┐
     Yes            No
      │              │
      ▼              ▼
  Pass to       Redirect to
  Dashboard     /dashboard/unauthorized
  Layout        (atau modul default user)
      │
      ▼
┌────────────────────────────────────────────┐
│ src/app/dashboard/layout.tsx (Guard Level) │
│ - Verifies AuthContext session             │
│ - Checks exact permission for pathname     │
│ - Halts child page render if forbidden     │
└─────────────────────┬──────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────┐
│ Child Page Component (e.g. AssetsPage)     │
│ - Only mounts & executes API calls IF      │
│   layout guard approves access             │
└────────────────────────────────────────────┘
```

---

## 4. Detailed Component & Specification Changes

### 4.1 Token & Cookie Synchronization (`frontend/src/context/AuthContext.tsx`)
1. Di `login(token, user)`: Set `localStorage` dan `document.cookie = 'token=${token}; path=/; max-age=86400; SameSite=Lax'`.
2. Di `initializeAuth()`: Jika token ada di `localStorage` tapi belum ada di cookie, set ulang cookie agar Next.js server middleware selalu sinkron.
3. Di `logout()`: Hapus dari `localStorage` dan hapus cookie `token` (`max-age=0` / expired).

### 4.2 Next.js Route Guard Middleware (`frontend/src/middleware.ts`)
1. Mengekstrak cookie `token` dan mendecode JWT payload.
2. Mengintegrasikan daftar rute terperinci (termasuk sub-halaman master dan attendance).
3. Jika rute meminta izin yang tidak dimiliki user:
   - Redirect ke `/dashboard/unauthorized?from=<pathname>`.
4. Jika tidak ada token:
   - Redirect ke `/login?redirect=<pathname>`.

### 4.3 Centralized Dashboard Layout Guard (`frontend/src/app/dashboard/layout.tsx`)
1. Buat file `frontend/src/app/dashboard/layout.tsx` sebagai layout bawaan Next.js App Router.
2. Membungkus semua sub-rute dashboard dengan verifikasi token dan permission.
3. Jika user belum login atau sesi sedang diverifikasi, tampilkan *Verifying Session*.
4. Jika user tidak memiliki akses ke rute aktif, tampilkan layar *403 Akses Dibatasi* **tanpa merender child page**, sehingga child page tidak pernah memicu API call terlarang.

### 4.4 Granular Master Data & Navigation Rules (`frontend/src/components/layout/DashboardLayout.tsx`)
1. Perbarui `navGroups`:
   - Batasi *IT Equipment Types* dan *Vendors* dengan `itOnly: true` (hanya SuperAdmin, ITAdmin, ITStaff, Management). User HRD/HR Attendance tidak akan melihat menu ini di sidebar.
2. Perbarui `login` dan `dashboard/page.tsx` default redirect:
   - Prioritaskan role HRD/Attendance ke `/dashboard/attendance`.

### 4.5 Backend Route Audit
1. Verifikasi seluruh router backend (`assetRoutes.ts`, `licenseRoutes.ts`, `ticketRoutes.ts`, `infrastructureRoutes.ts`, `hardwareAuditRoutes.ts`, `masterRoutes.ts`, `employeeRoutes.ts`, `userRoutes.ts`, `roleRoutes.ts`) memiliki `authenticateToken` dan `requirePermission(...)`.

---

## 5. Security & Verification Strategy

1. **Test Matrix**:
   - User SuperAdmin -> Akses penuh ke seluruh halaman dan API.
   - User ITAdmin -> Akses ke Assets, Tickets, Licenses, Infrastructure, Audits, Master Data. Dilarang modifikasi role RBAC.
   - User HRD / HR Attendance:
     - Diizinkan: `/dashboard/attendance/*`, `/dashboard/master/departments`, `/dashboard/master/employees`, `/dashboard/master/locations`.
     - Ditolak (403): `/dashboard/assets`, `/dashboard/hardware-audits`, `/dashboard/licenses`, `/dashboard/tickets`, `/dashboard/infrastructure`, `/dashboard/access`, `/dashboard/master/equipment-types`, `/dashboard/master/vendors`, `/dashboard/master/asset-custodians`.
2. **Automated Verification**:
   - `npm --prefix frontend run test`
   - `npm --prefix backend run test`
   - `npm --prefix frontend run lint`
   - `npm --prefix backend build`
