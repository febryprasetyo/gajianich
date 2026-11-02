-- Safely apply realtime trigger if adms.review_logs exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'adms' AND table_name = 'review_logs') THEN
    ALTER TABLE adms.review_logs ADD COLUMN IF NOT EXISTS ingested_at timestamptz;

    CREATE INDEX IF NOT EXISTS idx_adms_review_logs_uningested 
      ON adms.review_logs(group_id, punched_at) 
      WHERE ingested_at IS NULL;

    UPDATE adms.review_logs r
    SET ingested_at = r.created_at
    WHERE r.ingested_at IS NULL
      AND r.employee_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.attendance_device_raw_logs raw
        WHERE raw.employee_id = r.employee_id
          AND raw.timestamp = r.punched_at
      );

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION adms.notify_new_punch() RETURNS trigger LANGUAGE plpgsql AS $trigger$
      BEGIN
        PERFORM pg_notify('adms_new_punch', json_build_object(
          'id', NEW.id,
          'group_id', NEW.group_id,
          'employee_id', NEW.employee_id,
          'work_date', to_char(NEW.punched_at, 'YYYY-MM-DD')
        )::text);
        RETURN NEW;
      END;
      $trigger$;
    $fn$;

    DROP TRIGGER IF EXISTS trg_adms_new_punch ON adms.review_logs;

    CREATE TRIGGER trg_adms_new_punch
      AFTER INSERT ON adms.review_logs
      FOR EACH ROW
      EXECUTE FUNCTION adms.notify_new_punch();
  END IF;
END $$;

