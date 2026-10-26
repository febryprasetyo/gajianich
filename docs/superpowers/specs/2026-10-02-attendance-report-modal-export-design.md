# GAJIANICH HR Attendance Reports & Multi-Select Export — Design Spec (Updated)

**Tanggal:** 2026-10-02  
**Status:** DRAFT (Revisi Detail Berdasarkan Masukan Pengguna)  
**Dokumen:** `docs/superpowers/specs/2026-10-02-attendance-report-modal-export-design.md`  
**Target Halaman:** Rekap Absensi (`/dashboard/attendance/reports`)

---

## 1. Summary & Problem Statement

Berdasarkan tinjauan dan arahan pengguna:
1. **Istilah Periode**: Istilah *"Periode Mulai"* dan *"Periode Selesai"* wajib diganti menjadi **"Periode Awal"** dan **"Periode Akhir"** di semua antarmuka (UI rekap, modal ekspor) dan kolom header file Excel.
2. **Siklus Cut-Off Tanggal (21 s.d. 20)**:
   - Periode default saat halaman dibuka belum terbentuk sebagai tanggal 21 s.d. 20 (sebelumnya masih mengambil sembarang tanggal -30 hari).
   - Periode wajib terbentuk dengan:
     - **Periode Awal**: tanggal `21` di bulan N (contoh: bulan 8 = `2026-08-21`).
     - **Periode Akhir**: tanggal `20` di bulan berikutnya N+1 (contoh: `2026-09-20`), sesuai acuan resmi Talenta HR (`detail?month=8&year=2026` = 21 Aug 2026 s.d. 20 Sep 2026).
3. **Filter Departemen Langsung**:
   - Tombol toggle dan panel collapsible *"All filters"* dihilangkan.
   - Dropdown filter departemen diletakkan langsung di toolbar utama.
4. **Modal Jendela Ekspor Multi-Person & Multi-Divisi**:
   - Saat tombol ekspor ditekan, muncul jendela/modal untuk memilih nama siapa saja yang akan diekspor dengan dukungan multi-divisi dan multi-karyawan secara interaktif.
5. **Rekapan Izin, Sakit, Cuti**:
   - Menambahkan kolom dan hitungan terpisah untuk masing-masing **Izin (I)**, **Sakit (S)**, dan **Cuti (C)** pada ringkasan KPI, tabel rekap, dan sheet Excel.
6. **Pembersihan Nama File Ekspor**:
   - Kata *"payroll"* dihilangkan dari nama file dan nama lembar kerja (worksheet). Nama file menjadi `rekap-absensi-${startDate}-${endDate}.xlsx` dan nama sheet menjadi `Rekap Absensi`.

---

## 2. Goals & Non-Goals

### Goals
1. **Standarisasi Istilah**:
   - Semua kemunculan *"Periode Mulai"* diganti menjadi **"Periode Awal"**.
   - Semua kemunculan *"Periode Selesai"* diganti menjadi **"Periode Akhir"**.
2. **Pembentukan Siklus Cut-Off 21 s.d. 20 Otomatis**:
   - `getDefaultAttendancePeriod`: secara otomatis membentuk rentang cut-off tanggal 21 s.d. 20 berdasarkan data/tanggal aktif.
   - `getPayrollCyclePeriod`: bulan N membentuk tanggal awal `21` bulan N s.d. tanggal akhir `20` bulan N+1 (misal bulan 8 = 21 Agustus 2026 s.d. 20 September 2026).
   - Label pada popover bulan menampilkan label jelas: `Agt 2026 (21 Agt – 20 Sep)`.
3. **Filter Departemen Langsung di Toolbar**:
   - Menghapus tombol toggle *"All filters"* dan kontainer collapsible.
   - Menempatkan dropdown departemen langsung pada toolbar utama bersebelahan dengan pemilih bulan dan pencarian.
4. **Modal Ekspor Fleksibel (Multi-Divisi & Multi-Person)**:
   - Jendela modal pop-up saat klik tombol *"Ekspor Excel"*.
   - Filter divisi multi-select dengan chips dan tombol cepat *Pilih Semua / Batal Semua*.
   - Daftar centang karyawan multi-select dengan pencarian teks, counter terpilih, dan tombol *Pilih Semua / Batal Semua*.
   - Mengunduh file Excel hanya untuk karyawan yang dipilih.
