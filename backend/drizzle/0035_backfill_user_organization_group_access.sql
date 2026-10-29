-- Backfill user_organization_group_access for existing user accounts linked to employees
INSERT INTO "user_organization_group_access" ("user_id", "group_id")
SELECT DISTINCT u.id, m.group_id
FROM "users" u
JOIN "employees" e ON e.id = u.employee_id
JOIN "department_organization_mappings" m ON m.department_id = e.department_id
JOIN "organization_groups" og ON og.id = m.group_id AND og.is_active = true
ON CONFLICT ("user_id", "group_id") DO NOTHING;
