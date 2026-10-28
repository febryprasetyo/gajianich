CREATE TABLE "attendance_device_raw_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attendance_device_raw_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sync_log_id" bigint,
	"device_id" bigint NOT NULL,
	"pin" varchar(50) NOT NULL,
	"employee_id" bigint,
	"timestamp" timestamp NOT NULL,
	"work_date" varchar(10) NOT NULL,
	"verify_mode" varchar(50) DEFAULT 'Fingerprint' NOT NULL,
	"in_out_state" varchar(50) DEFAULT 'Masuk' NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_device_sync_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attendance_device_sync_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"device_id" bigint NOT NULL,
	"sync_type" varchar(50) DEFAULT 'MANUAL_DOWNLOAD' NOT NULL,
	"start_date" varchar(10),
	"end_date" varchar(10),
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"total_fetched" integer DEFAULT 0 NOT NULL,
	"total_parsed" integer DEFAULT 0 NOT NULL,
	"total_processed" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_by_id" bigint,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "attendance_devices" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attendance_devices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" varchar(50) NOT NULL,
	"name" varchar(150) NOT NULL,
	"ip" varchar(50) NOT NULL,
	"port" integer DEFAULT 4370 NOT NULL,
	"comm_key" integer DEFAULT 0 NOT NULL,
	"device_number" integer DEFAULT 1 NOT NULL,
	"serial_number" varchar(100),
	"model" varchar(100) DEFAULT 'Solution X900',
	"platform" varchar(100),
	"firmware" varchar(150),
	"location" varchar(150),
	"connection_type" varchar(50) DEFAULT 'Ethernet' NOT NULL,
	"status" varchar(50) DEFAULT 'DISCONNECTED' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"timeout_ms" integer DEFAULT 5000 NOT NULL,
	"total_logs" integer DEFAULT 0 NOT NULL,
	"last_sync_at" timestamp,
	"last_connected_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_devices_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "attendance_device_raw_logs" ADD CONSTRAINT "attendance_device_raw_logs_sync_log_id_attendance_device_sync_logs_id_fk" FOREIGN KEY ("sync_log_id") REFERENCES "public"."attendance_device_sync_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_device_raw_logs" ADD CONSTRAINT "attendance_device_raw_logs_device_id_attendance_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."attendance_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_device_raw_logs" ADD CONSTRAINT "attendance_device_raw_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_device_sync_logs" ADD CONSTRAINT "attendance_device_sync_logs_device_id_attendance_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."attendance_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_device_sync_logs" ADD CONSTRAINT "attendance_device_sync_logs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_raw_logs_pin_timestamp" ON "attendance_device_raw_logs" USING btree ("pin","timestamp");--> statement-breakpoint
CREATE INDEX "idx_raw_logs_device_timestamp" ON "attendance_device_raw_logs" USING btree ("device_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_raw_logs_work_date" ON "attendance_device_raw_logs" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX "idx_device_sync_logs_device_id" ON "attendance_device_sync_logs" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_device_sync_logs_started_at" ON "attendance_device_sync_logs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_attendance_devices_ip_port" ON "attendance_devices" USING btree ("ip","port");