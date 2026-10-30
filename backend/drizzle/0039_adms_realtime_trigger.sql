-- Add ingested_at tracking column to adms.review_logs
ALTER TABLE adms.review_logs ADD COLUMN IF NOT EXISTS ingested_at timestamptz;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_adms_review_logs_uningested 
  ON adms.review_logs(group_id, punched_at) 
  WHERE ingested_at IS NULL;
--> statement-breakpoint
-- Backfill ingested_at for logs that already have an exact match in attendance_device_raw_logs
UPDATE adms.review_logs r
SET ingested_at = r.created_at
WHERE r.ingested_at IS NULL
  AND r.employee_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.attendance_device_raw_logs raw
    WHERE raw.employee_id = r.employee_id
      AND raw.timestamp = r.punched_at
  );
--> statement-breakpoint
-- Create trigger function to broadcast real-time event when a new punch arrives
CREATE OR REPLACE FUNCTION adms.notify_new_punch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('adms_new_punch', json_build_object(
    'id', NEW.id,
    'group_id', NEW.group_id,
    'employee_id', NEW.employee_id,
    'work_date', to_char(NEW.punched_at, 'YYYY-MM-DD')
  )::text);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_adms_new_punch ON adms.review_logs;
--> statement-breakpoint
CREATE TRIGGER trg_adms_new_punch
  AFTER INSERT ON adms.review_logs
  FOR EACH ROW
  EXECUTE FUNCTION adms.notify_new_punch();
