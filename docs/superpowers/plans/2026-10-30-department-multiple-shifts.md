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

- [ ] **Task 1.1** — Buat tabel `attendance_work_hours` di `backend/src/db/schema/attendanceWorkspace.ts`  
  Field: `id`, `orgId`, `name`, `color`, `scheduleIn`, `scheduleOut`, `scanInStart`, `scanInEnd`, `scanOutStart`, `scanOutEnd`, `lateToleranceMinutes`, `earlyLeaveToleranceMinutes`, `requireCheckIn`, `requireCheckOut`, `createdAt`, `updatedAt`

- [ ] **Task 1.2** — Perbarui tabel `attendanceShifts` di schema:
  - **Hapus** kolom: `scheduleIn`, `scheduleOut`, `saturdayScheduleIn`, `saturdayScheduleOut`, `workDays`
  - **Tambah** kolom FK (nullable): `mondayWorkHoursId`, `tuesdayWorkHoursId`, `wednesdayWorkHoursId`, `thursdayWorkHoursId`, `fridayWorkHoursId`, `saturdayWorkHoursId`, `sundayWorkHoursId`

- [ ] **Task 1.3** — Perbarui tabel `attendanceShiftAssignments`:
  - Ubah unique index dari `(departmentId)` menjadi `(departmentId, shiftId)`
  - Tambah kolom `isDefault: boolean().default(false).notNull()`

- [ ] **Task 1.4** — Buat file migrasi SQL:  
  `backend/drizzle/0036_work_hours_template_and_shift_redesign.sql`  
  Sertakan:
  - `CREATE TABLE attendance_work_hours ...`
  - `ALTER TABLE attendance_shifts DROP COLUMN ...`
  - `ALTER TABLE attendance_shifts ADD COLUMN monday_work_hours_id UUID REFERENCES ...`
  - (x7 per hari)
  - `DROP INDEX uq_shift_assignment_department; CREATE UNIQUE INDEX ...`
  - `ALTER TABLE attendance_shift_assignments ADD COLUMN is_default ...`

- [ ] **Task 1.5** — Daftarkan migrasi di `backend/drizzle/meta/_journal.json`

- [ ] **Task 1.6** — Jalankan migrasi dan verifikasi struktur tabel di PostgreSQL
  ```bash
  cd backend && npx drizzle-kit migrate
  ```

---

## Phase 2: Domain Types & Logika Resolusi Shift

- [ ] **Task 2.1** — Perbarui interface di:
  - `backend/src/domain/attendanceTypes.ts`
  - `frontend/src/lib/attendance/types.ts`
  
  Tambah `WorkHoursTemplate`, update `AttendanceShift`, update `ShiftAssignment` (tambah `isDefault`).

- [ ] **Task 2.2** — Perbarui `getWorkingScheduleForDate` di:
  - `backend/src/domain/attendanceSchedule.ts`
  - `frontend/src/lib/attendance/scheduleShift.ts`
  
  Implementasi:
  ```ts
  const dayMap = { 0: shift.sundayWorkHoursId, 1: shift.mondayWorkHoursId, ... 6: shift.saturdayWorkHoursId }
  const whId = dayMap[workDate.getUTCDay()]
  if (!whId) return { isDayOff: true }
  // fetch template, return schedule
  ```

- [ ] **Task 2.3** — Perbarui logika **Minggu opsional** di `attendanceCalculationService.ts`:
  - `sundayWorkHoursId !== null` + ada tap → `isDayOff: false`, hitung normal
  - `sundayWorkHoursId !== null` + tidak ada tap → `isDayOff: true` (libur, bukan ALPHA)
  - `sundayWorkHoursId === null` → `isDayOff: true`

- [ ] **Task 2.4** — Tulis unit tests di `backend/src/domain/attendanceSchedule.test.ts`:
  ```
  ✓ Senin dengan Reguler Produksi → scheduleIn: "08:00", scheduleOut: "16:00"
  ✓ Sabtu dengan Sabtu Pendek → scheduleIn: "08:00", scheduleOut: "13:00"
  ✓ Minggu dengan Minggu Penuh + ada tap → isDayOff: false, scheduleIn: "08:00"
  ✓ Minggu dengan Minggu Penuh + tidak ada tap → isDayOff: true
  ✓ Minggu dengan sundayWorkHoursId: null → isDayOff: true
  ✓ Tap masuk dalam window scan → valid
  ✓ Tap masuk di luar window scan → invalid/rejected
  ```

