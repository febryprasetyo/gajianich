# Roadmap & Todo Pengembangan Fitur GAJIANICH

Dokumen ini adalah **indeks utama roadmap**. Setiap item prioritas dipecah ke berkas terpisah untuk efisiensi konteks dan token. Rincian arsitektur teknis merujuk langsung ke dokumen [Design Spec](../superpowers/specs/) dan [Implementation Plan](../superpowers/plans/).

---

## Ringkasan Prioritas & Status

| No | Inisiatif / Fitur | Status | File Detail | Spec / Plan |
|---|---|---|---|---|
| **01** | Asset Management Dashboard & Role Landing | **Selesai** | [01-asset-management-dashboard.md](./01-asset-management-dashboard.md) | [Spec](../superpowers/specs/2026-10-08-asset-dashboard-role-landing-design.md) \| [Plan](../superpowers/plans/2026-10-08-asset-dashboard-role-landing.md) |
| **02** | HR Reconciliation Manual Employee Filter | **Selesai** | [02-hr-reconciliation-filter.md](./02-hr-reconciliation-filter.md) | [Spec](../superpowers/specs/2026-10-08-hr-reconciliation-manual-user-filter-design.md) \| [Plan](../superpowers/plans/2026-10-08-hr-reconciliation-manual-user-filter.md) |
| **03** | Perhitungan, Form Cuti F4, Master Saldo & Edit Cuti | **Selesai** | [03-pengajuan-cuti-tahunan.md](./03-pengajuan-cuti-tahunan.md) | [Spec](../superpowers/specs/2026-10-19-edit-leave-request-design.md) \| [Plan](../superpowers/plans/2026-10-19-edit-leave-request.md) |
| **04** | Attendance Engine Hardening, DB Sync & Strict Toggle | **Selesai** | [04-attendance-engine-hardening.md](./04-attendance-engine-hardening.md) | [Spec](../superpowers/specs/2026-10-09-attendance-db-persistence-design.md) \| [Plan](../superpowers/plans/2026-10-09-attendance-db-persistence.md) |
| **05** | Perombakan Aktivitas Absensi untuk Audit HR | **Selesai** | [05-audit-aktivitas-hr.md](./05-audit-aktivitas-hr.md) | [Spec](../superpowers/specs/2026-10-12-hr-activity-audit-design.md) \| [Plan](../superpowers/plans/2026-10-12-hr-activity-audit.md) |
| **06** | Sistem Tiket Helpdesk IT | **Selesai** | [06-helpdesk-tiket-it.md](./06-helpdesk-tiket-it.md) | [Spec](../superpowers/specs/2026-10-12-helpdesk-ticket-design.md) \| [Plan](../superpowers/plans/2026-10-12-helpdesk-ticket.md) |
| **07** | Presensi Mobile PWA Karyawan & Backend Integrasi | **Selesai** | [07-presensi-mobile-pwa.md](./07-presensi-mobile-pwa.md) | [Spec](../superpowers/specs/2026-10-22-mobile-attendance-backend-design.md) \| [Plan](../superpowers/plans/2026-10-22-mobile-attendance-backend.md) |
| **08** | Arsitektur Modular Package-by-Feature (Screaming Architecture) & Drizzle | **Rencana** | [08-arsitektur-modular-package-by-feature.md](./08-arsitektur-modular-package-by-feature.md) | [Spec](../superpowers/specs/2026-10-23-modular-architecture-migration-design.md) \| [Plan](../superpowers/plans/2026-10-23-modular-architecture-migration.md) |
| **09** | Perbaikan Hasil Audit Presensi Mobile | **Selesai** | [Checklist](#perbaikan-hasil-audit-presensi-mobile) | [Spec](../superpowers/specs/2026-10-23-mobile-attendance-audit-fixes-design.md) \| [Plan](../superpowers/plans/2026-10-23-mobile-attendance-audit-fixes.md) |
| **10** | Smart Clock Selection (Pilihan Masuk vs Pulang) | **Selesai** | [10-smart-clock-selection.md](./10-smart-clock-selection.md) | [Spec](../superpowers/specs/2026-10-23-smart-clock-selection-design.md) \| [Plan](../superpowers/plans/2026-10-23-smart-clock-selection.md) |
| **11** | Notifikasi HRD & Pemisahan Halaman Approval (Absensi, Foto & Pengaturan) | **Selesai** | [11-notifikasi-hrd-dan-pemisahan-halaman-approval.md](./11-notifikasi-hrd-dan-pemisahan-halaman-approval.md) | [Spec](../superpowers/specs/2026-10-26-hrd-approval-notifications-and-page-split-design.md) \| [Plan](../superpowers/plans/2026-10-26-hrd-approval-notifications-and-page-split.md) |
| **12** | Download Presensi Mesin Absensi & Kalkulasi Shift (Solution Pattern) | **Dalam Proses** | [12-download-presensi-mesin-dan-kalkulasi-shift.md](./12-download-presensi-mesin-dan-kalkulasi-shift.md) | [Spec](../superpowers/specs/2026-10-27-attendance-machine-sync-design.md) \| [Plan](../superpowers/plans/2026-10-27-attendance-machine-sync.md) |
| **13** | Master Desain Standar Global (Desktop & Future Pages) | **Selesai** | [13-master-desain-standar-global.md](./13-master-desain-standar-global.md) | [Spec](../superpowers/specs/2026-10-27-master-design-standard-design.md) \| [Plan](../superpowers/plans/2026-10-27-master-design-standard.md) |
| **14** | Rebranding Total: Penggantian Kata ams & ams-app ke gajianich | **Selesai** | [14-rebrand-ams-ke-gajianich.md](./14-rebrand-ams-ke-gajianich.md) | [Spec](../superpowers/specs/2026-10-28-replace-ams-with-gajianich-design.md) \| [Plan](../superpowers/plans/2026-10-28-replace-ams-with-gajianich.md) |
| **15** | Pemisahan CMC/MGM, Cakupan Akses & Identitas Dokumen | **Implementasi terverifikasi; menunggu aktivasi** | [15-cmc-mgm-organization-scope.md](./15-cmc-mgm-organization-scope.md) | [Spec](../superpowers/specs/2026-10-29-cmc-mgm-organization-scope-design.md) \| [Plan](../superpowers/plans/2026-10-29-cmc-mgm-organization-scope.md) |

---

## Checkpoint Verifikasi Suite Pengujian — 28 Oktober 2026

- **Frontend**: Perbaikan default import `xlsx` pada parser absensi (`frontend/src/lib/attendance/biff.ts`) dan penambahan regresi parsing tanggal serial berbentuk teks. Verifikasi: 206/206 tes lulus, typecheck lulus, ESLint lulus.
- **Backend**:
  - Penambahan toleransi nama database `gajianich_hr_audit_test` dan `ams_hr_audit_test` pada `hrAuditDatabase.ts`.
  - Penanganan error listener pada connection pool di `backend/src/db/index.ts` untuk mencegah unhandled error saat disposable test database dihapus.
  - Penyelarasan pengujian multi-clocking pada `mobileClock.integration.test.ts` untuk memvalidasi alur approval pending (saat `autoApproveOut: false`) dan auto-approve (saat `autoApproveOut: true`).
  - Verifikasi: 382/382 tes lulus (100% lulus, 0 fail).

## Petunjuk Penggunaan (Token-Efficient Workflow)

1. **Melihat status global**: Cukup buka file indeks ini ([README.md](./README.md)).
2. **Mengerjakan fitur tertentu**: Buka HANYA file detail fitur tersebut (misal [08-arsitektur-modular-package-by-feature.md](./08-arsitektur-modular-package-by-feature.md)) untuk menghemat token dan fokus pada checklist & checkpoint yang sedang aktif.
3. **Aturan Checkpoint Git**:
   - Beri tanda `[x]` pada checkpoint hanya setelah commit Git terverifikasi secara lokal.
   - Status berubah menjadi **Selesai** bila semua kriteria selesai telah diuji.

---

## Perbaikan Hasil Audit Presensi Mobile

Tindak lanjut audit presensi mobile tanggal 23 Oktober 2026 berstatus **selesai dan terverifikasi**. Seluruh item perbaikan telah diimplementasikan dan diuji melalui verifikasi menyeluruh (backend unit/integration tests 309 pass, frontend unit tests 192 pass, frontend lint, typecheck tsc --noEmit, build nextjs, dan Playwright E2E browser tests).

- [Spesifikasi dan kriteria penerimaan](../superpowers/specs/2026-10-23-mobile-attendance-audit-fixes-design.md).
- [Rencana implementasi dan pengujian](../superpowers/plans/2026-10-23-mobile-attendance-audit-fixes.md).
- [Laporan verifikasi awal](../mobile-attendance-approval-verification.md), sebagai catatan historis.

### TODO

- [x] **FIX-01 / P1:** Cegah mobile IN dan proyeksi approval menimpa record mesin, impor atau manual; lindungi konflik yang muncul sebelum HRD menyetujui. Plan Task 1.
- [x] **FIX-02 / P2:** Samakan resolusi shift aktif untuk jadwal dan approval; individual nonaktif harus dapat mengikuti divisi aktif, tanpa penugasan tetap review HRD. Plan Task 2.
- [x] **FIX-03 / P2:** Pulihkan durasi riwayat mesin, termasuk shift malam; durasi mobile pending/ditolak tetap tidak dihitung. Plan Task 3.
- [x] **FIX-04 / P2:** Tampilkan error/retry terpisah untuk summary dan riwayat; cegah data periode lama tampil pada pilihan baru dan respons usang menimpa daftar. Plan Task 5.
- [x] **FIX-05 / P2:** Benarkan status beranda: tanpa pengajuan bukan Disetujui, COMPLETED bukan Belum Absen, CHECKED_IN bukan otomatis tepat waktu. Plan Task 4.
- [x] **FIX-06 / P2:** Gunakan ModalShell pada detail/koreksi; uji fokus, Escape, Tab, pencegahan penutupan saat mengirim dan isi keterangan saat gagal. Plan Task 6.
- [x] **FIX-07 / P3:** Selaraskan keterangan antrean dengan seluruh pending dan 500 keputusan terbaru. Koordinasikan pemilik MobileApprovalsPage.tsx. Plan Task 7.
- [x] **VERIFY:** Jalankan tes regresi backend/frontend, TypeScript, lint, build dan browser pada 360/390/768/1280 px; catat hasil serta batas verifikasi. Plan Task 8.

### Aturan Penyelesaian

Centang setiap item hanya setelah perubahan diterapkan, tes relevan lulus dan bukti dicatat. Pengujian integrasi memakai database disposable. Penyusunan dokumentasi ini tidak menjalankan implementasi, migrasi utama, atau deployment.

Baseline audit: 25 tes backend terkait dan 192 tes frontend lulus; tiga regresi backend tetap berhasil direproduksi pada fixture terisolasi. Baseline hijau bukan bukti TODO di atas sudah selesai.

Catatan penyimpanan: direktori `docs` saat ini diabaikan Git melalui aturan `/docs/`. Dokumen ini tersedia lokal di checkout; pengiriman melalui commit/PR perlu menyertakan berkas dokumentasi secara eksplisit tanpa mengubah aturan ignore global.

## Checkpoint Tooling — 27 Oktober 2026

Instalasi lokal REA 6.7.0 untuk Codex selesai; doctor integrasi dan handshake MCP lulus (207 tools). Restart Codex untuk memuat integrasi. Analisis native memerlukan provider tambahan. [Rincian verifikasi](../plan/2026-10-27-rea-installation-checkpoint.md). Belum dibuat commit.

## Checkpoint Presensi FI - FO Guard & Double Scan — 27 Oktober 2026

- Perbaikan database kasus 50181 (Adam Putra Jaya) tanggal 2026-10-26 selesai: `scan_in` dipulihkan ke `10:14`, `scan_out` `17:05`, dan log duplikat `17:06` ditandai `REJECTED`.
- Backend service `mobileAttendanceService.ts` mengimplementasikan resolusi FI - FO (First In - Last Out) dan guard `validateClockAllowed` untuk menolak scan masuk baru jika shift sudah lengkap.
- Frontend mobile (`/m/presensi`, `/m/beranda`, dan `PresensiRingButton`) mengunci tombol menjadi "Selesai" (disabled) ketika kehadiran hari ini sudah lengkap (`isCheckedIn && isCheckedOut`).
- Unit test `mobileAttendanceService.test.ts` lulus 5/5, typecheck backend dan frontend lulus tanpa error.

## Checkpoint Tooling Solution X900 — 27 Oktober 2026

Ghidra 12.1.4 + JDK 21, Frida, TShark/capinfos, MDB Tools dan 7-Zip tersedia; uji dekompilasi, hook fixture, pembacaan PCAP sintetis, serta MCP dari konfigurasi tersimpan lulus. [Checkpoint dan batas verifikasi](../plan/2026-10-27-solution-x900-tooling-checkpoint.md). [Panduan Att.exe Windows 11](../operations/solution-x900-analysis-guide.md) dan [paket Process Monitor portable](../operations/solution-x900-windows-tools.zip) tersedia. Analisis target serta integrasi Gajianich menunggu artefak dari PC pengguna; belum dibuat commit.

### Update Jeda 30 Menit (Cooldown & Last-Out Update) — 27 Oktober 2026
- Ditambahkan aturan jeda 30 menit (`MIN_CHECKOUT_INTERVAL_MINUTES = 30`) setelah scan masuk.
- Jika karyawan scan lagi dalam rentang < 30 menit setelah scan masuk:
  - Tombol di UI menampilkan "Sudah Masuk" dengan info sisa jeda waktu (disabled untuk absen pulang).
  - Backend menolak absen pulang sebelum 30 menit dan memperlakukannya sebagai duplikat masuk yang aman (tidak merusak jam masuk atau mengubah jadi pulang).
- Jika karyawan sudah absen pulang dan scan pulang kembali di sore/malam hari:
  - Tombol di UI beralih ke "Perbarui Pulang" (*Last Out*).
  - Backend mencatat dan mengupdate jam pulang ke scan kepulangan terbaru.
- Seluruh 8 unit test dan typecheck TypeScript lulus hijau.

SDK vendor Solution tersedia di PC pengguna pada drive D:, belum dapat diakses dari host ini. SDK menjadi acuan pertama pemeriksaan integrasi; dukungan X900 dan isi SDK belum diverifikasi. [Lokasi dan tindak lanjut SDK](../plan/2026-10-27-solution-x900-tooling-checkpoint.md#sdk-vendor-yang-tersedia-di-pc-pengguna).

## Pemeriksaan SDK Solution X900 — 27 Oktober 2026

SDK yang diunggah telah diperiksa statis: DLL Windows COM x86/x64 versi 6.3.1.55, source demo dan manual tersedia; API koneksi dan penarikan log ditemukan. [Laporan beserta batas dukungan](../operations/solution-x900-sdk-assessment.md) dan [checkpoint](../plan/2026-10-27-solution-x900-sdk-assessment-checkpoint.md). Catatan sebelumnya bahwa SDK belum dapat diakses kini bersifat historis. Uji koneksi/firmware X900 dan implementasi integrasi belum dilakukan.

Konfigurasi uji SDK X900 dikonfirmasi: `192.168.10.224:4370`, communication key `0`. Att.exe terkoneksi; koneksi SDK belum diuji. [Konfigurasi mesin](../operations/solution-x900-sdk-assessment.md#konfigurasi-mesin-yang-dikonfirmasi-pengguna).

[Panduan uji SDK X900 pada Windows](../operations/solution-x900-sdk-windows-test.md) siap digunakan: koneksi, identitas, log historis, perbandingan dengan Att.exe dan penanganan awal error. Panduan diverifikasi terhadap source demo dan dokumentasi runtime; pelaksanaan di PC pengguna masih menunggu hasil.

Hasil uji X900 dari screenshot pengguna: koneksi, identitas dan tampilan log SDK berhasil; event realtime teramati. Versi aktif dilaporkan 6.3.1.43. [Bukti dan tindak lanjut](../operations/solution-x900-sdk-runtime-results.md): cocokkan record yang sama dengan Att.exe sebelum implementasi integrasi; kelengkapan penarikan dan ketahanan realtime belum diverifikasi.

Arah integrasi X900: pengguna meminta koneksi/download langsung dari Ubuntu melalui Gajianich. Kecocokan log SDK vs Att.exe sudah dikonfirmasi pengguna. [Penelusuran kelayakan Ubuntu](../operations/solution-x900-ubuntu-feasibility.md): koneksi TCP host pengembangan ke mesin berhasil; protokol ZK Linux dan penarikan log belum diuji.

## Konektor diagnostik mesin dari Ubuntu — 27 Oktober 2026

CLI pengujian beberapa mesin selesai untuk cakupan koneksi/identitas. Uji langsung X900 192.168.10.224:4370 key 0 berhasil dari Ubuntu, tanpa Windows. Tes diagnostik 15/15 lulus; suite backend 357/360 lulus dengan 3 kegagalan GA/mobile yang dirinci di [checkpoint](../plan/2026-10-27-ubuntu-attendance-connection-diagnostic-checkpoint.md). [Panduan menjalankan dan menambah mesin](../../backend/scripts/attendance-devices.README.md). Pengambilan log dan integrasi UI belum diimplementasikan; ID karyawan yang sama dengan PIN mesin dicatat sebagai kebutuhan fase berikutnya. Belum dibuat commit.

Konektor Ubuntu kini terverifikasi pada dua mesin fisik: 192.168.10.224 (serial WAE4242900026) dan 192.168.10.4 / MGM (serial WAE4242300038), keduanya X900 dan status ok. Kedua entri aktif pada konfigurasi lokal. [Hasil uji multi-mesin](../plan/2026-10-27-ubuntu-attendance-connection-diagnostic-checkpoint.md#uji-dua-mesin-fisik--27-oktober-2026). Tidak ada penarikan atau perubahan log.

Uji lima mesin selesai dengan hasil campuran: semua TCP 4370 terjangkau; 192.168.10.4 dan .224 berhasil; 192.168.0.80, 192.168.1.199 dan .242 menolak autentikasi 2032 baik dengan key uji awal maupun kandidat pengguna. Challenge 6001 kini ditangani; 17 tes konektor lulus. Penyebab key/protokol pada tiga mesin masih belum dipastikan. [Rincian dan bukti](../plan/2026-10-27-ubuntu-attendance-connection-diagnostic-checkpoint.md#uji-lima-target-dan-challenge-6001--27-oktober-2026).

## Checkpoint Download Presensi Mesin & Kalkulasi Transaksi (Solution Pattern) — 28 Oktober 2026

- **Frontend Tiga Halaman Mandiri**:
  - Halaman 1: Download Presensi Mesin (`/dashboard/attendance/devices`) dengan compact table, radio button, status koneksi idle 15 menit, modal download & simulation toggle.
  - Halaman 2: Data Presensi Mentah (`/dashboard/attendance/raw-logs`) dengan filter tanggal, mesin, search, dan pagination.
  - Halaman 3: Laporan Presensi Final (`/dashboard/attendance/transactions`) dengan kalkulasi FIFO (*First-In, Last-Out*), dan tab khusus **"⚠️ Karyawan Tanpa Shift"** untuk menetapkan shift default langsung.
- **Skema & Migrasi Database Drizzle**:
  - Skema tabel `attendance_devices`, `attendance_device_sync_logs`, dan `attendance_device_raw_logs` di `backend/src/db/schema/attendanceDevices.ts`.
  - Migrasi `0025_married_blazing_skull.sql` diterapkan ke database PostgreSQL dengan sukses.
  - Seed perangkat default lokal (Solution X900 Utama & MGM) terintegrasi di `backend/src/db/seed.ts`.
- **Backend ZK Socket Service & Session Manager**:
  - `zkProtocol.ts`: encoding ZK frame, checksum, decoding/encoding packed timestamp, parser streaming 40-byte attendance log records.
  - `zkSessionManager.ts`: singleton `AttendanceDeviceSessionManager` dengan 15-minute auto-disconnect idle timer dan socket lifecycle.
  - `attendanceDeviceRoutes.ts` & `attendanceDeviceController.ts`: REST API lengkap untuk CRUD mesin, connect, disconnect, download/sync log, dan query raw logs.
- **Backend Shift Calculation Engine**:
  - `attendanceCalculationService.ts`: kalkulasi otomatis aturan First-In Last-Out, penghitungan keterlambatan/pulang cepat, perutean eksplisit karyawan tanpa shift ke `unassignedShiftRecords`, dan upsert ke `attendance_records`.
- **Verifikasi**:
  - Backend automated unit tests 17/17 lulus (`attendanceDevices.test.ts`, `zkProtocol.test.ts`, `zkSessionManager.test.ts`, `attendanceCalculationService.test.ts`, `attendanceDeviceRoutes.test.ts`).
  - Backend `tsc --noEmit` lulus tanpa error (exit code 0).
  - Frontend production build (`npm run build`) dengan Node 24 lulus tanpa error (57/57 static pages).

## Checkpoint Integrasi Data Riil Solution X900 & Koreksi Offset Timestamp — 28 Oktober 2026

- **Koreksi Offset Binary Framing ZK TCP**:
  - Memperbaiki parsing timestamp 40-byte record Solution X900 TFT ke byte 27 (sebelumnya bergeser 1 byte di byte 28) sehingga timestamp tahun 2026 terbaca 100% akurat dan identik hingga ke detik dengan software resmi Solution.
  - Verifikasi mode dipetakan ke byte 26 ( = 15 = Face Scan,  = 1 = Fingerprint).
  - Mengeliminasi seluruh mock data dan membersihkan 4 baris data tiruan Adam Putra Jaya dari database.
- **Penarikan & Sinkronisasi Data Riil Mesin Fisik (192.168.10.4:4370)**:
  - Berhasil menarik 61.127 rekaman log riil dari memori perangkat keras Solution X900 MGM.
  - Memfilter dan mengimpor 137 rekaman data riil presensi tanggal 26–28 Oktober 2026 langsung ke  dan memetakan PIN ke master karyawan GAJIANICH.
- **Engine Kalkulasi Shift & Laporan Presensi**:
  - Endpoint kalkulasi shift  memproses 137 log mentah menjadi 115 transaksi presensi kerja lengkap dengan scan masuk, scan pulang, keterlambatan, dan jam kerja.
  - Menangani mesin offline secara anggun: jika perangkat tidak merespons (seperti 192.168.10.224), status otomatis ditandai  dan pesan kesalahan ditampilkan dengan informatif di modal UI.
- **Verifikasi**:
  - Unit test  (6/6 lulus) termasuk pengujian biner frame X900 TFT.
  - Backend unit test suite (367/369 lulus).
  - Frontend typecheck dan build Next.js lulus tanpa error.

## Checkpoint Integrasi Data Riil Solution X900 & Koreksi Offset Timestamp — 28 Oktober 2026

- Memperbaiki parsing timestamp 40-byte record Solution X900 TFT ke byte 27 (sebelumnya bergeser 1 byte di byte 28).
- Penarikan 61.127 log riil dan impor 137 rekaman 26-28 Oktober 2026 ke attendance_device_raw_logs.
- Perhitungan shift FIFO First-In Last-Out menghasilkan 115 transaksi presensi kerja lengkap.
- Penanganan status mesin offline secara anggun dan elegan.

## Checkpoint Perencanaan CMC/MGM — 29 Oktober 2026

Fondasi backend Task 1-3 telah diimplementasikan dan diuji: preview manifest, schema/mapping/membership additive, serta autentikasi dan resolver scope terkini. Suite backend 393/393 lulus dan typecheck lulus. Migrasi 0026 pada development mempertahankan fingerprint 19 tabel terlindungi, 369 karyawan dan 1.684 record absensi; tanpa reset. Inventaris per induk CMC/MGM dan cuti/approval sama dikonfirmasi pengguna. **Task 4-10 serta isolasi operasional belum selesai**; katalog/mapping/membership belum diprovisikan. [Detail](./15-cmc-mgm-organization-scope.md), [checkpoint](../plan/2026-10-29-cmc-mgm-organization-scope-checkpoint.md), dan [runbook](../plan/2026-10-29-cmc-mgm-rollout-runbook.md). Tidak ada commit atau deploy produksi; checkbox commit tetap kosong.

## Checkpoint Audit UI/UX — 29 Oktober 2026

Audit sampel aset, tiket dan vendor pada 360/390/1440 px selesai; ditemukan sembilan rekomendasi, termasuk pemilih kelompok yang menutup menu mobile dan fokus Shift+Tab yang keluar dari modal. [Laporan, prioritas dan bukti browser](../plan/2026-10-29-ui-ux-design-audit.md). Status: audit selesai, perbaikan belum diimplementasikan. Kode produk tidak berubah; typecheck/lint/unit test tidak dijalankan untuk pekerjaan dokumentasi ini. Belum dibuat commit atau deployment.

## Checkpoint CMC/MGM — integrasi akhir 29 Oktober 2026

Scope HR/GA/inventaris/akun, dokumen berversi dan pemilih kelompok per tab tersedia. Backend 408/408, frontend 217/217, Chromium 2/2, typecheck, lint frontend dan build lulus. Migrasi development 0026–0029 mempertahankan fingerprint 19 tabel: 369 karyawan dan 1.684 absensi utuh. Aktivasi menunggu mapping/membership, bukti historis dan identitas/template resmi. [Checkpoint lengkap](../plan/2026-10-29-cmc-mgm-organization-scope-checkpoint.md), [runbook](../plan/2026-10-29-cmc-mgm-rollout-runbook.md). Tidak ada deploy produksi.

Commit implementasi CMC/MGM terverifikasi: `c17148e` pada branch `feature/cmc-mgm-organization-scope`; checkpoint 1–9 dan 10a ditandai selesai, 10b aktivasi tetap terbuka.
