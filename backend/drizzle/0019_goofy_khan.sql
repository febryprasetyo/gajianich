CREATE TABLE "ga_goods_request_signed_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ga_goods_request_status_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ga_goods_request_status_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"request_id" uuid NOT NULL,
	"from_status" varchar(50) NOT NULL,
	"to_status" varchar(50) NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"changed_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ga_goods_requests" ADD COLUMN "title" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ga_goods_requests" ADD COLUMN "purpose" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ga_goods_requests" ADD COLUMN "status" varchar(50) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "ga_goods_requests" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ga_goods_request_signed_documents" ADD CONSTRAINT "ga_goods_request_signed_documents_request_id_ga_goods_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."ga_goods_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ga_goods_request_signed_documents" ADD CONSTRAINT "ga_goods_request_signed_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ga_goods_request_status_logs" ADD CONSTRAINT "ga_goods_request_status_logs_request_id_ga_goods_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."ga_goods_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ga_goods_request_status_logs" ADD CONSTRAINT "ga_goods_request_status_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ga_goods_signed_docs_request_idx" ON "ga_goods_request_signed_documents" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "ga_goods_status_logs_request_idx" ON "ga_goods_request_status_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "ga_goods_status_logs_created_at_idx" ON "ga_goods_request_status_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ga_goods_requests_status_idx" ON "ga_goods_requests" USING btree ("status");
--> statement-breakpoint
DO $$
DECLARE
  runtime_name text := nullif(current_setting('gajianich.hr_audit_runtime_role', true), '');
BEGIN
  IF runtime_name IS NOT NULL THEN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.ga_goods_requests, public.ga_goods_request_status_logs, public.ga_goods_request_signed_documents TO %I', runtime_name);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.ga_goods_request_status_logs_id_seq TO %I', runtime_name);
  END IF;
END;
$$;
