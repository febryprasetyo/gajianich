ALTER TABLE public.attendance_devices ADD COLUMN IF NOT EXISTS last_adms_seen_at timestamptz;
CREATE SCHEMA IF NOT EXISTS adms;
CREATE TABLE IF NOT EXISTS adms.schema_version (version integer PRIMARY KEY);
CREATE TABLE IF NOT EXISTS adms.devices (
 serial varchar(100) PRIMARY KEY,
 device_id bigint NOT NULL UNIQUE REFERENCES public.attendance_devices(id) ON DELETE RESTRICT,
 group_id bigint NOT NULL REFERENCES public.organization_groups(id) ON DELETE RESTRICT,
 source_id bigint REFERENCES public.attendance_sources(id) ON DELETE RESTRICT,
 allowed_network cidr NOT NULL,
 attlog_stamp varchar(100) NOT NULL DEFAULT '0',
 last_seen_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS adms.receipts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 serial varchar(100) NOT NULL REFERENCES adms.devices(serial) ON DELETE RESTRICT,
 source varchar(30) NOT NULL,
 table_name varchar(50) NOT NULL,
 stamp varchar(100),
 payload bytea NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}',
 outcome varchar(30) NOT NULL,
 error_message text,
 total_received integer NOT NULL DEFAULT 0,
 total_inserted integer NOT NULL DEFAULT 0,
 total_unmapped integer NOT NULL DEFAULT 0,
 received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adms_receipts_serial_time ON adms.receipts(serial,received_at);
ALTER TABLE public.attendance_device_raw_logs ADD COLUMN IF NOT EXISTS ingestion_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_logs_ingestion_key ON public.attendance_device_raw_logs(ingestion_key);

CREATE OR REPLACE FUNCTION adms.prepare_raw_log() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE status_code text; verify_code text; normalized_pin text;
BEGIN
 status_code := coalesce(NEW.raw_payload #>> '{punch,rawStatus}',NEW.raw_payload->>'rawStatus');
 verify_code := coalesce(NEW.raw_payload #>> '{punch,rawVerify}',NEW.raw_payload->>'rawVerify');
 normalized_pin := CASE WHEN NEW.pin ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(NEW.pin,'0'),''),'0') ELSE NEW.pin END;
 NEW.ingestion_key := md5(jsonb_build_array(NEW.device_id,normalized_pin,
  to_char(NEW.timestamp,'YYYY-MM-DD HH24:MI:SS'),coalesce(status_code,NEW.in_out_state),coalesce(verify_code,NEW.verify_mode))::text);
 -- Existing history stays untouched; match legacy rows that predate fingerprints.
 IF EXISTS (
  SELECT 1 FROM public.attendance_device_raw_logs r
  WHERE r.ingestion_key IS NULL AND r.device_id=NEW.device_id AND r.timestamp=NEW.timestamp
   AND (CASE WHEN r.pin ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(r.pin,'0'),''),'0') ELSE r.pin END)=normalized_pin
   AND r.in_out_state=NEW.in_out_state AND r.verify_mode=NEW.verify_mode
   AND (coalesce(r.raw_payload #>> '{punch,rawStatus}',r.raw_payload->>'rawStatus') IS NULL
        OR status_code IS NULL OR coalesce(r.raw_payload #>> '{punch,rawStatus}',r.raw_payload->>'rawStatus')=status_code)
   AND (coalesce(r.raw_payload #>> '{punch,rawVerify}',r.raw_payload->>'rawVerify') IS NULL
        OR verify_code IS NULL OR coalesce(r.raw_payload #>> '{punch,rawVerify}',r.raw_payload->>'rawVerify')=verify_code)
 ) THEN RETURN NULL; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS adms_raw_log_key ON public.attendance_device_raw_logs;
CREATE TRIGGER adms_raw_log_key BEFORE INSERT ON public.attendance_device_raw_logs
 FOR EACH ROW EXECUTE FUNCTION adms.prepare_raw_log();
INSERT INTO adms.schema_version(version) VALUES (1) ON CONFLICT DO NOTHING;

DO $$
DECLARE role_name text := nullif(current_setting('gajianich.adms_runtime_role',true),'');
 seq text;
BEGIN
 IF role_name IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND NOT rolbypassrls) THEN
   RAISE EXCEPTION 'ADMS_RUNTIME_ROLE must be an existing unprivileged role';
  END IF;
  EXECUTE format('GRANT USAGE ON SCHEMA adms,public TO %I',role_name);
  EXECUTE format('GRANT SELECT ON adms.schema_version TO %I',role_name);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON adms.devices,adms.receipts TO %I',role_name);
  EXECUTE format('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA adms TO %I',role_name);
  EXECUTE format('GRANT SELECT ON public.employees,public.department_organization_mappings,public.attendance_identities TO %I',role_name);
  EXECUTE format('GRANT SELECT,UPDATE ON public.attendance_devices TO %I',role_name);
  EXECUTE format('GRANT SELECT,INSERT ON public.attendance_device_raw_logs TO %I',role_name);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.attendance_device_sync_logs TO %I',role_name);
  FOREACH seq IN ARRAY ARRAY[pg_get_serial_sequence('public.attendance_device_raw_logs','id'),pg_get_serial_sequence('public.attendance_device_sync_logs','id')] LOOP
   IF seq IS NOT NULL THEN EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE %s TO %I',seq,role_name); END IF;
  END LOOP;
 END IF;
END $$;
