# Implementation Plan: Penyelarasan Format Laporan Audit Mingguan Server (8-Section Standard)

Dokumen ini memetakan langkah-langkah implementasi terarah untuk menyelaraskan sistem laporan audit server dengan format baku 8-bagian dari `docs/laporan-audit-server.md`.

---

## Shared Interfaces & Data Structures

```typescript
// Shared Types untuk 8 Bagian Laporan Audit

export interface ServiceAvailabilityItem {
  hostOrNode: string;
  roleOrService: string;
  uptimePercent: number;
  downtimeMinutes: number;
  status: 'Sehat' | 'Peringatan' | 'Kritis';
}

export interface ResourceMetricItem {
  metricName: string;
  avgValue: string;
  peakValue: string;
  threshold: string;
  status: 'Normal' | 'Aman' | 'Peringatan' | 'Kritis';
}

export interface DatabaseMiddlewareHealth {
  postgres: {
    sizeGb: number;
    growthGb: number;
    activePoolConnections: number;
    maxConnections: number;
    cacheHitRatioPct: number;
    deadlockCount: number;
    slowQueryCount: number;
  };
  redis: {
    memoryUsedMb: number;
    maxMemoryMb: number;
    hitRatioPct: number;
    evictionCount: number;
  };
}

export interface SecurityAuditSection {
  auth: {
    successfulSshLogins: number;
    failedSshAttempts: number;
    sudoExecutions: number;
    userAccountChanges: number;
  };
  patch: {
    osName: string;
    kernelVersion: string;
    pendingPackagesNormal: number;
    pendingPackagesSecurity: number;
    sslDomain: string;
    sslDaysRemaining: number;
    sslExpiryDate: string;
    autoRenewalStatus: string;
  };
}

export interface BackupDrItem {
  backupType: string;
  frequency: string;
  retention: string;
  avgSize: string;
  storageLocation: string;
  lastRestoreTest: string;
  status: 'Sukses' | 'Terlacak' | 'Gagal';
}

export interface IncidentRecord {
  code: string; // INC-YYYYMMDD-XX
  timestamp: string;
  description: string;
  impact: string;
  resolution: string;
  prevention: string;
}

export interface ActionItemRecord {
  no: number;
  action: string;
  pic: 'Sysadmin' | 'Backend Lead' | 'DevOps' | 'DBA' | 'IT Support';
  targetDate: string;
  priority: 'Tinggi' | 'Sedang' | 'Rutin';
}
```

---

## Phase-by-Phase Tasks

### Phase 1: Pengayaan Telemetri Agent (`gajianich-server-agent`)
- [x] **Task 1.1**: Tambahkan fungsi parser autentikasi host di `src/index.ts`:
  - Hitung login SSH sukses (`Accepted ... for ...`) dari `/var/log/auth.log` atau `journalctl -u ssh`.
  - Hitung percobaan SSH gagal (`Failed ... for ...`).
  - Hitung eksekusi perintah sudo (`COMMAND=...`).
  - Hitung modifikasi akun user (`useradd`, `userdel`).
- [x] **Task 1.2**: Tambahkan fungsi inspeksi database & middleware di `src/index.ts`:
  - Deteksi koneksi PostgreSQL aktif dan cache hit ratio via query lokal sederhana atau status kontainer `postgres`.
  - Deteksi Redis memory & hit ratio via `redis-cli info` atau status kontainer `redis`.
- [x] **Task 1.3**: Tambahkan pengecekan pembaruan sistem (`apt-check` / package pending) dan sertifikat SSL.
- [x] **Task 1.4**: Sertakan payload baru di telemetri agent dan verifikasi build `npm run build`.

### Phase 2: Skema Database & Migrasi Backend (`ams-app/backend`)
- [x] **Task 2.1**: Tambahkan kolom baru pada Drizzle schema `serverWeeklyReports` di `backend/src/db/schema/infrastructure.ts`:
  - `scope_type`, `sla_percent`, `service_availability`, `resource_metrics`, `database_middleware`, `security_audit`, `backup_dr`, `incidents_maintenance`, `action_items`.
- [x] **Task 2.2**: Buat berkas migrasi SQL `backend/drizzle/0060_server_weekly_reports_8sections.sql` dan daftarkan di journal.
- [x] **Task 2.3**: Perbarui controller backend `infrastructureController.ts` agar endpoint `getWeeklyReports` mengembalikan seluruh field 8-bagian dan mendukung filter `scope_type`.
- [x] **Task 2.4**: Terapkan migrasi database `npm run db:migrate` dan jalankan unit test skema & routes.

