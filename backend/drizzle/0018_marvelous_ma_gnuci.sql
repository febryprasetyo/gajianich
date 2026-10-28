CREATE TABLE "ga_goods_request_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_id" bigint NOT NULL,
	"storage_key" varchar(160) NOT NULL,
	"size" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ga_goods_request_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ga_goods_request_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"request_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" varchar(1000) NOT NULL,
	"quantity" integer NOT NULL,
	"estimated_price" numeric(14, 0) NOT NULL,
	"subtotal" numeric(14, 0) NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	CONSTRAINT "ga_goods_item_quantity_positive" CHECK ("ga_goods_request_items"."quantity" > 0),
	CONSTRAINT "ga_goods_item_price_positive" CHECK ("ga_goods_request_items"."estimated_price" > 0),
	CONSTRAINT "ga_goods_item_subtotal_correct" CHECK ("ga_goods_request_items"."subtotal" = "ga_goods_request_items"."quantity" * "ga_goods_request_items"."estimated_price")
);
--> statement-breakpoint
CREATE TABLE "ga_goods_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_date" date NOT NULL,
	"requester_name" varchar(150) NOT NULL,
	"job_title" varchar(150) NOT NULL,
	"division" varchar(150) NOT NULL,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ga_goods_request_attachments" ADD CONSTRAINT "ga_goods_request_attachments_item_id_ga_goods_request_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."ga_goods_request_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ga_goods_request_items" ADD CONSTRAINT "ga_goods_request_items_request_id_ga_goods_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."ga_goods_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ga_goods_requests" ADD CONSTRAINT "ga_goods_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ga_goods_attachments_item_idx" ON "ga_goods_request_attachments" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "ga_goods_request_items_request_idx" ON "ga_goods_request_items" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "ga_goods_requests_created_at_idx" ON "ga_goods_requests" USING btree ("created_at");
--> statement-breakpoint
INSERT INTO permissions (code, name, module, description) VALUES
('ga.requests.view', 'View Goods Requests', 'ga', 'Melihat permintaan barang GA dan bukti harga'),
('ga.requests.create', 'Create Goods Request', 'ga', 'Membuat permintaan barang beserta lampiran')
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
INSERT INTO roles (code, name, description, is_system) VALUES
('ga_staff', 'GA Staff', 'Permintaan barang General Affairs', true)
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('super_admin', 'ga_staff') AND p.code IN ('ga.requests.view', 'ga.requests.create')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DO $$
DECLARE
  runtime_name text := nullif(current_setting('gajianich.hr_audit_runtime_role', true), '');
BEGIN
  IF runtime_name IS NOT NULL THEN
    EXECUTE format('GRANT SELECT, INSERT ON TABLE public.ga_goods_requests, public.ga_goods_request_items, public.ga_goods_request_attachments TO %I', runtime_name);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.ga_goods_request_items_id_seq TO %I', runtime_name);
  END IF;
END;
$$;
