ALTER TABLE "attendance_work_hours"
  ADD COLUMN IF NOT EXISTS "group_id" bigint REFERENCES "organization_groups"("id") ON DELETE RESTRICT;

ALTER TABLE "attendance_shifts"
  ADD COLUMN IF NOT EXISTS "group_id" bigint REFERENCES "organization_groups"("id") ON DELETE RESTRICT;

ALTER TABLE "attendance_shifts"
  DROP CONSTRAINT IF EXISTS "attendance_shifts_code_unique";

CREATE INDEX IF NOT EXISTS "attendance_work_hours_group_idx" ON "attendance_work_hours" ("group_id");
CREATE INDEX IF NOT EXISTS "attendance_shifts_group_idx" ON "attendance_shifts" ("group_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_attendance_shifts_group_code" ON "attendance_shifts" ("group_id", "code");

DO $$
DECLARE
  v_cmc_id bigint;
  v_mgm_id bigint;
  v_wh record;
  v_sh record;
  v_new_wh_id bigint;
  v_new_sh_id bigint;
BEGIN
  SELECT id INTO v_cmc_id FROM organization_groups WHERE code = 'CMC' LIMIT 1;
  IF v_cmc_id IS NULL THEN
    SELECT id INTO v_cmc_id FROM organization_groups ORDER BY id ASC LIMIT 1;
  END IF;
  SELECT id INTO v_mgm_id FROM organization_groups WHERE code = 'MGM' LIMIT 1;

  IF v_cmc_id IS NOT NULL THEN
    UPDATE attendance_work_hours SET group_id = v_cmc_id WHERE group_id IS NULL;
    UPDATE attendance_shifts SET group_id = v_cmc_id WHERE group_id IS NULL;

    IF v_mgm_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM attendance_shifts WHERE group_id = v_mgm_id) THEN
      CREATE TEMP TABLE tmp_wh_map (old_id bigint PRIMARY KEY, new_id bigint NOT NULL) ON COMMIT DROP;
      CREATE TEMP TABLE tmp_sh_map (old_id bigint PRIMARY KEY, new_id bigint NOT NULL) ON COMMIT DROP;

      FOR v_wh IN SELECT * FROM attendance_work_hours WHERE group_id = v_cmc_id ORDER BY id ASC LOOP
        INSERT INTO attendance_work_hours (
          group_id, name, color, schedule_in, schedule_out,
          scan_in_start, scan_in_end, scan_out_start, scan_out_end,
          late_tolerance_minutes, early_leave_tolerance_minutes,
          require_check_in, require_check_out, is_active, created_at, updated_at
        ) VALUES (
          v_mgm_id, v_wh.name, v_wh.color, v_wh.schedule_in, v_wh.schedule_out,
          v_wh.scan_in_start, v_wh.scan_in_end, v_wh.scan_out_start, v_wh.scan_out_end,
          v_wh.late_tolerance_minutes, v_wh.early_leave_tolerance_minutes,
          v_wh.require_check_in, v_wh.require_check_out, v_wh.is_active, v_wh.created_at, NOW()
        ) RETURNING id INTO v_new_wh_id;
        INSERT INTO tmp_wh_map (old_id, new_id) VALUES (v_wh.id, v_new_wh_id);
      END LOOP;

      FOR v_sh IN SELECT * FROM attendance_shifts WHERE group_id = v_cmc_id ORDER BY id ASC LOOP
        INSERT INTO attendance_shifts (
          group_id, code, name, description,
          monday_work_hours_id, tuesday_work_hours_id, wednesday_work_hours_id,
          thursday_work_hours_id, friday_work_hours_id, saturday_work_hours_id, sunday_work_hours_id,
          auto_approve_in, auto_approve_out, is_default, is_active, created_at, updated_at
        ) VALUES (
          v_mgm_id, v_sh.code, v_sh.name, v_sh.description,
          (SELECT new_id FROM tmp_wh_map WHERE old_id = v_sh.monday_work_hours_id),
          (SELECT new_id FROM tmp_wh_map WHERE old_id = v_sh.tuesday_work_hours_id),
          (SELECT new_id FROM tmp_wh_map WHERE old_id = v_sh.wednesday_work_hours_id),
          (SELECT new_id FROM tmp_wh_map WHERE old_id = v_sh.thursday_work_hours_id),
          (SELECT new_id FROM tmp_wh_map WHERE old_id = v_sh.friday_work_hours_id),
          (SELECT new_id FROM tmp_wh_map WHERE old_id = v_sh.saturday_work_hours_id),
          (SELECT new_id FROM tmp_wh_map WHERE old_id = v_sh.sunday_work_hours_id),
          v_sh.auto_approve_in, v_sh.auto_approve_out, v_sh.is_default, v_sh.is_active, v_sh.created_at, NOW()
        ) RETURNING id INTO v_new_sh_id;
        INSERT INTO tmp_sh_map (old_id, new_id) VALUES (v_sh.id, v_new_sh_id);
      END LOOP;

      UPDATE attendance_shift_assignments a
      SET shift_id = m.new_id, updated_at = NOW()
      FROM tmp_sh_map m, department_organization_mappings dom
      WHERE a.shift_id = m.old_id
        AND a.department_id = dom.department_id
        AND dom.group_id = v_mgm_id;

      UPDATE attendance_shift_assignments a
      SET shift_id = m.new_id, updated_at = NOW()
      FROM tmp_sh_map m, employees e, department_organization_mappings dom
      WHERE a.shift_id = m.old_id
        AND a.employee_id = e.id
        AND e.department_id = dom.department_id
        AND dom.group_id = v_mgm_id;
    END IF;
  END IF;
END $$;
