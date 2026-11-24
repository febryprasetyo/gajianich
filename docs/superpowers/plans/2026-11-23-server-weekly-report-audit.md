# TASK PLAN: GAJIANICH Infrastructure Weekly Health & Security Audit Reporting

**Date:** 2026-11-23  
**Status:** In Review (Spec-Driven Development)  
**Spec Reference:** `docs/superpowers/specs/2026-11-23-server-weekly-report-audit-design.md`  
**PRD Reference:** `docs/specs/PRD-SERVER-WEEKLY-REPORT-AUDIT.md`

---

## Shared Interfaces & Data Contracts

### 1. Database Table Interface (`server_weekly_reports`)
```typescript
export interface ServerWeeklyReportRecord {
  id: number;
  serverId: number;
  periodWeek: string; // e.g. "2026-W47"
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  executiveSummary: string | null;
  incidentRca: string | null;
  recommendations: Array<{
    priority: 'TINGGI' | 'SEDANG' | 'RENDAH';
    title: string;
    action: string;
  }>;
  pdfFileName: string;
  pdfFilePath: string;
  fileSizeBytes: number;
  generatedBy: string;
  createdAt: Date;
}
```

### 2. Aggregated 7-Day Metrics Payload (Input to Gemini AI)
```typescript
export interface AggregatedWeeklyMetrics {
  server: {
    id: number;
    code: string;
    name: string;
    ipAddress: string;
    specs: string;
    os: string;
  };
  period: {
    week: string;
    startDate: string;
    endDate: string;
  };
  metrics: {
    avgCpuPct: number;
    peakCpuPct: number;
    avgRamPct: number;
    peakRamPct: number;
    startDiskPct: number;
    endDiskPct: number;
    diskGrowthPct: number;
    avgLoad1m: number;
    avgNetRxBps: number;
    avgNetTxBps: number;
    sampleCount: number;
  };
  services: Array<{
    name: string;
    category: string;
    status: string;
    restarts: number;
  }>;
  security: {
    failedSshCount: number;
    fail2banBannedIps: number;
    sslDaysRemaining: number;
    ufwStatus: string;
  };
  backups: Array<{
    dbName: string;
    status: string;
    sizeMb: number;
    completedAt: string;
  }>;
}
```

### 3. AI Analysis Output Contract
```typescript
export interface AiAuditAnalysisResult {
  overallStatus: 'NORMAL' | 'WARNING' | 'CRITICAL';
  executiveSummary: string;
  incidentRca: string | null;
  recommendations: Array<{
    priority: 'TINGGI' | 'SEDANG' | 'RENDAH';
    title: string;
    action: string;
  }>;
}
```

---

## Prinsip Eksekusi Utama (Strict Real Data & Backend-First Flow)

1. **ZERO DUMMY DATA**: Dilarang membuat mock/dummy data statis di modul reporter maupun backend. Pengujian wajib mengambil data riil dari tabel `server_metric_samples`, `servers`, dan `db_backups`.
2. **STRICT PHASE ORDER**:
   - **Langkah 1**: Selesaikan seluruh konfigurasi Agen (`gajianich-server-agent`), Migrasi Database, Modul Reporter (`gajianich-server-reporter`), dan Backend API (`ams-app/backend`).
   - **Langkah 2**: Jalankan verifikasi *end-to-end* hingga PDF riil terbit di storage fisik dan tercatat di database PostgreSQL.
   - **Langkah 3**: HANYA setelah backend dan reporter 100% selesai dan terbukti memproses data riil, baru mulai membangun UI/UX Frontend di Web Dashboard.

---

## Phase-by-Phase Implementation Tasks

### Phase 1: Database Schema & Migration (`ams-app/backend`)
- [ ] **Task 1.1**: Tambahkan definisi tabel `serverWeeklyReports` pada `backend/src/db/schema/infrastructure.ts`.
- [ ] **Task 1.2**: Ekspor tabel pada `backend/src/db/schema/index.ts`.
- [ ] **Task 1.3**: Tulis unit test skema database pada `backend/src/db/schema/infrastructureWeeklyReport.test.ts` (TDD).
- [ ] **Task 1.4**: Jalankan migrasi dan pastikan test skema lulus.
  * **Verifikasi:** `cd backend && npx vitest run src/db/schema/infrastructureWeeklyReport.test.ts`

### Phase 2: Remote Agent Update Support (`gajianich-server-agent`)
- [ ] **Task 2.1**: Buat skrip idempoten `scripts/update.sh` di root `gajianich-server-agent/` dengan izin eksekusi (`chmod +x`).
- [ ] **Task 2.2**: Tambahkan tipe perintah `actionType: 'update'` pada interface `PendingCommand` di `src/index.ts`.
- [ ] **Task 2.3**: Tambahkan handler eksekusi `bash scripts/update.sh` di dalam loop pemrosesan perintah remote agen.
- [ ] **Task 2.4**: Tulis unit test untuk verifikasi penanganan command `update` pada `gajianich-server-agent`.
  * **Verifikasi:** `cd /home/fastpec/code/gajianich-server-agent && npm run build`

