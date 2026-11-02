# Implementation Plan: Laporan Absensi Harian (Format Cetak Landscape)

- **Tanggal Dokumen**: 2026-11-02
- **Spec Acuan**: `docs/superpowers/specs/2026-11-02-daily-attendance-landscape-report-design.md`
- **Status**: Draft for User Review & Approval

---

## 1. Shared Interfaces

```typescript
// Shared Types untuk Frontend & Backend (Daily Attendance Report)

export interface DailyAttendanceEmployeeRow {
  no: number;
  employeeId: number;
  employeeName: string;
  jobLevel: string | null;
  position: string | null;
  isHighlighted: boolean;       // Stabilo kuning: otomatis jika Level Jabatan/Posisi = Koordinator / Direktur, atau di-override manual oleh HRD
  locationUpdate: string;       // "Jakarta/ Kantor" (mesin) atau "Kabupaten Serang, Banten" (mobile/dinas luar)
  scanIn: string | null;        // "HH:mm" atau null
  isLate: boolean;              // true jika scanIn > scheduleIn
  lateMinutes: number;
  keterangan: string;           // "TDK ADA ABSEN", "SAKIT (SDH INFO...)", dll.
  attendanceStatus: string;     // 'PRESENT' | 'ALPHA' | 'SAKIT' | 'IZIN' | 'CUTI' | 'DINAS_LUAR'
  sourceType: 'ADMS' | 'MOBILE' | 'LEAVE' | 'MANUAL' | 'NONE';
}

export interface DailyAttendanceDepartmentGroup {
  departmentId: number;
  departmentName: string;
  employees: DailyAttendanceEmployeeRow[];
}

export interface DailyAttendanceReportResponse {
  workDate: string;             // 'YYYY-MM-DD'
  formattedDate: string;        // '30-Oct-26' / 'Jumat, 30 Oktober 2026'
  departments: DailyAttendanceDepartmentGroup[];
  summary: {
    totalEmployees: number;
    present: number;
    late: number;
    absent: number;
  };
}

export interface UpsertDailyNotePayload {
  workDate: string;
  employeeId: number;
  isHighlighted?: boolean;
  manualNote?: string;
}
```

---

## 2. Phase-by-Phase Tasks

### Phase 1: Database Schema & Migration
- [ ] Buat file skema Drizzle ORM: `backend/src/db/schema/attendanceDailyNotes.ts`.
- [ ] Daftarkan skema baru di `backend/src/db/index.ts`.
- [ ] Tulis unit test untuk verifikasi skema: `backend/src/db/schema/attendanceDailyNotes.test.ts`.
- [ ] Buat file migrasi database SQL menggunakan Drizzle Kit (`drizzle-kit generate`).
- [ ] Jalankan migrasi dan pastikan tabel `attendance_daily_notes` terbuat.

### Phase 2: Location Parser & Daily Report Query Service (TDD)
- [ ] Buat utilitas parser lokasi `backend/src/domain/attendanceLocationFormat.ts`:
  - Jika sumber mesin ADMS/kantor: return statis `"Jakarta/ Kantor"`.
  - Jika sumber mobile GPS/Nominatim address: ekstrak `[Kabupaten/Kota], [Provinsi]` (contoh: `"Kabupaten Serang, Banten"` atau `"Kabupaten Gowa, Sulawesi Selatan"`).
  - Tulis unit test di `backend/src/domain/attendanceLocationFormat.test.ts`.
