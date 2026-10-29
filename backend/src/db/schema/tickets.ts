import { organizationGroups } from './organizations';
import { pgTable, bigint, varchar, timestamp, text, integer, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';
import { assets } from './assets';
import { employees } from './employees';

export const ticketCategories = pgTable('ticket_categories', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  code: varchar('code', { length: 20 }),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const slaPolicies = pgTable('sla_policies', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  priority: varchar('priority', { length: 20 }).notNull().unique(), // Low, Medium, High, Critical
  targetResponseHours: integer('target_response_hours').notNull(),
  targetResolutionHours: integer('target_resolution_hours').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const itTickets = pgTable('it_tickets', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ticketCode: varchar('ticket_code', { length: 50 }).notNull().unique(),
  type: varchar('type', { length: 20 }).default('Incident').notNull(), // Incident, Request
  subject: varchar('subject', { length: 200 }).notNull(),
  description: text('description').notNull(),
  categoryId: bigint('category_id', { mode: 'number' }).references(() => ticketCategories.id).notNull(),
  priority: varchar('priority', { length: 20 }).default('Medium').notNull(), // Low, Medium, High, Critical
  status: varchar('status', { length: 30 }).default('Open').notNull(), // Open, In Progress, Pending, Resolved, Closed
  reporterId: bigint('reporter_id', { mode: 'number' }).notNull(),
  assigneeId: bigint('assignee_id', { mode: 'number' }).references(() => users.id),
  assetId: bigint('asset_id', { mode: 'number' }).references(() => assets.id, { onDelete: 'set null' }),
  dueAt: timestamp('due_at'),
  resolvedAt: timestamp('resolved_at'),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ticketComments = pgTable('ticket_comments', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  ticketId: bigint('ticket_id', { mode: 'number' }).references(() => itTickets.id, { onDelete: 'cascade' }).notNull(),
  userId: bigint('user_id', { mode: 'number' }).references(() => users.id).notNull(),
  commentText: text('comment_text').notNull(),
  isInternal: boolean('is_internal').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const assetMaintenances = pgTable('asset_maintenances', {
  groupId: bigint('group_id', { mode: 'number' }).references(() => organizationGroups.id),
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  assetId: bigint('asset_id', { mode: 'number' }).references(() => assets.id, { onDelete: 'cascade' }).notNull(),
  maintenanceType: varchar('maintenance_type', { length: 30 }).notNull(), // Preventive, Corrective
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  cost: bigint('cost', { mode: 'number' }).default(0).notNull(),
  vendorId: bigint('vendor_id', { mode: 'number' }),
  scheduledAt: timestamp('scheduled_at'),
  completedAt: timestamp('completed_at'),
  status: varchar('status', { length: 30 }).default('Scheduled').notNull(), // Scheduled, In Progress, Completed, Cancelled
  performedById: bigint('performed_by_id', { mode: 'number' }).references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

