# GAJIANICH HR Shift & Schedule Management — Design Specification

**Tanggal:** 2026-10-01  
**Status:** DRAFT (Menunggu Tinjauan & Persetujuan Pengguna)  
**Dokumen:** `docs/superpowers/specs/2026-10-01-hr-shift-schedule-management-design.md`  
**Target URL Modul:**  
- Pengaturan Shift: `/dashboard/attendance/master/shifts`  
- Kartu Absensi Terintegrasi: `/dashboard/attendance/employees/[id]`  
- Rekap & Data Harian: `/dashboard/attendance`  
**Referensi:** `docs/view-attd-talenta.md` (PT Cahaya Mas Cemerlang - Talenta HR)

---

## 1. Summary & Problem Statement

Pada sistem absensi saat ini:
1. **Hari Kosong Terlewati (*Skipped Days*)**: File impor mesin absensi hanya mencatat karyawan yang melakukan scan masuk/pulang. Karyawan yang berhalangan hadir karena **Sakit (S)**, **Cuti (C)**, **Izin (I)**, atau **Mangkir/Alpha (A)** tidak memiliki rekaman mesin, sehingga tanggal-tanggal tersebut hilang/terlewati dari kartu absensi dan tidak dapat dideteksi atau diedit oleh HRD.
2. **Ketiadaan Pengaturan Jadwal & Shift Kerja**: Sistem belum memiliki pengelolaan jam kerja. Padahal perusahaan memiliki beberapa pola kerja:
   - **Default Utama (Office / Standar)**: 5 hari kerja (Senin–Jumat: 08:00 – 17:00, Sabtu & Minggu Libur).
   - **Divisi Produksi (6 Hari Kerja)**: Senin–Jumat 08:00 – 16:00, Sabtu 08:00 – 14:00 (Hari Kerja Aktif), Minggu Libur.
   - **Shift Khusus Produksi**: Shift Pagi (07:00–15:00), Shift Siang (15:00–23:00), Shift Malam (23:00–07:00).
3. **Siklus Cut-Off Payroll Belum Standar**: Pencarian data masih manual mengetikkan `startDate` dan `endDate`, padahal siklus penggajian PT Cahaya Mas Cemerlang menggunakan cut-off bulanan standar: **Tanggal 21 bulan sebelumnya s.d. Tanggal 20 bulan berjalan** (misal: Periode September = 21 Agustus s.d. 20 September).

Solusinya adalah mengimplementasikan modul **Master Jam Kerja & Pengaturan Shift** terpusat, penugasan shift per departemen/karyawan, proyeksi kalender harian lengkap (31 hari) pada kartu absensi sesuai pola Talenta, dan dialog aksi pencatatan kehadiran manual serta ketidakhadiran (Sakit/Cuti/Izin/Alpha).

---

## 2. Goals & Non-Goals

### Goals
1. **Default Sistem Jam Kerja**:
   - Secara default seluruh karyawan menerapkan jadwal **08:00 – 17:00** dengan **5 hari kerja (Senin – Jumat)**. Sabtu dan Minggu otomatis berstatus **Day Off (Libur)**.
2. **Menu Baru: Pengaturan Shift & Jam Kerja** (`/dashboard/attendance/master/shifts`):
   - Tabel master shift: membuat, melihat, mengedit, dan mengaktifkan shift kerja (Kode, Nama, Jam Masuk, Jam Pulang, Pola Hari Kerja, Jam Khusus Hari Sabtu).
   - Penugasan Shift (*Shift Assignment*):
     - Menetapkan shift default ke tingkat **Departemen** (misal: Divisi Produksi $\rightarrow$ Shift Produksi 6 Hari).
     - Menetapkan shift khusus ke tingkat **Karyawan Individu** (override, misal operator mesin $\rightarrow$ Shift Malam).
3. **Siklus Cut-Off Payroll Bulanan**:
   - Pemilih filter periode berupa **Dropdown Bulan & Tahun Siklus Payroll** (misal *"September 2026"* otomatis menetapkan 21 Agustus 2026 s.d. 20 September 2026).
   - Opsi *"Rentang Tanggal Kustom"* tetap tersedia untuk kebutuhan audit tanggal khusus.
4. **Proyeksi Kalender Harian Penuh (Full 30/31 Days Grid)**:
   - Kartu absensi merender seluruh baris tanggal kalender secara runtut tanpa melompati hari.
   - Jadwal masuk, jadwal pulang, dan status libur otomatis mengikuti shift karyawan yang aktif pada hari tersebut.
5. **Aksi Pencatatan Absensi & Ketidakhadiran oleh HRD**:
   - Baris tanggal yang kosong/belum ada scan dapat diklik atau memiliki tombol **"Catat Absensi / Izin"**.
   - Opsi pencatatan:
     - 🟢 **Hadir Manual**: Input Jam Masuk & Jam Pulang manual (alasan: lupa bawa kartu/mesin eror).
     - 🟡 **Sakit (S)**: Scan kosong, jam kerja 0, status `SAKIT`.
     - 🔵 **Cuti (C)**: Status `CUTI`.
     - 🟣 **Izin (I)**: Status `IZIN`.
     - 🔴 **Tidak Hadir / Alpha (A)**: Status `ALPHA`.
   - Field **Alasan / Catatan**: Bersifat opsional (tidak wajib) untuk audit trail (misal: *"Sakit demam, surat dokter terlampir"*).
6. **Sinkronisasi Otomatis Rekapitulasi & Ekspor Excel**:
   - Strip KPI ringkasan dan file Excel rekapitulasi memuat rincian: *Hadir*, *Sakit*, *Izin*, *Cuti*, *Alpha*, *Day Off*, dan *Overtime*.

