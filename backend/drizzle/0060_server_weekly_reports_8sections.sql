ALTER TABLE "server_weekly_reports" ALTER COLUMN "server_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "server_weekly_reports" ADD COLUMN IF NOT EXISTS "scope_type" varchar(20) DEFAULT 'NODE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "server_weekly_reports" ADD COLUMN IF NOT EXISTS "sla_percent" numeric DEFAULT '99.90' NOT NULL;
--> statement-breakpoint
ALTER TABLE "server_weekly_reports" ADD COLUMN IF NOT EXISTS "service_availability" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "server_weekly_reports" ADD COLUMN IF NOT EXISTS "resource_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "server_weekly_reports" ADD COLUMN IF NOT EXISTS "database_middleware" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "server_weekly_reports" ADD COLUMN IF NOT EXISTS "security_audit" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "server_weekly_reports" ADD COLUMN IF NOT EXISTS "backup_dr" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "server_weekly_reports" ADD COLUMN IF NOT EXISTS "incidents_maintenance" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "server_weekly_reports" ADD COLUMN IF NOT EXISTS "action_items" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_server_weekly_reports_scope" ON "server_weekly_reports" USING btree ("scope_type");
