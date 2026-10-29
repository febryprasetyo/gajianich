-- Restore existing attendance devices to CMC organization group
UPDATE "attendance_devices"
SET "group_id" = (SELECT id FROM "organization_groups" WHERE code = 'CMC' LIMIT 1)
WHERE "group_id" IS NULL;
--> statement-breakpoint
-- Restore existing attendance device raw logs and sync logs to match device group
UPDATE "attendance_device_raw_logs"
SET "group_id" = (SELECT id FROM "organization_groups" WHERE code = 'CMC' LIMIT 1)
WHERE "group_id" IS NULL;
--> statement-breakpoint
UPDATE "attendance_device_sync_logs"
SET "group_id" = (SELECT id FROM "organization_groups" WHERE code = 'CMC' LIMIT 1)
WHERE "group_id" IS NULL;
--> statement-breakpoint
-- Restore existing attendance face requests to employee's organization group (or CMC by default)
UPDATE "attendance_face_requests" afr
SET "group_id" = COALESCE(
  (
    SELECT dom.group_id
    FROM "employees" e
    JOIN "department_organization_mappings" dom ON dom.department_id = e.department_id
    WHERE e.id = afr.employee_id
    LIMIT 1
  ),
  (SELECT id FROM "organization_groups" WHERE code = 'CMC' LIMIT 1)
)
WHERE afr.group_id IS NULL;
