import { pgTable, bigint, integer, boolean, timestamp, uniqueIndex, foreignKey } from 'drizzle-orm/pg-core';
import { departments } from './master';
import { employees } from './employees';
import { users } from './users';
import { organizationGroups, organizations } from './organizations';

export const departmentReportRosters = pgTable('department_report_rosters', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  groupId: bigint('group_id', { mode: 'number' }).references(() => organizationGroups.id, { onDelete: 'restrict' }),
  organizationId: bigint('organization_id', { mode: 'number' }).references(() => organizations.id, { onDelete: 'restrict' }),
  departmentId: bigint('department_id', { mode: 'number' }).notNull().references(() => departments.id, { onDelete: 'cascade' }),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  coordinatorId: bigint('coordinator_id', { mode: 'number' }).references(() => employees.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  isCoordinator: boolean('is_coordinator').notNull().default(false),
  updatedById: bigint('updated_by_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({
    name: 'departmentReportRosters_organization_group_fk',
    columns: [table.organizationId, table.groupId],
    foreignColumns: [organizations.id, organizations.groupId],
  }).onDelete('restrict'),
  uniqueIndex('uq_dept_roster_dept_emp').on(table.departmentId, table.employeeId),
]);
