ALTER TABLE attendance_devices ADD COLUMN IF NOT EXISTS last_adms_seen_at timestamptz;
--> statement-breakpoint
ALTER TABLE attendance_device_raw_logs ADD COLUMN IF NOT EXISTS ingestion_key text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_logs_ingestion_key ON attendance_device_raw_logs(ingestion_key);
