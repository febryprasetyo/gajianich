CREATE TABLE IF NOT EXISTS "attendance_self_logs" (
"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attendance_self_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
"employee_id" bigint NOT NULL,
"user_id" bigint,
"event_type" varchar(10) NOT NULL,
"work_date" varchar(10) NOT NULL,
"scan_time" varchar(10) NOT NULL,
"shift_code" varchar(50) NOT NULL,
"shift_category" varchar(20) NOT NULL,
"latitude" varchar(30),
"longitude" varchar(30),
"accuracy" integer,
"address" text,
"map_url" text,
"google_maps_url" text,
"is_within_geofence" boolean DEFAULT true NOT NULL,
"distance_meters" integer,
"photo_url" text,
"photo_purged_at" timestamp,
"tx_hash" varchar(100) NOT NULL,
"device_info" text,
"notes" text,
"requires_verification" boolean DEFAULT true NOT NULL,
"approval_status" varchar(20) DEFAULT 'PENDING' NOT NULL,
"approval_note" text,
"verified_by_id" bigint,
"verified_at" timestamp,
"created_at" timestamp DEFAULT now() NOT NULL,
CONSTRAINT "attendance_self_logs_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_face_profiles" (
"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attendance_face_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
"employee_id" bigint NOT NULL,
"is_enrolled" boolean DEFAULT true NOT NULL,
"face_descriptor_hash" varchar(128),
"sample_photo_url" text,
"enrolled_at" timestamp DEFAULT now() NOT NULL,
"updated_at" timestamp DEFAULT now() NOT NULL,
CONSTRAINT "attendance_face_profiles_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "attendance_self_logs" ADD CONSTRAINT "attendance_self_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "attendance_self_logs" ADD CONSTRAINT "attendance_self_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "attendance_self_logs" ADD CONSTRAINT "attendance_self_logs_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "attendance_face_profiles" ADD CONSTRAINT "attendance_face_profiles_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attendance_self_logs_employee_date" ON "attendance_self_logs" USING btree ("employee_id", "work_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attendance_self_logs_approval_status" ON "attendance_self_logs" USING btree ("approval_status");
--> statement-breakpoint
INSERT INTO permissions (code, name, module, description) VALUES
('attendance.mobile.verify', 'Verify Mobile Attendance', 'attendance', 'Memverifikasi atau menolak pengajuan presensi mobile karyawan')
ON CONFLICT (code) DO NOTHING;
