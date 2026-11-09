-- Cleanup existing duplicate employee user accounts before creating unique index
-- If an employee has both an administrative/HR account and an employee account, consolidate references to the primary account
DO $$
DECLARE
    dup RECORD;
    primary_user_id BIGINT;
    secondary_user_id BIGINT;
BEGIN
    FOR dup IN
        SELECT employee_id
        FROM users
        WHERE employee_id IS NOT NULL
        GROUP BY employee_id
        HAVING COUNT(*) > 1
    LOOP
        -- Pick primary account: prefer role other than 'Employee', or lowest id
        SELECT id INTO primary_user_id
        FROM users
        WHERE employee_id = dup.employee_id
        ORDER BY CASE WHEN lower(role) LIKE '%employee%' THEN 2 ELSE 1 END, id ASC
        LIMIT 1;

        FOR secondary_user_id IN
            SELECT id
            FROM users
            WHERE employee_id = dup.employee_id AND id <> primary_user_id
        LOOP
            -- Re-point any attendance self logs to primary user
            UPDATE attendance_self_logs SET user_id = primary_user_id WHERE user_id = secondary_user_id;

            -- Nullify employee_id on secondary user account and mark inactive
            UPDATE users
            SET employee_id = NULL,
                status = 'inactive'
            WHERE id = secondary_user_id;
        END LOOP;
    END LOOP;
END $$;
--> statement-breakpoint
-- Strict 1 Employee = 1 User Account constraint
-- Partial unique index ensures that an employee can only be linked to at most one user account.
CREATE UNIQUE INDEX IF NOT EXISTS "users_employee_id_unique" ON "users" ("employee_id") WHERE "employee_id" IS NOT NULL;

