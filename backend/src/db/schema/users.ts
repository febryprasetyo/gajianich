import { pgTable, bigint, varchar, timestamp, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { employees } from './employees';

export const permissions = pgTable('permissions', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  code: varchar('code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  module: varchar('module', { length: 50 }).notNull(),
  description: varchar('description', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const roles = pgTable('roles', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
  roleId: bigint('role_id', { mode: 'number' }).notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: bigint('permission_id', { mode: 'number' }).notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
}));

export const users = pgTable('users', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  mustChangePassword: boolean('must_change_password').default(false).notNull(),
  roleId: bigint('role_id', { mode: 'number' }).references(() => roles.id),
  role: varchar('role', { length: 50 }).default('SuperAdmin').notNull(),
  employeeId: bigint('employee_id', { mode: 'number' }).references(() => employees.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 30 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
