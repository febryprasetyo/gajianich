CREATE TABLE IF NOT EXISTS "server_weekly_reports" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "server_weekly_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"server_id" bigint NOT NULL,
	"period_week" varchar(20) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" varchar(30) DEFAULT 'NORMAL' NOT NULL,
	"executive_summary" text,
	"incident_rca" text,
	"recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pdf_file_name" varchar(255) NOT NULL,
	"pdf_file_path" varchar(500) NOT NULL,
	"file_size_bytes" bigint DEFAULT 0 NOT NULL,
	"generated_by" varchar(50) DEFAULT 'GEMINI_AI_SCHEDULER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "server_weekly_reports" ADD CONSTRAINT "server_weekly_reports_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_server_weekly_reports_server_period" ON "server_weekly_reports" USING btree ("server_id","period_week");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_server_weekly_reports_created_at" ON "server_weekly_reports" USING btree ("created_at");