- [ ] **Task 2.5** — Verifikasi: `npx tsc --noEmit` di backend

---

## Phase 3: Backend Services & Workspace Commands

- [ ] **Task 3.1** — Tambah command `case "work_hours"` di `backend/src/services/attendanceWorkspace.ts`:
  - `action: "create"` → insert `attendance_work_hours`
  - `action: "update"` → update by id + orgId
  - `action: "delete"` → soft delete / hard delete dengan cek FK constraint
  - `action: "list"` → query by orgId

- [ ] **Task 3.2** — Perbarui command `case "shift"`:
  - Baca dan simpan `mondayWorkHoursId` s.d. `sundayWorkHoursId` (bukan jam langsung)
  - Validasi Zod: semua FK harus `uuid` atau `null`

- [ ] **Task 3.3** — Perbarui command `case "assign_shift"`:
  - `action: "add"` → insert `attendance_shift_assignments` dengan `isDefault`
  - `action: "set_default"` → toggle `isDefault` (unset lainnya di departemen yang sama)
  - `action: "remove"` → delete by `departmentId + shiftId`

- [ ] **Task 3.4** — Jalankan integration test:
  ```bash
  npm test -- --testPathPattern=attendanceWorkspace.integration
  ```

---

## Phase 4: Frontend UI

### 4A. Master Jam Kerja (Tab Baru di ShiftManagementPage)

- [ ] **Task 4.1** — Buat komponen tab "Jam Kerja" di `frontend/src/components/attendance/master/ShiftManagementPage.tsx`
  - `WorkHoursTab.tsx`: TableShell + FilterToolbar + KpiGrid (total template)
  - `WorkHoursModal.tsx`: ModalShell dengan semua field (jam masuk, jam pulang, window scan, toleransi, warna, toggle)
  - Row action: Edit (ikon `Edit`) + Hapus (ikon `Trash2`, konfirmasi `ConfirmDeleteModal`)

### 4B. Form Shift — Mapping Per-Hari

- [ ] **Task 4.2** — Perbarui modal Create/Edit Shift di `ShiftManagementPage.tsx`:
  - Ganti input jam langsung dengan **tabel mapping 7 hari**
  - Setiap baris: label hari + dropdown (options: semua `WorkHoursTemplate` + "— Libur —")
  - Preview jam masuk-pulang tampil di samping dropdown setelah dipilih

### 4C. Tab Penugasan Departemen

- [ ] **Task 4.3** — Perbarui tampilan Penugasan Departemen:
  - Badge pill per shift yang terhubung + indikator `Default`
  - Tombol `+ Tambah Shift` → modal pilih shift + set sebagai default
  - Tombol hapus per shift (`RowActionButton` dengan ikon `Trash2`)

### 4D. Mobile Beranda

- [ ] **Task 4.4** — Perbarui `frontend/src/app/m/beranda/page.tsx`:
  - Tampilkan jam berdasarkan template Jam Kerja yang aktif pada hari ini
  - Untuk Minggu: tampilkan jam Minggu jika `sundayWorkHoursId` terisi

---

## Phase 5: Verification Loop & Git Commit

- [ ] **Task 5.1** — Typecheck backend:
  ```bash
  cd backend && npx tsc --noEmit
  ```

- [ ] **Task 5.2** — Typecheck frontend:
  ```bash
  cd frontend && npx tsc --noEmit
  ```

- [ ] **Task 5.3** — Unit & integration tests:
  ```bash
  cd backend && npm test
  ```

- [ ] **Task 5.4** — Linter frontend:
  ```bash
  cd frontend && npm run lint
  ```

- [ ] **Task 5.5** — Git commit atomic:
  ```bash
  git add -A
  git commit -m "feat(shift): redesign shift to use work-hours templates with per-day mapping and sunday optional support"
  ```

---

## Catatan Migrasi Data

> Untuk data shift yang sudah ada, diperlukan script migrasi data:
> 1. Buat `WorkHoursTemplate` default dari nilai `scheduleIn/Out` yang lama.
> 2. Assign template tersebut ke `mondayWorkHoursId` s.d. `fridayWorkHoursId`.
> 3. Jika `saturdayScheduleIn` terisi, buat template Sabtu dan assign ke `saturdayWorkHoursId`.
> 4. `sundayWorkHoursId = null` untuk semua shift lama (default: Minggu libur).
