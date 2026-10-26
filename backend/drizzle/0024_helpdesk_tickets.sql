-- 0024_helpdesk_tickets.sql
CREATE TABLE IF NOT EXISTS "helpdesk_ticket_counters" (
"year_month" varchar(6) PRIMARY KEY NOT NULL,
"last_seq" integer DEFAULT 0 NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "helpdesk_tickets" (
"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "helpdesk_tickets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
"ticket_number" varchar(50) NOT NULL,
"title" varchar(200) NOT NULL,
"description" text NOT NULL,
"status" varchar(30) DEFAULT 'OPEN' NOT NULL,
"priority" varchar(20) DEFAULT 'MEDIUM' NOT NULL,
"category" varchar(30) NOT NULL,
"origin" varchar(20) NOT NULL,
"reported_at" timestamp with time zone NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"resolved_at" timestamp with time zone,
"requester_employee_id" bigint NOT NULL,
"requester_name_snapshot" varchar(255) NOT NULL,
"requester_department_snapshot" varchar(255) NOT NULL,
"created_by_user_id" bigint NOT NULL,
"created_by_name_snapshot" varchar(255) NOT NULL,
"assigned_to_user_id" bigint,
"assigned_to_name_snapshot" varchar(255),
"affected_asset_id" bigint,
"affected_asset_label" varchar(255),
"affected_employee_id" bigint,
"affected_employee_label" varchar(255),
"resolution_note" text,
"resolution_confirmed_by" varchar(100),
"resolution_confirmed_at" timestamp with time zone,
"resolution_confirmation_channel" varchar(20),
"feedback_score" integer,
"feedback_note" text,
"feedback_source" varchar(20),
"report_evidence" text,
"is_internal" boolean DEFAULT false NOT NULL,
"sla_response_minutes" integer,
"first_response_at" timestamp with time zone,
CONSTRAINT "helpdesk_tickets_ticket_number_unique" UNIQUE("ticket_number"),
CONSTRAINT "helpdesk_tickets_status_check" CHECK ("helpdesk_tickets"."status" IN ('OPEN','IN_PROGRESS','PENDING','RESOLVED','CLOSED')),
CONSTRAINT "helpdesk_tickets_priority_check" CHECK ("helpdesk_tickets"."priority" IN ('LOW','MEDIUM','HIGH','CRITICAL')),
CONSTRAINT "helpdesk_tickets_category_check" CHECK ("helpdesk_tickets"."category" IN ('HARDWARE','SOFTWARE','NETWORK','ACCESS','PRINTER','PERIPHERAL','OTHER')),
CONSTRAINT "helpdesk_tickets_origin_check" CHECK ("helpdesk_tickets"."origin" IN ('WHATSAPP','PHONE','EMAIL','WALK_IN','INTERNAL_FINDING')),
CONSTRAINT "helpdesk_tickets_feedback_score_check" CHECK ("helpdesk_tickets"."feedback_score" IS NULL OR ("helpdesk_tickets"."feedback_score" >= 1 AND "helpdesk_tickets"."feedback_score" <= 5)),
CONSTRAINT "helpdesk_tickets_feedback_source_check" CHECK ("helpdesk_tickets"."feedback_source" IS NULL OR "helpdesk_tickets"."feedback_source" = 'STAFF_RECORDED'),
CONSTRAINT "helpdesk_tickets_confirmation_channel_check" CHECK ("helpdesk_tickets"."resolution_confirmation_channel" IS NULL OR "helpdesk_tickets"."resolution_confirmation_channel" IN ('WHATSAPP','PHONE','EMAIL','WALK_IN','SYSTEM'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "helpdesk_ticket_comments" (
"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "helpdesk_ticket_comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
"ticket_id" bigint NOT NULL,
"author_user_id" bigint NOT NULL,
"author_name_snapshot" varchar(255) NOT NULL,
"body" text NOT NULL,
"is_internal_note" boolean DEFAULT false NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "helpdesk_ticket_audit" (
"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "helpdesk_ticket_audit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
"ticket_id" bigint NOT NULL,
"actor_user_id" bigint NOT NULL,
"actor_name_snapshot" varchar(255) NOT NULL,
"action" varchar(40) NOT NULL,
"field_changed" varchar(100),
"old_value" text,
"new_value" text,
"note" varchar(500),
"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
CONSTRAINT "helpdesk_audit_action_check" CHECK ("helpdesk_ticket_audit"."action" IN ('CREATE','UPDATE','ASSIGN','STATUS_CHANGE','COMMENT','RESOLVE','CLOSE','REOPEN'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "helpdesk_attachments" (
"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "helpdesk_attachments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
"ticket_id" bigint NOT NULL,
"filename" varchar(255) NOT NULL,
"storage_path" varchar(500) NOT NULL,
"mime_type" varchar(100) NOT NULL,
"size_bytes" integer NOT NULL,
"uploaded_by_user_id" bigint NOT NULL,
"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'helpdesk_tickets_requester_employee_id_employees_id_fk') THEN
    ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_requester_employee_id_employees_id_fk" FOREIGN KEY ("requester_employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'helpdesk_tickets_assigned_to_user_id_users_id_fk') THEN
    ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'helpdesk_tickets_affected_asset_id_assets_id_fk') THEN
    ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_affected_asset_id_assets_id_fk" FOREIGN KEY ("affected_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'helpdesk_tickets_affected_employee_id_employees_id_fk') THEN
    ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_affected_employee_id_employees_id_fk" FOREIGN KEY ("affected_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'helpdesk_ticket_comments_ticket_id_helpdesk_tickets_id_fk') THEN
    ALTER TABLE "helpdesk_ticket_comments" ADD CONSTRAINT "helpdesk_ticket_comments_ticket_id_helpdesk_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."helpdesk_tickets"("id") ON DELETE restrict ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'helpdesk_ticket_audit_ticket_id_helpdesk_tickets_id_fk') THEN
    ALTER TABLE "helpdesk_ticket_audit" ADD CONSTRAINT "helpdesk_ticket_audit_ticket_id_helpdesk_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."helpdesk_tickets"("id") ON DELETE restrict ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'helpdesk_attachments_ticket_id_helpdesk_tickets_id_fk') THEN
    ALTER TABLE "helpdesk_attachments" ADD CONSTRAINT "helpdesk_attachments_ticket_id_helpdesk_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."helpdesk_tickets"("id") ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_status_created_idx" ON "helpdesk_tickets" USING btree ("status","created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_requester_created_idx" ON "helpdesk_tickets" USING btree ("requester_employee_id","created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_assignee_status_idx" ON "helpdesk_tickets" USING btree ("assigned_to_user_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_reported_at_idx" ON "helpdesk_tickets" USING btree ("reported_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_number_idx" ON "helpdesk_tickets" USING btree ("ticket_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_comments_ticket_idx" ON "helpdesk_ticket_comments" USING btree ("ticket_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_audit_ticket_idx" ON "helpdesk_ticket_audit" USING btree ("ticket_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_attachments_ticket_idx" ON "helpdesk_attachments" USING btree ("ticket_id","uploaded_at" DESC NULLS LAST);
--> statement-breakpoint

-- Append-only trigger for helpdesk_ticket_audit
CREATE OR REPLACE FUNCTION helpdesk_ticket_audit_append_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'helpdesk_ticket_audit is append-only: UPDATE, DELETE, and TRUNCATE operations are forbidden'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_helpdesk_ticket_audit_append_only ON helpdesk_ticket_audit;
CREATE TRIGGER trg_helpdesk_ticket_audit_append_only
BEFORE UPDATE OR DELETE ON helpdesk_ticket_audit
FOR EACH ROW EXECUTE FUNCTION helpdesk_ticket_audit_append_only();
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_helpdesk_ticket_audit_truncate ON helpdesk_ticket_audit;
CREATE TRIGGER trg_helpdesk_ticket_audit_truncate
BEFORE TRUNCATE ON helpdesk_ticket_audit
FOR EACH STATEMENT EXECUTE FUNCTION helpdesk_ticket_audit_append_only();
--> statement-breakpoint

-- Seed RBAC permissions
INSERT INTO permissions(code, name, module, description) VALUES
  ('helpdesk.view', 'View Helpdesk Tickets', 'helpdesk', 'Melihat tiket helpdesk IT dan laporan'),
  ('helpdesk.manage', 'Manage Helpdesk Tickets', 'helpdesk', 'Mencatat, memperbarui, assign, komentar, dan menyelesaikan tiket'),
  ('helpdesk.admin', 'Administer Helpdesk Tickets', 'helpdesk', 'Membuka kembali tiket tertutup, mengubah tanggal laporan, dan administrasi')
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('it_staff', 'it_admin', 'super_admin', 'hr_attendance', 'management')
  AND p.code = 'helpdesk.view'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('it_staff', 'it_admin', 'super_admin')
  AND p.code = 'helpdesk.manage'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('it_admin', 'super_admin')
  AND p.code = 'helpdesk.admin'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

DO $$
DECLARE runtime_name text := nullif(current_setting('ams.hr_audit_runtime_role', true), '');
BEGIN
  IF runtime_name IS NOT NULL THEN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.helpdesk_tickets, public.helpdesk_ticket_comments, public.helpdesk_attachments, public.helpdesk_ticket_counters TO %I', runtime_name);
    EXECUTE format('GRANT SELECT, INSERT ON TABLE public.helpdesk_ticket_audit TO %I', runtime_name);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.helpdesk_tickets_id_seq, public.helpdesk_ticket_comments_id_seq, public.helpdesk_ticket_audit_id_seq, public.helpdesk_attachments_id_seq TO %I', runtime_name);
  END IF;
END;
$$;
