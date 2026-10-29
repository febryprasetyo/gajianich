import { pgTable, bigint, varchar, timestamp, text, integer } from 'drizzle-orm/pg-core';
import { assets } from './assets';
import {organizationGroups} from './organizations';

export const hardwareAuditLogs = pgTable('hardware_audit_logs', {
  groupId:bigint('group_id',{mode:'number'}).references(()=>organizationGroups.id),
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  custodianName: varchar('custodian_name', { length: 150 }).notNull(),
  serialNumber: varchar('serial_number', { length: 100 }),
  manufacturer: varchar('manufacturer', { length: 100 }),
  model: varchar('model', { length: 150 }),
  cpuName: varchar('cpu_name', { length: 200 }),
  ramSizeGb: integer('ram_size_gb'),
  ramSlotCount: integer('ram_slot_count'),
  disk1SizeGb: integer('disk_1_size_gb'),
  disk2SizeGb: integer('disk_2_size_gb'),
  rawSpecs: text('raw_specs'),
  notes: text('notes'),
  status: varchar('status', { length: 30 }).default('PENDING').notNull(), // PENDING, SYNCED_AUTO, SYNCED_MANUAL, DISMISSED
  matchedAssetId: bigint('matched_asset_id', { mode: 'number' }).references(() => assets.id, { onDelete: 'set null' }),
  scannedAt: timestamp('scanned_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type HardwareAuditLog = typeof hardwareAuditLogs.$inferSelect;
export type NewHardwareAuditLog = typeof hardwareAuditLogs.$inferInsert;

export const hardwareAuditPeripherals = pgTable('hardware_audit_peripherals', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  auditId: bigint('audit_id', { mode: 'number' })
    .references(() => hardwareAuditLogs.id, { onDelete: 'cascade' })
    .notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  presetCategory: varchar('preset_category', { length: 50 }),
  customCategory: varchar('custom_category', { length: 100 }),
  brandModel: varchar('brand_model', { length: 200 }).notNull(),
  serialNumber: varchar('serial_number', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type HardwareAuditPeripheralRecord = typeof hardwareAuditPeripherals.$inferSelect;
export type NewHardwareAuditPeripheralRecord = typeof hardwareAuditPeripherals.$inferInsert;

