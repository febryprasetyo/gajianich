import {
  pgTable,
  bigint,
  varchar,
  integer,
  timestamp,
  boolean,
  text,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { employees } from './employees';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export const attendanceDevices = pgTable(
  'attendance_devices',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 150 }).notNull(),
    ip: varchar('ip', { length: 50 }).notNull(),
    port: integer('port').default(4370).notNull(),
    commKey: integer('comm_key').default(0).notNull(),
    deviceNumber: integer('device_number').default(1).notNull(),
    serialNumber: varchar('serial_number', { length: 100 }),
    model: varchar('model', { length: 100 }).default('Solution X900'),
    platform: varchar('platform', { length: 100 }),
    firmware: varchar('firmware', { length: 150 }),
    location: varchar('location', { length: 150 }),
    connectionType: varchar('connection_type', { length: 50 }).default('Ethernet').notNull(),
    status: varchar('status', { length: 50 }).default('DISCONNECTED').notNull(),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    timeoutMs: integer('timeout_ms').default(5000).notNull(),
    totalLogs: integer('total_logs').default(0).notNull(),
    lastSyncAt: timestamp('last_sync_at'),
    lastConnectedAt: timestamp('last_connected_at'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_attendance_devices_ip_port').on(table.ip, table.port),
  ]
);

export const attendanceDeviceSyncLogs = pgTable(
  'attendance_device_sync_logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    deviceId: bigint('device_id', { mode: 'number' })
      .notNull()
      .references(() => attendanceDevices.id, { onDelete: 'cascade' }),
    syncType: varchar('sync_type', { length: 50 }).default('MANUAL_DOWNLOAD').notNull(),
    startDate: varchar('start_date', { length: 10 }),
    endDate: varchar('end_date', { length: 10 }),
    status: varchar('status', { length: 50 }).default('PENDING').notNull(),
    totalFetched: integer('total_fetched').default(0).notNull(),
    totalParsed: integer('total_parsed').default(0).notNull(),
    totalProcessed: integer('total_processed').default(0).notNull(),
    errorMessage: text('error_message'),
    createdById: bigint('created_by_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
    }),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('idx_device_sync_logs_device_id').on(table.deviceId),
    index('idx_device_sync_logs_started_at').on(table.startedAt),
  ]
);

export const attendanceDeviceRawLogs = pgTable(
  'attendance_device_raw_logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    syncLogId: bigint('sync_log_id', { mode: 'number' }).references(
      () => attendanceDeviceSyncLogs.id,
      { onDelete: 'set null' }
    ),
    deviceId: bigint('device_id', { mode: 'number' })
      .notNull()
      .references(() => attendanceDevices.id, { onDelete: 'cascade' }),
    pin: varchar('pin', { length: 50 }).notNull(),
    employeeId: bigint('employee_id', { mode: 'number' }).references(() => employees.id, {
      onDelete: 'set null',
    }),
    timestamp: timestamp('timestamp').notNull(),
    workDate: varchar('work_date', { length: 10 }).notNull(),
    verifyMode: varchar('verify_mode', { length: 50 }).default('Fingerprint').notNull(),
    inOutState: varchar('in_out_state', { length: 50 }).default('Masuk').notNull(),
    rawPayload: jsonb('raw_payload'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_raw_logs_pin_timestamp').on(table.pin, table.timestamp),
    index('idx_raw_logs_device_timestamp').on(table.deviceId, table.timestamp),
    index('idx_raw_logs_work_date').on(table.workDate),
  ]
);

export type AttendanceDevice = InferSelectModel<typeof attendanceDevices>;
export type NewAttendanceDevice = InferInsertModel<typeof attendanceDevices>;

export type AttendanceDeviceSyncLog = InferSelectModel<typeof attendanceDeviceSyncLogs>;
export type NewAttendanceDeviceSyncLog = InferInsertModel<typeof attendanceDeviceSyncLogs>;

export type AttendanceDeviceRawLog = InferSelectModel<typeof attendanceDeviceRawLogs>;
export type NewAttendanceDeviceRawLog = InferInsertModel<typeof attendanceDeviceRawLogs>;
