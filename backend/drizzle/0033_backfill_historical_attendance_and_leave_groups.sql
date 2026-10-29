-- Backfill historical attendance batches to CMC (default corporate ingestion)
UPDATE "attendance_batches"
SET "group_id" = (SELECT id FROM "organization_groups" WHERE code = 'CMC' LIMIT 1)
WHERE "group_id" IS NULL;
--> statement-breakpoint
-- Backfill mobile attendance self logs to employee's department group
UPDATE "attendance_self_logs" asl
SET "group_id" = COALESCE(
  (
    SELECT dom.group_id
    FROM "employees" e
    JOIN "department_organization_mappings" dom ON dom.department_id = e.department_id
    WHERE e.id = asl.employee_id
    LIMIT 1
  ),
  (SELECT id FROM "organization_groups" WHERE code = 'CMC' LIMIT 1)
)
WHERE asl.group_id IS NULL;
--> statement-breakpoint
-- Backfill historical attendance records based on employee's mapped group
UPDATE "attendance_records" ar
SET "group_id" = dom.group_id
FROM "employees" e
JOIN "department_organization_mappings" dom ON dom.department_id = e.department_id
WHERE e.id = ar.employee_id AND ar.group_id IS NULL;
--> statement-breakpoint
-- Backfill leave requests based on employee's mapped group
UPDATE "leave_requests" lr
SET "group_id" = dom.group_id
FROM "employees" e
JOIN "department_organization_mappings" dom ON dom.department_id = e.department_id
WHERE e.id = lr.employee_id AND lr.group_id IS NULL;
--> statement-breakpoint
-- Backfill leave balances based on employee's mapped group
UPDATE "leave_balances" lb
SET "group_id" = dom.group_id
FROM "employees" e
JOIN "department_organization_mappings" dom ON dom.department_id = e.department_id
WHERE e.id = lb.employee_id AND lb.group_id IS NULL;
