import { pgTable, bigint, varchar, timestamp, text, integer, boolean, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { employees } from "../../db/schema/employees";
import { users } from "../../db/schema/users";
import { assets } from "../../db/schema/assets";

export const ticketStatuses = ["OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"] as const;
export const ticketPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const ticketCategories = ["HARDWARE", "SOFTWARE", "NETWORK", "ACCESS", "PRINTER", "PERIPHERAL", "OTHER"] as const;
export const ticketOrigins = ["WHATSAPP", "PHONE", "EMAIL", "WALK_IN", "INTERNAL_FINDING"] as const;
export const ticketAuditActions = ["CREATE", "UPDATE", "ASSIGN", "STATUS_CHANGE", "COMMENT", "RESOLVE", "CLOSE", "REOPEN"] as const;
export const confirmationChannels = ["WHATSAPP", "PHONE", "EMAIL", "WALK_IN", "SYSTEM"] as const;

export const helpdeskTickets = pgTable("helpdesk_tickets", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  ticketNumber: varchar("ticket_number", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 30, enum: ticketStatuses }).default("OPEN").notNull(),
  priority: varchar("priority", { length: 20, enum: ticketPriorities }).default("MEDIUM").notNull(),
  category: varchar("category", { length: 30, enum: ticketCategories }).notNull(),
  origin: varchar("origin", { length: 20, enum: ticketOrigins }).notNull(),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),

  // Tiga Identitas: Requester (karyawan), Created By (staf pencatat), Assigned To (staf pengerjaan)
  requesterEmployeeId: bigint("requester_employee_id", { mode: "number" })
    .references(() => employees.id, { onDelete: "restrict" })
    .notNull(),
  requesterNameSnapshot: varchar("requester_name_snapshot", { length: 255 }).notNull(),
  requesterDepartmentSnapshot: varchar("requester_department_snapshot", { length: 255 }).notNull(),

  createdByUserId: bigint("created_by_user_id", { mode: "number" }).notNull(),
  createdByNameSnapshot: varchar("created_by_name_snapshot", { length: 255 }).notNull(),

  assignedToUserId: bigint("assigned_to_user_id", { mode: "number" })
    .references(() => users.id, { onDelete: "set null" }),
  assignedToNameSnapshot: varchar("assigned_to_name_snapshot", { length: 255 }),

  // Target Aset / Karyawan Terdampak (opsional)
  affectedAssetId: bigint("affected_asset_id", { mode: "number" })
    .references(() => assets.id, { onDelete: "set null" }),
  affectedAssetLabel: varchar("affected_asset_label", { length: 255 }),
  affectedEmployeeId: bigint("affected_employee_id", { mode: "number" })
    .references(() => employees.id, { onDelete: "set null" }),
  affectedEmployeeLabel: varchar("affected_employee_label", { length: 255 }),

  // Konfirmasi Resolusi
  resolutionNote: text("resolution_note"),
  resolutionConfirmedBy: varchar("resolution_confirmed_by", { length: 100 }),
  resolutionConfirmedAt: timestamp("resolution_confirmed_at", { withTimezone: true }),
  resolutionConfirmationChannel: varchar("resolution_confirmation_channel", { length: 20, enum: confirmationChannels }),

  // Feedback (bertanda STAFF_RECORDED)
  feedbackScore: integer("feedback_score"),
  feedbackNote: text("feedback_note"),
  feedbackSource: varchar("feedback_source", { length: 20 }),

  // Bukti / Ringkasan Percakapan Laporan
  reportEvidence: text("report_evidence"),

  // Penanda Temuan Internal IT (tidak masuk metrik layanan karyawan)
  isInternal: boolean("is_internal").default(false).notNull(),

  // Metrik SLA
  slaResponseMinutes: integer("sla_response_minutes"),
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
}, (table) => [
  check("helpdesk_tickets_status_check", sql`${table.status} IN ('OPEN','IN_PROGRESS','PENDING','RESOLVED','CLOSED')`),
  check("helpdesk_tickets_priority_check", sql`${table.priority} IN ('LOW','MEDIUM','HIGH','CRITICAL')`),
  check("helpdesk_tickets_category_check", sql`${table.category} IN ('HARDWARE','SOFTWARE','NETWORK','ACCESS','PRINTER','PERIPHERAL','OTHER')`),
  check("helpdesk_tickets_origin_check", sql`${table.origin} IN ('WHATSAPP','PHONE','EMAIL','WALK_IN','INTERNAL_FINDING')`),
  check("helpdesk_tickets_feedback_score_check", sql`${table.feedbackScore} IS NULL OR (${table.feedbackScore} >= 1 AND ${table.feedbackScore} <= 5)`),
  check("helpdesk_tickets_feedback_source_check", sql`${table.feedbackSource} IS NULL OR ${table.feedbackSource} = 'STAFF_RECORDED'`),
  check("helpdesk_tickets_confirmation_channel_check", sql`${table.resolutionConfirmationChannel} IS NULL OR ${table.resolutionConfirmationChannel} IN ('WHATSAPP','PHONE','EMAIL','WALK_IN','SYSTEM')`),
  index("helpdesk_tickets_status_created_idx").on(table.status, table.createdAt.desc()),
  index("helpdesk_tickets_requester_created_idx").on(table.requesterEmployeeId, table.createdAt.desc()),
  index("helpdesk_tickets_assignee_status_idx").on(table.assignedToUserId, table.status),
  index("helpdesk_tickets_reported_at_idx").on(table.reportedAt.desc()),
  index("helpdesk_tickets_number_idx").on(table.ticketNumber),
]);

