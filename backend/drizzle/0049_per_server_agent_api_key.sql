ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "agent_key_hash" varchar(128);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "agent_key_prefix" varchar(32);

