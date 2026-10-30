# Implementation Plan: Multiple Shift per Departemen & Jam Kerja Template

> **Revisi:** 2026-10-30 — Sesuai Design Spec terbaru: arsitektur dua-lapis Master Jam Kerja + Shift (mapping per-hari).

---

## Overview

Rencana implementasi fitur jadwal shift berbasis **template Jam Kerja** yang di-mapping per hari dalam seminggu. Setiap hari bisa diassign template jam kerja berbeda (atau null = libur). Mendukung Minggu opsional (tap-driven) dan multiple shift per departemen.

---

## Shared Types (Backend & Frontend)

```ts
// attendance_work_hours
interface WorkHoursTemplate {
  id: string;
  orgId: string;
  name: string;
  color?: string;
  scheduleIn: string;       // "HH:mm"
  scheduleOut: string;      // "HH:mm"
  scanInStart: string;      // "HH:mm"
  scanInEnd: string;        // "HH:mm"
  scanOutStart: string;     // "HH:mm"
  scanOutEnd: string;       // "HH:mm"
  lateToleranceMinutes: number;
  earlyLeaveToleranceMinutes: number;
  requireCheckIn: boolean;
  requireCheckOut: boolean;
}

// attendance_shifts (diperbarui)
interface AttendanceShift {
  id: string;
  name: string;
  mondayWorkHoursId: string | null;
  tuesdayWorkHoursId: string | null;
  wednesdayWorkHoursId: string | null;
  thursdayWorkHoursId: string | null;
  fridayWorkHoursId: string | null;
  saturdayWorkHoursId: string | null;
  sundayWorkHoursId: string | null;
}

// attendance_shift_assignments (diperbarui)
interface ShiftAssignment {
  id: string;
  departmentId: string;
  shiftId: string;
  isDefault: boolean;
}

// Resolved schedule for a given date
interface DaySchedule {
  isDayOff: boolean;
  scheduleIn?: string;
  scheduleOut?: string;
  scanInStart?: string;
  scanInEnd?: string;
  scanOutStart?: string;
  scanOutEnd?: string;
  lateToleranceMinutes?: number;
  earlyLeaveToleranceMinutes?: number;
}
```

---

## Phase 1: Database Schema & Migration

- [x] **Task 1.1** — Buat tabel `attendance_work_hours` di `backend/src/db/schema/attendanceWorkspace.ts`  
  Field: `id`, `name`, `color`, `scheduleIn`, `scheduleOut`, `scanInStart`, `scanInEnd`, `scanOutStart`, `scanOutEnd`, `lateToleranceMinutes`, `earlyLeaveToleranceMinutes`, `requireCheckIn`, `requireCheckOut`, `createdAt`, `updatedAt`

- [x] **Task 1.2** — Perbarui tabel `attendanceShifts` di schema:
  - **Tambah** kolom FK (nullable): `mondayWorkHoursId`, `tuesdayWorkHoursId`, `wednesdayWorkHoursId`, `thursdayWorkHoursId`, `fridayWorkHoursId`, `saturdayWorkHoursId`, `sundayWorkHoursId`

- [x] **Task 1.3** — Perbarui tabel `attendanceShiftAssignments`:
  - Ubah unique index dari `(departmentId)` menjadi `(departmentId, shiftId)`
  - Tambah kolom `isDefault: boolean().default(false).notNull()`

- [x] **Task 1.4** — Buat file migrasi SQL:  
  `backend/drizzle/0036_work_hours_template_and_shift_redesign.sql`

- [x] **Task 1.5** — Daftarkan migrasi di `backend/drizzle/meta/_journal.json`

- [x] **Task 1.6** — Jalankan migrasi dan verifikasi struktur tabel di PostgreSQL

---

## Phase 2: Domain Types & Logika Resolusi Shift

- [x] **Task 2.1** — Perbarui interface di:
  - `backend/src/domain/attendanceTypes.ts`
  - `frontend/src/lib/attendance/types.ts`
  
  Tambah `WorkHoursTemplate`, update `AttendanceShift`, update `ShiftAssignment` (tambah `isDefault`).