export const helpdeskTicketComments = pgTable("helpdesk_ticket_comments", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  ticketId: bigint("ticket_id", { mode: "number" })
    .references(() => helpdeskTickets.id, { onDelete: "restrict" })
    .notNull(),
  authorUserId: bigint("author_user_id", { mode: "number" }).notNull(),
  authorNameSnapshot: varchar("author_name_snapshot", { length: 255 }).notNull(),
  body: text("body").notNull(),
  isInternalNote: boolean("is_internal_note").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("helpdesk_comments_ticket_idx").on(table.ticketId, table.createdAt.asc()),
]);

export const helpdeskTicketAudit = pgTable("helpdesk_ticket_audit", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  ticketId: bigint("ticket_id", { mode: "number" })
    .references(() => helpdeskTickets.id, { onDelete: "restrict" })
    .notNull(),
  actorUserId: bigint("actor_user_id", { mode: "number" }).notNull(),
  actorNameSnapshot: varchar("actor_name_snapshot", { length: 255 }).notNull(),
  action: varchar("action", { length: 40, enum: ticketAuditActions }).notNull(),
  fieldChanged: varchar("field_changed", { length: 100 }),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  note: varchar("note", { length: 500 }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("helpdesk_audit_action_check", sql`${table.action} IN ('CREATE','UPDATE','ASSIGN','STATUS_CHANGE','COMMENT','RESOLVE','CLOSE','REOPEN')`),
  index("helpdesk_audit_ticket_idx").on(table.ticketId, table.occurredAt.asc()),
]);

export const helpdeskAttachments = pgTable("helpdesk_attachments", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  ticketId: bigint("ticket_id", { mode: "number" })
    .references(() => helpdeskTickets.id, { onDelete: "restrict" })
    .notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  storagePath: varchar("storage_path", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedByUserId: bigint("uploaded_by_user_id", { mode: "number" }).notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("helpdesk_attachments_ticket_idx").on(table.ticketId, table.uploadedAt.desc()),
]);

export const helpdeskTicketCounters = pgTable("helpdesk_ticket_counters", {
  yearMonth: varchar("year_month", { length: 6 }).primaryKey(),
  lastSeq: integer("last_seq").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
