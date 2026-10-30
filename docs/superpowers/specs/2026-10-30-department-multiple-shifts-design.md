# Design Spec: Multiple Shift per Departemen & Jadwal Per-Hari (Jam Kerja Template)

> **Revisi:** 2026-10-30 — Arsitektur diubah dari pendekatan kolom per-hari menjadi arsitektur dua-lapis **Jam Kerja (template) + Shift (mapping hari)**, mengikuti referensi sistem HRIS produksi.

---

## 1. Summary & Problem Statement

Dalam operasional perusahaan (khususnya departemen produksi), kebutuhan jadwal kerja memiliki variasi jam dan hari yang berbeda:

- Karyawan Departemen Produksi memiliki jadwal standar **Senin–Jumat 08:00–16:00** dan **Sabtu 08:00–13:00**.
- Ketika produksi meningkat, karyawan **dapat masuk Minggu** dengan jam kerja **08:00–16:00** — namun jika tidak masuk, **tidak dihitung ALPHA** (hari libur opsional).
- Setiap jam kerja memiliki **window scan** (kapan tap masuk/pulang diterima sistem) dan **toleransi** keterlambatan/pulang cepat.

**Masalah sistem saat ini:**
- Hanya mendukung satu konfigurasi jam per shift (tanpa window scan, tanpa per-hari).
- Unique index `uq_shift_assignment_department` mengunci 1 shift per departemen.
- Hari Minggu di-hardcode `isDayOff: true` tanpa bisa dikonfigurasi.

---

## 2. Goals & Non-Goals

### Goals

- **Master Jam Kerja (`attendance_work_hours`)**: Tabel template independen berisi jam masuk, jam pulang, window scan masuk/pulang, toleransi terlambat & pulang cepat, warna, label.
- **Shift sebagai Mapping Hari (`attendance_shifts`)**: Shift tidak lagi menyimpan jam — melainkan **me-link setiap hari dalam seminggu ke satu template Jam Kerja** (atau `null` = hari libur).
- **Hari Minggu Opsional**: Jika Shift meng-assign Jam Kerja ke Minggu (`sundayWorkHoursId` ≠ null) dan karyawan **tap masuk** → dihitung sesuai jadwal. Jika **tidak tap** → hari libur (bukan ALPHA).
- **Multiple Shift per Departemen**: Satu departemen dapat memiliki beberapa shift (misal: Shift Reguler dan Shift Lembur Minggu), dengan penanda `isDefault`.
- **UI Master Jam Kerja**: CRUD template jam kerja dengan form window scan.
- **UI Master Shift**: Mapping per-hari ke template jam kerja (visual timeline opsional).

### Non-Goals

- Mengubah formula lembur Depnaker — tetap diproses di payroll engine.
- Menghapus prioritas penugasan shift langsung per karyawan.
- Mengubah mekanisme perhitungan payroll.
- Menjadikan hari Minggu sebagai hari kerja **wajib** — Minggu selalu bersifat opsional (tap-driven).

### Keputusan Desain (Dikunci)

> **Hari Minggu selalu opsional by design.** Meskipun `sundayWorkHoursId` di-assign ke shift, tidak ada tap di hari Minggu = **LIBUR** (bukan ALPHA). Tidak diperlukan flag `isMandatory` — aturan ini berlaku untuk semua karyawan dan departemen.

| Hari | Di-assign Jam Kerja | Tidak Tap | Status |
|------|--------------------:|-----------|--------|
| Senin–Jumat | ✅ Ya | ❌ Tidak hadir | **ALPHA** |
| Sabtu | ✅ Ya | ❌ Tidak hadir | **ALPHA** |
| Minggu | ✅ Ya | ❌ Tidak hadir | **LIBUR** (bukan ALPHA) |

---

## 3. Data Model & Schema Diffs

### A. Tabel Baru: `attendance_work_hours` (Master Jam Kerja)

```sql
CREATE TABLE attendance_work_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id),
  name        VARCHAR(100) NOT NULL,           -- e.g. "Daytime", "Sabtu Pendek", "Minggu Penuh"
  color       VARCHAR(20),                     -- Warna untuk visualisasi timeline
  schedule_in  VARCHAR(5) NOT NULL,            -- Jam masuk, format HH:mm, e.g. "08:00"
  schedule_out VARCHAR(5) NOT NULL,            -- Jam pulang, format HH:mm, e.g. "16:00"
  scan_in_start  VARCHAR(5) NOT NULL,          -- Jam mulai scan masuk, e.g. "06:30"
  scan_in_end    VARCHAR(5) NOT NULL,          -- Jam akhir scan masuk, e.g. "11:30"
  scan_out_start VARCHAR(5) NOT NULL,          -- Jam mulai scan pulang, e.g. "14:30"
  scan_out_end   VARCHAR(5) NOT NULL,          -- Jam akhir scan pulang, e.g. "23:30"
  late_tolerance_minutes        INTEGER NOT NULL DEFAULT 5,
  early_leave_tolerance_minutes INTEGER NOT NULL DEFAULT 5,
  require_check_in  BOOLEAN NOT NULL DEFAULT TRUE,
  require_check_out BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT now(),
  updated_at  TIMESTAMP DEFAULT now()
);
```

