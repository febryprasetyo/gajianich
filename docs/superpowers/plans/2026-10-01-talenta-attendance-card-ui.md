# GAJIANICH HR Attendance Card — Talenta Style UI Task Plan

**Tanggal:** 2026-10-01  
**Status:** DRAFT (Menunggu Persetujuan Pengguna)  
**Dokumen Spec:** `docs/superpowers/specs/2026-10-01-talenta-attendance-card-ui-design.md`  
**Target Modul:** `frontend/src/components/attendance/` & `frontend/src/lib/attendance/`

---

## 1. Shared Types & Helpers

Definisi tipe data untuk metrik dan representasi baris kartu Talenta:

```typescript
export interface TalentaKpiSummary {
  // Segmen 1: Exceptions
  earlyClockOut: number;
  noClockOut: number;
  noClockIn: number;
  invalid: number;

  // Segmen 2: Absences & Off Days
  absent: number;
  dayOff: number;
  timeOff: number;

  // Segmen 3: Future
  nextWorkdays: number;
}

export interface TalentaCalendarRow {
  date: string;              // YYYY-MM-DD
  dateDisplay: string;       // Wed, 23 Sep 2026
  dayName: string;           // Rabu
  shiftCode: string;         // 'O', 'dayoff', 'Shift 1', dsb.
  isDayOff: boolean;
  scheduleIn: string;        // '08:00' atau '00:00'
  scheduleOut: string;       // '17:00' atau '00:00'
  clockIn: string;           // '08:05' atau '-'
  clockOut: string;          // '17:11' atau '-'
  attendanceCode: string;    // 'H', 'S', 'I', 'C', '-'
  timeOffCode: string;       // 'S', 'Cuti', '-'
  overtimeDisplay: string;   // '01:30' atau '-'
  record?: AttendanceRecord | null;
}
```

---

## 2. Phase-by-Phase Tasks

### Phase 1: Domain Logic & Unit Tests (TDD)
- [ ] Buat helper domain: `frontend/src/lib/attendance/talentaDomain.ts`
  - `calculateTalentaKpi(rows: CalendarDayRow[], todayStr: string): TalentaKpiSummary`
  - `formatTalentaDate(dateStr: string): string` (format: `Wed, 23 Sep 2026`)
  - `mapTalentaAttendanceCodes(row: CalendarDayRow): { attendanceCode: string; timeOffCode: string; shiftCode: string }`
- [ ] Buat unit test vitest: `frontend/src/lib/attendance/talentaDomain.test.ts`
  - Test kalkulasi 3 segmen KPI (Early clock out, No clock in/out, Absent, Day off, Time off, Next workdays)
  - Test mapping kode status absensi sesuai spesifikasi Talenta PT Cahaya Mas Cemerlang
- [ ] Verifikasi tes hijau via `npm test` atau `npx vitest run talentaDomain`.

### Phase 2: Talenta UI Components
- [ ] Buat komponen **`TalentaMonthPickerPopover.tsx`**:
  - Tombol trigger dengan ikon kalender: `[ Oct 2026 ] [ ▾ ]`
  - Popover: Navigasi Tahun `< 2026 >`, Grid 12 bulan (Jan–Dec) dengan rounded solid blue active state, dan tombol *"This Month"*.
  - Menutup otomatis saat klik di luar (click-outside listener).
- [ ] Buat komponen **`TalentaKpiStrip.tsx`**:
  - Panel putih dengan 3 segmen terbagi garis vertikal:
    - Segmen 1: Early clock out, No clock out, No clock in, Invalid.
    - Segmen 2: Absent, Day off, Time off.
    - Segmen 3: Next workdays.
  - Tipografi rapi dan proporsional sesuai acuan visual Talenta.
- [ ] Buat komponen **`TalentaAttendanceTable.tsx`**:
  - Kolom: Date, Shift, Schedule in, Schedule out, Clock in, Clock out, Attendance code, Time off code, Overtime, Aksi.
  - Sorting per kolom (Date, Shift, Clock in, Clock out).
  - Styling status `dayoff` (merah coral, 00:00 - 00:00), dash `-` hijau/slate untuk scan kosong.
  - Quick action bagi HRD untuk koreksi atau catat absensi/izin manual.

### Phase 3: Integration into Attendance Card Page
- [ ] Integrasikan ke `AttendanceReportsPage.tsx` ketika menampilkan kartu karyawan individu (`employeeId` aktif).
- [ ] Pastikan tombol "All filters" dan tombol "Ekspor Excel" tetap berfungsi dengan baik.
- [ ] Uji responsivitas tabel pada tampilan mobile/tablet.

### Phase 4: Verification & Git Commit
- [ ] Jalankan `npm run lint` & `npx tsc --noEmit` untuk memastikan zero type error.
- [ ] Jalankan unit test `npm test`.
- [ ] Git commit atomic dengan conventional commit: `feat(attendance): talenta-style attendance card UI and KPI strip`.

---

## 3. Verification Commands

```bash
# 1. Typecheck
cd /home/fastpec/code/gajianich/frontend && npx tsc --noEmit

# 2. Unit Tests
cd /home/fastpec/code/gajianich/frontend && npm test

# 3. Linter
cd /home/fastpec/code/gajianich/frontend && npm run lint
```
