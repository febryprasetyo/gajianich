import { pgTable, bigint, varchar, integer, timestamp, boolean, uniqueIndex, foreignKey } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';
import { organizationGroups, organizations } from './organizations';

export const attendanceBatches = pgTable('attendance_batches', {
  groupId: bigint('group_id', {mode: 'number'}).references(() => organizationGroups.id, {onDelete: 'restrict'}),
  organizationId: bigint('organization_id', {mode: 'number'}).references(() => organizations.id, {onDelete: 'restrict'}),
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  filename: varchar('filename', { length: 255 }).notNull(),
  sourceId: integer('source_id').default(1).notNull(),
  fileHash: varchar('file_hash', { length: 64 }),
  status: varchar('status', { length: 20 }).default('COMMITTED').notNull(), // 'DRAFT' | 'COMMITTED' | 'CANCELLED'
  totalRows: integer('total_rows').default(0).notNull(),
  validRows: integer('valid_rows').default(0).notNull(),
  skippedRows: integer('skipped_rows').default(0).notNull(),
  strictIntegrity: boolean('strict_integrity').default(false).notNull(),
  revision: integer('revision').default(1).notNull(),
  createdById: bigint('created_by_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  committedAt: timestamp('committed_at'),
}, (table) => [
  foreignKey({name:'attendanceBatches_organization_group_fk',columns:[table.organizationId,table.groupId],foreignColumns:[organizations.id,organizations.groupId]}).onDelete('restrict'),
]);

export const attendanceRecords = pgTable('attendance_records', {
  groupId: bigint('group_id', {mode: 'number'}).references(() => organizationGroups.id, {onDelete: 'restrict'}),
  organizationId: bigint('organization_id', {mode: 'number'}).references(() => organizations.id, {onDelete: 'restrict'}),
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  workDate: varchar('work_date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
  shift: varchar('shift', { length: 100 }),
  scheduleIn: varchar('schedule_in', { length: 10 }),
  scheduleOut: varchar('schedule_out', { length: 10 }),
  scanIn: varchar('scan_in', { length: 10 }),
  scanOut: varchar('scan_out', { length: 10 }),
  rawScanIn: varchar('raw_scan_in', { length: 10 }),
  rawScanOut: varchar('raw_scan_out', { length: 10 }),
  lateMinutes: integer('late_minutes').default(0).notNull(),
  earlyMinutes: integer('early_minutes').default(0).notNull(),
  overtimeMinutes: integer('overtime_minutes').default(0).notNull(),
  attendanceStatus: varchar('attendance_status', { length: 20 }).default('PRESENT').notNull(), // 'PRESENT' | 'DINAS_LUAR' | 'IZIN' | 'SAKIT' | 'CUTI' | 'ALPHA'
  isDayOff: boolean('is_day_off').default(false).notNull(),
  normalized: boolean('normalized').default(false).notNull(),
  revision: integer('revision').default(1).notNull(),
  sourceBatchId: bigint('source_batch_id', { mode: 'number' }).references(() => attendanceBatches.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({name:'attendanceRecords_organization_group_fk',columns:[table.organizationId,table.groupId],foreignColumns:[organizations.id,organizations.groupId]}).onDelete('restrict'),
  uniqueIndex('uq_attendance_employee_date').on(table.employeeId, table.workDate),
]);