### B. Tabel `attendance_shifts` (Diubah Total)

Dari: menyimpan jam langsung per shift.
Menjadi: mapping hari-dalam-seminggu → FK ke `attendance_work_hours`.

```sql
-- Kolom-kolom yang DIHAPUS:
--   schedule_in, schedule_out
--   saturday_schedule_in, saturday_schedule_out
--   work_days

-- Kolom-kolom yang DITAMBAHKAN (FK nullable = hari libur):
ALTER TABLE attendance_shifts
  ADD COLUMN monday_work_hours_id    UUID REFERENCES attendance_work_hours(id),
  ADD COLUMN tuesday_work_hours_id   UUID REFERENCES attendance_work_hours(id),
  ADD COLUMN wednesday_work_hours_id UUID REFERENCES attendance_work_hours(id),
  ADD COLUMN thursday_work_hours_id  UUID REFERENCES attendance_work_hours(id),
  ADD COLUMN friday_work_hours_id    UUID REFERENCES attendance_work_hours(id),
  ADD COLUMN saturday_work_hours_id  UUID REFERENCES attendance_work_hours(id),  -- null = Sabtu libur
  ADD COLUMN sunday_work_hours_id    UUID REFERENCES attendance_work_hours(id);   -- null = Minggu libur opsional
```

**Semantik kolom per-hari:**
- `*_work_hours_id = null` → hari tersebut adalah **hari libur** (tidak ALPHA jika tidak hadir).
- `*_work_hours_id = <uuid>` → hari tersebut **aktif**; jam kerja mengikuti template Jam Kerja yang di-link.
- Untuk **Minggu opsional** (masuk boleh, tidak masuk = libur): set `sunday_work_hours_id` ke template "Minggu Penuh". Logika resolusi mendeteksi kehadiran tap sebelum menetapkan status.

### C. Tabel `attendance_shift_assignments` (Diperbarui)

```sql
-- Ubah unique index dari per-departemen menjadi per-kombinasi departemen+shift:
DROP INDEX uq_shift_assignment_department;
CREATE UNIQUE INDEX uq_shift_assignment_dept_shift
  ON attendance_shift_assignments(department_id, shift_id);

-- Tambah kolom penanda shift utama:
ALTER TABLE attendance_shift_assignments
  ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;
```

### D. Contoh Data Nyata (Departemen Produksi)

**Master Jam Kerja:**

| Nama | Jam Masuk | Jam Pulang | Scan Masuk | Scan Pulang | Tol. Lmbt | Tol. Cpt |
|------|-----------|------------|-----------|-------------|-----------|----------|
| Reguler Produksi | 08:00 | 16:00 | 06:00–10:30 | 14:00–20:00 | 5 mnt | 5 mnt |
| Sabtu Pendek | 08:00 | 13:00 | 06:00–10:30 | 11:00–16:00 | 5 mnt | 5 mnt |
| Minggu Penuh | 08:00 | 16:00 | 06:00–10:30 | 14:00–20:00 | 5 mnt | 5 mnt |

**Shift "Produksi Reguler":**

| Hari | Jam Kerja |
|------|-----------|
| Senin | Reguler Produksi |
| Selasa | Reguler Produksi |
| Rabu | Reguler Produksi |
| Kamis | Reguler Produksi |
| Jumat | Reguler Produksi |
| Sabtu | Sabtu Pendek |
| Minggu | Minggu Penuh *(null jika tidak ada produksi Minggu)* |

### E. File Migrasi Drizzle

- `backend/drizzle/0036_work_hours_template_and_shift_redesign.sql`

---

## 4. API & Business Logic Specifications

### A. Resolusi Jadwal Harian (`getWorkingScheduleForDate`)

```ts
function getWorkingScheduleForDate(shift: AttendanceShift, workDate: Date): DaySchedule {
  const dayOfWeek = workDate.getUTCDay(); // 0=Minggu, 1=Senin, ..., 6=Sabtu
  const dayMap: Record<number, string | null> = {
    0: shift.sundayWorkHoursId,
    1: shift.mondayWorkHoursId,
    2: shift.tuesdayWorkHoursId,
    3: shift.wednesdayWorkHoursId,
    4: shift.thursdayWorkHoursId,
    5: shift.fridayWorkHoursId,
    6: shift.saturdayWorkHoursId,
  };

  const workHoursId = dayMap[dayOfWeek];

  if (!workHoursId) {
    return { isDayOff: true };
  }

  const wh = await db.query.attendanceWorkHours.findFirst({ where: eq(id, workHoursId) });

  return {
    isDayOff: false,
    scheduleIn:    wh.scheduleIn,
    scheduleOut:   wh.scheduleOut,
    scanInStart:   wh.scanInStart,
    scanInEnd:     wh.scanInEnd,
    scanOutStart:  wh.scanOutStart,
    scanOutEnd:    wh.scanOutEnd,
    lateToleranceMinutes:       wh.lateToleranceMinutes,
    earlyLeaveToleranceMinutes: wh.earlyLeaveToleranceMinutes,
    requireCheckIn:  wh.requireCheckIn,
    requireCheckOut: wh.requireCheckOut,
  };
}
```

