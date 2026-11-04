CREATE TABLE IF NOT EXISTS "department_report_rosters" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "department_report_rosters_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"group_id" bigint REFERENCES "organization_groups"("id") ON DELETE restrict,
	"organization_id" bigint REFERENCES "organizations"("id") ON DELETE restrict,
	"department_id" bigint NOT NULL REFERENCES "departments"("id") ON DELETE cascade,
	"employee_id" bigint NOT NULL REFERENCES "employees"("id") ON DELETE cascade,
	"coordinator_id" bigint REFERENCES "employees"("id") ON DELETE set null,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_coordinator" boolean DEFAULT false NOT NULL,
	"updated_by_id" bigint REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departmentReportRosters_organization_group_fk" FOREIGN KEY ("organization_id","group_id") REFERENCES "organizations"("id","group_id") ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_dept_roster_dept_emp" ON "department_report_rosters" ("department_id","employee_id");

