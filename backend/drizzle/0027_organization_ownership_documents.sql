CREATE TABLE "document_identity_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_identity_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"group_id" bigint NOT NULL,
	"organization_id" bigint NOT NULL,
	"version" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"logo_asset_key" text NOT NULL,
	"approved_reference" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_identity_id_group_org_unique" UNIQUE("id","group_id","organization_id"),
	CONSTRAINT "document_identity_version_unique" UNIQUE("organization_id","version"),
	CONSTRAINT "document_identity_approval_check" CHECK (length(trim("document_identity_versions"."approved_reference")) > 0),
	CONSTRAINT "document_identity_name_check" CHECK (length(trim("document_identity_versions"."name")) > 0),
	CONSTRAINT "document_identity_logo_check" CHECK (length(trim("document_identity_versions"."logo_asset_key")) > 0)
);
--> statement-breakpoint
CREATE TABLE "document_profiles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"group_id" bigint NOT NULL,
	"organization_id" bigint NOT NULL,
	"kind" varchar(10) NOT NULL,
	"template_version_id" bigint NOT NULL,
	"identity_version_id" bigint NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "document_profile_owner_kind_unique" UNIQUE("organization_id","kind")
);
--> statement-breakpoint
CREATE TABLE "document_template_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_template_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"group_id" bigint NOT NULL,
	"kind" varchar(10) NOT NULL,
	"version" bigint NOT NULL,
	"layout_key" varchar(100) NOT NULL,
	"labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signatories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approved_reference" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_template_id_group_kind_unique" UNIQUE("id","group_id","kind"),
	CONSTRAINT "document_template_version_unique" UNIQUE("group_id","kind","version"),
	CONSTRAINT "document_template_kind_check" CHECK ("document_template_versions"."kind" in ('LEAVE','GA')),
	CONSTRAINT "document_template_approval_check" CHECK (length(trim("document_template_versions"."approved_reference")) > 0)
);
--> statement-breakpoint
ALTER TABLE "asset_assignment_history" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "attendance_batches" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "attendance_batches" ADD COLUMN "organization_id" bigint;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "organization_id" bigint;--> statement-breakpoint
ALTER TABLE "attendance_device_raw_logs" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "attendance_device_sync_logs" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "attendance_devices" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "attendance_face_requests" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "attendance_self_logs" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "ga_goods_requests" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "ga_goods_requests" ADD COLUMN "organization_id" bigint;--> statement-breakpoint
ALTER TABLE "ga_goods_requests" ADD COLUMN "document_profile_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "organization_id" bigint;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "document_profile_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "document_identity_versions" ADD CONSTRAINT "document_identity_versions_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_identity_versions" ADD CONSTRAINT "document_identity_versions_organization_id_group_id_organizations_id_group_id_fk" FOREIGN KEY ("organization_id","group_id") REFERENCES "public"."organizations"("id","group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_profiles" ADD CONSTRAINT "document_profiles_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_profiles" ADD CONSTRAINT "document_profiles_organization_id_group_id_organizations_id_group_id_fk" FOREIGN KEY ("organization_id","group_id") REFERENCES "public"."organizations"("id","group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_profiles" ADD CONSTRAINT "document_profiles_template_version_id_group_id_kind_document_template_versions_id_group_id_kind_fk" FOREIGN KEY ("template_version_id","group_id","kind") REFERENCES "public"."document_template_versions"("id","group_id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_profiles" ADD CONSTRAINT "document_profiles_identity_version_id_group_id_organization_id_document_identity_versions_id_group_id_organization_id_fk" FOREIGN KEY ("identity_version_id","group_id","organization_id") REFERENCES "public"."document_identity_versions"("id","group_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_template_versions" ADD CONSTRAINT "document_template_versions_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assignment_history" ADD CONSTRAINT "asset_assignment_history_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_batches" ADD CONSTRAINT "attendance_batches_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_batches" ADD CONSTRAINT "attendance_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_device_raw_logs" ADD CONSTRAINT "attendance_device_raw_logs_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_device_sync_logs" ADD CONSTRAINT "attendance_device_sync_logs_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_face_requests" ADD CONSTRAINT "attendance_face_requests_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_self_logs" ADD CONSTRAINT "attendance_self_logs_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ga_goods_requests" ADD CONSTRAINT "ga_goods_requests_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ga_goods_requests" ADD CONSTRAINT "ga_goods_requests_organization_id_group_id_organizations_id_group_id_fk" FOREIGN KEY ("organization_id","group_id") REFERENCES "public"."organizations"("id","group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_group_id_organization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ga_goods_requests_group_idx" ON "ga_goods_requests" USING btree ("group_id");--> statement-breakpoint
ALTER TABLE "ga_goods_requests" ADD CONSTRAINT "ga_goods_owner_pair_check" CHECK ("ga_goods_requests"."organization_id" IS NULL OR "ga_goods_requests"."group_id" IS NOT NULL);