### Phase 3: Peningkatan Modul Reporter (`gajianich-server-reporter`)
- [x] **Task 3.1**: Perbarui `dataAggregator.ts` untuk mengagregasikan 8 bagian:
  - Ekstraksi SLA persentase dan daftar ketersediaan layanan.
  - Perhitungan pertumbuhan disk dan proyeksi runway kapasitas storage.
  - Pengambilan data PostgreSQL, Redis, SSH logs, backup DR, dan insiden OOM/restarts.
  - Dukungan mode `cluster` untuk menggabungkan seluruh server online.
- [x] **Task 3.2**: Perbarui `ai/geminiAnalyst.ts` dan `ai/ruleBasedFallback.ts`:
  - Enforce prompt anti-slop: larangan buzzword AI (*revolusioner, seamless, elevate, game-changer*), fakta angka riil, format insiden `INC-YYYYMMDD-XX`, dan Action Items ber-PIC operasional nyata (Sysadmin, Backend Lead, DevOps, DBA).
- [x] **Task 3.3**: Perbarui `generator/template.ts` mengadopsi layout & redaksi Sophos Enterprise (`docs/Security_Audit_Report.pdf`):
  - Cover page formal: Logo GAJIANICH, Judul Laporan Audit, Blok Metadata Node/Cluster, Periode, dan Server Timestamp.
  - Running header (Logo & Section Title) dan running footer (`Server Time : [Timestamp]`) di setiap halaman.
  - Paragraf narasi pengantar kontekstual di awal setiap bagian untuk menjelaskan fungsi pengawasan tersebut bagi bisnis & stabilitas sistem.
  - Tabel data bersih dengan horizontal visual bars (untuk persentase dan volume byte), selang-seling baris subtil, baris fallback `"Tidak Ada Insiden Tercatat"` (*No Record Found*), dan page-break CSS rapi.
- [x] **Task 3.4**: Uji coba unit test `npm test` dan eksekusi generate PDF untuk server node dan cluster.

### Phase 4: Antarmuka Web Dashboard GAJIANICH (`ams-app/frontend`)
- [x] **Task 4.1**: Perbarui `ReportDetailModal.tsx` dengan tab navigasi interaktif:
  - Tab 1: Ringkasan Eksekutif & SLA Layanan (Bagian 1 & 2)
  - Tab 2: Utilisasi Resource & Kapasitas (Bagian 3)
  - Tab 3: Kesehatan Database & Middleware (Bagian 4)
  - Tab 4: Audit Keamanan & Kepatuhan Akses (Bagian 5)
  - Tab 5: Backup DR & Catatan Insiden (Bagian 6 & 7)
  - Tab 6: Rekomendasi Tindakan ber-PIC (Bagian 8)
- [x] **Task 4.2**: Audit Microcopy UI (`/ux-copy`):
  - Seluruh tombol menggunakan pola `[Kata Kerja] + [Objek]` (`"Unduh PDF"`, `"Audit Sekarang"`, `"Tutup"`).
  - Pesan error dan toast tidak menyalahkan pengguna dan bebas bahasa robotik AI.
- [x] **Task 4.3**: Perbarui `GenerateReportModal.tsx` dengan opsi pemilihan cakupan: Node Server atau Cluster Fleet.
- [x] **Task 4.4**: Perbarui `page.tsx` pada `/dashboard/infrastructure/reports` untuk menampilkan badge lingkup (Node / Cluster) dan integrasikan download PDF.
- [x] **Task 4.5**: Jalankan verifikasi linting, typecheck (`tsc --noEmit`), dan unit test frontend.

---

## Verification Commands

1. **Agent Build**:
   ```bash
   cd /home/fastpec/code/gajianich-server-agent && npm run build
   ```
2. **Backend Database Migration & Tests**:
   ```bash
   cd /home/fastpec/code/ams-app/backend && npm run db:migrate && npx tsx --test src/routes/infrastructureReportsRoutes.test.ts
   ```
3. **Reporter Unit Tests & Generation**:
   ```bash
   cd /home/fastpec/code/gajianich-server-reporter && npm test && npm run generate -- --server=161637
   ```
4. **Frontend Verification**:
   ```bash
   cd /home/fastpec/code/ams-app/frontend && npx tsc --noEmit && npx eslint src/app/dashboard/infrastructure/reports/
   ```
