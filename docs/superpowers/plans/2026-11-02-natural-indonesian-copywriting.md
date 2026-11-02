# Implementation Plan: Penyesuaian Copywriting Alami (Modern Startup) - Anti Kaku

- **Tanggal Dokumen:** 2026-11-02
- **Tujuan:** Menghilangkan kata-kata yang terlalu baku/kaku (misal: "Swafoto", "Ikhtisar", "Label Aset", "Penggunaan Kursi") dan menggantinya dengan istilah bahasa Indonesia yang luwes, akrab, dan lazim digunakan di lingkungan startup & kantor modern di Indonesia.

---

## 1. Prinsip Copywriting Natural & Modern
1. **Luwes & Akrab:** Hindari istilah birokrasi pemerintah (seperti *Swafoto*, *Ikhtisar*, *Permohonan*). Gunakan istilah kantor modern (seperti *Foto Wajah*, *Beranda*, *Pengajuan*).
2. **Adopsi Istilah Industri yang Sudah Lazim:** Istilah teknis yang umum di dunia IT/HR tidak dipaksakan diterjemahkan secara kaku (misal: *Asset Tag*, *Seats*, *Software*, *Reset Filter*, *Audit Hardware*).
3. **Ringkas & Tidak Bertele-tele:** Nama menu maksimal 2-3 kata yang langsung *to-the-point*.

---

## 2. Rincian Usulan Perubahan (Tabel Review)

### A. Navigasi Sidebar (Menu & Grup)
| Area / Path | Istilah Kaku Saat Ini | Usulan Alami (Modern Startup) | Catatan |
| :--- | :--- | :--- | :--- |
| **Grup Utama** | Ikhtisar | **Beranda** | "Ikhtisar" terlalu formal |
| `/dashboard` | Dasbor Utama | **Dashboard** | Lebih bersih & standar |
| **Grup HR** | Manajemen SDM (HR) | **HR & Kehadiran** | Lebih ringkas & luwes |
| Sub-grup HR 1 | Kehadiran & Waktu | **Presensi** | Lebih lazim di kantor |
| `/dashboard/attendance/overview` | Dasbor Kehadiran | **Ringkasan Presensi** | Ringkas |
| `/dashboard/attendance` | Rekap Kehadiran | **Data Presensi** | Standar HR harian |
| `/dashboard/attendance/imports` | Impor Data Presensi | **Impor Presensi** | Lebih singkat |
| `/dashboard/attendance/employees` | Lembar Waktu Karyawan | **Kartu Presensi** | "Lembar waktu" terjemahan kaku |
| `/dashboard/attendance/reports` | Laporan Kehadiran | **Laporan Presensi** | Konsisten kata "Presensi" |
| `/dashboard/attendance/activity` | Log Aktivitas HR | **Riwayat Aktivitas HR** | Kata "Riwayat" lebih akrab |
| Sub-grup HR 2 | Integrasi Mesin & IoT | **Mesin Presensi** | "IoT" terlalu teknis untuk HRD |
| `/dashboard/attendance/adms` | Monitor Server ADMS | **Status Server ADMS** | Jelas status koneksi |
| `/dashboard/attendance/devices` | Terminal Mesin Presensi | **Daftar Mesin** | Menghilangkan kata "Terminal" |
| `/dashboard/attendance/raw-logs` | Log Mentah Presensi | **Log Presensi** | Menghindari kata "Mentah" |
| `/dashboard/attendance/transactions` | Log Transaksi Presensi | **Hasil Tarik Presensi** | Menjelaskan hasil sinkronisasi |
| Sub-grup HR 3 | Persetujuan Presensi | **Verifikasi Presensi** | Lebih cocok untuk verifikasi mandiri |
| `/dashboard/attendance/approvals` | Antrean Persetujuan | **Review Presensi** | Jelas fungsinya untuk review |
| `/dashboard/attendance/approvals/photos` | Verifikasi Swafoto Presensi | **Validasi Foto Wajah** | Hapus kata kaku "Swafoto" |
| `/dashboard/attendance/approvals/rules` | Kebijakan Auto-Approval | **Aturan Auto-Approve** | Bahasa startup yang sangat lazim |
| Sub-grup HR 4 | Manajemen Cuti & Izin | **Cuti & Izin** | Ringkas |
| `/dashboard/leaves` | Permohonan Cuti | **Pengajuan Cuti** | "Pengajuan" lebih wajar dari "Permohonan" |
| `/dashboard/leaves/balances` | Saldo & Kuota Cuti | **Saldo Cuti** | Ringkas |
| `/dashboard/leaves/settings` | Kebijakan & Kuota Cuti | **Pengaturan Cuti** | Lebih wajar untuk menu setting |
| Sub-grup HR 5 | Data Master Karyawan | **Master Data HR** | Singkat & jelas |
| `/dashboard/attendance/master/employees` | Direktori Karyawan | **Daftar Karyawan** | Lebih umum di Indonesia |
| `/dashboard/attendance/master/departments` | Struktur Departemen | **Departemen** | Lebih ringkas |
| `/dashboard/attendance/master/shifts` | Jadwal & Pola Shift | **Shift & Jam Kerja** | Sangat familiar |
| `/dashboard/access` (child HR) | Akses Pengguna | **Akun Pengguna** | Akrab |
| `/dashboard/attendance/settings` | Konfigurasi Sistem HR | **Pengaturan Absensi** | Cukup pengaturan |
| **Grup GA** | Umum & Pengadaan (GA) | **General Affairs (GA)** | Singkatan GA sudah sangat dikenal |
| `/dashboard/ga/requests` | Pengajuan Pengadaan | **Permintaan Barang** | Lebih familiar di level operasional |
| **Grup IT** | IT & Aset Perusahaan | **IT & Aset** | Tidak perlu "Perusahaan" |
| Sub-grup IT 1 | Aset Inventaris | **Inventaris Aset** | Urutan wajar bahasa Indonesia |
| `/dashboard/assets/overview` | Dasbor Aset | **Ringkasan Aset** | Lebih natural |
| `/dashboard/assets` | Daftar Aset Perangkat | **Daftar Aset** | Ringkas |
| `/dashboard/hardware-audits` | Audit Fisik Perangkat | **Audit Hardware** | Istilah hardware lazim di IT |
| `/dashboard/licenses` | Lisensi Perangkat Lunak | **Lisensi Software** | "Software" lazim dipakai |
| Sub-grup IT 2 | Layanan & Operasional IT | **Operasional IT** | Ringkas |
| `/dashboard/tickets` | Tiket Bantuan IT | **Helpdesk & Tiket** | Sangat familiar di tim IT |
| `/dashboard/infrastructure` | Infrastruktur & Server | **Server Accurate** | Khusus monitoring server, database Firebird, & lisensi Accurate (Server VPS/Fisik umum akan dibuat menu terpisah ke depannya) |
| Sub-grup IT 3 | Konfigurasi Master IT | **Master Data IT** | Standar industri |
| `/dashboard/master/equipment-types` | Kategori & Jenis Perangkat | **Tipe Perangkat** | Jelas |
| `/dashboard/master/asset-custodians` | Penanggung Jawab Aset | **Pemegang Aset** | Penjelasan familiar |
| `/dashboard/master/asset-custodians/reconciliation` | Rekonsiliasi Data HR | **Sinkron Karyawan HR** | "Sinkron" lebih aktif |
| `/dashboard/master/locations` | Lokasi & Cabang | **Lokasi Kantor** | Jelas |
| `/dashboard/master/vendors` | Rekanan & Vendor | **Daftar Vendor** | Singkat |
| `/dashboard/master/departments` | Departemen (Sinkron IT) | **Departemen IT** | Jelas pemisahnya |
| `/dashboard/master/employees` | Karyawan (Sinkron IT) | **Karyawan IT** | Jelas pemisahnya |
| **Grup Akses** | Pengaturan & Keamanan | **Akses & Pengguna** | Tidak kaku |
| `/dashboard/access` | Akses & Peran Pengguna | **Kelola Pengguna** | Action-oriented |

