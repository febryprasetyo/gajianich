CREATE TABLE IF NOT EXISTS "employee_organization_transfers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_organization_transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"employee_id" bigint NOT NULL,
	"from_group_id" bigint NOT NULL,
	"to_group_id" bigint NOT NULL,
	"from_department_id" bigint NOT NULL,
	"to_department_id" bigint NOT NULL,
	"from_location_id" bigint,
	"to_location_id" bigint,
	"effective_date" date NOT NULL,
	"reason" text NOT NULL,
	"transferred_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_organization_transfers" ADD CONSTRAINT "employee_organization_transfers_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_organization_transfers" ADD CONSTRAINT "employee_organization_transfers_from_group_id_organization_groups_id_fk" FOREIGN KEY ("from_group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_organization_transfers" ADD CONSTRAINT "employee_organization_transfers_to_group_id_organization_groups_id_fk" FOREIGN KEY ("to_group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_organization_transfers" ADD CONSTRAINT "employee_organization_transfers_from_department_id_departments_id_fk" FOREIGN KEY ("from_department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_organization_transfers" ADD CONSTRAINT "employee_organization_transfers_to_department_id_departments_id_fk" FOREIGN KEY ("to_department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_organization_transfers" ADD CONSTRAINT "employee_organization_transfers_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_organization_transfers" ADD CONSTRAINT "employee_organization_transfers_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_organization_transfers" ADD CONSTRAINT "employee_organization_transfers_transferred_by_users_id_fk" FOREIGN KEY ("transferred_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_transfers_employee_idx" ON "employee_organization_transfers" USING btree ("employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_transfers_created_idx" ON "employee_organization_transfers" USING btree ("created_at" DESC);