5. **Rekapan Terpisah Izin, Sakit, Cuti**:
   - Agregasi `sakitCount`, `izinCount`, `cutiCount` di `summarizeEmployees`.
   - Strip `Totals` 6-metrik: Total Keterlambatan, Total Lembur, Hadir, Izin, Sakit, Cuti.
   - Kolom tabel: `Karyawan`, `Departemen`, `Hadir`, `Terlambat`, `Lembur`, `Izin`, `Sakit`, `Cuti`, `Aksi`.
   - Kolom Excel: `No`, `ID Karyawan`, `Nama Karyawan`, `Departemen`, `Periode Awal`, `Periode Akhir`, `Hari Hadir`, `Keterlambatan (Menit)`, `Durasi Terlambat`, `Lembur (Menit)`, `Durasi Lembur`, `Izin`, `Sakit`, `Cuti`.
6. **Penamaan File & Sheet Bersih**:
   - Nama file: `rekap-absensi-${startDate}-${endDate}.xlsx` (tanpa kata "payroll").
   - Sheet name: `Rekap Absensi`.

### Non-Goals
- Tidak merombak tabel database Drizzle ORM atau migrasi backend.
- Tidak menghapus fitur koreksi kehadiran individual.

---

## 3. Data Model & Logic Calculation

### 3.1 Siklus Tanggal Cut-Off 21 s.d. 20
```typescript
export function getPayrollCyclePeriod(year: number, month: number): {
  startDate: string; // YYYY-MM-21 (Bulan N)
  endDate: string;   // YYYY-MM-20 (Bulan N+1)
  label: string;
  year: number;
  month: number;
} {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const startMonthStr = String(month).padStart(2, '0');
  const endMonthStr = String(nextMonth).padStart(2, '0');

  const startDate = `${year}-${startMonthStr}-21`;
  const endDate = `${nextYear}-${endMonthStr}-20`;
  const label = `${MONTH_NAMES_ID[month - 1]} ${year}`;

  return { startDate, endDate, label, year, month };
}
```

### 3.2 Ekstensi Interface `EmployeeReport`
```typescript
export interface EmployeeReport {
  employee: Employee;
  recordCount: number;      // Hari hadir
  lateMinutes: number;      // Total menit keterlambatan
  overtimeMinutes: number;  // Total menit lembur
  sakitCount: number;       // Jumlah SAKIT
  izinCount: number;        // Jumlah IZIN
  cutiCount: number;        // Jumlah CUTI
}
```

### 3.3 Kolom File Excel
Header sheet `Rekap Absensi`:
1. `No`
2. `ID Karyawan`
3. `Nama Karyawan`
4. `Departemen`
5. `Periode Awal`
6. `Periode Akhir`
7. `Hari Hadir`
8. `Keterlambatan (Menit)`
9. `Durasi Terlambat`
10. `Lembur (Menit)`
11. `Durasi Lembur`
12. `Izin`
13. `Sakit`
14. `Cuti`

---

## 4. UI/UX Specifications

### 4.1 Toolbar Langsung (Direct Toolbar)
- `[ Bulan Kalender (21 Agt – 20 Sep) ▾ ]`
- `[ Dropdown Departemen (Semua Departemen) ▾ ]`
- `[ Search Input: Cari nama karyawan... ]`
- Tombol kanan: `[ Ekspor Excel ]` (Membuka jendela modal)

### 4.2 Modal Jendela Ekspor (`ExportAttendanceModal`)
- **Header**:
  - Judul: "Ekspor Rekap Absensi"
  - Subjudul: "Pilih divisi dan karyawan yang akan disertakan dalam laporan Excel."
  - Tag Periode: `Periode Awal: 21 Aug 2026 | Periode Akhir: 20 Sep 2026`
- **Bagian Divisi (Multi-Divisi)**:
  - Tombol chip per divisi + badge jumlah karyawan.
  - Tombol cepat: "Pilih Semua Divisi" / "Hapus Pilihan".
- **Bagian Karyawan (Multi-Person)**:
  - Search bar mini nama/kode karyawan.
  - Counter: "Terpilih: X dari Y karyawan".
  - Tombol cepat: "Pilih Semua" / "Batal Semua".
  - Daftar scrollable kartu karyawan dengan checkbox.
- **Footer**:
  - Nama file: `rekap-absensi-2026-08-21-2026-09-20.xlsx`
  - Tombol Batal & Tombol Unduh Excel.

---

## 5. Security & Verification

- Seluruh hak akses RBAC dihormati.
- Unit test suite diperbarui dan diverifikasi:
  - `scheduleShift.test.mjs`
  - `domain.test.mjs`
  - `excelExport.test.mjs`
  - `talentaCard.test.mjs`
- Typecheck & Next.js production build bebas error.