### Phase 3: Scaffolding Modul `gajianich-server-reporter` & Core Engines
- [ ] **Task 3.1**: Inisialisasi package TypeScript mandiri di `/home/fastpec/code/gajianich-server-reporter` (termasuk link `/mnt/Data/code/gajianich-server-reporter`) dengan dependensi: `@google/genai`, `puppeteer`, `dotenv`, `pg` / `drizzle-orm`.
- [ ] **Task 3.2**: Implementasi `DataAggregator` (`src/aggregator/dataAggregator.ts`) untuk mengekstrak metrik 7 hari, Docker container restarts, security logs, dan backup history dari database PostgreSQL.
- [ ] **Task 3.3**: Implementasi `GeminiAnalyst` (`src/ai/geminiAnalyst.ts`) menggunakan `@google/genai` dengan model `gemini-2.5-flash` dan prompt terstruktur.
- [ ] **Task 3.4**: Implementasi `RuleBasedFallback` (`src/ai/ruleBasedFallback.ts`) sebagai mesin evaluasi lokal jika API key tidak tersedia atau kuota habis.
- [ ] **Task 3.5**: Buat template HTML & CSS print-ready bertema *Emerald Enterprise* (`src/generator/template.ts`) dengan header berulang, nomor halaman otomatis, dan `page-break-inside: avoid`.
- [ ] **Task 3.6**: Implementasi `PdfRenderer` (`src/generator/pdfRenderer.ts`) via Puppeteer headless dengan flags hemat memori.
- [ ] **Task 3.7**: Implementasi `Archiver` (`src/storage/archiver.ts`) untuk menyimpan PDF ke direktori `/home/fastpec/code/storage/reports/` dan menyimpan metadata ke `server_weekly_reports`.
- [ ] **Task 3.8**: Implementasi CLI Runner (`src/cli.ts`) dan Scheduler Cron (`src/index.ts`).
  * **Verifikasi:** `cd /home/fastpec/code/gajianich-server-reporter && npm test && npm run build`

### Phase 4: Backend Integration Endpoints (`ams-app/backend`)
- [ ] **Task 4.1**: Tambahkan fungsi controller `getWeeklyReports`, `downloadWeeklyReport`, dan `generateWeeklyReportOnDemand` pada `backend/src/controllers/infrastructureController.ts`.
- [ ] **Task 4.2**: Daftarkan routes baru pada `backend/src/routes/infrastructureRoutes.ts`:
  * `GET /api/v1/infrastructure/reports` (permission: `infrastructure.view`)
  * `GET /api/v1/infrastructure/reports/:id/download` (permission: `infrastructure.view`)
  * `POST /api/v1/infrastructure/reports/generate` (permission: `infrastructure.manage`)
- [ ] **Task 4.3**: Tulis automated unit & integration tests untuk ketiga endpoint di `backend/src/routes/infrastructureReportsRoutes.test.ts`.
  * **Verifikasi:** `cd backend && npx vitest run src/routes/infrastructureReportsRoutes.test.ts`

### Phase 5: Frontend Web Dashboard UI (`ams-app/frontend`)
- [ ] **Task 5.1**: Buat halaman baru `frontend/src/app/dashboard/infrastructure/reports/page.tsx` mematuhi Master Desain Baku GAJIANICH:
  * `PageHeader` dengan ikon `FileText` emerald, judul, subjudul deskriptif, dan tombol aksi "Audit Sekarang".
  * `KpiGrid` dan 4 `KpiCard` interaktif: Total Laporan, Normal, Warning, Kritis.
  * `FilterToolbar` terpisah dengan input search, dropdown server & status, serta tombol Reset.
  * `TableShell` menampilkan daftar laporan, badge status berwarna semantik, tanggal, ukuran file, dan `RowActionButton` (Download & Detail).
- [ ] **Task 5.2**: Buat Modal Shell Trigger Generate Audit (`GenerateReportModal.tsx`) untuk memilih server target dan memicu generate on-demand.
- [ ] **Task 5.3**: Buat Modal Detail Ringkasan Audit (`ReportDetailModal.tsx`) untuk meninjau RCA dan rekomendasi langsung di browser.
- [ ] **Task 5.4**: Tambahkan navigasi dan shortcut link ke halaman Laporan dari sidebar dan halaman `/dashboard/servers`.
- [ ] **Task 5.5**: Tulis component test untuk halaman reports pada `frontend/src/app/dashboard/infrastructure/reports/page.test.tsx`.
  * **Verifikasi:** `cd frontend && npx vitest run src/app/dashboard/infrastructure/reports/page.test.tsx`

### Phase 6: End-to-End Verification & Documentation Checkpoint
- [ ] **Task 6.1**: Jalankan uji coba generate laporan end-to-end melalui CLI / API dev: verifikasi file PDF terbit di storage, tata letak visual A4 teratur tanpa potongan aneh, dan metadata tercatat di database.
- [ ] **Task 6.2**: Jalankan full suite verification:
  * Backend: `cd backend && npm run typecheck && npm test`
  * Frontend: `cd frontend && npm run typecheck && npm run lint`
- [ ] **Task 6.3**: Perbarui roadmap dan checkpoint di `docs/todo/README.md` dan `docs/todo/20-server-weekly-report-audit.md`.
