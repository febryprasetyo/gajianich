# Rencana Implementasi: Download Presensi Mesin & Kalkulasi Transaksi (Solution Pattern)

- **Tanggal**: 2026-10-27
- **Dokumen Acuan**: [`docs/superpowers/specs/2026-10-27-attendance-machine-sync-design.md`](docs/superpowers/specs/2026-10-27-attendance-machine-sync-design.md)
- **Status**: Selesai (Full-Stack Implemented & Verified)

---

## 1. Phase 1: Frontend UI Architecture — Pemisahan Tiga Halaman Mandiri

- [x] Daftarkan 3 submenu mandiri di `DashboardLayout.tsx`:
  - **Download Presensi** (`/dashboard/attendance/devices`)
  - **Data Presensi** (`/dashboard/attendance/raw-logs`)
  - **Laporan Presensi** (`/dashboard/attendance/transactions`)
- [x] **Halaman 1: Download Presensi Mesin** (`/dashboard/attendance/devices`):
  - Tabel ringkas mesin absensi (*Compact Data Table*) dengan Radio Button (single select).
  - Toolbar aksi operasi: `[▶ Koneksikan]`, `[⏹ Putuskan]`, `[📥 Download Data Presensi]`, `[+ Tambah Mesin]` (Modal), `[🗑 Hapus Mesin]`.
  - Modal "Download Data Presensi" dengan date picker & dynamic progress bar.
  - Kartu ringkasan ringkas dan tautan langsung ke Data Presensi & Laporan Presensi (bebas dari penumpukan tabel besar di bawahnya).
- [x] **Halaman 2: Data Presensi (Log Mentah Mesin)** (`/dashboard/attendance/raw-logs`):
  - Tabel log mentah fisik mesin (waktu presensi riil per detik, NIK/PIN, nama, departemen, mesin, tipe verifikasi, tag Masuk/Pulang/Antara).
  - Filter tanggal, filter mesin, dan pencarian NIK/Nama.
  - Tombol aksi utama `[🧮 Kalkulasi ke Laporan Presensi]` dengan transisi mulus ke halaman Laporan Presensi.
- [x] **Halaman 3: Laporan Presensi (Data Final Terkalkulasi)** (`/dashboard/attendance/transactions`):
  - Tabel hasil kalkulasi shift menggunakan aturan *First-In, Last-Out* (jam masuk tap 1, jam pulang tap akhir, jam kerja, keterlambatan).
  - Tab / Filter khusus **"⚠️ Karyawan Tanpa Shift"** dengan tombol langsung **"Tetapkan Shift Default"** dan **"Kalkulasi Ulang"** agar tidak ada data absensi yang terlewat.
- [x] Verifikasi build Next.js dan penyimpanan browser `localStorage` (`gajianich_attendance_raw_logs` & `gajianich_attendance_processed_records`).

---

## 2. Phase 2: Database Schema & Migration

- [x] Skema tabel `attendance_devices` dan `attendance_device_sync_logs` di Drizzle ORM.
- [x] Skema penyimpanan log mentah batch `attendance_device_raw_logs` untuk audit.
- [x] Migrasi database dan seed perangkat mesin lokal.

---

## 3. Phase 3: Backend ZK Socket Service & Session Manager

- [x] Parser ZK `CMD_ATTLOG_RRQ` streaming binary.
- [x] `AttendanceDeviceSessionManager` singleton dengan idle timer 15 menit.
- [x] Endpoint `/api/attendance/devices`, `/connect`, `/disconnect`, `/sync`.

---

## 4. Phase 4: Backend Shift Calculation Engine

- [x] Integrasi `resolveActiveEmployeeShift` dan `getWorkingScheduleForDate`.
- [x] Kalkulasi keterlambatan dan upsert ke `attendance_records`.
- [x] Pemisahan data tanpa shift ke response khusus audit.

---

## 5. Phase 5: Verification Loop & Final Checkpoint

- [x] Frontend build test (`npm run build`).
- [x] Backend automated tests (`npm test`).
- [x] Perbarui checkpoint di `docs/todo/README.md`.
