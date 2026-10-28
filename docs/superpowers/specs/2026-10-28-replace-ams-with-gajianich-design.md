# Design Spec: Penggantian Kata `ams` Menjadi `gajianich`

- **Tanggal:** 2026-10-28
- **Status:** Menunggu Review & Approval Pengguna
- **Scope:** Repository-wide Brand & Terminology Replacement (`ams` ──► `gajianich`)

---

## 1. Summary & Problem Statement

Setelah penggantian `ams-app` menjadi `gajianich`, kata `ams` (baik huruf besar `AMS` maupun huruf kecil `ams`) masih digunakan pada berbagai bagian sistem:
1. Label dan teks pada User Interface (UI), halaman detail aset, manajemen absensi, form permohonan barang GA, dan modal kata sandi.
2. Nama file unduhan template dan ekspor Excel (`ams-asset-import-template.xlsx`, `ams-employee-import-template.xlsx`, `ams-karyawan-aktif.xlsx`).
3. Domain fallback email akun sistem internal (`@ams.internal` ──► `@gajianich.internal`).
4. Key event dan storage browser (`ams:attendance-workspace:v2`, `ams:attendance-updated`).
5. Nama package monorepo (`ams-itsm-root` ──► `gajianich-root`, `ams-itsm-backend` ──► `gajianich-backend`).
6. Dokumentasi arsitektur, panduan desain (`UI_DESIGN_SYSTEM_GUIDE.md`, `DESIGN.md`, `AGENTS.md`), serta runbook operasional.

Tujuan spesifikasi ini adalah menyeragamkan seluruh terminologi sistem ke **GAJIANICH** secara komprehensif.

---

## 2. Analisis Opsi Pendekatan

### Pendekatan A (Direkomendasikan: Comprehensive Application, UI, Docs, Packages, & Safe DB/Infra)
- **Cakupan**:
  - Semua label UI, teks header, watermark, dan modal (`AMS` ──► `GAJIANICH`).
  - Template import/export Excel (`ams-*` ──► `gajianich-*`) beserta test terkait.
  - Domain fallback email (`@ams.internal` ──► `@gajianich.internal`).
  - Storage & window event keys (`ams:attendance-*` ──► `gajianich:attendance-*`).
  - Package names (`ams-itsm-root` ──► `gajianich-root`, `ams-itsm-backend` ──► `gajianich-backend`).
  - Dokumentasi proyek (`README.md`, `AGENTS.md`, `DESIGN.md`, `UI_DESIGN_SYSTEM_GUIDE.md`, `docs/operations/*`).
- **Batasan Keamanan (Non-Goals)**:
  - Database role name `ams_app` dan trigger setting `ams.hr_audit_runtime_role` pada SQL migration yang sudah committed (`backend/drizzle/0015` s/d `0024`) tidak diubah, untuk mencegah rusaknya koneksi database PostgreSQL eksisting atau kegagalan checksum migrasi.
  - Substring alami yang memuat huruf "ams" (misal: `programs`, `params`, `diagrams`, `streams`) tidak boleh tersentuh.

### Pendekatan yang Dipilih: Total Full Rename (Pendekatan B Sesuai Permintaan Pengguna)
- Sesuai arahan eksplisit pengguna ("ya jalankan semua ganti ke gajianich tinggalkan semua kata ams atau ams-app"), seluruh token `ams` diubah total:
  - Database names & roles: `gajianich_dev_db`, `gajianich_prod_db`, `gajianich_app`, `gajianich.hr_audit_runtime_role`.
  - Docker Compose containers, images, volume names: `gajianich-*`.
  - Systemd units: `gajianich-postgres-backup.*`, `gajianich-postgres-verify.*`.
  - Drizzle migrations `0015` - `0024` & `migrate.ts`: setting `gajianich.hr_audit_runtime_role`.
  - Test suites & tmp directories: `gajianich_hr_audit_test`, `gajianich_ci_db`, `/tmp/gajianich-*`.
  - Seluruh dokumen dan rancangan lama disinkronkan ke GAJIANICH.
- **Batasan Baku**: Substring alami bahasa pemrograman/Inggris yang memuat huruf "ams" (misal: `ramSizeGb`, `params`, `diagrams`, `streams`, `streamsearch`) tetap dipertahankan karena merupakan konstruksi kode standar / hardware spec.

---

## 3. Data Model & Blast Radius (Berdasarkan Pendekatan A)

