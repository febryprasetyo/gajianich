-- Align attendance_device_raw_logs group_id to employee's department group if known
UPDATE "attendance_device_raw_logs" adrl
SET "group_id" = dom.group_id
FROM "employees" e
JOIN "department_organization_mappings" dom ON dom.department_id = e.department_id
WHERE adrl.employee_id = e.id AND (adrl.group_id IS NULL OR adrl.group_id != dom.group_id);
