# Todo 12: Download Presensi Mesin Absensi & Kalkulasi Shift (Solution Pattern)

Dokumen ini merinci rencana teknis integrasi mesin absensi fisik (Solution/ZKTeco) ke dalam sistem AMS, penarikan data transaksi (*Download Data Presensi*), pemisahan antara **Data Presensi (Log Mentah)** dan **Laporan Presensi (Data Final Terkalkulasi)**, penanganan tap ganda (*First-In, Last-Out*), integrasi jadwal shift karyawan, serta pencegahan kehilangan data absensi via tab **⚠️ Tidak Ada Shift**.

- **Design Spec**: [docs/superpowers/specs/2026-10-27-attendance-machine-sync-design.md](../superpowers/specs/2026-10-27-attendance-machine-sync-design.md)
- **Implementation Plan**: [docs/superpowers/plans/2026-10-27-attendance-machine-sync.md](../superpowers/plans/2026-10-27-attendance-machine-sync.md)
- **Status**: **Dalam Proses (Frontend-First)**

---

## 1. Latar Belakang & Kebutuhan

1. **Alur Mesin Absensi**: HRD membutuhkan cara mudah menarik data log dari mesin absensi fisik (Solution X900, MGM, dsb) langsung melalui aplikasi web tanpa harus membuka aplikasi desktop terpisah.
2. **Masalah Data Double / Lewat Siang**: Karyawan sering tap 2x saat masuk atau lewat depan mesin saat istirahat siang sehingga wajah/jari terdeteksi. Sistem harus mengambil scan pertama (*scan in*) dan scan terakhir (*scan out*) sebagai data final.
3. **Data Hilang Saat Kalkulasi Shift**: Sering terjadi data mentah di mesin ada, namun saat dikalkulasi ke laporan absensi datanya hilang karena karyawan belum punya shift atau aturan shift tidak sesuai. Solusinya:
   - Cache log mentah mesin di browser (`localStorage`) & DB audit sebagai **Data Presensi**.
   - Sediakan tab **⚠️ Tidak Ada Shift** agar HRD bisa langsung melihat siapa saja yang absen tapi belum terdaftar di shift dan menetapkan shift langsung dari layar yang sama tanpa edit manual.
4. **Desain Kompak (Solution Pattern)**: Mengganti kartu mesin yang boros ruang dengan tabel data ringkas (radio button 1 mesin per baris) + toolbar aksi cepat (`Koneksikan`, `Putuskan`, `Download Data Presensi`, `Kalkulasi Shift`).
5. **Idle Auto-Disconnect**: Otomatis putuskan socket koneksi ke mesin setelah 15 menit tidak ada aktivitas untuk mencegah port mesin terkunci.

---

## 2. Struktur Terminologi

- **`Data Presensi`**: Log mentah mesin absensi (setiap detik tap, NIK/PIN, waktu asli, lokasi mesin, tipe verifikasi). Tersimpan di browser cache dan DB audit log.
- **`Laporan Presensi`**: Data absensi harian yang sudah dikalkulasikan dengan aturan shift (Jam Masuk tap 1, Jam Pulang tap akhir, Shift kerja, status Terlambat, Hadir).
- **`⚠️ Tidak Ada Shift`**: Log tap karyawan yang belum memiliki penugasan shift aktif, memungkinkan HRD menetapkan shift secara langsung.

---

## 3. Rencana Tahapan Eksekusi (Phased Tasks)

### Fase 1: Frontend UI Refactor — Solution Pattern (Sedang Berjalan)
- [x] Submenu navigasi "Download Presensi" di `DashboardLayout.tsx`.
- [x] Rute halaman `/dashboard/attendance/devices`.
- [ ] Tabel ringkas mesin absensi (*Compact Data Table*) dengan Radio Button (single select).
- [ ] Toolbar aksi operasi: `[▶ Koneksikan]`, `[⏹ Putuskan]`, `[📥 Download Data Presensi]`, `[+ Tambah Mesin]`, `[🗑 Hapus Mesin]` (Role-gated Superadmin/IT Admin).
- [ ] Modal interaktif "Download Data Presensi" dengan pilihan rentang tanggal & animated progress bar (`Mengunduh log transaksi: X / Y baris data`).
- [ ] Dual-view tabs:
  - Tab 1: **Laporan Presensi** (Data Final Terkalkulasi).
  - Tab 2: **Data Presensi** (Log Mentah tersimpan di `localStorage` & audit).
  - Tab 3: **⚠️ Tidak Ada Shift** (Deteksi anomali absensi tanpa jadwal kerja).
- [ ] Pembersih tap ganda *First-In, Last-Out* (FIFO Guard) & simulasi kalkulasi shift.

### Fase 2: Database Schema & Migration
- [ ] Skema Drizzle `attendance_devices` (IP, port, commKey, deviceNumber, status, lastSyncAt).
- [ ] Skema Drizzle `attendance_device_sync_logs` & `attendance_device_raw_logs` untuk audit trail.
- [ ] Database migration & seeder mesin lokal.

### Fase 3: Backend ZK Socket Service & Session Manager
- [ ] Parser ZK `CMD_ATTLOG_RRQ` streaming binary.
- [ ] Singleton `AttendanceDeviceSessionManager` dengan 15-minute idle auto-disconnect.
- [ ] Endpoint `/api/attendance/devices`, `/connect`, `/disconnect`, `/sync`.

### Fase 4: Backend Shift Calculation Engine
- [ ] Integrasi `resolveActiveEmployeeShift` dan `getWorkingScheduleForDate`.
- [ ] Perhitungan otomatis keterlambatan dan upsert ke `attendance_records`.
- [ ] Response metadata untuk karyawan yang belum memiliki shift aktif.

### Fase 5: Verification & Delivery
- [ ] Verifikasi build Next.js (`npm run build`).
- [ ] Verifikasi backend automated tests (`npm test`).
- [ ] Update checkpoint di `docs/todo/README.md`.
