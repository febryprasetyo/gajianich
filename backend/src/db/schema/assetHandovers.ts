import { pgTable, bigint, varchar, date, timestamp, integer, text, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { organizations } from './organizations';
import { employees } from './employees';
import { assets } from './assets';

export const assetHandovers = pgTable(
  'asset_handovers',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    handoverNumber: varchar('handover_number', { length: 50 }).notNull().unique(),
    handoverDate: date('handover_date').notNull(),
    organizationId: bigint('organization_id', { mode: 'number' }).references(() => organizations.id, { onDelete: 'set null' }),
    employeeId: bigint('employee_id', { mode: 'number' }).references(() => employees.id, { onDelete: 'set null' }),
    recipientName: varchar('recipient_name', { length: 150 }).notNull(),
    recipientAddress: text('recipient_address'),
    recipientPosition: varchar('recipient_position', { length: 100 }),
    recipientPhone: varchar('recipient_phone', { length: 50 }),
    itemTypes: jsonb('item_types').$type<string[]>().notNull().default([]),
    itemTypesCustom: varchar('item_types_custom', { length: 150 }),
    givenByName: varchar('given_by_name', { length: 150 }).notNull(),
    givenByTitle: varchar('given_by_title', { length: 100 }),
    givenByUserId: bigint('given_by_user_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
    receivedByName: varchar('received_by_name', { length: 150 }).notNull(),
    notes: text('notes'),
    status: varchar('status', { length: 30 }).default('COMPLETED').notNull(),
    createdById: bigint('created_by_id', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('asset_handovers_date_idx').on(table.handoverDate),
    index('asset_handovers_recipient_idx').on(table.recipientName),
    index('asset_handovers_status_idx').on(table.status),
    index('asset_handovers_created_at_idx').on(table.createdAt),
  ]
);

export const assetHandoverItems = pgTable(
  'asset_handover_items',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    handoverId: bigint('handover_id', { mode: 'number' })
      .notNull()
      .references(() => assetHandovers.id, { onDelete: 'cascade' }),
    itemOrder: integer('item_order').notNull(),
    assetId: bigint('asset_id', { mode: 'number' }).references(() => assets.id, { onDelete: 'set null' }),
    itemName: varchar('item_name', { length: 255 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('asset_handover_items_handover_id_idx').on(table.handoverId),
    index('asset_handover_items_asset_id_idx').on(table.assetId),
  ]
);
