ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activation_token" varchar(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activation_token_expires_at" timestamp;
CREATE INDEX IF NOT EXISTS "users_activation_token_idx" ON "users" ("activation_token");
