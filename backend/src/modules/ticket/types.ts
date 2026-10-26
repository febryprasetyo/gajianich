import { z } from "zod";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "PENDING" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketCategory = "HARDWARE" | "SOFTWARE" | "NETWORK" | "ACCESS" | "PRINTER" | "PERIPHERAL" | "OTHER";
export type TicketOrigin = "WHATSAPP" | "PHONE" | "EMAIL" | "WALK_IN" | "INTERNAL_FINDING";
export type TicketAuditAction = "CREATE" | "UPDATE" | "ASSIGN" | "STATUS_CHANGE" | "COMMENT" | "RESOLVE" | "CLOSE" | "REOPEN";
export type ConfirmationChannel = "WHATSAPP" | "PHONE" | "EMAIL" | "WALK_IN" | "SYSTEM";

export interface TicketActor {
  userId: number;
  name: string;
  username: string;
  permissions: string[];
}

export interface TicketIdentity {
  userId?: number;
  employeeId?: number;
  nameSnapshot: string;
  departmentSnapshot?: string;
}

export interface TicketSummary {
  id: string;
  ticketNumber: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  origin: TicketOrigin;
  isInternal: boolean;
  reportedAt: string;
  createdAt: string;
  requester: TicketIdentity;
  createdBy: TicketIdentity;
  assignedTo: TicketIdentity | null;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorUserId: number;
  authorName: string;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
}

export interface TicketAuditEntry {
  id: string;
  ticketId: string;
  actorUserId: number;
  actorName: string;
  action: TicketAuditAction;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
  occurredAt: string;
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: number;
  uploadedAt: string;
}

export interface TicketDetail extends TicketSummary {
  description: string;
  reportEvidence: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  resolutionConfirmedBy: string | null;
  resolutionConfirmedAt: string | null;
  resolutionConfirmationChannel: ConfirmationChannel | null;
  feedbackScore: number | null;
  feedbackNote: string | null;
  feedbackSource: "STAFF_RECORDED" | null;
  affectedAsset: { id: string; label: string } | null;
  affectedEmployee: { id: string; label: string } | null;
  firstResponseAt: string | null;
  slaResponseMinutes: number | null;
  comments: TicketComment[];
  attachments?: TicketAttachment[];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
}

export const CreateTicketSchema = z.object({
  title: z.string().trim().min(3, "Judul tiket minimal 3 karakter").max(200, "Judul tiket maksimal 200 karakter"),
  description: z.string().trim().min(5, "Deskripsi minimal 5 karakter"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  category: z.enum(["HARDWARE", "SOFTWARE", "NETWORK", "ACCESS", "PRINTER", "PERIPHERAL", "OTHER"]),
  origin: z.enum(["WHATSAPP", "PHONE", "EMAIL", "WALK_IN", "INTERNAL_FINDING"]),
  reportedAt: z.string().or(z.date()).optional(),
  requesterEmployeeId: z.coerce.number().int().positive("Requester employee wajib dipilih"),
  assignedToUserId: z.coerce.number().int().positive().nullable().optional(),
  affectedAssetId: z.coerce.number().int().positive().nullable().optional(),
  affectedEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  reportEvidence: z.string().max(2000, "Bukti percakapan maksimal 2000 karakter").nullable().optional(),
  isInternal: z.boolean().default(false),
});

export type CreateTicketDTO = z.infer<typeof CreateTicketSchema>;

export const UpdateTicketSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(5).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  category: z.enum(["HARDWARE", "SOFTWARE", "NETWORK", "ACCESS", "PRINTER", "PERIPHERAL", "OTHER"]).optional(),
  origin: z.enum(["WHATSAPP", "PHONE", "EMAIL", "WALK_IN", "INTERNAL_FINDING"]).optional(),
  reportedAt: z.string().or(z.date()).optional(),
  assignedToUserId: z.number().int().positive().nullable().optional(),
  affectedAssetId: z.number().int().positive().nullable().optional(),
  affectedEmployeeId: z.number().int().positive().nullable().optional(),
  resolutionNote: z.string().nullable().optional(),
  resolutionConfirmedBy: z.string().max(100).nullable().optional(),
  resolutionConfirmedAt: z.string().or(z.date()).nullable().optional(),
  resolutionConfirmationChannel: z.enum(["WHATSAPP", "PHONE", "EMAIL", "WALK_IN", "SYSTEM"]).nullable().optional(),
  feedbackScore: z.number().int().min(1).max(5).nullable().optional(),
  feedbackNote: z.string().nullable().optional(),
  feedbackSource: z.literal("STAFF_RECORDED").nullable().optional(),
  reportEvidence: z.string().max(2000).nullable().optional(),
  isInternal: z.boolean().optional(),
  reopenJustification: z.string().optional(),
});

export type UpdateTicketDTO = z.infer<typeof UpdateTicketSchema>;

export const AddCommentSchema = z.object({
  body: z.string().trim().min(1, "Isi komentar tidak boleh kosong"),
  isInternalNote: z.boolean().default(false),
});

export type AddCommentDTO = z.infer<typeof AddCommentSchema>;

export const ALLOWED_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["PENDING", "RESOLVED", "CLOSED"],
  PENDING: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: ["OPEN"],
};
