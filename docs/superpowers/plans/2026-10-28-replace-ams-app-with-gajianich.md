# Task Plan: Penggantian Kata `ams-app` Menjadi `gajianich`

- **Tanggal:** 2026-10-28
- **Spec:** [2026-10-28-replace-ams-app-with-gajianich-design.md](file:///home/fastpec/code/ams-app/docs/superpowers/specs/2026-10-28-replace-ams-app-with-gajianich-design.md)
- **Status:** Completed & Verified

---

## 1. Overview & Phased Execution

Pekerjaan ini dilakukan bertahap dan diverifikasi dengan cermat:

```text
Phase 1: CI/CD & Deploy Infrastructure
         (release.yml, deploy/scripts/*, deploy/systemd/*, deploy/tests/deploy.bats)
         │
         ▼
Phase 2: Root & Operational Documentation
         (README.md, docs/operations/*)
         │
         ▼
Phase 3: Historical Superpowers Specs, Plans, & Todo
         (docs/superpowers/*, docs/todo/*)
         │
         ▼
Phase 4: Verification & Git Commit
         (bats tests, git grep verification, atomic commit)
```

---

## 2. Phase-by-Phase Checklist

### Phase 1: CI/CD & Deploy Infrastructure
- [x] Update `.github/workflows/release.yml`: Ganti `/opt/ams-app/` menjadi `/opt/gajianich/`.
- [x] Update `deploy/scripts/backup-postgres.sh`: Ganti default `BACKUP_DIR` menjadi `/var/backups/gajianich/postgres`.
- [x] Update `deploy/scripts/deploy-to-prod.sh`: Ganti default `PROD_DIR` menjadi `/home/cmc/app/svc/gajianich`.
- [x] Update `deploy/scripts/deploy.sh`: Ganti default `APP_DIR` menjadi `/opt/gajianich` dan `BACKUP_DIR` menjadi `/var/backups/gajianich/postgres`.
- [x] Update `deploy/scripts/preflight.sh`: Ganti default `ENV_FILE` menjadi `/opt/gajianich/.env`.
- [x] Update `deploy/scripts/rollback.sh`: Ganti default `APP_DIR` menjadi `/opt/gajianich`.
- [x] Update `deploy/scripts/verify-postgres-backup.sh`: Ganti default `BACKUP_DIR` menjadi `/var/backups/gajianich/postgres`.
- [x] Update `deploy/systemd/ams-postgres-backup.service`: Ganti path script dan backup ke `/opt/gajianich/` dan `/var/backups/gajianich/`.
- [x] Update `deploy/systemd/ams-postgres-verify.service`: Ganti path script dan backup ke `/opt/gajianich/` dan `/var/backups/gajianich/`.
- [x] Update `deploy/tests/deploy.bats`: Ganti test mock dir ke `$TEST_TMPDIR/opt/gajianich`.
- [x] Jalankan verifikasi bats: `npx bats deploy/tests/deploy.bats` (harus 5/5 pass).

### Phase 2: Root & Operational Documentation
- [x] Update `README.md`: Ganti URL clone dan instruksi `cd ams-app` menjadi `cd gajianich`.
- [x] Update `docs/operations/database-recovery.md`: Ganti `/var/backups/ams-app/` dan `/opt/ams-app/`.
- [x] Update `docs/operations/development.md`: Ganti `/srv/ams-app/workspace` menjadi `/srv/gajianich/workspace`.
- [x] Update `docs/operations/release.md`: Ganti `/opt/ams-app/` menjadi `/opt/gajianich/`.
- [x] Update `docs/operations/server-setup.md`: Ganti seluruh referensi `/opt/ams-app` dan `/var/backups/ams-app` serta clone command.

### Phase 3: Historical Superpowers Specs, Plans, & Todo
- [x] Update docs superpowers plans:
  - `docs/superpowers/plans/2026-08-20-automated-development-deployment.md`
  - `docs/superpowers/plans/2026-09-25-ams-attendance-migration.md`
  - `docs/superpowers/plans/2026-10-01-talenta-attendance-card-ui.md`
  - `docs/superpowers/plans/2026-10-09-leave-request-form.md`
  - `docs/superpowers/plans/2026-10-14-master-cuti-settings.md`
  - `docs/superpowers/plans/2026-10-19-edit-leave-request.md`
  - `docs/superpowers/plans/2026-10-20-ga-approvals.md`
  - `docs/superpowers/plans/2026-10-23-mobile-attendance-approval.md`
  - `docs/superpowers/plans/2026-10-26-hrd-approval-notifications-and-page-split.md`
- [x] Update docs superpowers specs & design guides:
  - `docs/superpowers/specs/2026-08-20-automated-development-deployment-design.md`
  - `docs/superpowers/specs/2026-10-08-asset-dashboard-role-landing-design.md`
  - `docs/superpowers/specs/2026-10-21-goods-request-edit-delete-save-print-design.md`
  - `docs/superpowers/specs/2026-10-23-modular-architecture-migration-design.md`
  - `docs/superpowers/specs/2026-10-26-hrd-approval-notifications-and-page-split-design.md`
  - `docs/superpowers/specs/UI_DESIGN_SYSTEM_GUIDE.md`
- [x] Update `docs/todo/11-notifikasi-hrd-dan-pemisahan-halaman-approval.md`.

### Phase 4: Verification & Git Commit
- [x] Jalankan verifikasi menyeluruh:
  - `git grep "ams-app" | grep -v "2026-10-28-replace-ams-app-with-gajianich"` (harus menghasilkan output kosong).
  - `npx bats deploy/tests/deploy.bats` (harus lulus 5/5).
- [ ] Buat Git commit dengan conventional commit:
  - `refactor(repo): replace ams-app naming with gajianich across scripts and docs`

