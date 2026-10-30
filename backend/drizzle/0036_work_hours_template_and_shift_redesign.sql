-- Migration: 0036_work_hours_template_and_shift_redesign
-- Tujuan:
--   1. Buat tabel baru attendance_work_hours (Master Jam Kerja / template)
--   2. Tambah kolom FK per-hari ke attendance_shifts (ganti scheduleIn/Out lama)
--   3. Migrasi data shift lama → template jam kerja default
--   4. Ubah unique index attendance_shift_assignments: dept → (dept, shift)
--   5. Tambah kolom is_default ke attendance_shift_assignments

--> statement-breakpoint

-- =============================================================================
-- STEP 1: Buat tabel attendance_work_hours (Master Jam Kerja)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "attendance_work_hours" (
  "id"                          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "name"                        varchar(100) NOT NULL,
  "color"                       varchar(20),
  "schedule_in"                 varchar(5) NOT NULL,
  "schedule_out"                varchar(5) NOT NULL,
  "scan_in_start"               varchar(5) NOT NULL,
  "scan_in_end"                 varchar(5) NOT NULL,
  "scan_out_start"              varchar(5) NOT NULL,
  "scan_out_end"                varchar(5) NOT NULL,
  "late_tolerance_minutes"      integer NOT NULL DEFAULT 5,
  "early_leave_tolerance_minutes" integer NOT NULL DEFAULT 5,
  "require_check_in"            boolean NOT NULL DEFAULT true,
  "require_check_out"           boolean NOT NULL DEFAULT true,
  "is_active"                   boolean NOT NULL DEFAULT true,
  "created_at"                  timestamp NOT NULL DEFAULT now(),
  "updated_at"                  timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint

-- =============================================================================
-- STEP 2: Tambah kolom FK per-hari ke attendance_shifts & buat schedule lama nullable
-- =============================================================================
ALTER TABLE "attendance_shifts"
  ALTER COLUMN "schedule_in" DROP NOT NULL,
  ALTER COLUMN "schedule_out" DROP NOT NULL,
  ALTER COLUMN "work_days" DROP NOT NULL;

--> statement-breakpoint

ALTER TABLE "attendance_shifts"
  ADD COLUMN IF NOT EXISTS "monday_work_hours_id"    bigint REFERENCES "attendance_work_hours"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "tuesday_work_hours_id"   bigint REFERENCES "attendance_work_hours"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "wednesday_work_hours_id" bigint REFERENCES "attendance_work_hours"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "thursday_work_hours_id"  bigint REFERENCES "attendance_work_hours"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "friday_work_hours_id"    bigint REFERENCES "attendance_work_hours"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "saturday_work_hours_id"  bigint REFERENCES "attendance_work_hours"("id") ON DELETE SET NULL,
  -- Minggu selalu opsional: null/tidak tap = LIBUR, bukan ALPHA
  ADD COLUMN IF NOT EXISTS "sunday_work_hours_id"    bigint REFERENCES "attendance_work_hours"("id") ON DELETE SET NULL;

--> statement-breakpoint

-- =============================================================================
-- STEP 3: Migrasi data shift lama → template Jam Kerja
--   Setiap shift lama yang punya schedule_in/schedule_out dibuatkan template
--   Jam Kerja default, lalu FK hari Senin-Jumat di-point ke template tsb.
--   Sabtu dibuat template terpisah jika saturday_schedule_in terisi.
-- =============================================================================
DO $$
DECLARE
  r RECORD;
  wh_id bigint;
  sat_wh_id bigint;
  -- Window scan default: 2 jam sebelum s.d. 2 jam setelah jam masuk/pulang
  v_scan_in_start  varchar(5);
  v_scan_in_end    varchar(5);
  v_scan_out_start varchar(5);
  v_scan_out_end   varchar(5);
BEGIN
  FOR r IN SELECT * FROM attendance_shifts WHERE schedule_in IS NOT NULL LOOP

    -- Hitung window scan default (±2 jam dari jam resmi)
    v_scan_in_start  := to_char((r.schedule_in::time  - interval '2 hours'), 'HH24:MI');
    v_scan_in_end    := to_char((r.schedule_in::time  + interval '2 hours'), 'HH24:MI');
    v_scan_out_start := to_char((r.schedule_out::time - interval '2 hours'), 'HH24:MI');
    v_scan_out_end   := to_char((r.schedule_out::time + interval '2 hours'), 'HH24:MI');

    -- Buat template Jam Kerja dari jadwal reguler
    INSERT INTO attendance_work_hours (
      name, schedule_in, schedule_out,
      scan_in_start, scan_in_end, scan_out_start, scan_out_end
    )
    VALUES (
      r.name || ' - Reguler',
      r.schedule_in, r.schedule_out,
      v_scan_in_start, v_scan_in_end, v_scan_out_start, v_scan_out_end
    )
    RETURNING id INTO wh_id;

    -- Assign ke hari Senin - Jumat (work_days >= 5)
    UPDATE attendance_shifts SET
      monday_work_hours_id    = wh_id,
      tuesday_work_hours_id   = wh_id,
      wednesday_work_hours_id = wh_id,
      thursday_work_hours_id  = wh_id,
      friday_work_hours_id    = wh_id
    WHERE id = r.id;

    -- Jika shift 6 hari (work_days >= 6): buat template Sabtu
    IF r.work_days >= 6 AND r.saturday_schedule_in IS NOT NULL THEN
      v_scan_in_start  := to_char((r.saturday_schedule_in::time  - interval '2 hours'), 'HH24:MI');
      v_scan_in_end    := to_char((r.saturday_schedule_in::time  + interval '2 hours'), 'HH24:MI');
      v_scan_out_start := to_char((r.saturday_schedule_out::time - interval '2 hours'), 'HH24:MI');
      v_scan_out_end   := to_char((r.saturday_schedule_out::time + interval '2 hours'), 'HH24:MI');

      INSERT INTO attendance_work_hours (
        name, schedule_in, schedule_out,
        scan_in_start, scan_in_end, scan_out_start, scan_out_end
      )
      VALUES (
        r.name || ' - Sabtu',
        r.saturday_schedule_in, r.saturday_schedule_out,
        v_scan_in_start, v_scan_in_end, v_scan_out_start, v_scan_out_end
      )
      RETURNING id INTO sat_wh_id;

      UPDATE attendance_shifts SET saturday_work_hours_id = sat_wh_id WHERE id = r.id;
    END IF;

  END LOOP;
END;
$$;

--> statement-breakpoint

-- =============================================================================
-- STEP 4: Ubah unique index attendance_shift_assignments
--   Dari: uq_shift_assignment_department (hanya departmentId)
--   Menjadi: uq_shift_assignment_dept_shift (departmentId + shiftId)
--   → Satu departemen bisa punya banyak shift
-- =============================================================================
DROP INDEX IF EXISTS "uq_shift_assignment_department";

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_shift_assignment_dept_shift"
  ON "attendance_shift_assignments"("department_id", "shift_id");

--> statement-breakpoint

-- =============================================================================
-- STEP 5: Tambah kolom is_default ke attendance_shift_assignments
--   Shift pertama per departemen secara default menjadi is_default = true
-- =============================================================================
ALTER TABLE "attendance_shift_assignments"
  ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false;

--> statement-breakpoint

-- Set is_default = true untuk satu shift per departemen yang sudah ada
UPDATE "attendance_shift_assignments" asa
SET is_default = true
WHERE id IN (
  SELECT DISTINCT ON (department_id) id
  FROM attendance_shift_assignments
  WHERE department_id IS NOT NULL
  ORDER BY department_id, id ASC
);

--> statement-breakpoint

-- =============================================================================
-- CATATAN: Kolom lama (schedule_in, schedule_out, work_days,
-- saturday_schedule_in, saturday_schedule_out) dipertahankan sementara
-- untuk kompatibilitas backward — akan di-drop di migrasi berikutnya
-- setelah semua query/service diperbarui.
-- =============================================================================

