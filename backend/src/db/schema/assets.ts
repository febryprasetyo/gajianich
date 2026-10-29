import { pgTable, bigint, varchar, timestamp, text, uniqueIndex, integer, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { locations } from './master';
import { employees } from './employees';
import { users } from './users';
import { assetCustodians } from './assetCustodians';
import { organizationGroups } from './organizations';

export const assetCategories = pgTable('asset_categories', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  codePrefix: varchar('code', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('asset_categories_name_lower_unique').on(sql`lower(${table.name})`),
  uniqueIndex('asset_categories_code_lower_unique').on(sql`lower(${table.codePrefix})`),
]);

export const assets = pgTable('assets', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  assetCode: varchar('asset_tag', { length: 50 }).notNull().unique(),
  name: varchar('brand', { length: 150 }).notNull(),
  categoryId: bigint('category_id', { mode: 'number' }).references(() => assetCategories.id).notNull(),
  locationId: bigint('location_id', { mode: 'number' }).references(() => locations.id),
  currentCustodianId: bigint('current_custodian_id', { mode: 'number' }).references(() => assetCustodians.id),
  assignedToEmployeeId: bigint('current_user_id', { mode: 'number' }).references(() => employees.id),
  serialNumber: varchar('serial_number', { length: 100 }),
  status: varchar('status', { length: 30 }).default('Available').notNull(), // Available, Assigned, Maintenance, Disposed, Lost
  condition: varchar('condition', { length: 30 }).default('Good').notNull(), // Good, Fair, Poor, Damaged
  purchaseDate: timestamp('purchase_date'),
  warrantyExpiry: timestamp('warranty_expiry'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('assets_serial_number_lower_unique')
    .on(sql`lower(trim(${table.serialNumber}))`)
    .where(sql`${table.serialNumber} IS NOT NULL AND trim(${table.serialNumber}) <> ''`),
]);

export const assetAssignmentHistory = pgTable('asset_assignment_history', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  assetId: bigint('asset_id', { mode: 'number' }).references(() => assets.id, { onDelete: 'cascade' }).notNull(),
  custodianId: bigint('custodian_id', { mode: 'number' }).references(() => assetCustodians.id),
  groupId: bigint('group_id', { mode: 'number' }).references(() => organizationGroups.id),
  custodianNameSnapshot: varchar('custodian_name_snapshot', { length: 150 }),
  locationNameSnapshot: varchar('location_name_snapshot', { length: 100 }),
  employeeId: bigint('employee_id', { mode: 'number' }).references(() => employees.id),
  assignedByUserId: bigint('assigned_by_user_id', { mode: 'number' }).references(() => users.id),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  returnedAt: timestamp('returned_at'),
  conditionOnAssign: varchar('condition_on_assign', { length: 50 }).default('Good').notNull(),
  conditionOnReturn: varchar('condition_on_return', { length: 50 }),
  handoverNotes: text('handover_notes'),
  returnNotes: text('return_notes'),
});

export const assetComputerSpecs = pgTable('asset_computer_specs', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  assetId: bigint('asset_id', { mode: 'number' })
    .references(() => assets.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  cpuName: varchar('cpu_name', { length: 200 }),
  ramSizeGb: integer('ram_size_gb'),
  ramSlotCount: integer('ram_slot_count'),
  disk1SizeGb: integer('disk_1_size_gb'),
  disk2SizeGb: integer('disk_2_size_gb'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  check('asset_computer_specs_ram_size_positive', sql`${table.ramSizeGb} > 0`),
  check('asset_computer_specs_ram_slots_positive', sql`${table.ramSlotCount} > 0`),
  check('asset_computer_specs_disk_1_positive', sql`${table.disk1SizeGb} > 0`),
  check('asset_computer_specs_disk_2_positive', sql`${table.disk2SizeGb} IS NULL OR ${table.disk2SizeGb} > 0`),
]);

export const assetAccessories = pgTable('asset_accessories', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  assetId: bigint('asset_id', { mode: 'number' })
    .references(() => assets.id, { onDelete: 'cascade' })
    .notNull(),
  accessoryType: varchar('accessory_type', { length: 50 }).notNull(),
  description: varchar('description', { length: 150 }),
  quantity: integer('quantity').default(1).notNull(),
  condition: varchar('condition', { length: 30 }).default('Good').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  check('asset_accessories_quantity_positive', sql`${table.quantity} > 0`),
]);
