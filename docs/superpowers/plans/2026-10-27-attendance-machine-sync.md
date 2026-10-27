# Rencana Implementasi: Download Presensi Mesin & Kalkulasi Transaksi (Solution Pattern)

- **Tanggal**: 2026-10-27
- **Dokumen Acuan**: [`docs/superpowers/specs/2026-10-27-attendance-machine-sync-design.md`](docs/superpowers/specs/2026-10-27-attendance-machine-sync-design.md)
- **Status**: Siap Eksekusi (Frontend-First)

---

## 1. Phase 1: Frontend UI Refactor — Solution Pattern (Sedang Berjalan)

- [x] Tambahkan submenu navigasi "Download Presensi" di `DashboardLayout.tsx`.
- [x] Ubah antarmuka kartu mesin menjadi **Tabel Ringkas (*Compact Data Table*)** dengan Radio Button (1 mesin per baris, single selection).
- [x] Implementasikan **Toolbar Operasi Aksi Cepat**:
  - `[▶ Koneksikan]` (Play)
  - `[⏹ Putuskan]` (Stop)
  - `[📥 Download Data Presensi]` (Membuka modal download)
  - `[+ Tambah Mesin]` & `[🗑 Hapus Mesin]` (terproteksi hak akses Superadmin / IT Admin)
- [x] Buat **Modal "Download Data Presensi"** interaktif:
  - Input Tanggal Mulai & Tanggal Selesai (tombol shortcut Hari Ini, 7 Hari Terakhir, Bulan Ini).
  - Progress bar dinamis yang menampilkan persentase dan jumlah baris data log yang ditarik: `Mengunduh log transaksi: 95 / 142 baris data...`.
- [x] Implementasikan **Dual-View Tabs** hasil di bawah tabel mesin:
  - **Tab 1: `Laporan Presensi`** (Data Final hasil kalkulasi: Jam Masuk Tap 1, Jam Pulang Tap Akhir, Shift, Terlambat, Hadir).
  - **Tab 2: `Data Presensi`** (Log Mentah fisik mesin yang dicache di browser `localStorage`, memuat setiap detik tap, jam siang, dll).
  - **Tab 3: `⚠️ Tidak Ada Shift`** (Mendeteksi karyawan yang punya log di mesin tapi belum ada shift, mencegah data hilang saat laporan).
- [x] Implementasikan logika pembersih data **First-In, Last-Out** (FIFO Guard) dan simulasi kalkulasi shift.

---

## 2. Phase 2: Database Schema & Migration

- [ ] Skema tabel `attendance_devices` dan `attendance_device_sync_logs` di Drizzle ORM.
- [ ] Skema penyimpanan log mentah batch `attendance_device_raw_logs` untuk audit.
- [ ] Migrasi database dan seed perangkat mesin lokal.

---

## 3. Phase 3: Backend ZK Socket Service & Session Manager

- [ ] Parser ZK `CMD_ATTLOG_RRQ` streaming binary.
- [ ] `AttendanceDeviceSessionManager` singleton dengan idle timer 15 menit.
- [ ] Endpoint `/api/attendance/devices`, `/connect`, `/disconnect`, `/sync`.

---

## 4. Phase 4: Backend Shift Calculation Engine

- [ ] Integrasi `resolveActiveEmployeeShift` dan `getWorkingScheduleForDate`.
- [ ] Kalkulasi keterlambatan dan upsert ke `attendance_records`.
- [ ] Pemisahan data tanpa shift ke response khusus audit.

---

## 5. Phase 5: Verification Loop & Final Checkpoint

- [ ] Frontend build test (`npm run build`).
- [ ] Backend automated tests (`npm test`).
- [ ] Perbarui checkpoint di `docs/todo/README.md`.
