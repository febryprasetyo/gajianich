# 14. Rebranding Total: Penggantian Kata `ams` & `ams-app` ke `gajianich`

## Status: Selesai

- **Spec**: [`docs/superpowers/specs/2026-10-28-replace-ams-with-gajianich-design.md`](../superpowers/specs/2026-10-28-replace-ams-with-gajianich-design.md)
- **Plan**: [`docs/superpowers/plans/2026-10-28-replace-ams-with-gajianich.md`](../superpowers/plans/2026-10-28-replace-ams-with-gajianich.md)

---

## Ringkasan Perubahan

1. **Milestone 1**: Penggantian kata `ams-app` menjadi `gajianich` di seluruh kode, konfigurasi skrip deployment, systemd, test bats, dan dokumentasi operasi.
2. **Milestone 2**: Penggantian kata `ams` pada antarmuka pengguna (UI), template spreadsheet Excel, fallback domain internal (`@gajianich.internal`), storage key browser (`gajianich:attendance-*`), dan package name (`gajianich-root`, `gajianich-backend`).
3. **Milestone 3**: Penggantian menyeluruh token `ams` dan `ams_*` pada basis data (`gajianich_dev_db`, `gajianich_prod_db`, `gajianich_app`, `gajianich.hr_audit_runtime_role`), Docker compose containers/volumes, systemd services/timers, Drizzle migrations, suite tes integrasi/e2e, serta seluruh berkas dokumentasi operasional dan riwayat perancangan.
4. **Verifikasi**: Bats tests (11/11), backend unit & integration tests (20/20), backend build (`tsc`), dan frontend typecheck (`tsc --noEmit`) seluruhnya lulus tanpa galat.

