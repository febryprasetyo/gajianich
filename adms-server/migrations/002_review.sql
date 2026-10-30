ALTER TABLE adms.devices ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE adms.devices ADD COLUMN IF NOT EXISTS last_data_at timestamptz;
ALTER TABLE adms.receipts ADD COLUMN IF NOT EXISTS storage_target text;
UPDATE adms.receipts SET storage_target='MAIN_LEGACY' WHERE storage_target IS NULL;
ALTER TABLE adms.receipts ALTER COLUMN storage_target SET DEFAULT 'REVIEW';
ALTER TABLE adms.receipts ALTER COLUMN storage_target SET NOT NULL;
CREATE TABLE IF NOT EXISTS adms.review_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 serial varchar(100) NOT NULL REFERENCES adms.devices(serial) ON DELETE RESTRICT,
 group_id bigint NOT NULL REFERENCES public.organization_groups(id) ON DELETE RESTRICT,
 receipt_id bigint NOT NULL REFERENCES adms.receipts(id) ON DELETE RESTRICT,
 pin text NOT NULL,
 punched_at timestamp without time zone NOT NULL,
 raw_status integer NOT NULL,
 raw_verify integer NOT NULL,
 work_code text,
 employee_id bigint,
 fingerprint text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adms_review_logs_group_time ON adms.review_logs(group_id,punched_at);
CREATE INDEX IF NOT EXISTS adms_review_logs_serial_time ON adms.review_logs(serial,punched_at);
CREATE INDEX IF NOT EXISTS adms_review_logs_receipt ON adms.review_logs(receipt_id);
INSERT INTO adms.schema_version(version) VALUES(2) ON CONFLICT DO NOTHING;
DO $$
DECLARE role_name text := nullif(current_setting('gajianich.adms_runtime_role',true),'');
BEGIN
 IF role_name IS NOT NULL THEN
  EXECUTE format('REVOKE UPDATE ON public.attendance_devices FROM %I',role_name);
  EXECUTE format('REVOKE INSERT ON public.attendance_device_raw_logs FROM %I',role_name);
  EXECUTE format('REVOKE INSERT,UPDATE ON public.attendance_device_sync_logs FROM %I',role_name);
  EXECUTE format('GRANT SELECT ON adms.review_logs TO %I',role_name);
  EXECUTE format('GRANT INSERT ON adms.review_logs TO %I',role_name);
  EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE adms.review_logs_id_seq TO %I',role_name);
 END IF;
END $$;
