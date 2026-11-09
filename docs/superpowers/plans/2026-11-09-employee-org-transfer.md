# Implementation Plan: Transfer Karyawan Antar Organisasi / Kelompok (CMC <-> MGM) dengan RBAC

## Shared Interfaces & Types
- `EmployeeTransferInput`: `{ targetGroupId: number; targetDepartmentId: number; targetLocationId?: number | null; effectiveDate: string; reason: string }`
- `EmployeeTransferRecord`: `{ id: number; employeeId: number; fromGroupId: number; toGroupId: number; fromDepartmentId: number; toDepartmentId: number; fromLocationId?: number | null; toLocationId?: number | null; effectiveDate: string; reason: string; transferredBy: number; createdAt: string }`

---

## Phase 1: Database Schema & Migration
- [x] Buat skema tabel `employee_organization_transfers` di `backend/src/db/schema/organizations.ts` (atau `backend/src/db/schema/employeeTransfers.ts`).
- [x] Buat file migrasi SQL atau pastikan Drizzle schema & script migration mencakup foreign keys ke `employees`, `organization_groups`, `departments`, `locations`, dan `users`.
- [x] Tulis unit test skema untuk memastikan constraint & relasi tabel `employee_organization_transfers`.

*Verification Command:*
`npm --prefix backend test src/db/schema/organizations.test.ts` (atau test file baru)

---

## Phase 2: RBAC Definition & Backend Service / Route
- [x] Daftarkan permission baru `employees.transfer` di `backend/src/domain/rbac.ts` dan seed permissions.
- [x] Berikan default permission ke role admin (`super_admin`, `it_admin`), dan pastikan role non-admin (`ga_staff`, `it_staff`, `employee`, `management`, `hr_attendance`) tidak memilikinya.
- [x] Implementasikan fungsi transfer di service `backend/src/services/employeeTransferService.ts` yang menjalankan:
  1. Validasi eksistensi karyawan dan relasi grup/departemen saat ini.
  2. Validasi target departemen & target organisasi (target department wajib terdaftar di `department_organization_mappings` untuk target group).
  3. Update `employees.departmentId` dan opsional `employees.locationId`.
  4. Insert record ke `employee_organization_transfers`.
  5. Jika ada akun `users` yang terikat (`users.employee_id`), update mapping `user_organization_group_access`.
  6. Catat audit event ke `hr_audit_events`.
  7. Invalidate relevant redis cache (`auth:org-access:*`, `ref:master:*`).
- [x] Buat controller `transferEmployee` dan `getEmployeeTransfers` di `backend/src/controllers/employeeTransferController.ts`.
- [x] Daftarkan route di `backend/src/routes/employeeRoutes.ts`:
  - `POST /:id/transfer` (diproteksi `requirePermission('employees.transfer')`)
  - `GET /:id/transfers` (diproteksi `requirePermission(['attendance.view', 'master.view', 'employees.transfer'])`)
- [x] Buat endpoint untuk mendapatkan daftar grup organisasi dan departemennya untuk mempermudah frontend (`GET /master/organization-groups/departments` atau serupa).
- [x] Tulis automated integration / unit tests untuk alur transfer & proteksi RBAC:
  - Admin berhasil mentransfer karyawan.
  - Role non-admin (cth: `ga_staff` / `employee`) ditolak (403 Forbidden).
  - Validasi departemen tidak cocok dengan target group ditolak (400 Bad Request).

*Verification Command:*
`npm --prefix backend test`

---

## Phase 3: Frontend UI Components & State Management
- [x] Tambahkan tipe transfer di `frontend/src/lib/employeeTypes.ts`.
- [x] Buat komponen `EmployeeTransferModal.tsx` di `frontend/src/components/master/`:
  - Modal form dialog responsif & mobile-friendly.
  - Ringkasan karyawan (Nama, NIK, Departemen Asal, Kelompok Asal).
  - Pilihan Kelompok Tujuan (CMC / MGM).
  - Pilihan Departemen Tujuan (reaktif berdasarkan grup yang dipilih).
  - Pilihan Lokasi Baru (opsional).
  - Tanggal Efektif & Alasan Transfer (required textarea).
  - Tombol Submit dengan loading state & konfirmasi.
- [x] Update `EmployeeDirectoryPage.tsx`:
  - Periksa permission `employees.transfer` menggunakan `checkUserPermission(user, 'employees.transfer')`.
  - Tambahkan tombol/ikon Transfer pada baris karyawan jika user memiliki izin.
  - Buka `EmployeeTransferModal` saat tombol diklik.
- [x] Update Halaman Detail Karyawan (`frontend/src/app/dashboard/master/employees/[id]/page.tsx` atau `frontend/src/components/master/EmployeeDetailPage.tsx`):
  - Tampilkan tombol "Transfer Organisasi" di header jika diizinkan.
  - Tampilkan riwayat transfer di tab/card "Riwayat Transfer Organisasi".
- [x] Tulis unit test untuk komponen frontend / logika permission transfer.

*Verification Command:*
`npm --prefix frontend test` & `npx --prefix frontend tsc --noEmit`

---

## Phase 4: Verification Loop & Quality Check
- [x] Jalankan backend typecheck: `npx --prefix backend tsc --noEmit`.
- [x] Jalankan frontend typecheck: `npx --prefix frontend tsc --noEmit`.
- [x] Jalankan linting: `npm run lint` / `npm --prefix frontend run lint`.
- [x] Jalankan seluruh suite test otomatis.
- [x] Update checkpoint di dokumen plan/spec/todo dan commit git milestone.

*Verification Command:*
`npm --prefix backend test && npm --prefix frontend test && npx --prefix backend tsc --noEmit && npx --prefix frontend tsc --noEmit`