---

### B. Header Tabel, Filter, dan Tombol di Halaman
| Komponen / Halaman | Istilah Kaku Saat Ini | Usulan Alami (Modern Startup) |
| :--- | :--- | :--- |
| **Semua Filter Toolbar** | Atur Ulang | **Reset Filter** |
| **Tabel Aset** | Label Aset | **Asset Tag** |
| **Tabel Aset** | Perangkat & Spesifikasi | **Nama Perangkat & Spesifikasi** |
| **Tabel Aset** | Penanggung Jawab | **Pemegang Aset** |
| **Tombol Aset** | Impor Massal Excel | **Impor Excel** |
| **Tombol Aset** | Daftarkan Aset Baru | **Tambah Aset Baru** |
| **Tabel Lisensi** | Penggunaan Kursi (Seat) | **Kapasitas Lisensi (Seats)** |
| **Tabel Lisensi** | Masa Berlaku | **Tanggal Kedaluwarsa** |
| **Tabel Lisensi** | Tanpa Kedaluwarsa (Permanen) | **Permanen (No Expiry)** |
| **Tombol Lisensi** | Tambah Lisensi Baru | **Tambah Lisensi** |
| **Persetujuan Foto** | Verifikasi Swafoto Karyawan | **Validasi Foto Wajah** |
| **Persetujuan Foto** | Verifikasi Foto (Tombol) | **Tinjau Foto** |
| **Auto-Approve Shift** | Persetujuan Otomatis Jam Masuk | **Auto-Approve Jam Masuk** |
| **Auto-Approve Shift** | Persetujuan Otomatis Jam Pulang | **Auto-Approve Jam Pulang** |
| **Auto-Approve Shift** | Simpan Kebijakan | **Simpan Aturan** |

---

## 3. Langkah Pelaksanaan
1. Pengguna memeriksa tabel perbandingan di atas dan memberikan approval atau catatan revisi.
2. Update file `DashboardLayout.tsx`, `routes.ts`, dan komponen halaman terkait sesuai baris yang disetujui.
3. Jalankan automated test loop (`npm test` & `npx tsc --noEmit`).
4. Commit perubahan ke git.

