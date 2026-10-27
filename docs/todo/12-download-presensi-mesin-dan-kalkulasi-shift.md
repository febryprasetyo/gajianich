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

### Fase 1: Frontend UI Architecture — Pemisahan Tiga Halaman Mandiri
- [x] Daftarkan 3 submenu mandiri di `DashboardLayout.tsx`:
  - **Download Presensi** (`/dashboard/attendance/devices`)
  - **Data Presensi** (`/dashboard/attendance/raw-logs`)
  - **Laporan Presensi** (`/dashboard/attendance/transactions`)
- [x] **Halaman 1: Download Presensi Mesin** (`/dashboard/attendance/devices`):
  - Khusus mesin absensi: tabel ringkas (radio button), status koneksi (idle 15m), modal Tambah Mesin, modal Download Data Presensi.
  - Tampilan bersih, lega, bebas dari penumpukan tabel log/laporan di bawahnya.
- [x] **Halaman 2: Data Presensi (Log Mentah Mesin)** (`/dashboard/attendance/raw-logs`):
  - Khusus log mentah fisik mesin per detik (waktu riil, NIK/PIN, nama, lokasi mesin, metode verifikasi, tag Masuk/Pulang/Antara).
  - Filter tanggal, filter mesin, search karyawan, dan tombol `[🧮 Kalkulasi ke Laporan Presensi]`.
- [x] **Halaman 3: Laporan Presensi (Data Final Terkalkulasi)** (`/dashboard/attendance/transactions`):
  - Khusus data presensi final hasil kalkulasi shift (*First-In, Last-Out*, jam kerja, keterlambatan).
  - Tab khusus **"⚠️ Karyawan Tanpa Shift"** dengan tombol langsung **"Tetapkan Shift Default"** dan **"Kalkulasi Ulang"**.
- [x] Integrasi sinkronisasi data antar halaman via browser cache (`ams_attendance_raw_logs` & `ams_attendance_processed_records`).


### Revisi UI & Copywriting (Standard Humanizer & Refined UX):
- [x] **Download Presensi**:
  - [x] Fitur Simulasi Gagal Hubung Mesin: Checkbox toggle pengujian di toolbar, pilihan 3 skenario kegagalan (`ETIMEDOUT`, `AUTH_FAILED`, `ECONNREFUSED`), status visual `Gagal Terhubung` (Rose/Merah) di tabel, alert banner diagnostik, dan Modal Detail Diagnostik lengkap dengan langkah troubleshooting & tombol perbaikan parameter.
  - Hapus embel-embel "(Mesin Absensi) Pattern Solution Desktop".
  - Humanisasi subtitle: *"Hubungkan mesin absensi kantor untuk menarik catatan kehadiran terbaru."*
  - Mengubah bar tombol dari latar hitam pekat (`bg-slate-900`) ke latar putih dengan border halus (`bg-white border border-slate-200/90`).
  - Penambahan fitur & modal **Edit Mesin** (nama, IP, port, comm key, keterangan).
- [x] **Data Presensi**:
  - Hapus badge "(Log Mentah Mesin) Total Rekaman Mentah".
  - Humanisasi subtitle: *"Daftar seluruh riwayat tap masuk dan pulang yang ditarik langsung dari mesin."*
  - Pemisahan visual: Baris 1 (Pencarian Cepat), Baris 2 (Filter Rentang Tanggal, Mesin, Status, dan Tombol Reset).
  - Date picker langsung terbuka saat klik area kotak tanggal (`showPicker()`).
  - Tombol **Reset Filter** dengan icon `RotateCcw` tampil menonjol dan jelas.
  - Penambahan pagination lengkap (pilihan 10/25/50 baris, counter, prev/next).
- [x] **Laporan Presensi**:
  - Hapus badge "(Data Final Terkalkulasi) Data Terkalkulasi".
  - Tagline subtitle lebih umum: *"Rekap kehadiran harian karyawan yang sudah disesuaikan dengan jadwal shift."*
  - Pemisahan baris pencarian dan filter data.
  - Date picker filter range langsung aktif pada klik kotak (`showPicker()`).
  - Tombol **Reset Filter** tampil menonjol dan jelas.
  - Penambahan pagination lengkap (10/25/50 baris, counter, prev/next).
  - Kolom **Jml Tap** dihapus dari tabel laporan.
  - Kolom **Shift** hanya menampilkan kode shift (misal `PAGI`, `SIANG`) tanpa jam kerja.

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
