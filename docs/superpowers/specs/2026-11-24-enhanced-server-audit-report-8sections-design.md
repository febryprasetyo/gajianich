# Design Spec: Penyelarasan Format Laporan Audit Mingguan Server (8-Section Standard)

- **Tanggal:** 24 November 2026
- **Status:** Draft (Menunggu Review & Approval)
- **Referensi Acuan:** `docs/laporan-audit-server.md` & `PRD-SERVER-WEEKLY-REPORT-AUDIT.md`
- **Lingkup Repositori:**
  - `gajianich-server-agent/` (Host Log & Middleware Telemetry Collection)
  - `ams-app/backend/` (Database Schema Drizzle 0060 & REST API Endpoints)
  - `gajianich-server-reporter/` (Data Aggregator, Gemini 2.5 Flash / Fallback Analyst, Template Cetak A4)
  - `ams-app/frontend/` (`ReportDetailModal.tsx`, `GenerateReportModal.tsx`, `/dashboard/infrastructure/reports/page.tsx`)

---

## 1. Summary & Problem Statement

Sistem laporan audit server mingguan yang telah dibangun saat ini sudah berhasil mengekstrak data riil dari PostgreSQL dan menghasilkan berkas PDF. Namun, format laporan perlu diselaraskan dengan standar dokumen resmi operasional yang tercantum di `docs/laporan-audit-server.md`. Dokumen acuan tersebut mensyaratkan **8 Bagian Formal Terstruktur**:
1. **Ringkasan Eksekutif (Executive Summary)**
2. **Ketersediaan & SLA Layanan (Service Availability Table)**
3. **Utilisasi Resource & Kapasitas (Resource Metrics & Storage Runway)**
4. **Kesehatan Database & Middleware (PostgreSQL & Redis)**
5. **Laporan Audit Keamanan & Kepatuhan Akses (SSH, Sudo, CVE, & SSL)**
6. **Verifikasi Backup & Disaster Recovery (DR Table & Restore Integrity)**
7. **Catatan Insiden & Pemeliharaan (Incidents Log & Maintenance Checklist)**
8. **Rekomendasi & Tindakan Minggu Depan (Action Items Table dengan PIC, Target Selesai, & Prioritas)**

Selain itu, sistem harus mendukung **Dual Mode** (Audit Per-Node Server dan Audit Konsolidasi Seluruh Cluster) serta penyajian lengkap 8 bagian tersebut di dalam **Web Dashboard Preview (`ReportDetailModal`)** sebelum berkas PDF diunduh.

---

## 2. Goals & Non-Goals

### Goals:
- **Zero Dummy Data**: Seluruh data yang disajikan pada Bagian 1 s/d 6 berasal dari pengukuran telemetri host riil, database query, dan file log sistem.
- **Full Agent Collection**: Memperluas `gajianich-server-agent` untuk mengumpulkan statistik autentikasi SSH (`auth.log`/`journalctl`), eksekusi sudo, metrik PostgreSQL/Redis lokal/kontainer, dan paket pembaruan sistem tanpa membebani host.
- **Dual Mode Scope**: Mendukung pembuatan audit spesifik per-server node (misal `srv-dev-cmc`, `srv-prod-node-01`) maupun audit konsolidasi seluruh armada server (*Cluster Fleet Audit*).
- **8-Section Standard PDF**: Template HTML/CSS Puppeteer menghasilkan layout A4 Portrait *Emerald Enterprise* yang presisi memuat ke-8 bagian sesuai `docs/laporan-audit-server.md`.
- **Full 8-Section Modal Preview**: Memperbarui `ReportDetailModal` di frontend dengan tab navigasi interaktif untuk meninjau seluruh 8 bagian secara detail di browser.

### Non-Goals:
- Agen tidak menginstal binary database lokal jika server tidak menjalankannya (hanya mengecek kontainer / socket yang memang ada di host).
- Tidak memodifikasi server live produksi `/home/cmc/app/svc/gajianich` (seluruh pengujian tetap di server dev).

---

## 3. Data Model & Schema Diffs (Drizzle ORM)

