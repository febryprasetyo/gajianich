# Design Spec: Standarisasi Menu Navigasi 100% Bahasa Indonesia Profesional (Opsi A)

- **Tanggal Dokumen:** 2026-11-02
- **Status:** APPROVED BY USER - Dalam Pelaksanaan
- **Tipe Perubahan:** UI/UX Copywriting & Standardisasi Navigasi Enterprise

---

## 1. Summary & Problem Statement

### Latar Belakang & Masalah
Navigasi sidebar dan konten halaman di GAJIANICH masih memiliki beberapa kelemahan copywriting:
1. **Pencampuran Bahasa (Spanglish):** Judul grup, item menu, judul halaman, sub-judul, header tabel, tombol, dan filter bercampur aduk antara bahasa Inggris dan bahasa Indonesia.
2. **Inkonsistensi Terminologi:** Istilah `Absensi` dan `Presensi` dipakai bergantian. Standar baku adalah **Presensi / Kehadiran**.
3. **Konten Halaman Masih Menggunakan Bahasa Inggris:** Beberapa halaman (termasuk modul Verifikasi Presensi, Inventaris Aset, Audit Hardware, dan Lisensi Software) masih menggunakan header tabel (`Action`, `Status`, `Category`, `Location`, dll) dan placeholder/filter bahasa Inggris.

### Solusi
Menerapkan **Opsi A (100% Bahasa Indonesia Profesional)** secara menyeluruh:
1. Standarisasi seluruh menu navigasi sidebar & route rules.
2. Standarisasi seluruh konten halaman: Judul (H1), Sub-judul, Kartu KPI, Filter, Placeholder Pencarian, Header Tabel (`<th>`), Pesan Loading/Empty State, Tombol Aksi, dan Modal.


---

## 2. Goals & Non-Goals

### Goals
- Mengubah 100% teks menu, sub-menu, dan header grup pada sidebar menjadi Bahasa Indonesia Profesional skala enterprise.
- Menstandarkan seluruh istilah kehadiran menjadi **Kehadiran** atau **Presensi** (menghapus kata "Absensi").
- Mengeliminasi duplikasi nama induk vs anak pada modul integrasi mesin (mengganti anak `Mesin Presensi` menjadi `Terminal Mesin Presensi`).
- Menyelaraskan teks deskriptif `moduleName` pada `ROUTE_PERMISSION_MAP` dan `DASHBOARD_ROUTE_RULES` agar breadcrumbs, title, dan error 403 konsisten dengan nama menu baru.
- Memperbarui unit test pada `routes.test.mjs` agar assertion mencerminkan label Bahasa Indonesia yang baru.
- Memastikan semua unit test (237+ test) dan typecheck TypeScript (`tsc --noEmit`) lulus 100%.

### Non-Goals
- **TIDAK mengubah path URL / endpoint:** Seluruh URL (`/dashboard/attendance`, `/dashboard/assets`, dll) tetap sama persis agar tidak merusak bookmark, API, atau middleware.
- **TIDAK mengubah kode hak akses / permissions RBAC:** Key permission seperti `attendance.view`, `assets.manage`, `attendance.mobile.verify` tetap sama persis.
- **TIDAK mengubah skema database:** Tidak ada migrasi database atau perubahan kolom.
- **TIDAK mengubah styling master:** Tetap mematuhi aturan baku Emerald Enterprise (`UI_DESIGN_SYSTEM_GUIDE.md`).

---

## 3. Data Model & Schema Diffs
- **Database Schema:** Tidak ada perubahan schema.
- **Types:** Struktur interface `NavGroup`, `NavItem`, `NavSubItem`, dan `RouteRule` tetap sama. Hanya nilai properti string `title`, `name`, dan `moduleName` yang diperbarui.

---

## 4. UI/UX Specification: Daftar Perubahan Menu Lengkap

### 4.1. Grup Utama
| Path URL | Nama Lama | Nama Baru (Bahasa Indonesia Profesional) |
| :--- | :--- | :--- |
| *(Header Grup)* | Utama | **Ikhtisar** |
| `/dashboard/...` | Dashboard | **Dasbor Utama** |

