ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "server_type" varchar(30) DEFAULT 'VPS';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "provider" varchar(100);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "location" varchar(150);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "environment" varchar(30) DEFAULT 'Production';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "role_badge" varchar(60) DEFAULT 'ACTIVE PROD WORKER';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "connection_mode" varchar(30) DEFAULT 'WS PUSH';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "cpu_model" varchar(150);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "cpu_cores" integer DEFAULT 4;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "daemon_core" varchar(60) DEFAULT 'Systemd 249.11';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "avg_ping_ms" numeric DEFAULT '1.2';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "cpu_usage_pct" numeric DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "cpu_iowait_pct" numeric DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "cpu_steal_pct" numeric DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "load_avg" jsonb DEFAULT '[0,0,0]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "context_switches_per_sec" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "interrupts_per_sec" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "zombie_processes" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "total_processes" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "ram_used_bytes" bigint DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "ram_total_bytes" bigint DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "ram_usage_pct" numeric DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "ram_buffers_bytes" bigint DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "swap_used_pct" numeric DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "disk_used_bytes" bigint DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "disk_total_bytes" bigint DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "disk_usage_pct" numeric DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "disk_read_bps" bigint DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "disk_write_bps" bigint DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "disk_iops" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "disk_mount_type" varchar(50) DEFAULT 'ext4 / root';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "inode_used" bigint DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "inode_total" bigint DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "inode_usage_pct" numeric DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "smart_status" varchar(30) DEFAULT 'PASSED';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "net_rx_bps" bigint DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "net_tx_bps" bigint DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "net_drop_packets" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "net_retrans_pct" numeric DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "tcp_established" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "tcp_time_wait" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "tcp_syn_recv" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "fd_allocated" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "fd_max" integer DEFAULT 65535;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "ssl_days_remaining" integer DEFAULT 90;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "ufw_status" varchar(40) DEFAULT 'Active';
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "fail2ban_banned_ips" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "failed_ssh_count" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "open_ports" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "unified_services" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "spark_history" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server_metric_samples" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "server_metric_samples_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"server_id" bigint NOT NULL REFERENCES "servers"("id") ON DELETE cascade,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"cpu_usage_pct" numeric DEFAULT '0' NOT NULL,
	"ram_usage_pct" numeric DEFAULT '0' NOT NULL,
	"disk_usage_pct" numeric DEFAULT '0' NOT NULL,
	"disk_read_bps" bigint DEFAULT 0 NOT NULL,
	"disk_write_bps" bigint DEFAULT 0 NOT NULL,
	"net_rx_bps" bigint DEFAULT 0 NOT NULL,
	"net_tx_bps" bigint DEFAULT 0 NOT NULL,
	"load_avg_1m" numeric DEFAULT '0' NOT NULL,
	"tcp_established" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_server_metric_samples_server_recorded" ON "server_metric_samples" ("server_id","recorded_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server_remote_commands" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "server_remote_commands_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"server_id" bigint NOT NULL REFERENCES "servers"("id") ON DELETE cascade,
	"action_type" varchar(40) NOT NULL,
	"target_id" varchar(150) NOT NULL,
	"target_name" varchar(150) NOT NULL,
	"category" varchar(40) DEFAULT 'systemd' NOT NULL,
	"status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"output_text" text,
	"requested_by_user_id" bigint REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_server_remote_commands_server_status" ON "server_remote_commands" ("server_id","status");

