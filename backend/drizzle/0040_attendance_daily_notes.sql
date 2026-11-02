CREATE TABLE IF NOT EXISTS "attendance_daily_notes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attendance_daily_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"group_id" bigint REFERENCES "organization_groups"("id") ON DELETE restrict,
	"organization_id" bigint REFERENCES "organizations"("id") ON DELETE restrict,
	"work_date" varchar(10) NOT NULL,
	"employee_id" bigint NOT NULL REFERENCES "employees"("id") ON DELETE cascade,
	"is_highlighted" boolean DEFAULT false NOT NULL,
	"manual_note" text,
	"updated_by_id" bigint REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attendanceDailyNotes_organization_group_fk" FOREIGN KEY ("organization_id","group_id") REFERENCES "organizations"("id","group_id") ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_attendance_daily_notes_emp_date" ON "attendance_daily_notes" ("employee_id","work_date");
