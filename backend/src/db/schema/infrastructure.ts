import {
  pgTable,
  bigint,
  varchar,
  timestamp,
  text,
  numeric,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { accurateLicenses } from './licenses';
import { users } from './users';

export const servers = pgTable('servers', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  serverCode: varchar('hostname', { length: 100 }),
  name: varchar('name', { length: 150 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  macAddress: varchar('mac_address', { length: 32 }),
  os: varchar('os', { length: 150 }),
  specs: varchar('storage_spec', { length: 255 }),
  status: varchar('status', { length: 30 }).default('Online'),
  notes: text('notes'),
  licenseServerUrl: varchar('license_server_url', { length: 255 }),
  agentVersion: varchar('agent_version', { length: 30 }),
  agentKeyHash: varchar('agent_key_hash', { length: 128 }),
  agentKeyPrefix: varchar('agent_key_prefix', { length: 32 }),
  uptimeSeconds: bigint('uptime_seconds', { mode: 'number' }).default(0),
  accurateStatus: varchar('accurate_status', { length: 30 }).default('UNKNOWN'),
  isAccurateActive: boolean('is_accurate_active').default(false).notNull(),
  isFirebirdActive: boolean('is_firebird_active').default(false).notNull(),
  services: jsonb('services').$type<unknown[]>().default([]).notNull(),
  processes: jsonb('processes').$type<unknown[]>().default([]).notNull(),

  // Server360 & ServerPulse extended telemetry columns
  serverType: varchar('server_type', { length: 30 }).default('VPS'),
  provider: varchar('provider', { length: 100 }),
  location: varchar('location', { length: 150 }),
  environment: varchar('environment', { length: 30 }).default('Production'),
  roleBadge: varchar('role_badge', { length: 60 }).default('ACTIVE PROD WORKER'),
  connectionMode: varchar('connection_mode', { length: 30 }).default('WS PUSH'),
  cpuModel: varchar('cpu_model', { length: 150 }),
  cpuCores: integer('cpu_cores').default(4),
  daemonCore: varchar('daemon_core', { length: 60 }).default('Systemd 249.11'),
  avgPingMs: numeric('avg_ping_ms').default('1.2'),

  // CPU & Kernel Scheduler
  cpuUsagePct: numeric('cpu_usage_pct').default('0'),
  cpuIoWaitPct: numeric('cpu_iowait_pct').default('0'),
  cpuStealPct: numeric('cpu_steal_pct').default('0'),
  loadAvg: jsonb('load_avg').$type<number[]>().default([0, 0, 0]).notNull(),
  contextSwitchesPerSec: integer('context_switches_per_sec').default(0),
  interruptsPerSec: integer('interrupts_per_sec').default(0),
  zombieProcesses: integer('zombie_processes').default(0),
  totalProcesses: integer('total_processes').default(0),

  // Memory & Swap
  ramUsedBytes: bigint('ram_used_bytes', { mode: 'number' }).default(0),
  ramTotalBytes: bigint('ram_total_bytes', { mode: 'number' }).default(0),
  ramUsagePct: numeric('ram_usage_pct').default('0'),
  ramBuffersBytes: bigint('ram_buffers_bytes', { mode: 'number' }).default(0),
  swapUsedPct: numeric('swap_used_pct').default('0'),

  // Storage, NVMe I/O & Inodes
  diskUsedBytes: bigint('disk_used_bytes', { mode: 'number' }).default(0),
  diskTotalBytes: bigint('disk_total_bytes', { mode: 'number' }).default(0),
  diskUsagePct: numeric('disk_usage_pct').default('0'),
  diskReadBytesPerSec: bigint('disk_read_bps', { mode: 'number' }).default(0),
  diskWriteBytesPerSec: bigint('disk_write_bps', { mode: 'number' }).default(0),
  diskIops: integer('disk_iops').default(0),
  diskMountType: varchar('disk_mount_type', { length: 50 }).default('ext4 / root'),
  inodeUsed: bigint('inode_used', { mode: 'number' }).default(0),
  inodeTotal: bigint('inode_total', { mode: 'number' }).default(0),
  inodeUsagePct: numeric('inode_usage_pct').default('0'),
  smartStatus: varchar('smart_status', { length: 30 }).default('PASSED'),

  // Network & TCP Descriptors
  netRxBytesPerSec: bigint('net_rx_bps', { mode: 'number' }).default(0),
  netTxBytesPerSec: bigint('net_tx_bps', { mode: 'number' }).default(0),
  netDropPackets: integer('net_drop_packets').default(0),
  netRetransPct: numeric('net_retrans_pct').default('0'),
  tcpEstablished: integer('tcp_established').default(0),
  tcpTimeWait: integer('tcp_time_wait').default(0),
  tcpSynRecv: integer('tcp_syn_recv').default(0),
  fdAllocated: integer('fd_allocated').default(0),
  fdMax: integer('fd_max').default(65535),

  // SecOps & Shield
  sslDaysRemaining: integer('ssl_days_remaining').default(90),
  ufwStatus: varchar('ufw_status', { length: 40 }).default('Active'),
  fail2banBannedIps: integer('fail2ban_banned_ips').default(0),
  failedSshCount: integer('failed_ssh_count').default(0),

  // Open Ports, Unified Workloads (PM2, Docker, DB, Systemd, Native) & Sparklines
  openPorts: jsonb('open_ports').$type<unknown[]>().default([]).notNull(),
  unifiedServices: jsonb('unified_services').$type<unknown[]>().default([]).notNull(),
  sparkHistory: jsonb('spark_history').$type<Record<string, number[]>>().default({}).notNull(),

  lastSeenAt: timestamp('last_seen_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('servers_hostname_unique').on(table.serverCode),
]);

export const serverMetricSamples = pgTable('server_metric_samples', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  serverId: bigint('server_id', { mode: 'number' }).references(() => servers.id, { onDelete: 'cascade' }).notNull(),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  cpuUsagePct: numeric('cpu_usage_pct').default('0').notNull(),
  ramUsagePct: numeric('ram_usage_pct').default('0').notNull(),
  diskUsagePct: numeric('disk_usage_pct').default('0').notNull(),
  diskReadBytesPerSec: bigint('disk_read_bps', { mode: 'number' }).default(0).notNull(),
  diskWriteBytesPerSec: bigint('disk_write_bps', { mode: 'number' }).default(0).notNull(),
  netRxBytesPerSec: bigint('net_rx_bps', { mode: 'number' }).default(0).notNull(),
  netTxBytesPerSec: bigint('net_tx_bps', { mode: 'number' }).default(0).notNull(),
  loadAvg1m: numeric('load_avg_1m').default('0').notNull(),
  tcpEstablished: integer('tcp_established').default(0).notNull(),
}, (table) => [
  index('idx_server_metric_samples_server_recorded').on(table.serverId, table.recordedAt),
]);

export const serverRemoteCommands = pgTable('server_remote_commands', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  serverId: bigint('server_id', { mode: 'number' }).references(() => servers.id, { onDelete: 'cascade' }).notNull(),
  actionType: varchar('action_type', { length: 40 }).notNull(),
  targetId: varchar('target_id', { length: 150 }).notNull(),
  targetName: varchar('target_name', { length: 150 }).notNull(),
  category: varchar('category', { length: 40 }).default('systemd').notNull(),
  status: varchar('status', { length: 30 }).default('PENDING').notNull(),
  outputText: text('output_text'),
  requestedByUserId: bigint('requested_by_user_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('idx_server_remote_commands_server_status').on(table.serverId, table.status),
]);

export const accurateLicenseLogs = pgTable('accurate_license_logs', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  serverId: bigint('server_id', { mode: 'number' }).references(() => servers.id, { onDelete: 'cascade' }).notNull(),
  seatNo: integer('seat_no'),
  licenseKey: varchar('license_key', { length: 100 }),
  date: varchar('date', { length: 50 }),
  ip: varchar('ip_address', { length: 45 }),
  version: varchar('version', { length: 50 }),
  host: varchar('host', { length: 100 }),
  status: varchar('status', { length: 30 }).default('ACTIVE'),
  scrapedAt: timestamp('scraped_at').defaultNow(),
}, (table) => [
  uniqueIndex('accurate_license_logs_server_key_unique').on(table.serverId, table.licenseKey),
]);

export const accurateDatabases = pgTable('accurate_databases', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  databaseName: varchar('database_name', { length: 150 }).notNull(),
  serverId: bigint('server_id', { mode: 'number' }).references(() => servers.id, { onDelete: 'cascade' }).notNull(),
  filePath: varchar('file_path', { length: 500 }),
  companyAlias: varchar('company_alias', { length: 150 }),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).default(0).notNull(),
  fileSizeMb: numeric('file_size_mb').default('0').notNull(),
  fileSizeFormatted: varchar('file_size_formatted', { length: 50 }).default('0 MB').notNull(),
  status: varchar('status', { length: 30 }).default('Online').notNull(),
  lastModifiedAt: timestamp('last_modified_at'),
  fileCreatedAt: timestamp('file_created_at'),
  reportedAt: timestamp('reported_at').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('accurate_databases_server_path_unique').on(table.serverId, table.filePath),
]);

export const accurateDatabaseUsers = pgTable('accurate_database_users', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  databaseId: bigint('database_id', { mode: 'number' }).references(() => accurateDatabases.id).notNull(),
  employeeId: bigint('employee_id', { mode: 'number' }).references(() => employees.id).notNull(),
  licenseId: bigint('license_id', { mode: 'number' }).references(() => accurateLicenses.id),
  accessRole: varchar('access_role', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const databaseBackups = pgTable('database_backups', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  databaseId: bigint('database_id', { mode: 'number' }).references(() => accurateDatabases.id).notNull(),
  backupPath: varchar('backup_path', { length: 255 }).notNull(),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  status: varchar('status', { length: 30 }).default('Success').notNull(),
  backupTimestamp: timestamp('backup_timestamp').defaultNow().notNull(),
  notes: text('notes'),
});

export const dbBackups = pgTable('db_backups', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  serverId: bigint('server_id', { mode: 'number' }).references(() => servers.id),
  dbName: varchar('db_name', { length: 100 }),
  sizeMb: numeric('size_mb'),
  status: varchar('status', { length: 30 }).default('Success'),
  backupPath: varchar('backup_path', { length: 255 }),
  completedAt: timestamp('completed_at').defaultNow(),
});
