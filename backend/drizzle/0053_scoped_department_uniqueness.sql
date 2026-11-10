-- Drop global unique constraints on departments name and code
ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_name_unique";
ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_code_unique";

-- Create indexes for performance when searching name and code
CREATE INDEX IF NOT EXISTS "departments_name_lower_idx" ON "departments" (LOWER(TRIM("name")));
CREATE INDEX IF NOT EXISTS "departments_code_upper_idx" ON "departments" (UPPER(TRIM("code")));