**Logika Minggu Opsional (tap-driven):**
```ts
// sundayWorkHoursId terisi + ada rekaman tap → isDayOff: false, hitung normal
// sundayWorkHoursId terisi + TIDAK ada tap  → isDayOff: true (LIBUR, bukan ALPHA)
// sundayWorkHoursId null                    → isDayOff: true (LIBUR, bukan ALPHA)
```

### B. Validasi Window Scan

```ts
function isWithinScanWindow(tapTime: string, start: string, end: string): boolean {
  return tapTime >= start && tapTime <= end;
}

// Tap masuk diterima: scanInStart <= tapIn <= scanInEnd
// Tap pulang diterima: scanOutStart <= tapOut <= scanOutEnd
```

### C. Resolusi Shift Departemen (`resolveActiveEmployeeShift`)

Prioritas tetap:
1. Penugasan langsung karyawan (`employeeId`)
2. Penugasan departemen (`isDefault: true` → fallback ke shift pertama)
3. Shift default sistem
4. Fallback shift reguler (`code: 'OFFICE'`)

> Dengan arsitektur baru, tidak perlu logika khusus "cari shift dengan jadwal Minggu" — resolusi shift sudah generik; hari Minggu ditangani oleh `sundayWorkHoursId` dalam shift yang terpilih.

### D. Workspace Commands (`attendanceWorkspace.ts`)

| Command | Perubahan |
|---------|-----------|
| `case "work_hours"` | **BARU** — CRUD master Jam Kerja |
| `case "shift"` | **DIPERBARUI** — simpan mapping `mondayWorkHoursId` s.d. `sundayWorkHoursId` (bukan jam langsung) |
| `case "assign_shift"` | **DIPERBARUI** — mendukung multiple shift per departemen + toggle `isDefault` |

---

## 5. Frontend UI/UX (Design System Baku GAJIANICH)

### 5A. Tab Baru: Master Jam Kerja

Komponen sesuai standar:
- **`PageHeader`**: Ikon emerald + "Master Jam Kerja" + subjudul + tombol "+ Tambah Jam Kerja"
- **`KpiGrid`**: Total template, jumlah shift yang menggunakan setiap template
- **`FilterToolbar`**: Search by nama
- **`TableShell`** kolom:

  | Nama | Jam Masuk | Jam Pulang | Window Scan Masuk | Window Scan Pulang | Tol. | Warna | Aksi |

- **`ModalShell` Create/Edit** field:
  - Nama Jam Kerja
  - Jam Masuk / Jam Pulang
  - Jam Mulai Scan Masuk / Jam Akhir Scan Masuk
  - Jam Mulai Scan Pulang / Jam Akhir Scan Pulang
  - Toleransi Terlambat (menit)
  - Toleransi Pulang Cepat (menit)
  - Warna (color swatch picker)
  - Toggle: Harus C/In & Harus C/Out

### 5B. Form Shift — Mapping Per-Hari

Form shift menampilkan tabel mapping 7 hari:

```
Nama Shift: [_________________]

┌─────────┬───────────────────────────────────┐
│ Hari    │ Jam Kerja                         │
├─────────┼───────────────────────────────────┤
│ Senin   │ [Reguler Produksi        ▼]       │
│ Selasa  │ [Reguler Produksi        ▼]       │
│ Rabu    │ [Reguler Produksi        ▼]       │
│ Kamis   │ [Reguler Produksi        ▼]       │
│ Jumat   │ [Reguler Produksi        ▼]       │
│ Sabtu   │ [Sabtu Pendek            ▼]       │
│ Minggu  │ [— Libur (opsional) —    ▼]       │
└─────────┴───────────────────────────────────┘
```

Setiap dropdown: semua template Jam Kerja + opsi **"— Libur —"** (null).  
Preview ringkas jam masuk-pulang tampil di samping dropdown setelah dipilih.

### 5C. Tab Penugasan Departemen

Badge pill setiap shift yang terhubung ke departemen, dengan indikator `Default`.  
Tombol "+ Tambah Shift Alternatif" dan aksi hapus per shift.

---

## 6. Security & Integrity Checklist

- Akses mutasi: `requirePermission('attendance.manage')` + `requireOrganizationScope('hr', 'write')`.
- Audit trail append-only (`appendHrAudit`) setiap perubahan master Jam Kerja, Shift, dan penugasan.
- Validasi Zod:
  - Format `HH:mm` wajib untuk semua field jam.
  - `scanInStart < scheduleIn` dan `scheduleOut < scanOutEnd`.
  - `scanInStart < scanInEnd` dan `scanOutStart < scanOutEnd`.
- FK constraint: `*_work_hours_id` harus berada dalam `org_id` yang sama.
- Error message ke client bersih dari stack trace internal.
