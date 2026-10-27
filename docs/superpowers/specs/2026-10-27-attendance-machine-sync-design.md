# Spesifikasi Desain: Download Presensi Mesin & Kalkulasi Transaksi (Solution Pattern)

- **Tanggal Pembuatan**: 2026-10-27
- **Status**: Disetujui Pengguna (Approved)
- **Tujuan**: Mengintegrasikan penarikan data dari mesin absensi fisik (Solution/ZKTeco) dengan antarmuka ringkas bergaya aplikasi Solution desktop, pemisahan jelas antara **Data Presensi (Log Mentah)** dan **Laporan Presensi (Data Final Terkalkulasi)**, penanganan tap ganda (*First-In, Last-Out*), integrasi shift, serta deteksi otomatis karyawan tanpa shift untuk mencegah data hilang.

---

## 1. Problem Statement & Background

Di lapangan saat menggunakan software Solution desktop dan sistem absensi lama, sering kali terjadi masalah:
1. **Accidental / Duplicate Scans**: Karyawan tap berulang kali di pagi hari atau tertangkap kamera mesin wajah saat lewat di siang hari/istirahat, sehingga log mentah bertumpuk.
2. **Data Hilang Saat Kalkulasi & Laporan**: Di log mentah mesin ada catatannya, tetapi saat dihitung (*kalkulasi*) dan dilihat di laporan akhir, data absensinya hilang/tidak muncul karena belum ada pengaturan shift atau NIK tidak cocok. Akibatnya HRD harus mengedit manual satu per satu.
3. **UI Boros Ruang**: Tampilan kartu (*card*) besar memakan terlalu banyak tempat. HRD lebih nyaman dengan tabel ringkas (*compact data table*) dengan radio button dan toolbar aksi (*Koneksikan*, *Putuskan*, *Download Data Presensi*) seperti pada software Solution.

---

## 2. Penyelarasan Istilah (Terminology)

- **`Data Presensi`**: **Log Mentah (*Raw Logs*)** — Data asli stempel waktu dari mesin per detik (*timestamp*, ID PIN, metode verifikasi), disimpan di cache browser (`localStorage`) dan database audit.
- **`Laporan Presensi`**: **Data Final Terkalkulasi (*Processed Attendance*)** — Hasil kalkulasi shift dengan aturan *First-In, Last-Out*, jam kerja terjadwal, menit keterlambatan, pulang cepat, dan status kehadiran.

---

## 3. Alur Pengguna (User Flow)

1. **Pemilihan Mesin**:
   - HRD memilih 1 mesin via radio button pada tabel ringkas mesin absensi.
2. **Koneksi (Toolbar Aksi)**:
   - HRD klik **"Koneksikan"** (Play). Backend membuka socket ZK TCP, status berubah menjadi *Terhubung* (hijau) dengan indikator idle timeout 15 menit.
3. **Download Data Presensi (Modal)**:
   - HRD klik tombol **"Download Data Presensi"**.
   - Muncul modal elegan untuk memilih rentang tanggal (Mulai s/d Selesai).
   - HRD menekan **"Mulai Download"**.
   - Tampil **Progress Bar interaktif** dengan hitungan data: `Mengunduh log transaksi: 95 / 142 baris data...`.
   - Data mentah langsung disimpan di cache browser dan database.
4. **Kalkulasi Shift (Tombol "Kalkulasi")**:
   - HRD menekan tombol **"Kalkulasi"**:
     - Sistem mengambil log mentah dari *Data Presensi*.
     - Menerapkan aturan *First-In, Last-Out* (tap pertama = `scan_in`, tap terakhir = `scan_out`, tap siang diabaikan).
     - Mencocokkan dengan jadwal shift karyawan (`attendanceShifts`).
     - Mengisi jam kerja, menghitung keterlambatan, dan menyimpan ke `attendance_records`.
5. **Inspeksi Hasil & Tab "Tidak Ada Shift"**:
   - Tab **Laporan Presensi**: Data final yang valid dan siap untuk payroll.
   - Tab **Data Presensi (Mentah)**: Bukti otentik seluruh rekaman tap fisik karyawan dari mesin.
   - Tab **⚠️ Tidak Ada Shift**: Menampilkan data tap yang tertahan karena karyawan belum memiliki shift aktif, lengkap dengan tombol cepat **"Tetapkan Shift"** dan **"Kalkulasi Ulang"**.

---

## 4. Spesifikasi Komponen UI (GAJIANICH / Emerald Enterprise)

1. **Top Toolbar**:
   - `[▶ Koneksikan]` (Emerald) — Aktif saat mesin dipilih & belum terhubung.
   - `[⏹ Putuskan]` (Rose/Slate) — Aktif saat mesin terhubung.
   - `[📥 Download Data Presensi]` (Emerald Primary) — Membuka modal download.
   - `[⚙️ Tambah Mesin]` & `[🗑 Hapus Mesin]` — Hanya muncul untuk role Superadmin / IT Admin.

2. **Compact Machine Table**:
   - Radio button (1 mesin per baris, single selection).
   - Kolom: Pilih, Nama Mesin, Status (Terhubung + timer idle / Terputus), IP & Port, No. Mesin, Tipe Komunikasi, Serial Number, Terakhir Tarik Data.

3. **Modal "Download Data Presensi"**:
   - Header: Nama & IP Mesin.
   - Date range picker + quick shortcuts (Hari Ini, 7 Hari Terakhir, Bulan Ini).
   - Checkbox: "Timpa/perbarui jam scan jika data sudah ada".
   - Progress bar dinamis menampilkan persentase & jumlah data mentah yang ditarik.
   - Rangkuman total log dan tombol pintas ke kalkulasi.

4. **Dual-View Tabs**:
   - **Tab Laporan Presensi (Final)**: Tabel absensi siap saji (NIK, Nama, Tanggal, Shift, Jadwal Masuk/Pulang, Scan Masuk, Scan Pulang, Terlambat, Status).
   - **Tab Data Presensi (Log Mentah)**: Tabel audit log fisik mesin (Departemen, Nama, No. ID, Tgl/Waktu detik asli, Lokasi/Mesin, No. PIN, Tipe Verifikasi).
   - **Tab ⚠️ Tidak Ada Shift**: Khusus karyawan yang ada tap mesin tetapi belum memiliki shift aktif, dengan tombol aksi tetapkan shift.

---

## 5. Aturan Logika & Data Cleaning

1. **First-In, Last-Out (FIFO Guard)**:
   - Karyawan dengan multiple tap pada tanggal `T`:
     - `sortedPunches = [tap_1, tap_2, ..., tap_n]`
     - `scan_in` = `sortedPunches[0]` (tap paling pagi)
     - `scan_out` = `sortedPunches[n - 1]` jika `n > 1`, `null` jika `n == 1`
     - Tap di antara keduanya (`tap_2` s/d `tap_n-1`) otomatis difilter.
2. **Integrasi Shift & Resolusi Otomatis**:
   - Ambil shift karyawan dari `resolveActiveEmployeeShift(employee, shifts, assignments)`.
   - Jika ditemukan: hitung `late_minutes`, `early_minutes`, dan simpan ke `attendance_records`.
   - Jika tidak ditemukan: tandai sebagai kategori **Tidak Ada Shift** agar HRD mendapat peringatan eksplisit.
