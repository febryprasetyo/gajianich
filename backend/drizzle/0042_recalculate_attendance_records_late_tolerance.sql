-- Recalculate historical attendance_records late_minutes and attendance_status using 5-minute tolerance and grace deduction
-- Reference: docs/superpowers/specs/2026-11-03-late-tolerance-calculation-design.md
UPDATE attendance_records
SET 
  late_minutes = GREATEST(0, (split_part(scan_in, ':', 1)::int * 60 + split_part(scan_in, ':', 2)::int) - (split_part(schedule_in, ':', 1)::int * 60 + split_part(schedule_in, ':', 2)::int + 5)),
  attendance_status = CASE 
    WHEN GREATEST(0, (split_part(scan_in, ':', 1)::int * 60 + split_part(scan_in, ':', 2)::int) - (split_part(schedule_in, ':', 1)::int * 60 + split_part(schedule_in, ':', 2)::int + 5)) = 0 AND attendance_status = 'LATE' THEN 'PRESENT'
    ELSE attendance_status
  END,
  updated_at = NOW()
WHERE scan_in IS NOT NULL 
  AND scan_in ~ '^[0-9]{2}:[0-9]{2}'
  AND schedule_in IS NOT NULL 
  AND schedule_in ~ '^[0-9]{2}:[0-9]{2}'
  AND is_day_off = false
  AND attendance_status IN ('PRESENT', 'LATE');
