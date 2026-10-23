ALTER TABLE attendance_shifts ADD COLUMN auto_approve_in boolean NOT NULL DEFAULT false, ADD COLUMN auto_approve_out boolean NOT NULL DEFAULT false;
ALTER TABLE employees ADD COLUMN photo_url text;
ALTER TABLE attendance_face_profiles ALTER COLUMN face_descriptor_hash TYPE text;
ALTER TABLE attendance_face_profiles ADD COLUMN descriptor_version varchar(50);
ALTER TABLE attendance_self_logs
 ADD COLUMN time_zone varchar(50) NOT NULL DEFAULT 'Asia/Jakarta',
 ADD COLUMN scan_date varchar(10),
 ADD COLUMN schedule_in varchar(10),
 ADD COLUMN schedule_out varchar(10),
 ADD COLUMN occurred_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN review_history jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE attendance_self_logs SET scan_date = work_date, occurred_at = (work_date || ' ' || scan_time)::timestamp AT TIME ZONE 'Asia/Jakarta';
CREATE TABLE attendance_face_requests (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 employee_id bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 descriptor text NOT NULL,
 photo_url text NOT NULL,
 old_photo_url text,
 status varchar(20) NOT NULL DEFAULT 'PENDING',
 note text,
 verified_by_id bigint REFERENCES users(id),
 verified_at timestamp,
 created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_face_request_pending ON attendance_face_requests(employee_id) WHERE status = 'PENDING';
INSERT INTO permissions(code, name, module, description) VALUES ('attendance.mobile.verify', 'Review Mobile Attendance & Photos', 'attendance', 'Approval absensi wajah, foto dan pengaturan approval shift') ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'hr_attendance' AND p.code = 'attendance.mobile.verify'
ON CONFLICT DO NOTHING;
DO $$
DECLARE runtime_name text := nullif(current_setting('ams.hr_audit_runtime_role', true), '');
BEGIN
  IF runtime_name IS NOT NULL THEN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.attendance_self_logs, public.attendance_face_profiles, public.attendance_face_requests TO %I', runtime_name);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.attendance_self_logs_id_seq, public.attendance_face_profiles_id_seq, public.attendance_face_requests_id_seq TO %I', runtime_name);
  END IF;
END;
$$;
