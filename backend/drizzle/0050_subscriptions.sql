CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(150) NOT NULL,
	"category" varchar(50) NOT NULL,
	"provider" varchar(150) NOT NULL,
	"registered_domain" varchar(255),
	"start_date" date,
	"expiry_date" date NOT NULL,
	"renewal_cost" numeric DEFAULT '0' NOT NULL,
	"billing_cycle" varchar(50) DEFAULT 'Tahunan' NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"login_url" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_category" ON "subscriptions" ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_expiry_date" ON "subscriptions" ("expiry_date");