### Non-Goals
- Tidak mengubah mesin biometric fisik secara real-time (data tetap bersumber dari unggahan Excel log mesin).
- Tidak membatasi fleksibilitas: HR Admin tetap memiliki wewenang mengoreksi atau mengubah shift sewaktu-waktu.

---

## 3. Data Model & Specifications

### A. Tipe Data Master Shift (`frontend/src/lib/attendance/types.ts`)
```typescript
export interface WorkShift {
  id: number;
  code: string;               // e.g. "OFFICE", "PROD_6D", "PROD_PAGI", "PROD_MALAM"
  name: string;               // e.g. "Office Reguler", "Produksi 6 Hari", "Shift Pagi"
  scheduleIn: string;         // "08:00"
  scheduleOut: string;        // "17:00" atau "16:00"
  workDays: 5 | 6;            // 5 = Senin-Jumat, 6 = Senin-Sabtu
  saturdayScheduleIn?: string | null;  // "08:00" (khusus shift 6 hari)
  saturdayScheduleOut?: string | null; // "14:00" (khusus shift 6 hari)
  description?: string;
  isDefault: boolean;         // true untuk Shift Office (08:00-17:00, 5 hari)
  isActive: boolean;
}

export interface ShiftAssignment {
  id: number;
  shiftId: number;
  departmentId?: number | null; // Jika null/undefined, berlaku per karyawan
  employeeId?: number | null;   // Jika terisi, override departemen
  effectiveDate?: string;       // YYYY-MM-DD
}
```

### B. Default Presets Sistem:
1. **Shift Office (Default)**:
   - Kode: `OFFICE`, Nama: *"Office Reguler (Default)"*
   - Jam Masuk: `08:00`, Jam Pulang: `17:00`
   - Hari Kerja: 5 hari (Senin–Jumat). Sabtu & Minggu = Day Off.
2. **Shift Produksi 6 Hari**:
   - Kode: `PROD_6D`, Nama: *"Produksi Reguler (6 Hari)"*
   - Senin–Jumat: `08:00 – 16:00`
   - Sabtu: `08:00 – 14:00` (Hari kerja aktif)
   - Minggu: Day Off.
3. **Shift Khusus Produksi (Pagi / Siang / Malam)**:
   - Pagi: `07:00 – 15:00`
   - Siang: `15:00 – 23:00`
   - Malam: `23:00 – 07:00`

### C. Ekstensi Dataset & AttendanceCommand
```typescript
export type AttendanceCommand =
  // Command yang sudah ada...
  | { type: correct; ... }
  // Command Baru:
  | {
      type: record_attendance;
      employeeId: number;
      workDate: string;
      attendanceStatus: AttendanceStatus;
      shiftId?: number;
      scanIn?: string | null;
      scanOut?: string | null;
      reason: string;
    }
  | {
      type: shift;
      action: create | update | delete;
      shift: WorkShift;
    }
  | {
      type: assign_shift;
      assignment: ShiftAssignment;
    };
```

---

## 4. UI/UX Hierarchy & Workflows

### 1. Menu Pengaturan Shift (`/dashboard/attendance/master/shifts`)
- **Tab 1: Master Jam Kerja**:
  - Tabel berisi daftar shift, jam masuk, jam pulang, pola hari kerja, badge default, dan tombol tambah/edit.
- **Tab 2: Penugasan Shift Departemen & Karyawan**:
  - Daftar departemen dan dropdown pemilihan shift default masing-masing.
  - Tabel override penugasan per karyawan untuk karyawan produksi yang ber-shift khusus.

### 2. Kartu Absensi Karyawan (`/dashboard/attendance/employees/[id]`)
- **Filter Bar**:
  - Dropdown **Periode Payroll**: Pilihan bulan & tahun (misal: *"September 2026 (21 Agu - 20 Sep)"*).
  - Badge Shift aktif karyawan bersangkutan (misal: *"Shift: Produksi Reguler (6 Hari)"*).
- **Tabel 31 Hari Kalender Penuh (Mirip Talenta)**:
  - Kolom: `Tanggal`, `Shift`, `Jadwal Masuk`, `Jadwal Pulang`, `Scan Masuk`, `Scan Pulang`, `Status Kehadiran`, `Ketidakhadiran (Time Off)`, `Lembur`, `Aksi`.
  - Hari libur mingguan otomatis bertanda `dayoff` (00:00 - 00:00).
  - Hari kerja aktif tanpa scan menampilkan status `Belum Ada Data` dengan tombol **"Catat / Koreksi"**.

### 3. Modal Dialog "Catat Absensi / Ketidakhadiran"
- Modal input sederhana dan jelas:
  - Menampilkan nama karyawan, tanggal, dan shift yang berlaku.
  - Opsi Status: Radio / Select (`Hadir Manual`, `Sakit`, `Cuti`, `Izin`, `Alpha`).
  - Jika Hadir Manual: Menampilkan input Jam Masuk & Jam Pulang.
  - Textarea Alasan / Keterangan (opsional / tidak wajib).
  - Tombol Simpan & Batal.

---

## 5. Security, RBAC & Verification

- **RBAC**: Hanya pengguna dengan peran HR Admin (`canWrite === true`) yang dapat menambah/mengedit master shift dan mencatat kehadiran/izin karyawan. Role viewer hanya dapat membaca.
- **Audit Trail**: Setiap pencatatan ketidakhadiran atau koreksi jam kerja tersimpan di log audit (`data.audit` dan `data.revisions`) beserta nama user dan alasannya.
- **Automated Verification Loop**:
  - Unit tests domain: menghitung cut-off payroll (21 Agu–20 Sep), resolusi shift departemen vs karyawan, perhitungan keterlambatan dan lembur khusus Sabtu (08:00–14:00 vs 08:00–17:00).
  - Build check: Next.js Turbopack typecheck 100% clean.
