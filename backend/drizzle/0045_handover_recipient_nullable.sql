-- Migration 0045: Allow nullable recipient_name and received_by_name for manual fill
ALTER TABLE "asset_handovers" ALTER COLUMN "recipient_name" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_handovers" ALTER COLUMN "received_by_name" DROP NOT NULL;
