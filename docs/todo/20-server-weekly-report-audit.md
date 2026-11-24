# 20 – Laporan Audit Server Mingguan (Weekly Health & Security Audit Reporting)
Status: Rencana
Spec: [2026-11-23-server-weekly-report-audit-design.md](../superpowers/specs/2026-11-23-server-weekly-report-audit-design.md) | Plan: [2026-11-23-server-weekly-report-audit.md](../superpowers/plans/2026-11-23-server-weekly-report-audit.md)
Lingkup: `gajianich-server-agent/scripts/update.sh`, `gajianich-server-agent/src/index.ts`, `gajianich-server-reporter/`, `backend/src/db/schema/infrastructure.ts`, `backend/src/routes/infrastructureRoutes.ts`, `backend/src/controllers/infrastructureController.ts`, `frontend/src/app/dashboard/infrastructure/reports/`, `frontend/src/components/servers/` | Di luar lingkup: Server produksi `/home/cmc/app/svc/gajianich` (seluruh instalasi & pengujian terisolasi di server development)

## Aturan Khusus Eksekusi
1. **ZERO DUMMY DATA**: Dilarang keras menggunakan data mock/dummy buatan. Pengujian dan agregasi wajib membaca data riil dari tabel `server_metric_samples`, `servers`, dan `db_backups`.
2. **ALUR SEKUENSIA KETAT (BACKEND & AGENT FIRST, FRONTEND LAST)**:
   - Selesaikan seluruh konfigurasi Agen (`gajianich-server-agent`), Migrasi Database, Modul Reporter (`gajianich-server-reporter`), dan Backend API (`ams-app/backend`).
   - Verifikasi end-to-end sampai PDF riil berhasil terbit secara fisik di storage dan tercatat di database PostgreSQL.
   - HANYA jika backend, agen, dan reporter telah 100% terverifikasi dengan data riil, barulah pengerjaan UI/UX frontend di Web Dashboard dimulai.

## Checkpoint
- [ ] CP-01: Skema `server_weekly_reports` (Drizzle ORM), migrasi DDL, dan unit test skema backend → verifikasi: `cd backend && npx vitest run src/db/schema/infrastructureWeeklyReport.test.ts`
- [ ] CP-02: Peningkatan `gajianich-server-agent` dengan skrip `scripts/update.sh` dan remote command handler `actionType === 'update'` → verifikasi: `cd /home/fastpec/code/gajianich-server-agent && npm run build`
- [ ] CP-03: Scaffolding modul `gajianich-server-reporter` (DataAggregator, Gemini 2.5 Flash Engine, Rule-Based Fallback, Emerald Enterprise Print CSS Template, Puppeteer PDF Generator, Storage Archiver, dan CLI runner) → verifikasi: `cd /home/fastpec/code/gajianich-server-reporter && npm test && npm run build`
- [ ] CP-04: Endpoint Backend REST API (`GET /reports`, `GET /reports/:id/download`, `POST /reports/generate`) dan integration test → verifikasi: `cd backend && npx vitest run src/routes/infrastructureReportsRoutes.test.ts`
- [ ] CP-05: Antarmuka Web Dashboard GAJIANICH (`/dashboard/infrastructure/reports`), PageHeader emerald, KPI Grid interaktif, FilterToolbar, TableShell riwayat laporan, Modal Trigger On-Demand, Modal Detail Ringkasan Audit, serta shortcut navigasi dari halaman Server → verifikasi: `cd frontend && npx vitest run src/app/dashboard/infrastructure/reports/page.test.tsx`
- [ ] CP-06: Verifikasi menyeluruh end-to-end generate PDF A4, typecheck & lint backend/frontend → verifikasi: `cd backend && npm run typecheck && npm test && cd ../frontend && npm run typecheck && npm run lint`

## Kriteria Selesai
- [ ] Modul `gajianich-server-reporter` terisolasi penuh dari `gajianich-server-agent` (agen bebas dari dependensi Chromium, Puppeteer, dan `@google/genai`).
- [ ] Ekstraksi metrik 7 hari berjalan akurat (CPU, RAM, Disk growth, Network throughput, container restart, Fail2Ban, failed SSH, SSL expiry, DB backup).
- [ ] Analisis cerdas Gemini `gemini-2.5-flash` menghasilkan output terstruktur (`overallStatus`, `executiveSummary`, `incidentRca`, `recommendations`) dengan fallback otomatis ke *rule-based engine* lokal saat koneksi API gagal atau tanpa API key.
- [ ] Dokumen PDF berformat A4 Portrait dengan styling *Emerald Enterprise*, header/footer berulang, dan penomoran halaman otomatis (*Halaman X dari Y*).
- [ ] Berkas PDF tersimpan aman di direktori storage lokal dan tercatat di database `server_weekly_reports`.
- [ ] Trigger on-demand via REST API (`POST /reports/generate`) berjalan *ephemeral* di latar belakang dan merespon `202 Accepted`.
- [ ] Halaman UI `/dashboard/infrastructure/reports` mematuhi standar Master Desain Baku GAJIANICH (PageHeader emerald, KPI Cards interaktif, FilterToolbar, TableShell, dan RowActionButton).