- [ ] Buat service `backend/src/services/dailyAttendanceReportService.ts`:
  - Query gabungan seluruh karyawan aktif per departemen yang dipilih (default `MARKETING`).
  - Mengambil data untuk tanggal berapapun (`workDate` hari ini maupun tanggal-tanggal sebelumnya).
  - Mengambil dan menggabungkan data dari `attendance_records`, `attendance_self_logs`, `leave_requests`, dan catatan persisten historis dari `attendance_daily_notes`.
  - Deteksi `isHighlighted`: otomatis `true` jika `job_level` atau `position` mengandung `koordinator` atau `direktur` (case-insensitive), atau jika di-override manual pada `attendance_daily_notes`.
  - Terapkan hirarki keterangan:
    1. `manualNote` dari `attendance_daily_notes` (tetap tersimpan dari hari-hari sebelumnya).
    2. Cuti/Izin/Sakit dari `leave_requests`.
    3. `"TDK ADA ABSEN"` bila tidak scan dan tidak ada cuti.
    4. Kosong bila hadir normal.
  - Deteksi `isLate` berdasarkan `schedule_in`.
  - Tulis unit & integration tests di `backend/src/services/dailyAttendanceReportService.test.ts`.

### Phase 3: Backend API Routes & Permissions
- [ ] Daftarkan endpoint baru di `backend/src/routes/attendanceRoutes.ts`:
  - `GET /api/attendance/daily-report`: Mengembalikan payload `DailyAttendanceReportResponse`.
  - `POST /api/attendance/daily-report/note`: Simpan/update penandaan kuning dan catatan manual HRD.
- [ ] Terapkan validasi input dengan Zod schema: `workDate` (YYYY-MM-DD), `employeeId`, `isHighlighted`, `manualNote`.
- [ ] Uji endpoint dengan integration test di `backend/src/routes/attendanceDailyReport.integration.test.ts`.

### Phase 4: Frontend UI Halaman Laporan Harian
- [ ] Buat halaman baru: `frontend/src/app/dashboard/attendance/daily-report/page.tsx`.
- [ ] Buat komponen utama `DailyAttendanceReportPage.tsx`:
  - `PageHeader` standar Emerald Enterprise.
  - Filter Tanggal tunggal & Dropdown Departemen (Default: MARKETING).
  - Ringkasan KPI strip (Total Karyawan, Hadir, Terlambat, Tidak Hadir).
  - Tabel pratinjau interaktif:
    - Tombol toggle stabilo kuning di baris karyawan.
    - Input keterangan inline dengan autosave / save button.
    - Jam masuk dengan styling sel merah muda lembut jika terlambat.
  - Tombol aksi: **"Cetak Laporan (Landscape)"** dan **"Export Excel"**.

### Phase 5: Landscape Print View & Styling Presisi
- [ ] Buat komponen dokumen cetak: `frontend/src/components/attendance/DailyAttendancePrintDocument.tsx`:
  - Header tanggal terpusat (`30-Oct-26`).
  - Header kolom departemen (misal `MARKETING`).
  - CSS `@media print` murni:
    - `@page { size: landscape; margin: 10mm; }`
    - Sembunyikan elemen dashboard (`no-print`).
    - Border tabel 1px solid hitam tegas tanpa border ganda.
    - Pewarnaan sel keterlambatan (merah muda) dan baris nama terpilih (kuning stabilo) dengan `print-color-adjust: exact`.
    - Dukungan *page-break* per departemen bila mode cetak gabungan dipilih.
- [ ] Tulis unit test untuk helper render cetak di `frontend/src/lib/attendance/dailyReportPrint.test.mjs`.

### Phase 6: Automated Verification Loop & Final Handoff
- [ ] Jalankan backend test: `cd backend && npm test`.
- [ ] Jalankan frontend test: `cd frontend && npm test`.
- [ ] Jalankan typecheck frontend & backend: `npm run build` atau `npx tsc --noEmit`.
- [ ] Verifikasi visual cetak melalui browser preview mode landscape.
- [ ] Git commit atomic dengan format conventional commit.

---

## 3. Verification Commands

1. **Backend Tests**:
   ```bash
   cd backend && NODE_OPTIONS="--no-deprecation" npx tsx --test src/services/dailyAttendanceReportService.test.ts src/domain/attendanceLocationFormat.test.ts
   ```
2. **Frontend Tests**:
   ```bash
   cd frontend && npx tsx --test src/lib/attendance/dailyReportPrint.test.mjs
   ```
3. **Typecheck & Linter**:
   ```bash
   cd backend && npx tsc --noEmit
   cd frontend && npm run build
   ```

