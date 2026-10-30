import {
  pgTable,
  bigint,
  varchar,
  integer,
  timestamp,
  boolean,
  text,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { departments } from './master';
import { users } from './users';
import { attendanceBatches } from './attendance';

// ---------------------------------------------------------------------------
// Master Jam Kerja — template jam kerja reusable (Daytime, Sabtu Pendek, dsb)
// ---------------------------------------------------------------------------
export const attendanceWorkHours = pgTable('attendance_work_hours', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 20 }),
  // Jam resmi masuk & pulang
  scheduleIn: varchar('schedule_in', { length: 5 }).notNull(),   // "HH:mm"
  scheduleOut: varchar('schedule_out', { length: 5 }).notNull(), // "HH:mm"
  // Window tap masuk yang diterima sistem
  scanInStart: varchar('scan_in_start', { length: 5 }).notNull(),
  scanInEnd: varchar('scan_in_end', { length: 5 }).notNull(),
  // Window tap pulang yang diterima sistem
  scanOutStart: varchar('scan_out_start', { length: 5 }).notNull(),
  scanOutEnd: varchar('scan_out_end', { length: 5 }).notNull(),
  // Toleransi
  lateToleranceMinutes: integer('late_tolerance_minutes').default(5).notNull(),
  earlyLeaveToleranceMinutes: integer('early_leave_tolerance_minutes').default(5).notNull(),
  // Flag wajib tap
  requireCheckIn: boolean('require_check_in').default(true).notNull(),
  requireCheckOut: boolean('require_check_out').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const attendanceSources = pgTable(
  'attendance_sources',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 150 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

export const attendanceIdentities = pgTable(
  'attendance_identities',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    sourceId: bigint('source_id', { mode: 'number' }).references(() => attendanceSources.id, { onDelete: 'cascade' }),
    externalNoId: varchar('external_no_id', { length: 100 }).notNull(),
    employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_attendance_identities_source_external').on(table.sourceId, table.externalNoId),
  ]
);

// ---------------------------------------------------------------------------
// Master Shift — mapping per-hari ke template Jam Kerja
// FK null pada hari tertentu = hari libur (Senin-Sabtu: tidak hadir = ALPHA;
// Minggu: tidak hadir = LIBUR, TIDAK pernah ALPHA)
// ---------------------------------------------------------------------------
export const attendanceShifts = pgTable(
  'attendance_shifts',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    // Mapping per-hari → FK ke attendanceWorkHours (null = hari libur)
    mondayWorkHoursId: bigint('monday_work_hours_id', { mode: 'number' }).references(() => attendanceWorkHours.id, { onDelete: 'set null' }),
    tuesdayWorkHoursId: bigint('tuesday_work_hours_id', { mode: 'number' }).references(() => attendanceWorkHours.id, { onDelete: 'set null' }),
    wednesdayWorkHoursId: bigint('wednesday_work_hours_id', { mode: 'number' }).references(() => attendanceWorkHours.id, { onDelete: 'set null' }),
    thursdayWorkHoursId: bigint('thursday_work_hours_id', { mode: 'number' }).references(() => attendanceWorkHours.id, { onDelete: 'set null' }),
    fridayWorkHoursId: bigint('friday_work_hours_id', { mode: 'number' }).references(() => attendanceWorkHours.id, { onDelete: 'set null' }),
    saturdayWorkHoursId: bigint('saturday_work_hours_id', { mode: 'number' }).references(() => attendanceWorkHours.id, { onDelete: 'set null' }),
    // Minggu selalu opsional — null/tidak tap = LIBUR, bukan ALPHA
    sundayWorkHoursId: bigint('sunday_work_hours_id', { mode: 'number' }).references(() => attendanceWorkHours.id, { onDelete: 'set null' }),
    autoApproveIn: boolean('auto_approve_in').default(false).notNull(),
    autoApproveOut: boolean('auto_approve_out').default(false).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// ---------------------------------------------------------------------------
// Penugasan Shift — satu departemen bisa memiliki beberapa shift (multiple)
// dengan penanda isDefault untuk shift utama
// ---------------------------------------------------------------------------
export const attendanceShiftAssignments = pgTable(
  'attendance_shift_assignments',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    shiftId: bigint('shift_id', { mode: 'number' }).notNull().references(() => attendanceShifts.id, { onDelete: 'cascade' }),
    departmentId: bigint('department_id', { mode: 'number' }).references(() => departments.id, { onDelete: 'cascade' }),
    employeeId: bigint('employee_id', { mode: 'number' }).references(() => employees.id, { onDelete: 'cascade' }),
    // Shift utama departemen (hanya satu isDefault:true per departemen)
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_shift_assignment_employee').on(table.employeeId),
    // Diubah: departemen bisa punya banyak shift, unik per (departement+shift)
    uniqueIndex('uq_shift_assignment_dept_shift').on(table.departmentId, table.shiftId),
  ]
);

export const attendanceLocks = pgTable(
  'attendance_locks',
  {
    workDate: varchar('work_date', { length: 10 }).primaryKey(),
    reason: varchar('reason', { length: 255 }).notNull(),
    actorId: bigint('actor_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);

export const attendanceGrants = pgTable(
  'attendance_grants',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    principalKey: varchar('principal_key', { length: 150 }).notNull().unique(),
    displayName: varchar('display_name', { length: 150 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(), // 'HR_ADMIN' | 'HR_STAFF' | 'REPORT_VIEWER'
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

export const attendanceImportRows = pgTable(
  'attendance_import_rows',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    batchId: bigint('batch_id', { mode: 'number' }).notNull().references(() => attendanceBatches.id, { onDelete: 'cascade' }),
    rowNumber: integer('row_number').notNull(),
    externalNoId: varchar('external_no_id', { length: 100 }).notNull(),
    employeeId: bigint('employee_id', { mode: 'number' }).references(() => employees.id, { onDelete: 'set null' }),
    workDate: varchar('work_date', { length: 10 }).notNull(),
    scanIn: varchar('scan_in', { length: 10 }),
    scanOut: varchar('scan_out', { length: 10 }),
    rawScanIn: varchar('raw_scan_in', { length: 10 }),
    rawScanOut: varchar('raw_scan_out', { length: 10 }),
    lateMinutes: integer('late_minutes').default(0).notNull(),
    earlyMinutes: integer('early_minutes').default(0).notNull(),
    overtimeMinutes: integer('overtime_minutes').default(0).notNull(),
    reviewStatus: varchar('review_status', { length: 20 }).default('NEEDS_REVIEW').notNull(),
    note: text('note').default('').notNull(),
    attendanceStatus: varchar('attendance_status', { length: 20 }),
    normalized: boolean('normalized').default(false).notNull(),
    issues: jsonb('issues').$type<string[]>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_attendance_import_rows_batch_row').on(table.batchId, table.rowNumber),
  ]
);

export const attendanceRevisions = pgTable(
  'attendance_revisions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    recordId: bigint('record_id', { mode: 'number' }).notNull(),
    reason: varchar('reason', { length: 255 }).notNull(),
    actor: varchar('actor', { length: 150 }).notNull(),
    before: jsonb('before').notNull(),
    after: jsonb('after').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);
