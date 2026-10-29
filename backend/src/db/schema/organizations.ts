import { sql } from 'drizzle-orm';
import { pgTable, bigint, varchar, boolean, timestamp, check, unique, foreignKey, primaryKey, index } from 'drizzle-orm/pg-core';
import { departments, locations } from './master';
import { users } from './users';

export const organizationGroups = pgTable('organization_groups', {
  id: bigint('id', {mode: 'number'}).primaryKey().generatedAlwaysAsIdentity(),
  code: varchar('code', {length: 3, enum: ['CMC', 'MGM']}).notNull().unique(),
  name: varchar('name', {length: 150}).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
}, t => [check('organization_groups_code_check', sql`${t.code} IN ('CMC','MGM')`)]);

export const organizations = pgTable('organizations', {
  id: bigint('id', {mode: 'number'}).primaryKey().generatedAlwaysAsIdentity(),
  groupId: bigint('group_id', {mode: 'number'}).notNull().references(() => organizationGroups.id, {onDelete: 'restrict'}),
  code: varchar('code', {length: 50}).notNull().unique(),
  name: varchar('name', {length: 255}).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
}, t => [unique('organizations_id_group_unique').on(t.id, t.groupId), index('organizations_group_idx').on(t.groupId)]);

export const departmentOrganizationMappings = pgTable('department_organization_mappings', {
  departmentId: bigint('department_id', {mode: 'number'}).primaryKey().references(() => departments.id, {onDelete: 'restrict'}),
  groupId: bigint('group_id', {mode: 'number'}).notNull().references(() => organizationGroups.id, {onDelete: 'restrict'}),
  organizationId: bigint('organization_id', {mode: 'number'}),
  approvalReference: varchar('approval_reference', {length: 255}).notNull(),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
}, t => [
  foreignKey({name: 'department_mapping_organization_group_fk', columns: [t.organizationId,t.groupId], foreignColumns: [organizations.id,organizations.groupId]}).onDelete('restrict'),
  index('department_mapping_group_idx').on(t.groupId),
  check('department_mapping_approval_check', sql`length(trim(${t.approvalReference})) > 0`),
]);

export const locationOrganizationMappings = pgTable('location_organization_mappings', {
  locationId: bigint('location_id', {mode: 'number'}).primaryKey().references(() => locations.id, {onDelete: 'restrict'}),
  groupId: bigint('group_id', {mode: 'number'}).notNull().references(() => organizationGroups.id, {onDelete: 'restrict'}),
  organizationId: bigint('organization_id', {mode: 'number'}),
  approvalReference: varchar('approval_reference', {length: 255}).notNull(),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
}, t => [
  foreignKey({name: 'location_mapping_organization_group_fk', columns: [t.organizationId,t.groupId], foreignColumns: [organizations.id,organizations.groupId]}).onDelete('restrict'),
  index('location_mapping_group_idx').on(t.groupId),
  check('location_mapping_approval_check', sql`length(trim(${t.approvalReference})) > 0`),
]);

export const userOrganizationGroupAccess = pgTable('user_organization_group_access', {
  userId: bigint('user_id', {mode: 'number'}).notNull().references(() => users.id, {onDelete: 'cascade'}),
  groupId: bigint('group_id', {mode: 'number'}).notNull().references(() => organizationGroups.id, {onDelete: 'restrict'}),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
}, t => [primaryKey({columns: [t.userId,t.groupId]}), index('user_organization_group_access_group_idx').on(t.groupId)]);