- [x] **Task 2.2** — Perbarui `getWorkingScheduleForDate` di:
  - `backend/src/domain/attendanceSchedule.ts`
  - `frontend/src/lib/attendance/scheduleShift.ts`

- [x] **Task 2.3** — Perbarui logika **Minggu opsional** di `attendanceCalculationService.ts` dan `attendanceSchedule.ts`:
  - `sundayWorkHoursId !== null` + ada tap → `isDayOff: false`, hitung normal (08:00 - 16:00)
  - `sundayWorkHoursId !== null` + tidak ada tap → `isDayOff: true` (libur, bukan ALPHA)
  - `sundayWorkHoursId === null` → `isDayOff: true`

- [x] **Task 2.4** — Tulis unit tests di `backend/src/domain/attendanceSchedule.test.ts` (7 passing tests)

- [x] **Task 2.5** — Verifikasi: `npx tsc --noEmit` di backend

---

## Phase 3: Backend Services & Workspace Commands

- [x] **Task 3.1** — Tambah command `case "work_hours"` di `backend/src/services/attendanceWorkspace.ts`:
  - `action: "create"` → insert `attendance_work_hours`
  - `action: "update"` → update by id
  - `action: "delete"` → cek FK constraint dan hapus

- [x] **Task 3.2** — Perbarui command `case "shift"`:
  - Simpan mapping per-hari `mondayWorkHoursId` s.d. `sundayWorkHoursId`
  - Auto-generate template dari legacy schedule jika dibuat dengan scheduleIn

- [x] **Task 3.3** — Perbarui command `case "assign_shift"`:
  - Multiple shift per departemen
  - Toggle `isDefault`
  - Cabut shift alternatif (`action: "remove"`)

- [x] **Task 3.4** — Jalankan integration test (11/11 passing tests)

---

## Phase 4: Frontend UI

- [x] **Task 4.1** — Buat tab "Master Jam Kerja" di `frontend/src/components/attendance/master/ShiftManagementPage.tsx`
  - Form modal lengkap dengan window scan masuk/pulang, toleransi keterlambatan/pulang cepat, warna, dan validasi.

- [x] **Task 4.2** — Perbarui modal Create/Edit Shift di `ShiftManagementPage.tsx`:
  - Tabel mapping 7 hari ke Master Jam Kerja
  - Info banner penjelasan aturan Minggu opsional (hadir dihitung sesuai jam minggu, tidak hadir libur).

- [x] **Task 4.3** — Perbarui tampilan Penugasan Departemen:
  - Dukungan multiple shift badges per departemen
  - Modal tambah shift ke departemen
  - Tombol set default dan hapus shift alternatif

- [x] **Task 4.4** — Sinkronisasi helper di `frontend/src/lib/attendance/scheduleShift.ts`

---

## Phase 5: Verification Loop & Git Commit

- [x] **Task 5.1** — Typecheck backend: `tsc` (0 errors)
- [x] **Task 5.2** — Typecheck frontend: `tsc --noEmit` (0 errors)
- [x] **Task 5.3** — Unit & integration tests (`npm test` backend & frontend unit tests pass)
- [x] **Task 5.4** — Linter frontend: `npm run lint` (0 errors)
- [ ] **Task 5.5** — Git commit atomic:
  ```bash
  git add -A
  git commit -m "feat(shift): implement work hours templates, per-day shift timetable, and multiple department shift assignments"
  ```

---

## Catatan Migrasi Data

> Untuk data shift yang sudah ada, diperlukan script migrasi data:
> 1. Buat `WorkHoursTemplate` default dari nilai `scheduleIn/Out` yang lama.
> 2. Assign template tersebut ke `mondayWorkHoursId` s.d. `fridayWorkHoursId`.
> 3. Jika `saturdayScheduleIn` terisi, buat template Sabtu dan assign ke `saturdayWorkHoursId`.
> 4. `sundayWorkHoursId = null` untuk semua shift lama (default: Minggu libur).
