-- Migration: 0037_default_all_departments_office_shift
-- Tujuan:
--   1. Pastikan template Jam Kerja "Office Reguler" (08:00 - 17:00) tersedia
--   2. Pastikan Master Shift "OFFICE" (Senin - Jumat 08:00 - 17:00, Sabtu-Minggu Libur) aktif sebagai default
--   3. Daftarkan secara default SEMUA departemen menggunakan shift OFFICE sebagai shift utama (is_default = true)

--> statement-breakpoint

DO $$
DECLARE
  v_wh_id bigint;
  v_office_shift_id bigint;
  d RECORD;
BEGIN
  -- Lewati jika tabel departments masih kosong (misal saat inisialisasi fresh database/test harness)
  IF NOT EXISTS (SELECT 1 FROM departments) THEN
    RETURN;
  END IF;

  -- 1. Temukan atau buat template Jam Kerja Office (08:00 - 17:00)
  SELECT id INTO v_wh_id
  FROM attendance_work_hours
  WHERE schedule_in = '08:00' AND schedule_out = '17:00'
  ORDER BY id ASC
  LIMIT 1;

  IF v_wh_id IS NULL THEN
    INSERT INTO attendance_work_hours (
      name, color,
      schedule_in, schedule_out,
      scan_in_start, scan_in_end,
      scan_out_start, scan_out_end,
      late_tolerance_minutes, early_leave_tolerance_minutes,
      require_check_in, require_check_out, is_active
    ) VALUES (
      'Office Reguler', '#059669',
      '08:00', '17:00',
      '06:00', '10:00',
      '15:00', '20:00',
      5, 5,
      true, true, true
    )
    RETURNING id INTO v_wh_id;
  END IF;

  -- 2. Temukan atau buat Shift OFFICE (Senin - Jumat 08:00 - 17:00, Sabtu & Minggu Libur)
  SELECT id INTO v_office_shift_id
  FROM attendance_shifts
  WHERE code = 'OFFICE'
  LIMIT 1;

  IF v_office_shift_id IS NULL THEN
    INSERT INTO attendance_shifts (
      code, name, description,
      monday_work_hours_id, tuesday_work_hours_id, wednesday_work_hours_id,
      thursday_work_hours_id, friday_work_hours_id,
      saturday_work_hours_id, sunday_work_hours_id,
      is_default, is_active
    ) VALUES (
      'OFFICE', 'Office Reguler (Default)', 'Senin - Jumat 08:00 - 17:00 (Sabtu & Minggu Libur)',
      v_wh_id, v_wh_id, v_wh_id, v_wh_id, v_wh_id,
      null, null,
      true, true
    )
    RETURNING id INTO v_office_shift_id;
  ELSE
    -- Pastikan shift OFFICE terhubung ke template 08:00 - 17:00 Senin - Jumat, Sabtu & Minggu Libur, dan is_default = true
    UPDATE attendance_shifts SET
      name = 'Office Reguler (Default)',
      description = 'Senin - Jumat 08:00 - 17:00 (Sabtu & Minggu Libur)',
      monday_work_hours_id = v_wh_id,
      tuesday_work_hours_id = v_wh_id,
      wednesday_work_hours_id = v_wh_id,
      thursday_work_hours_id = v_wh_id,
      friday_work_hours_id = v_wh_id,
      saturday_work_hours_id = null,
      sunday_work_hours_id = null,
      is_default = true,
      is_active = true,
      updated_at = now()
    WHERE id = v_office_shift_id;
  END IF;

  -- Set shift lain menjadi is_default = false
  UPDATE attendance_shifts SET is_default = false WHERE id != v_office_shift_id;

  -- 3. Tugaskan secara default SEMUA departemen menggunakan shift OFFICE
  FOR d IN SELECT id FROM departments LOOP
    -- Unset default lama di departemen ini jika ada
    UPDATE attendance_shift_assignments
    SET is_default = false, updated_at = now()
    WHERE department_id = d.id AND shift_id != v_office_shift_id;

    -- Insert atau update penugasan shift OFFICE sebagai is_default = true
    IF EXISTS (
      SELECT 1 FROM attendance_shift_assignments
      WHERE department_id = d.id AND shift_id = v_office_shift_id
    ) THEN
      UPDATE attendance_shift_assignments
      SET is_default = true, updated_at = now()
      WHERE department_id = d.id AND shift_id = v_office_shift_id;
    ELSE
      INSERT INTO attendance_shift_assignments (
        department_id, shift_id, is_default, created_at, updated_at
      ) VALUES (
        d.id, v_office_shift_id, true, now(), now()
      );
    END IF;
  END LOOP;

END;
$$;
