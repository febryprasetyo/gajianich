# Task Plan: Penggantian Kata `ams` Menjadi `gajianich`

- **Tanggal:** 2026-10-28
- **Spec:** [2026-10-28-replace-ams-with-gajianich-design.md](file:///home/fastpec/code/ams-app/docs/superpowers/specs/2026-10-28-replace-ams-with-gajianich-design.md)
- **Status:** Completed & Verified

---

## 1. Overview & Phased Execution

```text
Phase 1: Backend Controller, Templates, & Package Names
         (userController, assetImportController, employeeImport/Export, package.json)
         │
         ▼
Phase 2: Frontend UI, Modals, Templates, & Storage Keys
         (assets, access, attendance, hardware-audits, template download names)
         │
         ▼
Phase 3: Project Rules & Operational Documentation
         (AGENTS.md, DESIGN.md, UI_DESIGN_SYSTEM_GUIDE.md, README.md, docs/operations/*)
         │
         ▼
Phase 4: Verification & Git Commit
         (Unit tests, Bats tests, Word check, atomic commit)
```

---

## 2. Phase-by-Phase Checklist

### Phase 1: Backend Controller, Templates, & Package Names
- [x] Update `package.json`: ganti `"name": "ams-itsm-root"` ──► `"name": "gajianich-root"`.
- [x] Update `backend/package.json`: ganti `"name": "ams-itsm-backend"` ──► `"name": "gajianich-backend"`.
- [x] Update `backend/src/controllers/userController.ts`: ganti fallback domain `@ams.internal` ──► `@gajianich.internal`.
- [x] Update `backend/src/controllers/assetImportController.ts`: ganti attachment filename `ams-asset-import-template.xlsx` ──► `gajianich-asset-import-template.xlsx`.
- [x] Update `backend/src/controllers/employeeImportController.ts` & `src/controllers/employeeImport.integration.test.ts`: ganti filename `ams-employee-import-template.xlsx` ──► `gajianich-employee-import-template.xlsx`.
- [x] Update `backend/src/controllers/employeeExportController.ts` & `src/controllers/employeeExport.test.ts`: ganti prefix filename `ams-karyawan-aktif` ──► `gajianich-karyawan-aktif`.
- [x] Update `backend/src/services/assetWorkbook.ts`: ganti `workbook.creator = 'AMS ITSM'` ──► `'GAJIANICH ITSM'`.
- [x] Verifikasi backend unit tests: `npx tsx --test backend/src/controllers/employeeExport.test.ts backend/src/controllers/employeeImport.integration.test.ts`.

### Phase 2: Frontend UI, Modals, Templates, & Storage Keys
- [x] Update `frontend/src/app/dashboard/assets/[id]/page.tsx`: ganti "AMS Property Tag" ──► "GAJIANICH Property Tag".
- [x] Update `frontend/src/app/dashboard/assets/page.tsx`: ganti `ams-asset-import-template.xlsx` ──► `gajianich-asset-import-template.xlsx`.
- [x] Update `frontend/src/components/master/EmployeeImportModal.tsx`: ganti `ams-employee-import-template.xlsx` ──► `gajianich-employee-import-template.xlsx`.
- [x] Update `frontend/src/components/access/TemporaryPasswordModal.tsx` & `frontend/src/components/access/UserTable.tsx`: ganti `@ams.internal` ──► `@gajianich.internal`.
- [x] Update `frontend/src/components/attendance/AttendanceDevicesPage.tsx`: ganti "sistem AMS" ──► "sistem GAJIANICH".
- [x] Update `frontend/src/components/attendance/AttendanceDirectoryPage.tsx`: ganti referensi "AMS" ──► "GAJIANICH".
- [x] Update `frontend/src/components/attendance/AttendanceTransactionsPage.tsx` & `AttendanceWorkspace.tsx`: ganti storage key `ams:attendance-*` ──► `gajianich:attendance-*` dan pesan teks.
- [x] Update `frontend/src/components/hardware-audits/LinkAuditToAssetModal.tsx`: ganti "database AMS" ──► "database GAJIANICH".
- [x] Update `frontend/src/components/ga/GoodsRequestList.tsx`: perbarui komentar header.
- [x] Update `frontend/src/lib/attendance/domain.test.mjs`: ganti `@ams.id` ──► `@gajianich.id`.
- [x] Verifikasi frontend tests: `npm test --prefix frontend -- src/lib/attendance/domain.test.mjs src/lib/brandEntryPoints.test.mjs`.

### Phase 3: Project Rules & Operational Documentation
- [x] Update `AGENTS.md`: ganti "Aturan Agen Proyek AMS" ──► "Aturan Agen Proyek GAJIANICH".
- [x] Update `DESIGN.md`: ganti "AMS Enterprise" ──► "GAJIANICH Enterprise".
- [x] Update `UI_DESIGN_SYSTEM_GUIDE.md`: ganti "Master Desain UI/UX Baku - AMS Enterprise" ──► "GAJIANICH Enterprise".
- [x] Update `README.md`: perbarui judul dan referensi teks AMS ──► GAJIANICH.
- [x] Update `docs/operations/*`: perbarui kata AMS di dokumen operasional.

### Phase 4: Database, Docker, Systemd, Tests & Documentation
- [x] Update database names in env examples and compose: `gajianich_dev_db`, `gajianich_prod_db`, `gajianich_app`.
- [x] Rename and update systemd backup and verify units: `gajianich-postgres-backup.*` dan `gajianich-postgres-verify.*`.
- [x] Update Drizzle migration role setting: `gajianich.hr_audit_runtime_role` in `migrate.ts` and SQL migrations `0015` s/d `0024`.
- [x] Update test database names & paths across backend/deploy/e2e tests: `gajianich_hr_audit_test`, `gajianich_ci_db`, `/tmp/gajianich-*`.
- [x] Update all remaining operational docs and past specs/plans to reference GAJIANICH.
- [x] Run verification: bats tests (11/11), backend unit & integration tests (20/20), frontend typecheck.
- [x] Buat Git commit dengan conventional commit:
  - `refactor(repo): replace all remaining ams references with gajianich across database, docker, tests, and docs`

