# Implementation Plan: Comprehensive JWT & Middleware Route Protection Across All Pages

**Document ID**: `PLAN-2026-09-30-PAGE-GUARD`  
**Date**: 2026-09-30  
**Spec Reference**: `docs/superpowers/specs/2026-09-30-jwt-middleware-page-guard-design.md`  
**Status**: DRAFT - Ready for Review

---

## 1. Shared Types & Definitions

Definisi interface hak akses dan rute yang konsisten antara frontend dan middleware:

```typescript
export interface RouteAccessRule {
  path: string;
  exact?: boolean;
  requiredPermission?: string;
  allowedRoles?: string[];
  moduleName: string;
}
```

---

## 2. Phase-by-Phase Tasks

### Phase 1: Authentication Context & Cookie Reliability
- [x] Task 1.1: Perbarui `frontend/src/context/AuthContext.tsx` untuk memastikan sinkronisasi dua arah antara `localStorage` dan HTTP cookie `token`.
  - Pada `initializeAuth`: set cookie jika `token` ada di `localStorage`.
  - Pada `login`: simpan ke `localStorage` dan set cookie `token=${newToken}; path=/; max-age=86400; SameSite=Lax`.
  - Pada `logout`: bersihkan `localStorage` dan set cookie `token=; path=/; max-age=0`.
- [x] Task 1.2: Perbarui `backend/src/controllers/authController.ts` dan `backend/src/utils/jwt.ts` untuk memastikan payload token JWT menyertakan `permissions` array yang valid serta role name/code yang dinormalisasi.

### Phase 2: Next.js Server Middleware (`src/middleware.ts`)
- [x] Task 2.1: Finalisasi dan aktifkan `frontend/src/middleware.ts`.
  - Konfigurasi `matcher: ['/dashboard/:path*']`.
  - Ekstrak dan parse token JWT dari cookie request.
  - Implementasikan evaluasi rute yang ketat:
    - `/dashboard/assets/**` -> `assets.view`
    - `/dashboard/hardware-audits/**` -> `hardware_audits.view`
    - `/dashboard/licenses/**` -> `licenses.view`
    - `/dashboard/tickets/**` -> `tickets.view`
    - `/dashboard/infrastructure/**` -> `infrastructure.view`
    - `/dashboard/access/**` -> `access.users.view` atau `access.roles.manage`
    - `/dashboard/master/equipment-types/**` -> IT only (`assets.view` atau role `superadmin`, `itadmin`, `itstaff`)
    - `/dashboard/master/vendors/**` -> IT only (`assets.view` atau `licenses.view` atau role `superadmin`, `itadmin`, `itstaff`)
    - `/dashboard/master/asset-custodians/**` -> IT Admin only (`master.manage`)
    - `/dashboard/attendance/**` -> `attendance.view`
  - Jika token tidak valid / tidak ada: redirect ke `/login?redirect=<pathname>`.
  - Jika user tidak memiliki akses: redirect ke `/dashboard/unauthorized?from=<pathname>`.

### Phase 3: Centralized Dashboard Layout Guard & Navigation UX
- [x] Task 3.1: Buat `frontend/src/app/dashboard/layout.tsx` sebagai guard utama Next.js App Router.
  - Integrasikan `<DashboardLayout>` di tingkat rute dashboard.
  - Jika hak akses rute tidak terpenuhi, blokir rendering komponen anak (`children`) dan tampilkan 403 Forbidden alert agar child page tidak menjalankan `useEffect` dan pemanggilan API backend.
- [x] Task 3.2: Perbaiki `frontend/src/components/layout/DashboardLayout.tsx` dan `navGroups`.
  - Sembunyikan item menu IT Equipment Types, Vendors, dan Asset Custodians dari pengguna non-IT (seperti HRD / HR Attendance).
  - Pastikan breadcrumb dan sidebar aktif mencerminkan hak akses aktual.
- [x] Task 3.3: Perbaiki alur redirect login (`frontend/src/app/login/page.tsx` dan `frontend/src/app/dashboard/page.tsx`).
  - Prioritaskan role HRD/Attendance ke `/dashboard/attendance` alih-alih `/dashboard/master/departments`.

### Phase 4: Automated Verification & Testing
- [x] Task 4.1: Jalankan unit test frontend: `npm --prefix frontend run test`.
- [x] Task 4.2: Jalankan test backend: `npm --prefix backend run test`.
- [x] Task 4.3: Jalankan typecheck frontend: `./node_modules/.bin/tsc --noEmit`.
- [x] Task 4.4: Lakukan pengujian skenario simulasi role (SuperAdmin, ITAdmin, HRD).
  - Verifikasi HRD ditolak saat membuka `/dashboard/assets`, `/dashboard/licenses`, `/dashboard/infrastructure`, `/dashboard/access`, `/dashboard/master/equipment-types`, `/dashboard/master/vendors`.
  - Verifikasi HRD dapat mengakses `/dashboard/attendance/*`, `/dashboard/master/departments`, `/dashboard/master/employees`, `/dashboard/master/locations`.
- [x] Task 4.5: Commit atomic perubahan ke Git sesuai spesifikasi.

---

## 3. Verification Commands

1. **Frontend Test Suite**:
   ```bash
   npm --prefix frontend run test
   ```
2. **Backend Test Suite**:
   ```bash
   npm --prefix backend run test
   ```
3. **Frontend Typecheck**:
   ```bash
   cd frontend && ./node_modules/.bin/tsc --noEmit
   ```