### 3.1 Frontend (`frontend/`)
1. `src/app/dashboard/assets/[id]/page.tsx`:
   - "AMS Property Tag" ──► "GAJIANICH Property Tag"
2. `src/app/dashboard/assets/page.tsx`:
   - `a.download = 'ams-asset-import-template.xlsx'` ──► `gajianich-asset-import-template.xlsx`
3. `src/components/access/TemporaryPasswordModal.tsx` & `UserTable.tsx`:
   - `endsWith("@ams.internal")` ──► `endsWith("@gajianich.internal")`
4. `src/components/attendance/AttendanceDevicesPage.tsx`:
   - "sistem AMS" ──► "sistem GAJIANICH"
5. `src/components/attendance/AttendanceDirectoryPage.tsx`:
   - "master data AMS & Talenta", "login AMS", "Data Karyawan AMS" ──► "GAJIANICH"
6. `src/components/attendance/AttendanceTransactionsPage.tsx` & `AttendanceWorkspace.tsx`:
   - `localStorage.setItem("ams:attendance-workspace:v2", ...)` ──► `gajianich:attendance-workspace:v2`
   - `window.dispatchEvent(new CustomEvent("ams:attendance-updated"))` ──► `gajianich:attendance-updated`
   - "shift harian AMS" ──► "shift harian GAJIANICH"
7. `src/components/ga/GoodsRequestList.tsx`:
   - Komentar pola master: "Standard AMS Directory Pattern" ──► "Standard GAJIANICH Directory Pattern"
8. `src/components/hardware-audits/LinkAuditToAssetModal.tsx`:
   - "database AMS" ──► "database GAJIANICH"
9. `src/components/master/EmployeeImportModal.tsx`:
   - `a.download = 'ams-employee-import-template.xlsx'` ──► `gajianich-employee-import-template.xlsx`
10. `src/lib/attendance/domain.test.mjs`:
    - `@ams.id` ──► `@gajianich.id`

### 3.2 Backend (`backend/`)
1. `src/controllers/userController.ts`:
   - `@ams.internal` ──► `@gajianich.internal` (sinkron dengan filter frontend)
2. `src/controllers/assetImportController.ts`:
   - `filename="ams-asset-import-template.xlsx"` ──► `filename="gajianich-asset-import-template.xlsx"`
3. `src/controllers/employeeImportController.ts` & `src/controllers/employeeImport.integration.test.ts`:
   - `filename="ams-employee-import-template.xlsx"` ──► `filename="gajianich-employee-import-template.xlsx"`
4. `src/controllers/employeeExportController.ts` & `src/controllers/employeeExport.test.ts`:
   - `ams-karyawan-aktif-${dateStr}.xlsx` ──► `gajianich-karyawan-aktif-${dateStr}.xlsx`
5. `src/services/assetWorkbook.ts`:
   - `workbook.creator = 'AMS ITSM'` ──► `'GAJIANICH ITSM'`
6. `package.json` & `backend/package.json`:
   - `"name": "ams-itsm-root"` ──► `"name": "gajianich-root"`
   - `"name": "ams-itsm-backend"` ──► `"name": "gajianich-backend"`

### 3.3 Dokumentasi & Master Rules
1. `AGENTS.md`: "Aturan Agen Proyek AMS" ──► "Aturan Agen Proyek GAJIANICH"
2. `DESIGN.md`: "Desain Sistem Baku AMS Enterprise" ──► "Desain Sistem Baku GAJIANICH Enterprise"
3. `UI_DESIGN_SYSTEM_GUIDE.md`: "Master Desain UI/UX Baku - AMS Enterprise" ──► "Master Desain UI/UX Baku - GAJIANICH Enterprise"
4. `README.md`: Judul dan deskripsi stack AMS ──► GAJIANICH
5. `docs/operations/*`: Pembaruan kata AMS pada judul dan panduan operasional.

---

## 4. Verification Plan

1. **Automated Unit Tests**:
   - `npx tsx --test backend/src/controllers/employeeExport.test.ts`
   - `npx tsx --test backend/src/controllers/employeeImport.integration.test.ts`
   - `npm test --prefix frontend -- src/lib/attendance/domain.test.mjs src/lib/brandEntryPoints.test.mjs`
2. **Bats Deployment Tests**:
   - `npx bats deploy/tests/deploy.bats`
3. **Word Boundary Audit**:
   - Verifikasi bahwa kata berdiri sendiri `\bams\b` (case-insensitive) telah digantikan secara tepat pada seluruh file yang ditargetkan tanpa merusak token non-target seperti `params` atau file migration database.

