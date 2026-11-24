# 20 – Laporan Audit Server Mingguan (Weekly Health & Security Audit Reporting)
Status: Selesai
Spec: [2026-11-23-server-weekly-report-audit-design.md](../superpowers/specs/2026-11-23-server-weekly-report-audit-design.md) | Plan: [2026-11-23-server-weekly-report-audit.md](../superpowers/plans/2026-11-23-server-weekly-report-audit.md)
Lingkup: `gajianich-server-agent/scripts/update.sh`, `gajianich-server-agent/src/index.ts`, `gajianich-server-reporter/`, `backend/src/db/schema/infrastructure.ts`, `backend/src/routes/infrastructureRoutes.ts`, `backend/src/controllers/infrastructureController.ts`, `frontend/src/app/dashboard/infrastructure/reports/`, `frontend/src/components/servers/` | Di luar lingkup: Server produksi `/home/cmc/app/svc/gajianich` (seluruh instalasi & pengujian terisolasi di server development)

## Aturan Khusus Eksekusi
1. **ZERO DUMMY DATA**: Dilarang keras menggunakan data mock/dummy buatan. Pengujian dan agregasi wajib membaca data riil dari tabel `server_metric_samples`, `servers`, dan `db_backups`.
2. **ALUR SEKUENSIA KETAT (BACKEND & AGENT FIRST, FRONTEND LAST)**:
   - Selesaikan seluruh konfigurasi Agen (`gajianich-server-agent`), Migrasi Database, Modul Reporter (`gajianich-server-reporter`), dan Backend API (`ams-app/backend`).
   - Verifikasi end-to-end sampai PDF riil berhasil terbit secara fisik di storage dan tercatat di database PostgreSQL.
   - HANYA jika backend, agen, dan reporter telah 100% terverifikasi dengan data riil, barulah pengerjaan UI/UX frontend di Web Dashboard dimulai.

## Checkpoint
- [x] CP-01 — `702fd53` — Skema `server_weekly_reports` (Drizzle ORM), migrasi DDL `0059_server_weekly_reports.sql`, dan unit test skema backend → `cd backend && npx tsx --test src/db/schema/infrastructureWeeklyReport.test.ts` lulus (2/2 pass)
- [x] CP-02 — `ec7e146` — Peningkatan `gajianich-server-agent` dengan skrip `scripts/update.sh` dan remote command handler `actionType === 'update'` → `cd /home/fastpec/code/gajianich-server-agent && npm run build` lulus (tsc pass)
- [x] CP-03 — `ab71c46` — Scaffolding modul `gajianich-server-reporter` (DataAggregator real-data, Gemini 2.5 Flash Engine, Rule-Based Fallback, Emerald Enterprise Print CSS Template, Puppeteer PDF Generator, Storage Archiver, dan CLI runner) → `cd /home/fastpec/code/gajianich-server-reporter && npm test && npm run build` lulus (3/3 pass)
- [x] CP-04 — `f6cdc3e` — Endpoint Backend REST API (`GET /reports`, `GET /reports/:id/download`, `POST /reports/generate`) dan integration test → `cd backend && npx tsx --test src/routes/infrastructureReportsRoutes.test.ts` lulus (3/3 pass)
- [x] CP-05 — `283087a` — Verifikasi end-to-end generate PDF A4 menggunakan data riil 798 sampel database PostgreSQL: berkas PDF `Laporan-Mingguan-srv-prod-node-01-2026-W48.pdf` (229 KB) terbit di `/home/fastpec/code/storage/reports/` dan tercatat di database → `cd /home/fastpec/code/gajianich-server-reporter && npm run generate -- --server=137021` lulus
- [x] CP-06 — `cd311f8` — Antarmuka Web Dashboard GAJIANICH (`/dashboard/infrastructure/reports`), PageHeader emerald, 4 KPI Card interaktif (Total, Normal, Warning, Kritis), FilterToolbar, TableShell riwayat laporan, Modal Trigger On-Demand, Modal Detail Ringkasan Audit, serta shortcut navigasi dari halaman Server → `cd frontend && npx tsx --test src/lib/serverWeeklyReports.test.mjs && npx tsc --noEmit && npx eslint src/app/dashboard/infrastructure/reports/page.tsx` lulus (3/3 pass, 0 type errors, 0 lint errors)
- [x] CP-07 — `d570de1` — Pengayaan Telemetri Agent: parser log host `/var/log/auth.log` (login SSH sukses, percobaan gagal, eksekusi sudo, akun baru), status PostgreSQL & Redis middleware via docker exec, pengecekan paket update OS, dan dual-hub telemetry push ke localhost dev & live prod.
- [x] CP-08 — `e382eda` — Migrasi skema database `0060_server_weekly_reports_8sections.sql` (8 seksi audit, scope_type, sla_percent) & perbaikan controller backend untuk multi-path PDF search dan dukungan cluster scope.
- [x] CP-09 — `f981297` — Modul Reporter 8 Bagian Sophos Enterprise: cover page formal, running header/footer, narasi pengantar kontekstual per seksi, meter horizontal bar visual, fallback zero-outage elegan, dan unit test 4/4 lulus (`npm test`).
- [x] CP-10 — `4548974` — Antarmuka Web Dashboard GAJIANICH terintegrasi 8 Seksi: ReportDetailModal dengan 5 tab interaktif, GenerateReportModal dengan pilihan cakupan (Node Server vs Cluster Fleet), filter cakupan di toolbar, dan unduh PDF resmi.

## Kriteria Selesai
- [x] Modul `gajianich-server-reporter` terisolasi penuh dari `gajianich-server-agent` (agen bebas dari dependensi Chromium, Puppeteer, dan `@google/genai`).
- [x] Ekstraksi metrik 7 hari berjalan akurat (CPU, RAM, Disk growth, Network throughput, container restart, Fail2Ban, failed SSH, SSL expiry, DB backup) tanpa dummy data.
- [x] Analisis cerdas Gemini `gemini-2.5-flash` menghasilkan output terstruktur (`overallStatus`, `executiveSummary`, `incidentRca`, `recommendations`) dengan fallback otomatis ke *rule-based engine* lokal saat koneksi API gagal atau tanpa API key.
- [x] Dokumen PDF berformat A4 Portrait dengan styling *Emerald Enterprise*, header/footer berulang, dan penomoran halaman otomatis (*Halaman X dari Y*).
- [x] Berkas PDF tersimpan aman di direktori storage lokal dan tercatat di database `server_weekly_reports`.
- [x] Trigger on-demand via REST API (`POST /reports/generate`) berjalan *ephemeral* di latar belakang dan merespon `202 Accepted`.
- [x] Halaman UI `/dashboard/infrastructure/reports` mematuhi standar Master Desain Baku GAJIANICH (PageHeader emerald, KPI Cards interaktif, FilterToolbar, TableShell, dan RowActionButton).
