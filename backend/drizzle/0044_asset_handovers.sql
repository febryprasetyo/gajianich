-- Migration 0044: Asset Handover and Handover Items
-- Reference: docs/superpowers/specs/2026-11-04-asset-handover-form-design.md

CREATE TABLE IF NOT EXISTS "asset_handovers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_handovers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"handover_number" varchar(50) NOT NULL UNIQUE,
	"handover_date" date NOT NULL,
	"organization_id" bigint REFERENCES "organizations"("id") ON DELETE SET NULL,
	"employee_id" bigint REFERENCES "employees"("id") ON DELETE SET NULL,
	"recipient_name" varchar(150) NOT NULL,
	"recipient_address" text,
	"recipient_position" varchar(100),
	"recipient_phone" varchar(50),
	"item_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"item_types_custom" varchar(150),
	"given_by_name" varchar(150) NOT NULL,
	"given_by_title" varchar(100),
	"given_by_user_id" bigint REFERENCES "users"("id") ON DELETE SET NULL,
	"received_by_name" varchar(150) NOT NULL,
	"notes" text,
	"status" varchar(30) DEFAULT 'COMPLETED' NOT NULL,
	"created_by_id" bigint REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_handovers_date_idx" ON "asset_handovers" ("handover_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_handovers_recipient_idx" ON "asset_handovers" ("recipient_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_handovers_status_idx" ON "asset_handovers" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_handovers_created_at_idx" ON "asset_handovers" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_handover_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_handover_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"handover_id" bigint NOT NULL REFERENCES "asset_handovers"("id") ON DELETE CASCADE,
	"item_order" integer NOT NULL,
	"asset_id" bigint REFERENCES "assets"("id") ON DELETE SET NULL,
	"item_name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_handover_items_handover_id_idx" ON "asset_handover_items" ("handover_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_handover_items_asset_id_idx" ON "asset_handover_items" ("asset_id");

