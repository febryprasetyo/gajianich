-- Strict 1 Employee = 1 User Account constraint
-- Partial unique index ensures that an employee can only be linked to at most one user account.
CREATE UNIQUE INDEX IF NOT EXISTS "users_employee_id_unique" ON "users" ("employee_id") WHERE "employee_id" IS NOT NULL;
