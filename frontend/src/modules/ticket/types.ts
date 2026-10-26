export type TicketCategory =
  | "HARDWARE"
  | "SOFTWARE"
  | "NETWORK"
  | "ACCESS"
  | "EMAIL"
  | "OTHER";

export type TicketOrigin =
  | "WHATSAPP"
  | "PHONE"
  | "EMAIL"
  | "DIRECT"
  | "PORTAL"
  | "OTHER";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING"
  | "RESOLVED"
  | "CLOSED"
  | "CANCELLED";

export type ConfirmationChannel = "WHATSAPP" | "PHONE" | "WALK_IN" | "PORTAL";

export interface TicketSummary {
  id: number;
  ticketNumber: string;
  title: string;
  description: string;
  category: TicketCategory;
  origin: TicketOrigin;
  priority: TicketPriority;
  status: TicketStatus;
  requesterEmployeeId: number;
  requesterName: string | null;
  requesterDepartment: string | null;
  createdById: number;
  createdByName: string | null;
  assignedToEmployeeId: number | null;
  assignedToName: string | null;
  reportedAt: string;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  dueAt: string | null;
  isInternal: boolean;
  slaBreached?: boolean;
  auditCount?: number;
  attachmentsCount?: number;
}

export interface TicketAuditItem {
  id: number;
  ticketId: number;
  actorUserId: number;
  actorName?: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
}

export interface TicketCommentItem {
  id: number;
  ticketId: number;
  userId: number;
  userName?: string;
  comment: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TicketAttachmentItem {
  id: number;
  ticketId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface TicketDetail extends TicketSummary {
  requesterEmail: string | null;
  createdByUsername: string | null;
  assignedToEmail: string | null;
  resolutionNotes: string | null;
  confirmationChannel: ConfirmationChannel | null;
  feedbackScore: number | null;
  feedbackNotes: string | null;
  feedbackSource: string | null;
  assetId: number | null;
  assetName?: string | null;
  assetCode?: string | null;
  audit: TicketAuditItem[];
  comments: TicketCommentItem[];
  attachments: TicketAttachmentItem[];
}

export interface TicketStatsData {
  openCount: number;
  inProgressCount: number;
  resolvedTodayCount: number;
  criticalCount: number;
  avgResolutionMinutes: number;
  avgDelayMinutes: number;
  slaCompliancePercentage: number;
}

export interface CreateTicketInput {
  requesterEmployeeId: number;
  reportedAt?: string;
  category: TicketCategory;
  origin: TicketOrigin;
  priority: TicketPriority;
  title: string;
  description: string;
  assetId?: number | null;
  isInternal?: boolean;
}

export interface EmployeeLookupItem {
  id: number;
  name: string;
  email: string | null;
  department: string | null;
}

export interface TechnicianLookupItem {
  id: number;
  name: string;
  email: string | null;
}

export interface TicketFilterParams {
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  origin?: string;
  departmentId?: string | number;
  isInternal?: "all" | "true" | "false";
  page?: number;
  limit?: number;
}
