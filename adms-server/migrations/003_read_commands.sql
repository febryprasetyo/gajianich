CREATE TABLE IF NOT EXISTS adms.read_commands (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 serial varchar(100) NOT NULL REFERENCES adms.devices(serial) ON DELETE RESTRICT,
 group_id bigint NOT NULL REFERENCES public.organization_groups(id) ON DELETE RESTRICT,
 kind text NOT NULL DEFAULT 'ATTLOG_QUERY' CHECK(kind='ATTLOG_QUERY'),
 start_at timestamp NOT NULL,
 end_at timestamp NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','ACKNOWLEDGED','UNSUPPORTED','FAILED','EXPIRED')),
 requested_by bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 completed_at timestamptz,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 return_code integer,
 CHECK(end_at>=start_at AND end_at-start_at<=interval '31 days')
);
CREATE UNIQUE INDEX IF NOT EXISTS adms_one_pending_read ON adms.read_commands(serial) WHERE status IN ('PENDING','SENT');
INSERT INTO adms.schema_version(version) VALUES(3) ON CONFLICT DO NOTHING;
DO $$
DECLARE role_name text:=nullif(current_setting('gajianich.adms_runtime_role',true),'');
BEGIN
 IF role_name IS NOT NULL THEN
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON adms.read_commands TO %I',role_name);
  EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE adms.read_commands_id_seq TO %I',role_name);
 END IF;
END $$;
