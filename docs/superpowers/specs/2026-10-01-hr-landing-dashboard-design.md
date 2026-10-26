# GAJIANICH HR Dedicated Landing Dashboard — Design Specification (Revisi)

**Tanggal:** 2026-10-01  
**Status:** IMPLEMENTED & VERIFIED  
**Dokumen:** `docs/superpowers/specs/2026-10-01-hr-landing-dashboard-design.md`  
**Target URL Landing:** `/dashboard/attendance/overview`  
**Target URL Data Operasional:** `/dashboard/attendance`  
**Referensi Inspirasi:** Dreams ERP HR Dashboard, SmartHR Attendance Dashboard, Audit Anti-Slop 002

---

## 1. Summary & Problem Statement

Sebelumnya, pengguna dengan peran HR (*HR Admin* / *HR Staff*) yang login ke sistem diarahkan langsung ke satu halaman yang mencampur aduk antara data operasional absensi dan ringkasan eksekutif. Hal ini menyebabkan:
1. Halaman menjadi sangat panjang ke bawah dan membebani alur kerja harian pengguna.
2. Informasi penting seperti overview metrik, prioritas tindakan cepat, dan pantauan keterlambatan tertumpuk dengan tabel baris absensi ratusan karyawan.
3. Daftar distribusi departemen yang panjang membuat halaman terus memanjang ke bawah tanpa batasan.

### Solusi Desain Baru:
1. **Pemisahan Halaman Eksplisit**:
   - **Halaman Khusus Landing Overview** (`/dashboard/attendance/overview`): Berfungsi sebagai beranda utama ketika role HR login. Berisi sapaan personal, matriks KPI harian lengkap dan padat (compact), widget prioritas tindak lanjut (*actionable checks*), ringkasan departemen dengan fitur *Show More*, dan panel status mesin/integritas data.
   - **Halaman Khusus Data Absensi** (`/dashboard/attendance`): Berfungsi murni untuk operasional tabel presensi harian, filter tanggal/departemen, pencarian karyawan, ekspor excel, koreksi scan, dan penguncian data.
2. **Matriks Operasional Penuh & Padat (8 Indikator)**:
   - Menampilkan 8 kartu metrik tabular yang saling terhubung langsung ke filter tabel di halaman data absensi:
     1. Total Karyawan Aktif
     2. Total Kehadiran Hari Ini (dengan persentase rate)
     3. Tepat Waktu Datang
     4. Terlambat Datang (dengan durasi menit/jam)
     5. Pulang Lebih Awal (dengan durasi menit)
     6. Lembur Kerja (dengan durasi jam lembur)
     7. Cuti / Izin / Sakit
     8. Missing Punch / Anomali Scan
3. **Distribusi Departemen Kompak dengan Show More**:
   - Menampilkan 4 departemen teratas terlebih dahulu pada grid 2-kolom.
   - Menyediakan tombol interaktif "Lihat Semua (N)" / "Tampilkan Lebih Sedikit" sehingga halaman tetap kompak dan tidak memanjang ke bawah.

---

## 2. Goals & Non-Goals

### Goals
1. **Dedicated HR Landing Page**:
   - Route `/dashboard/attendance/overview` sebagai default redirect untuk pengguna ber-role HR (`getDefaultRedirectForUser`).
   - Navigasi sidebar terpisah: "Ringkasan HR" (`/dashboard/attendance/overview`) dan "Data Absensi" (`/dashboard/attendance`).
2. **Personalized HR Hero**:
   - Sapaan kontekstual waktu (*Pagi/Siang/Sore, [Nama HR]*) + maskot kucing kopi GAJIANICH (`/branding/gajianich-cat-favicon.png`).
   - Penunjuk tanggal Jakarta (WIB) dengan format lokal Indonesia.
   - Tombol aksi cepat adaptif izin pengguna.
3. **8 Compact KPI Cards**:
   - Grid 4-kolom (2-kolom di tablet/ponsel) dengan angka tabular, badge status, dan tautan deep-link filter ke `/dashboard/attendance?condition=...`.
4. **Actionable Priority Checks ("Perlu Dicek Hari Ini")**:
   - Daftar 5 anomali teratas (terlambat signifikan atau missing punch) dengan tautan langsung ke kartu absensi atau dialog koreksi.
5. **Kompak Department Summary dengan Show More**:
   - Default 4 departemen dengan tombol toggle expand/collapse.
6. **Preservasi Halaman Data Absensi**:
   - Halaman `/dashboard/attendance` tetap fokus pada tabel dan utilitas pencarian/ekspor/koreksi.

### Non-Goals
- Tidak ada data fiktif (semua angka dihitung reaktif dari `AttendanceDataset` riil).
- Tidak memodifikasi skema database atau backend endpoint yang berisiko regresi.

---

## 3. UI/UX Hierarchy & Flow

```
[ Login sebagai Role HR ]
          │
          ▼
[ /dashboard/attendance/overview ]  <── Landing Khusus Overview
  ├─ 1. HrHeroGreeting (Sapaan, Tanggal WIB, Quick Actions)
  ├─ 2. HrTodayKpiCards (8 Matriks Operasional Padat: Hadir, Telat, Cepat, Lembur, dll)
  └─ 3. Grid 2-Kolom:
       ├─ Kolom Kiri:
       │    ├─ HrPriorityChecks (Daftar anomali yang perlu ditindaklanjuti)
       │    └─ HrDepartmentSummary (4 Departemen + Toggle "Lihat Semua")
       └─ Kolom Kanan:
            └─ Status Operasional & Mesin (Kunci Tanggal, Log Terakhir, Navigasi ke Data Absensi)
          │
          ▼ (Klik tombol/kartu)
[ /dashboard/attendance ]  <── Halaman Data Absensi Operasional
  ├─ Filter Tanggal, Departemen, Pencarian, Ekspor Excel, Kunci Data
  └─ Tabel Lengkap Presensi Karyawan
```

---

## 4. Verification & Testing

- Unit tests: `frontend/src/lib/attendance/overviewMetrics.test.mjs` (100% Pass)
- Access routes tests: `frontend/src/lib/access/routes.test.mjs` (100% Pass)
- Production build: `npm run build` (0 errors, Turbopack clean)