### 4.2. Grup HR (Manajemen SDM)
| Path URL | Nama Lama | Nama Baru (Bahasa Indonesia Profesional) |
| :--- | :--- | :--- |
| *(Header Grup)* | HR | **Manajemen SDM (HR)** |
| *(Sub-group 1)* | Attendance | **Kehadiran & Waktu** |
| `/dashboard/attendance/overview` | Ringkasan HR | **Dasbor Kehadiran** |
| `/dashboard/attendance` | Data Absensi | **Rekap Kehadiran** |
| `/dashboard/attendance/imports` | Impor Absensi | **Impor Data Presensi** |
| `/dashboard/attendance/employees` | Kartu Absensi | **Lembar Waktu Karyawan** |
| `/dashboard/attendance/reports` | Laporan Absensi | **Laporan Kehadiran** |
| `/dashboard/attendance/activity` | Riwayat Aktivitas HR | **Log Aktivitas HR** |
| *(Sub-group 2)* | Mesin Presensi | **Integrasi Mesin & IoT** |
| `/dashboard/attendance/adms` | Review ADMS | **Monitor Server ADMS** |
| `/dashboard/attendance/devices` | Mesin Presensi | **Terminal Mesin Presensi** |
| `/dashboard/attendance/raw-logs` | Data Presensi | **Log Mentah Presensi** |
| `/dashboard/attendance/transactions` | Laporan Presensi | **Log Transaksi Presensi** |
| *(Sub-group 3)* | Verifikasi Presensi | **Persetujuan Presensi** |
| `/dashboard/attendance/approvals` | Review Absensi | **Antrean Persetujuan** |
| `/dashboard/attendance/approvals/photos` | Validasi Foto Wajah | **Verifikasi Swafoto Presensi** |
| `/dashboard/attendance/approvals/rules` | Aturan Auto-Approve | **Kebijakan Auto-Approval** |
| *(Sub-group 4)* | Cuti | **Manajemen Cuti & Izin** |
| `/dashboard/leaves` | Pengajuan Cuti | **Permohonan Cuti** |
| `/dashboard/leaves/balances` | Rekap Saldo Cuti | **Saldo & Kuota Cuti** |
| `/dashboard/leaves/settings` | Pengaturan Cuti | **Kebijakan & Kuota Cuti** |
| *(Sub-group 5)* | Master Data | **Data Master Karyawan** |
| `/dashboard/attendance/master/employees` | Karyawan Absensi | **Direktori Karyawan** |
| `/dashboard/attendance/master/departments` | Departemen Absensi | **Struktur Departemen** |
| `/dashboard/attendance/master/shifts` | Shift & Jam Kerja | **Jadwal & Pola Shift** |
| `/dashboard/access` | Akun Pengguna | **Akses Pengguna** |
| `/dashboard/attendance/settings` | Pengaturan | **Konfigurasi Sistem HR** |

### 4.3. Grup GA (Umum & Pengadaan)
| Path URL | Nama Lama | Nama Baru (Bahasa Indonesia Profesional) |
| :--- | :--- | :--- |
| *(Header Grup)* | GA | **Umum & Pengadaan (GA)** |
| `/dashboard/ga/requests` | Permintaan Barang | **Pengajuan Pengadaan** |

### 4.4. Grup IT & Assets (IT & Aset Perusahaan)
| Path URL | Nama Lama | Nama Baru (Bahasa Indonesia Profesional) |
| :--- | :--- | :--- |
| *(Header Grup)* | IT & Assets | **IT & Aset Perusahaan** |
| *(Sub-group 1)* | Asset Management | **Aset Inventaris** |
| `/dashboard/assets/overview` | Ringkasan Aset | **Dasbor Aset** |
| `/dashboard/assets` | Inventaris Aset | **Daftar Aset Perangkat** |
| `/dashboard/hardware-audits` | Hardware Audits | **Audit Fisik Perangkat** |
| `/dashboard/licenses` | Software Licenses | **Lisensi Perangkat Lunak** |
| *(Sub-group 2)* | Operations | **Layanan & Operasional IT** |
| `/dashboard/tickets` | Service Desk | **Tiket Bantuan IT (Helpdesk)** |
| `/dashboard/infrastructure` | Accurate & Servers | **Infrastruktur & Server** |
| *(Sub-group 3)* | Master Data IT | **Konfigurasi Master IT** |
| `/dashboard/master/equipment-types` | IT Equipment Types | **Kategori & Jenis Perangkat** |
| `/dashboard/master/asset-custodians` | Asset Custodians | **Penanggung Jawab Aset** |
| `/dashboard/master/asset-custodians/reconciliation` | HR Reconciliation | **Rekonsiliasi Data HR** |
| `/dashboard/master/locations` | Locations | **Lokasi & Cabang** |
| `/dashboard/master/vendors` | Vendors | **Rekanan & Vendor** |
| `/dashboard/master/departments` | Departments | **Departemen (Sinkron IT)** |
| `/dashboard/master/employees` | Employees | **Karyawan (Sinkron IT)** |

### 4.5. Grup Pengguna & Akses (Pengaturan & Keamanan)
| Path URL | Nama Lama | Nama Baru (Bahasa Indonesia Profesional) |
| :--- | :--- | :--- |
| *(Header Grup)* | Pengguna & Akses | **Pengaturan & Keamanan** |
| `/dashboard/access` | Manajemen Pengguna | **Akses & Peran Pengguna** |

---

## 5. Security & Edge Cases
- **Role-Based Access Control (RBAC):** Tidak terpengaruh karena filtering `hasItemAccess` dan `hasSubItemAccess` mengecek permission string teknis (misal `attendance.view`) dan nama role (`superadmin`, `hr`, dll), bukan nama label tampilan.
- **Route Access Protection (`canAccessRoute`):** Tetap bekerja 100% menggunakan prefix path dan permission.
- **Pencarian Breadcrumb:** Breadcrumb otomatis menampilkan nama baru yang elegan dan konsisten dengan menu yang diklik.

---

## 6. Verification Plan
- Unit testing via `npm test` di direktori `frontend`.
- Typecheck via `npx tsc --noEmit`.
- Verifikasi visual konsistensi huruf kapital dan kerapian string.

