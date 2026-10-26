# GAJIANICH HR Attendance Card — Talenta Style UI Redesign

**Tanggal:** 2026-10-01  
**Status:** DRAFT (Menunggu Tinjauan & Persetujuan Pengguna)  
**Dokumen:** `docs/superpowers/specs/2026-10-01-talenta-attendance-card-ui-design.md`  
**Target Halaman:**  
- Kartu Absensi Karyawan: `/dashboard/attendance/employees/[id]`  
- Terintegrasi juga pada tampilan rekap kartu karyawan di `/dashboard/attendance/reports`  
**Referensi:** Screenshot Talenta UI & `docs/view-attd-talenta.md` (PT Cahaya Mas Cemerlang - Talenta HR)

---

## 1. Summary & Problem Statement

Tampilan kartu absensi individu saat ini masih menggunakan layout kartu KPI kotak-kotak warna-warni yang berbeda dengan pola antarmuka standar Talenta HR yang sudah familiar digunakan oleh manajemen dan HRD PT Cahaya Mas Cemerlang.

Berdasarkan referensi visual Talenta HR yang dilampirkan pengguna:
1. **Filter Bar & Kalender Popover**:
   - Pemilih bulan berbentuk tombol ringkas (contoh: `Oct 2026` dengan icon kalender).
   - Saat diklik, membuka popover/dropdown pemilih bulan interaktif:
     - Header tahun dengan navigasi panah: `< 2026 >`
     - Grid 12 bulan (Jan – Dec) dengan bulan aktif di-highlight (warna solid primary/blue dengan sudut membulat).
     - Tombol cepat *"This Month"* di bagian bawah.
   - Tombol *"All filters"* dan tombol ikon gear/pengaturan kolom (*Adjust column*).
2. **Stat Strip / KPI Bar Talenta**:
   - Berupa satu kartu horizontal putih memanjang dengan pembatas garis vertikal tipis, terbagi menjadi 3 segmen terstruktur:
     - **Segmen 1 (Penyimpangan Jam Kerja)**:
       - `Early clock out` (Pulang awal)
       - `No clock out` (Tidak scan pulang)
       - `No clock in` (Tidak scan masuk)
       - `Invalid` (Tidak valid / anomali)
     - *Garis Pemisah Vertikal*
     - **Segmen 2 (Status Tidak Masuk Kerja)**:
       - `Absent` (Mangkir / Alpha)
       - `Day off` (Hari libur)
       - `Time off` (Izin / Cuti / Sakit)
     - *Garis Pemisah Vertikal*
     - **Segmen 3 (Hari Kerja Mendatang)**:
       - `Next workdays` (Hari kerja tersisa dalam periode aktif)
3. **Format Tabel Absensi Harian (Log Presisi Talenta)**:
   - Header tabel bersih berlatar abu-abu terang dengan indikator sortir `⇅`.
   - Kolom yang persis sesuai Talenta:
     1. `Date ⇅` (contoh: `Wed, 23 Sep 2026`)
     2. `Shift ⇅` (contoh: `O` untuk kerja normal, teks merah `dayoff` untuk hari libur)
     3. `Schedule in ⇅` (contoh: `08:00` atau `00:00` saat libur)
     4. `Schedule out ⇅` (contoh: `17:00` atau `00:00` saat libur)
     5. `Clock in ⇅` (contoh: `08:05` atau tanda `-` hijau/slate jika kosong)
     6. `Clock out ⇅` (contoh: `17:11` atau tanda `-` jika kosong)
     7. `Attendance code` (contoh: `H`, `S`, `-`)
     8. `Time off code` (contoh: `S`, `Cuti`, `-`)
     9. `Overtime` (contoh: `-` atau durasi jam `01:30`)
   - Baris libur (*dayoff*) memiliki penanda visual khas Talenta (shift teks merah `dayoff`, jam `00:00 – 00:00`, tanpa scan).
   - Mendukung klik baris / aksi cepat bagi HRD untuk mencatat absensi manual / izin / koreksi data.

---

## 2. Goals & Non-Goals

### Goals
1. **Month-Year Picker Popover Khas Talenta**:
   - Komponen pemilih bulan popover yang elegan (label bulan & tahun, popup grid 12 bulan, navigasi panah tahun, tombol *"This Month"*).
   - Sinkronisasi dengan siklus cut-off payroll 21 s.d. 20 (atau bulan kalender penuh).
2. **KPI Strip 3-Segmen Talenta**:
   - Menghitung secara akurat metrik:
     - `Early clock out`, `No clock out`, `No clock in`, `Invalid`
     - `Absent` (hari kerja tanpa scan & tanpa izin), `Day off` (Sabtu/Minggu/Hari Libur Nasional), `Time off` (Sakit, Cuti, Izin)
     - `Next workdays` (hari kerja terjadwal yang jatuh setelah tanggal hari ini).
3. **Tabel Log Absensi Talenta**:
   - Tampilan kolom: Date, Shift, Schedule in, Schedule out, Clock in, Clock out, Attendance code, Time off code, Overtime.
   - Styling identik dengan gambar acuan: tipografi jelas, padding proporsional, `dayoff` berwarna merah coral, jam terjadwal `08:00` / `17:00`, scan masuk/pulang, dan tombol aksi koreksi/catat.