File target: `backend/src/db/schema/infrastructure.ts` & migrasi `0060_server_weekly_reports_8sections.sql`.

### Kolom Tambahan pada Tabel `server_weekly_reports`:
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `scope_type` | `varchar(20)` | `'NODE'` (default) atau `'CLUSTER'` |
| `sla_percent` | `numeric(5, 2)` | Persentase uptime & SLA layanan (misal 99.95) |
| `service_availability` | `jsonb` | Daftar ketersediaan host & services (uptime %, downtime menit, status) |
| `resource_metrics` | `jsonb` | Metrik resource (CPU, RAM, Disk growth, Net I/O) + capacity runway |
| `database_middleware` | `jsonb` | Metrik PostgreSQL (ukuran, pool, cache hit, slow query) & Redis (mem, hit, eviction) |
| `security_audit` | `jsonb` | Audit login SSH, sudo count, CVE / pending packages, SSL days |
| `backup_dr` | `jsonb` | Tabel verifikasi backup, retensi, lokasi offsite, dan hasil uji restore |
| `incidents_maintenance`| `jsonb` | Daftar insiden mingguan (`INC-YYYYMMDD-XX`) & checklist pemeliharaan |
| `action_items` | `jsonb` | Rekomendasi teknis dengan kolom PIC, Target Selesai, dan Prioritas |

---

## 4. Arsitektur Aliran Data (Dual Mode)

```text
[ gajianich-server-agent ] 
       │ (auth.log, sudo, pg/redis health, container status, apt-check)
       ▼
[ GAJIANICH Backend API ] ──► [ ams_dev_db: servers & server_metric_samples ]
                                   │
       ┌───────────────────────────┴───────────────────────────┐
       ▼                                                       ▼
[ Per-Node Aggregation ]                                [ Cluster Aggregation ]
  (Spesifik 1 server node)                                (Seluruh server online)
       │                                                       │
       └───────────────────────────┬───────────────────────────┘
                                   ▼
                   [ gajianich-server-reporter ]
                     ├── Gemini 2.5 Flash / Fallback Rule Engine
                     │   (Sintesis 8 Bagian, RCA Insiden, PIC Action Items)
                     ├── Template Emerald Enterprise A4 (8 Section)
                     └── Puppeteer Headless PDF Generator
                                   │
                                   ▼
             [ PDF Storage & DB server_weekly_reports ]
                                   │
                                   ▼
               [ Web Dashboard 8-Section Modal & Download ]
```

---

## 5. Rincian 8 Bagian Laporan Audit (Mengadopsi Layout & Redaksi Sophos Enterprise)

Mengikuti referensi visual dan redaksional `docs/Security_Audit_Report.pdf`:

### Halaman Sampul (Cover Page):
- **Header**: Logo `GAJIANICH` tebal di sudut kiri atas.
- **Judul Dokumen**: Tipografi tegas `Security & Infrastructure Audit Report` (atau `Laporan Audit Status Server & Keamanan Mingguan`).
- **Subjudul & Periode**: Tanggal periode audit (misal: `17 November – 23 November 2026`).
- **Blok Metadata Appliance / Node**:
  - `Disusun untuk:` / `Prepared for:` `GAJIANICH Production Cluster`
  - `Node Server:` `srv-prod-node-01 (Host Worker)` / `Cluster Fleet`
  - `Alamat Host / IP:` `192.168.10.x / Linux x86_64`
  - `Sistem Operasi:` `Ubuntu 22.04 LTS / Docker Engine 27`
- **Footer**: Timestamp server di sudut kanan bawah (`Server Time : [Timestamp]`).

---

### Format Tiap Bagian (Struktur Narasi Redaksional + Tabel Data):
Setiap bagian diawali **Paragraf Pengantar Kontekstual Teknis** (editorial narrative) yang menjelaskan fungsi pengawasan tersebut bagi stabilitas sistem, diikuti tabel metrik yang dilengkapi *horizontal data bars* dan baris *fallback* yang rapi jika tidak ada insiden.

