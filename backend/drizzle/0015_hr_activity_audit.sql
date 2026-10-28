CREATE TABLE "hr_audit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hr_audit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"operation_id" uuid NOT NULL,
	"actor_id" bigint NOT NULL,
	"actor_username" varchar(100) NOT NULL,
	"actor_name" varchar(255) NOT NULL,
	"action" varchar(24) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" varchar(100),
	"entity_label" varchar(255) NOT NULL,
	"outcome" varchar(16) NOT NULL,
	"summary" varchar(1000) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "hr_audit_events_action_check" CHECK ("hr_audit_events"."action" IN ('CREATE','UPDATE','DELETE','IMPORT','REVIEW','LINK','UNLINK','APPROVE','REJECT','CANCEL','REOPEN','LOCK','UNLOCK','ASSIGN','UNASSIGN')),
	CONSTRAINT "hr_audit_events_outcome_check" CHECK ("hr_audit_events"."outcome" IN ('SUCCESS','PARTIAL','FAILED')),
	CONSTRAINT "hr_audit_events_metadata_object" CHECK (jsonb_typeof("hr_audit_events"."metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "hr_audit_targets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hr_audit_targets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" bigint NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"entity_label" varchar(255) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"changed_fields" jsonb NOT NULL,
	CONSTRAINT "hr_audit_targets_changed_fields_array" CHECK (jsonb_typeof("hr_audit_targets"."changed_fields") = 'array' AND NOT jsonb_path_exists("hr_audit_targets"."changed_fields", '$[*] ? (@.type() != "string")')),
	CONSTRAINT "hr_audit_targets_before_object" CHECK ("hr_audit_targets"."before" IS NULL OR jsonb_typeof("hr_audit_targets"."before") = 'object'),
	CONSTRAINT "hr_audit_targets_after_object" CHECK ("hr_audit_targets"."after" IS NULL OR jsonb_typeof("hr_audit_targets"."after") = 'object')
);
--> statement-breakpoint
CREATE TABLE "hr_mutation_receipts" (
	"actor_id" bigint NOT NULL,
	"operation_id" uuid NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_mutation_receipts_actor_id_operation_id_pk" PRIMARY KEY("actor_id","operation_id")
);
--> statement-breakpoint
ALTER TABLE "hr_audit_targets" ADD CONSTRAINT "hr_audit_targets_event_id_hr_audit_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."hr_audit_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_audit_events_time_idx" ON "hr_audit_events" USING btree ("occurred_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "hr_audit_events_actor_time_idx" ON "hr_audit_events" USING btree ("actor_id","occurred_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "hr_audit_events_action_time_idx" ON "hr_audit_events" USING btree ("action","occurred_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "hr_audit_events_entity_idx" ON "hr_audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "hr_audit_targets_event_idx" ON "hr_audit_targets" USING btree ("event_id","id");--> statement-breakpoint
CREATE INDEX "hr_audit_targets_entity_idx" ON "hr_audit_targets" USING btree ("entity_type","entity_id","event_id");
--> statement-breakpoint
-- Reject statements even when an operator accidentally grants broader DML privileges.
CREATE FUNCTION public.reject_hr_audit_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'HR audit history is append-only'
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER hr_audit_events_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.hr_audit_events
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_hr_audit_mutation();
--> statement-breakpoint
CREATE TRIGGER hr_audit_targets_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.hr_audit_targets
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_hr_audit_mutation();
--> statement-breakpoint
ALTER TABLE public.hr_audit_events ENABLE ALWAYS TRIGGER hr_audit_events_append_only;
--> statement-breakpoint
ALTER TABLE public.hr_audit_targets ENABLE ALWAYS TRIGGER hr_audit_targets_append_only;
--> statement-breakpoint
-- Provision the runtime login outside migrations. Never grant it ownership of audit tables.
DO $$
DECLARE
  runtime_name text := nullif(current_setting('gajianich.hr_audit_runtime_role', true), '');
  runtime_oid oid;
  relation_name text;
BEGIN
  SELECT oid INTO runtime_oid FROM pg_roles
    WHERE rolname = runtime_name AND NOT rolsuper AND NOT rolcreaterole
      AND NOT rolcreatedb AND NOT rolreplication AND NOT rolbypassrls;
  IF runtime_oid IS NULL THEN
    RAISE EXCEPTION 'HR audit runtime role must exist and be an unprivileged role; set HR_AUDIT_RUNTIME_ROLE';
  END IF;
  IF pg_has_role(runtime_oid, current_user, 'MEMBER')
     OR EXISTS (
       SELECT 1 FROM pg_roles r
       WHERE (r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls)
         AND pg_has_role(runtime_oid, r.oid, 'MEMBER')
     ) THEN
    RAISE EXCEPTION 'HR audit runtime role must be separate from the migration owner and privileged roles';
  END IF;
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', runtime_name);
  FOREACH relation_name IN ARRAY ARRAY['hr_audit_events','hr_audit_targets','hr_mutation_receipts'] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', relation_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', relation_name, runtime_name);
    EXECUTE format('GRANT SELECT, INSERT ON TABLE public.%I TO %I', relation_name, runtime_name);
    IF has_table_privilege(runtime_oid, 'public.' || relation_name, 'UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') THEN
      RAISE EXCEPTION 'HR audit runtime role inherits unsafe privileges on %', relation_name;
    END IF;
  END LOOP;
END;
$$;
--> statement-breakpoint
-- HR audit permission catalog: additive and safe to reapply to an existing installation.
INSERT INTO public.permissions (code, name, module, description)
VALUES ('hr.audit.view', 'View HR Activity Audit', 'attendance', 'Melihat riwayat perubahan data HR')
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code = 'hr_attendance' AND p.code = 'hr.audit.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
