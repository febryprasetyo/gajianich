import { pgTable, bigint, varchar, text, boolean, timestamp, uniqueIndex, foreignKey } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';
import { organizationGroups, organizations } from './organizations';

export const attendanceDailyNotes = pgTable('attendance_daily_notes', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  groupId: bigint('group_id', { mode: 'number' }).references(() => organizationGroups.id, { onDelete: 'restrict' }),
  organizationId: bigint('organization_id', { mode: 'number' }).references(() => organizations.id, { onDelete: 'restrict' }),
  workDate: varchar('work_date', { length: 10 }).notNull(), // 'YYYY-MM-DD'
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  isHighlighted: boolean('is_highlighted').default(false).notNull(), // Highlight kuning manual oleh HRD
  manualNote: text('manual_note'), // Memo keterangan manual HRD
  updatedById: bigint('updated_by_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({
    name: 'attendanceDailyNotes_organization_group_fk',
    columns: [table.organizationId, table.groupId],
    foreignColumns: [organizations.id, organizations.groupId]
  }).onDelete('restrict'),
  uniqueIndex('uq_attendance_daily_notes_emp_date').on(table.employeeId, table.workDate),
]);