#### Bagian 1: Ringkasan Eksekutif (Executive Summary & Report Findings)
- Paragraf pembuka ringkas yang menerangkan kondisi umum armada server pada periode audit.
- Poin observasi utama (*Key Observations*):
  - Ketersediaan Layanan & SLA (99.95%)
  - Insiden & waktu pemulihan (auto-recovered)
  - Kapasitas storage host & laju pertumbuhan
  - Audit Keamanan (brute force SSH, Fail2Ban)
  - Status Verifikasi Backup di off-site storage.

#### Bagian 2: Ketersediaan & SLA Layanan (Service Availability)
- Narasi pengantar pemantauan kontainer & port kritis.
- Tabel Ketersediaan: Host/Node, Peran Layanan, Uptime (%), Downtime (menit), dan Status Pill semantik (● SEHAT / ● KRITIS).

#### Bagian 3: Utilisasi Resource & Kapasitas (Resource Metrics & Storage Runway)
- Narasi utilisasi kapasitas komputasi dan memori.
- Tabel Metrik: CPU, RAM, Root Disk (`/`), Network I/O dengan kolom Rata-rata, Puncak (Peak), Ambang Batas, serta horizontal metric bar visual.
- Catatan Runway: Estimasi kapasitas storage aman (misal: aman untuk 18 bulan ke depan).

#### Bagian 4: Kesehatan Database & Middleware (Database & Middleware Health)
- Narasi kesehatan transaksional PostgreSQL & in-memory cache Redis.
- Rincian metrik: Ukuran database, pertumbuhan, pool koneksi, cache hit ratio, slow query, serta hit ratio & memori Redis.

#### Bagian 5: Laporan Audit Keamanan & Kepatuhan Akses (Security Audit)
- Narasi pengawasan autentikasi host dan kepatuhan patch.
- Tabel Akses: Login SSH sukses, percobaan gagal (IP diblokir fail2ban), eksekusi sudo, dan perubahan akun sistem.
- Status CVE, paket pembaruan pending, dan validitas sertifikat SSL (sisa hari & auto-renewal).

#### Bagian 6: Verifikasi Backup & Disaster Recovery (DR)
- Narasi integritas pemulihan bencana.
- Tabel Cadangan: Tipe (Full, WAL/PITR, Uploads, Config), Frekuensi, Retensi, Ukuran, Lokasi Simpan (NAS/S3/Git), dan Status.
- Catatan Hasil Uji Coba Restore: Durasi dan integritas data.

#### Bagian 7: Catatan Insiden & Pemeliharaan (Incidents & Maintenance)
- Narasi penanganan anomali operasional.
- Jika ada insiden: Format `INC-YYYYMMDD-XX` (waktu, deskripsi, dampak, resolusi, pencegahan).
- Jika tidak ada insiden: Tampil baris tabel elegan `"Tidak Ada Insiden Tercatat"` (*No Record Found* ala Sophos).
- Checklist pemeliharaan rutin mingguan yang diselesaikan.

#### Bagian 8: Rekomendasi & Tindakan Minggu Depan (Action Items)
- Narasi langkah mitigasi risiko proaktif.
- Tabel Tindakan: No, Tindakan / Rekomendasi Teknis, PIC (Sysadmin, Backend Lead, DevOps, DBA), Target Selesai, Prioritas (Tinggi, Sedang, Rutin).

---

## 6. Antarmuka Web Dashboard (`ams-app/frontend`)

1. **`ReportDetailModal.tsx`**:
   - Dilengkapi navigasi tab:
     - `Ringkasan & SLA` (Bagian 1 & 2)
     - `Resource & Kapasitas` (Bagian 3)
     - `Database & Keamanan` (Bagian 4 & 5)
     - `Backup & Insiden` (Bagian 6 & 7)
     - `Rekomendasi Tindakan` (Bagian 8)
   - Tombol "Unduh Dokumen PDF Resmi" selalu tersedia di bagian footer modal.
2. **`GenerateReportModal.tsx`**:
   - Ditambahkan opsi pemilihan cakupan:
     - *Audit Node Server* (pilih server spesifik)
     - *Audit Konsolidasi Seluruh Cluster* (gabungan seluruh armada server)

