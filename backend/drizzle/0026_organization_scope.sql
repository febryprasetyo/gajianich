CREATE TABLE "department_organization_mappings" (
	"department_id" bigint PRIMARY KEY NOT NULL,
	"group_id" bigint NOT NULL,
	"organization_id" bigint,
	"approval_reference" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "department_mapping_approval_check" CHECK (length(trim("department_organization_mappings"."approval_reference")) > 0)
);
--> statement-breakpoint
CREATE TABLE "location_organization_mappings" (
	"location_id" bigint PRIMARY KEY NOT NULL,
	"group_id" bigint NOT NULL,
	"organization_id" bigint,
	"approval_reference" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_mapping_approval_check" CHECK (length(trim("location_organization_mappings"."approval_reference")) > 0)
);
--> statement-breakpoint
CREATE TABLE "organization_groups" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "organization_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" varchar(3) NOT NULL,
	"name" varchar(150) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_groups_code_unique" UNIQUE("code"),
	CONSTRAINT "organization_groups_code_check" CHECK ("organization_groups"."code" IN ('CMC','MGM'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "organizations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"group_id" bigint NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_code_unique" UNIQUE("code"),
	CONSTRAINT "organizations_id_group_unique" UNIQUE("id","group_id")
);
--> statement-breakpoint
CREATE TABLE "user_organization_group_access" (
	"user_id" bigint NOT NULL,
	"group_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_organization_group_access_user_id_group_id_pk" PRIMARY KEY("user_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "department_organization_mappings" ADD CONSTRAINT "department_organization_mappings_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_organization_mappings" ADD CONSTRAINT "department_organization_mappings_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_organization_mappings" ADD CONSTRAINT "department_mapping_organization_group_fk" FOREIGN KEY ("organization_id","group_id") REFERENCES "public"."organizations"("id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_organization_mappings" ADD CONSTRAINT "location_organization_mappings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_organization_mappings" ADD CONSTRAINT "location_organization_mappings_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_organization_mappings" ADD CONSTRAINT "location_mapping_organization_group_fk" FOREIGN KEY ("organization_id","group_id") REFERENCES "public"."organizations"("id","group_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_group_access" ADD CONSTRAINT "user_organization_group_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_group_access" ADD CONSTRAINT "user_organization_group_access_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "department_mapping_group_idx" ON "department_organization_mappings" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "location_mapping_group_idx" ON "location_organization_mappings" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "organizations_group_idx" ON "organizations" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "user_organization_group_access_group_idx" ON "user_organization_group_access" USING btree ("group_id");