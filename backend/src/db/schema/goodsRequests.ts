import { pgTable, uuid, bigint, varchar, date, timestamp, integer, numeric, text, index, check, jsonb, foreignKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { organizationGroups, organizations } from './organizations';
import type { DocumentProfileSnapshot } from './documentProfiles';

export const goodsRequests = pgTable('ga_goods_requests', {
  id: uuid('id').primaryKey(),
  groupId: bigint('group_id', { mode: 'number' }).references(() => organizationGroups.id),
  organizationId: bigint('organization_id', { mode: 'number' }),
  documentProfileSnapshot: jsonb('document_profile_snapshot').$type<DocumentProfileSnapshot>(),
  title: varchar('title', { length: 255 }).notNull().default(''),
  purpose: text('purpose').notNull().default(''),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  version: integer('version').notNull().default(1),
  requestDate: date('request_date').notNull(),
  requesterName: varchar('requester_name', { length: 150 }).notNull(),
  jobTitle: varchar('job_title', { length: 150 }).notNull(),
  division: varchar('division', { length: 150 }).notNull(),
  createdBy: bigint('created_by', { mode: 'number' }).notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  foreignKey({ columns: [t.organizationId,t.groupId], foreignColumns: [organizations.id,organizations.groupId] }),
  check('ga_goods_owner_pair_check', sql`${t.organizationId} IS NULL OR ${t.groupId} IS NOT NULL`),
  index('ga_goods_requests_group_idx').on(t.groupId),
  index('ga_goods_requests_created_at_idx').on(t.createdAt),
  index('ga_goods_requests_status_idx').on(t.status),
]);

export const goodsRequestItems = pgTable('ga_goods_request_items', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  requestId: uuid('request_id').notNull().references(() => goodsRequests.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  name: varchar('name', { length: 1000 }).notNull(),
  quantity: integer('quantity').notNull(),
  estimatedPrice: numeric('estimated_price', { precision: 14, scale: 0 }).notNull(),
  subtotal: numeric('subtotal', { precision: 14, scale: 0 }).notNull(),
  notes: text('notes').notNull().default(''),
}, t => [
  index('ga_goods_request_items_request_idx').on(t.requestId),
  check('ga_goods_item_quantity_positive', sql`${t.quantity} > 0`),
  check('ga_goods_item_price_positive', sql`${t.estimatedPrice} > 0`),
  check('ga_goods_item_subtotal_correct', sql`${t.subtotal} = ${t.quantity} * ${t.estimatedPrice}`),
]);

export const goodsRequestAttachments = pgTable('ga_goods_request_attachments', {
  id: uuid('id').primaryKey(),
  itemId: bigint('item_id', { mode: 'number' }).notNull().references(() => goodsRequestItems.id, { onDelete: 'cascade' }),
  storageKey: varchar('storage_key', { length: 160 }).notNull(),
  size: integer('size').notNull(),
}, t => [index('ga_goods_attachments_item_idx').on(t.itemId)]);

export const goodsRequestStatusLogs = pgTable('ga_goods_request_status_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  requestId: uuid('request_id').notNull().references(() => goodsRequests.id, { onDelete: 'cascade' }),
  fromStatus: varchar('from_status', { length: 50 }).notNull(),
  toStatus: varchar('to_status', { length: 50 }).notNull(),
  notes: text('notes').notNull().default(''),
  changedBy: bigint('changed_by', { mode: 'number' }).notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  index('ga_goods_status_logs_request_idx').on(t.requestId),
  index('ga_goods_status_logs_created_at_idx').on(t.createdAt),
]);

export const goodsRequestSignedDocuments = pgTable('ga_goods_request_signed_documents', {
  id: uuid('id').primaryKey(),
  requestId: uuid('request_id').notNull().references(() => goodsRequests.id, { onDelete: 'cascade' }),
  storageKey: varchar('storage_key', { length: 255 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  size: integer('size').notNull(),
  uploadedBy: bigint('uploaded_by', { mode: 'number' }).notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  index('ga_goods_signed_docs_request_idx').on(t.requestId),
]);