4. **Modal / Filter Samping ("All filters")**:
   - Tombol "All filters" untuk memfilter berdasarkan status kehadiran (Hadir, Sakit, Terlambat, dsb.) atau rentang kustom.
5. **Mobile-Responsive & Aksesibilitas**:
   - Responsif di layar tablet dan desktop lebar, dengan horizontal scroll yang rapi pada tabel.

### Non-Goals
- Tidak merombak backend database Drizzle ORM atau membuat tabel baru (semua kalkulasi memanfaatkan data kehadiran, shift, dan domain logic yang sudah ada).
- Tidak menghapus fitur koreksi dan pencatatan manual HRD yang sudah dibuat sebelumnya (tetap dapat diakses via baris tabel atau tombol aksi).

---

## 3. Data Model & Logic Calculation

### Perhitungan Metrik KPI Talenta
Berdasarkan baris kalender (`calendarRows: CalendarDayRow[]`) pada periode yang dipilih:
```typescript
interface TalentaAttendanceSummary {
  // Segmen 1: Exceptions
  earlyClockOut: number;  // r.scanOut < scheduleOut (earlyMinutes > 0)
  noClockOut: number;     // r.scanIn ada, tapi r.scanOut kosong
  noClockIn: number;      // r.scanOut ada, tapi r.scanIn kosong
  invalid: number;        // anomali (misal: scan jam tidak masuk akal atau status INVALID)
  
  // Segmen 2: Absences & Non-working days
  absent: number;         // hari kerja masa lalu tanpa scan dan tanpa izin (ALPHA)
  dayOff: number;         // row.isDayOff (Sabtu/Minggu atau Libur Resmi)
  timeOff: number;        // row dengan status SAKIT, CUTI, atau IZIN
  
  // Segmen 3: Future
  nextWorkdays: number;   // row.date > today && !row.isDayOff
}
```

### Pemetaan Kode Absensi (Attendance & Time Off Code)
Sesuai data Talenta PT Cahaya Mas Cemerlang di `docs/view-attd-talenta.md`:
- `Attendance code`:
  - `H` = Hadir (Present)
  - `S` = Sakit
  - `I` = Izin
  - `C` = Cuti
  - `-` = Kosong / Libur / Alpha
- `Time off code`:
  - `S` = Sakit
  - `CT` / `C` = Cuti
  - `IZ` / `I` = Izin
  - `-` = Tidak ada time off
- `Shift`:
  - `O` = Office / Standar (08:00 - 17:00)
  - `dayoff` = Libur mingguan / libur terjadwal (00:00 - 00:00)
  - Nama shift khusus jika ada (misal `Shift 1`, `Shift 2`, `National Holiday`)

---

## 4. UI/UX Specifications

### 4.1 Filter Bar
- **Tombol Bulan Aktif**:
  - Tampilan: `[ Kalender Icon ] [ Oct 2026 ] [ ▾ ]`
  - Klik membuka dropdown:
    - Bar atas: Tombol `<` Tahun `2026` Tombol `>`
    - Grid 4x3 nama bulan (Jan s.d. Dec)
    - Tombol footer: "This Month"
- **Tombol "All filters"**: Membuka drawer atau popover filter status.
- **Tombol Ikon Opsi/Ekspor**: Tombol cepat untuk ekspor Excel / opsi kolom.

### 4.2 KPI Summary Strip (Segmented Card)
- Single card putih, border `border-slate-200`, rounded-xl, shadow-sm.
- Dibagi menjadi 3 segmen dengan garis vertikal:
  - **Segmen 1**: 4 item (Early clock out, No clock out, No clock in, Invalid).
  - **Segmen 2**: 3 item (Absent, Day off, Time off).
  - **Segmen 3**: 1 item (Next workdays).
- Angka berukuran 20px font-bold, label di bawahnya berukuran 12px teks slate-500.

### 4.3 Tabel Log Absensi
- Header berlatar `bg-slate-50/70` teks `text-slate-600` font-semibold teks-xs uppercase tracking-wider.
- Kolom:
  1. `Date ⇅`
  2. `Shift ⇅`
  3. `Schedule in ⇅`
  4. `Schedule out ⇅`
  5. `Clock in ⇅`
  6. `Clock out ⇅`
  7. `Attendance code`
  8. `Time off code`
  9. `Overtime`
  10. `Aksi` (Koreksi / Catat Absensi)
- Penataan baris libur:
  - Shift bertuliskan `dayoff` warna merah muda/coral (`text-rose-500` / `#f05a5b`).
  - Schedule: `00:00` dan `00:00`.
- Format tanggal: `Wed, 23 Sep 2026`.

---

## 5. Security & Verification

- **RBAC**: Hanya pengguna berhak (`HR_ADMIN`, `HR_STAFF`, `SUPER_ADMIN`) yang dapat melakukan aksi koreksi/pencatatan. Peran `REPORT_VIEWER` hanya dapat melihat.
- **Verifikasi**:
  - Unit test pada fungsi kalkulasi KPI Talenta (`calculateTalentaKpi`).
  - Unit test pada pemformatan baris tabel Talenta (`formatTalentaDayRow`).
  - Typecheck `npx tsc --noEmit` & Vitest.