---

## 7. Standar Content Writing & Layout Non-AI Vibe (Anti-Slop & UX-Copy)

Mengikuti panduan master `ux-copy` dan `antislop-copywriting`, seluruh teks, microcopy, dan tata letak dilarang keras berbau "AI Slop":

### A. Aturan Content Writing & Microcopy (No AI Vibe):
1. **Dilarang Kata Klise AI**: Dilarang menggunakan kata seperti *revolusioner, mutakhir, seamless, elevate, empower, unlock, landscape, menyelami, tonggak sejarah, game-changer, solusi komprehensif, canggih*. Gunakan istilah operasional teknis yang presisi (misal: *ketersediaan layanan, pemulihan otomatis, utilisasi CPU, laju pertumbuhan storage*).
2. **Tanpa Inflasi Klaim (Significance Inflation)**: Sajikan fakta angka eksak dengan satuan (`99.95%`, `24%`, `42.8 GB`, `14 percobaan`). Jangan mengarang klaim bombastis tanpa bukti kuantitatif.
3. **Gaya Bahasa Operator IT Ops Manusiawi**: Ringkasan eksekutif, analisis RCA, dan tindakan perbaikan ditulis dengan gaya bahasa insinyur DevOps/SRE senior Indonesia—lugas, tenang, solutif, dan bebas basa-basi chatbot (*"Semoga ini membantu"*, *"Mari kita telusuri"*).
4. **Button & CTA Labels**: Berpola `[Kata Kerja] + [Objek]` maksimal 3 kata: `"Unduh PDF"`, `"Audit Sekarang"`, `"Lihat Rincian"`, `"Tutup"`. Dilarang menggunakan label ambigu seperti `"Submit"`, `"Proses Permintaan Lanjutan Ini"`, atau `"Klik di Sini"`.
5. **Pesan Kesalahan & Status**: Mengedepankan solusi sistem dan tidak menyalahkan pengguna:
   - Baik: *"Berkas PDF belum ditemukan pada storage. Jalankan audit untuk menerbitkan laporan terbaru."*
   - Buruk: *"Error 500: Internal Server Error"* atau *"Operasi berhasil dijalankan secara luar biasa"*.

### B. Aturan Layout & Visual Design (Emerald Enterprise Engineer Aesthetic):
1. **Bebas AI Visual Clichés**: Dilarang menggunakan kartu bergradien ungu/neon yang mengambang, glassmorphism blur berlebihan, border glow, atau ilustrasi 3D generik.
2. **Kerapian Tipografi & Data Densitas**:
   - Font sistem bersih (`-apple-system`, `Inter`, `Roboto`) dipadu dengan angka tabular font monospaced (`font-mono tabular-nums`) untuk metrik persentase, byte, IP, dan durasi.
   - Tabel bergaris tipis bersih (`border-b border-slate-200`) dengan padding seimbang (`px-4 py-3`), selang-seling baris subtil (`bg-slate-50/50`), dan header abu-abu slate berbobot tegas.
3. **Format Cetak PDF A4 Presisi**:
   - Menggunakan margin 15mm standar cetak dokumen formal korporat.
   - Kop surat resmi `GAJIANICH INFRASTRUCTURE AUDIT`, kode pengesahan sistem, hash sha256 unik, dan *page-break-inside: avoid* pada tiap seksi agar tidak terpotong canggung saat diarsipkan.

---

## 8. Rencana Verifikasi

1. **Host Agent**: Build & jalankan pengujian parsing log autentikasi SSH & sudo di `gajianich-server-agent`.
2. **Database Migration**: `npm run db:migrate` berhasil menerapkan migrasi `0060`.
3. **Reporter Unit Tests**: Verifikasi unit test aggregator, Gemini/rule-based analyst, dan template 8-bagian lulus.
4. **End-to-End Real Generation**: Generate PDF fisik untuk node `srv-dev-cmc` dan mode `cluster`, lalu pastikan seluruh 8 bagian terisi data riil.
5. **Frontend UI Verification**: Typecheck (`tsc --noEmit`), linter, dan pengujian tab modal di browser.
