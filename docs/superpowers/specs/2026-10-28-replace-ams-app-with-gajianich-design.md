# Design Spec: Penggantian Kata `ams-app` Menjadi `gajianich`

- **Tanggal:** 2026-10-28
- **Status:** Menunggu Review & Approval Pengguna
- **Scope:** Bounded Repository Renaming & Documentation Alignment

---

## 1. Summary & Problem Statement

Nama repo dan direktori instalasi awal menggunakan kata `ams-app`. Seiring dengan peresmian identitas brand aplikasi menjadi **GAJIANICH** (Grup Administrasi, Jadwal, & Informasi Internal), kata `ams-app` yang masih tersebar di konfigurasi CI/CD GitHub Actions, skrip deployment, berkas unit systemd, test bats, dokumentasi operasional, serta dokumen spec/plan historis perlu dibersihkan dan digantikan secara konsisten menjadi `gajianich`.

Tujuan dari spec ini adalah memastikan seluruh kemunculan string `ams-app` di codebase diubah menjadi `gajianich` secara rapi dan aman tanpa merusak konfigurasi database atau fungsionalitas aplikasi yang sudah berjalan.

---

## 2. Goals & Non-Goals

### Goals
- Mengganti seluruh kemunculan kata `ams-app` menjadi `gajianich` pada seluruh 31 berkas terlacak (tracked files) di repositori:
  - Workflow GitHub Actions (`.github/workflows/release.yml`)
  - Dokumentasi root (`README.md`)
  - Deployment scripts (`deploy/scripts/*`: `backup-postgres.sh`, `deploy-to-prod.sh`, `deploy.sh`, `preflight.sh`, `rollback.sh`, `verify-postgres-backup.sh`)
  - Konfigurasi systemd (`deploy/systemd/ams-postgres-backup.service`, `deploy/systemd/ams-postgres-verify.service`)
  - Automated tests deployment (`deploy/tests/deploy.bats`)
  - Dokumentasi operasional (`docs/operations/*`)
  - Dokumen spesifikasi dan rencana terdahulu (`docs/superpowers/specs/*`, `docs/superpowers/plans/*`, `docs/todo/*`)
- Memastikan suite pengujian bats (`deploy/tests/deploy.bats`) berjalan sukses setelah pembaruan path default.
- Memastikan tidak ada sisa `ams-app` pada `git grep "ams-app"`.

### Non-Goals
- **Database Role**: User PostgreSQL `ams_app` (dengan underscore) tidak diubah agar tidak merusak izin role, connection string, maupun migrasi skema database yang ada.
- **Nama Package Monorepo**: Nama package monorepo `ams-itsm-root` dan `ams-itsm-backend` tidak diubah karena tidak memuat kata `ams-app` dan bukan bagian dari permintaan.
- **Direktori Fisik Host**: Perubahan nama folder di host filesystem (misal `/home/fastpec/code/ams-app`) berada di luar kendali repo git. Perubahan hanya berlaku pada string/kode di dalam repositori.

---

## 3. Data Model & Architecture Impact

- **Database**: Tidak ada perubahan skema database (Drizzle ORM) maupun DDL.
- **API Contract**: Tidak ada endpoint atau payload API yang terpengaruh.
- **Deployment Paths**:
  - Default aplikasi: `/opt/ams-app` ──► `/opt/gajianich`
  - Default backup: `/var/backups/ams-app/postgres` ──► `/var/backups/gajianich/postgres`
  - Production deploy target: `/home/cmc/app/svc/ams-app` ──► `/home/cmc/app/svc/gajianich`
  - Workspace dev target: `/srv/ams-app/workspace` ──► `/srv/gajianich/workspace`
  - Clone repo URL: `https://github.com/<owner>/ams-app.git` ──► `https://github.com/<owner>/gajianich.git`

---

## 4. Blast Radius & Affected Files (31 Berkas)

1. **CI/CD & Root**:
   - `.github/workflows/release.yml`
   - `README.md`
2. **Deploy Scripts & Systemd & Bats**:
   - `deploy/scripts/backup-postgres.sh`
   - `deploy/scripts/deploy-to-prod.sh`
   - `deploy/scripts/deploy.sh`
   - `deploy/scripts/preflight.sh`
   - `deploy/scripts/rollback.sh`
   - `deploy/scripts/verify-postgres-backup.sh`
   - `deploy/systemd/ams-postgres-backup.service`
   - `deploy/systemd/ams-postgres-verify.service`
   - `deploy/tests/deploy.bats`
3. **Dokumentasi Operasional**:
   - `docs/operations/database-recovery.md`
   - `docs/operations/development.md`
   - `docs/operations/release.md`
   - `docs/operations/server-setup.md`
4. **Dokumen Superpowers & Todo**:
   - `docs/superpowers/plans/2026-08-20-automated-development-deployment.md`
   - `docs/superpowers/plans/2026-09-25-ams-attendance-migration.md`
   - `docs/superpowers/plans/2026-10-01-talenta-attendance-card-ui.md`
   - `docs/superpowers/plans/2026-10-09-leave-request-form.md`
   - `docs/superpowers/plans/2026-10-14-master-cuti-settings.md`
   - `docs/superpowers/plans/2026-10-19-edit-leave-request.md`
   - `docs/superpowers/plans/2026-10-20-ga-approvals.md`
   - `docs/superpowers/plans/2026-10-23-mobile-attendance-approval.md`
   - `docs/superpowers/plans/2026-10-26-hrd-approval-notifications-and-page-split.md`
   - `docs/superpowers/specs/2026-08-20-automated-development-deployment-design.md`
   - `docs/superpowers/specs/2026-10-08-asset-dashboard-role-landing-design.md`
   - `docs/superpowers/specs/2026-10-21-goods-request-edit-delete-save-print-design.md`
   - `docs/superpowers/specs/2026-10-23-modular-architecture-migration-design.md`
   - `docs/superpowers/specs/2026-10-26-hrd-approval-notifications-and-page-split-design.md`
   - `docs/superpowers/specs/UI_DESIGN_SYSTEM_GUIDE.md`
   - `docs/todo/11-notifikasi-hrd-dan-pemisahan-halaman-approval.md`

---

## 5. Security & Verification Strategy

- **Security Boundary**: Tidak ada kredensial atau environment variable rahasia yang terpengaruh. File `.env` tetap berada di luar version control.
- **Verification Commands**:
  - `git grep -i "ams-app"` wajib mengembalikan output kosong (kecuali mungkin spec/plan yang mendokumentasikan proses perubahan ini).
  - `npx bats deploy/tests/deploy.bats` wajib lulus 5/5 test.
  - `git diff` diverifikasi menyeluruh agar tidak ada perubahan tak sengaja di luar penggantian `ams-app` -> `gajianich`.

