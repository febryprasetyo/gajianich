import { eq, desc, asc, and, or, sql, ilike, gte, lte } from "drizzle-orm";
import { db, pool } from "../../db";
import {
  helpdeskTickets,
  helpdeskTicketComments,
  helpdeskTicketAudit,
  helpdeskAttachments,
  helpdeskTicketCounters
} from "./schema";
import { employees } from "../../db/schema/employees";
import { departments } from "../../db/schema/master";
import { users } from "../../db/schema/users";
import { assets } from "../../db/schema/assets";
import {
  TicketActor,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketOrigin,
  CreateTicketDTO,
  UpdateTicketDTO,
  AddCommentDTO,
  TicketSummary,
  TicketDetail,
  TicketComment,
  TicketAuditEntry,
  Page,
  ALLOWED_STATUS_TRANSITIONS
} from "./types";

export function validateStatusTransition(current: TicketStatus, next: TicketStatus): void {
  if (current === next) return;
  const allowed = ALLOWED_STATUS_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(`Transisi status dari ${current} ke ${next} tidak valid`);
  }
}

function getDefaultSlaMinutes(priority: TicketPriority): number {
  switch (priority) {
    case "CRITICAL": return 120; // 2 jam
    case "HIGH": return 240;     // 4 jam
    case "MEDIUM": return 480;   // 8 jam
    case "LOW": return 1440;     // 24 jam
    default: return 480;
  }
}

export async function generateTicketNumber(client?: any): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${year}${month}`;

  const runner = client || pool;
  const res = await runner.query(
    "INSERT INTO helpdesk_ticket_counters (year_month, last_seq, updated_at) " +
    "VALUES ($1, 1, now()) " +
    "ON CONFLICT (year_month) DO UPDATE SET last_seq = helpdesk_ticket_counters.last_seq + 1, updated_at = now() " +
    "RETURNING last_seq",
    [yearMonth]
  );

  const seq = res.rows[0].last_seq;
  const formattedSeq = String(seq).padStart(4, "0");
  return `TKT-${yearMonth}-${formattedSeq}`;
}

export async function createTicket(actor: TicketActor, input: CreateTicketDTO): Promise<TicketDetail> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Validasi requester employee di database
    const empRes = await client.query(
      "SELECT e.id, e.full_name, d.name AS dept_name " +
      "FROM employees e LEFT JOIN departments d ON e.department_id = d.id " +
      "WHERE e.id = $1",
      [input.requesterEmployeeId]
    );

    if (empRes.rowCount === 0) {
      throw new Error("Requester employee tidak ditemukan di direktori karyawan");
    }

    const emp = empRes.rows[0];
    const requesterNameSnapshot = emp.full_name;
    const requesterDepartmentSnapshot = emp.dept_name || "Umum";

    // 2. Snapshot created by actor
    const createdByUserId = actor.userId;
    const createdByNameSnapshot = actor.name;

    // 3. Snapshot assignee jika ada
    let assignedToUserId: number | null = null;
    let assignedToNameSnapshot: string | null = null;
    if (input.assignedToUserId) {
      const uRes = await client.query(
        "SELECT u.id, u.username, COALESCE(e.full_name, u.username) AS name " +
        "FROM users u LEFT JOIN employees e ON u.employee_id = e.id " +
        "WHERE u.id = $1",
        [input.assignedToUserId]
      );
      if (uRes.rowCount && uRes.rowCount > 0) {
        assignedToUserId = uRes.rows[0].id;
        assignedToNameSnapshot = uRes.rows[0].name;
      }
    }

    // 4. Snapshot affected asset & employee jika ada
    let affectedAssetId: number | null = null;
    let affectedAssetLabel: string | null = null;
    if (input.affectedAssetId) {
      const aRes = await client.query("SELECT id, asset_tag, brand FROM assets WHERE id = $1", [input.affectedAssetId]);
      if (aRes.rowCount && aRes.rowCount > 0) {
        affectedAssetId = aRes.rows[0].id;
        affectedAssetLabel = `${aRes.rows[0].asset_tag} - ${aRes.rows[0].brand}`;
      }
    }

    let affectedEmployeeId: number | null = null;
    let affectedEmployeeLabel: string | null = null;
    if (input.affectedEmployeeId) {
      const aeRes = await client.query("SELECT id, full_name FROM employees WHERE id = $1", [input.affectedEmployeeId]);
      if (aeRes.rowCount && aeRes.rowCount > 0) {
        affectedEmployeeId = aeRes.rows[0].id;
        affectedEmployeeLabel = aeRes.rows[0].full_name;
      }
    }

    // 5. Validasi timestamp (dengan toleransi clock drift client 5 menit)
    const now = new Date();
    let reportedAt = input.reportedAt ? new Date(input.reportedAt) : now;
    if (reportedAt.getTime() > now.getTime()) {
      if (reportedAt.getTime() - now.getTime() <= 5 * 60 * 1000) {
        reportedAt = now;
      } else {
        throw new Error("Waktu laporan (reported_at) tidak boleh lebih maju daripada waktu pencatatan tiket");
      }
    }

    // 6. Nomor tiket
    const ticketNumber = await generateTicketNumber(client);
    const slaMinutes = getDefaultSlaMinutes(input.priority);

    // 7. Insert tiket
    const insertRes = await client.query(
      `INSERT INTO helpdesk_tickets (
        ticket_number, title, description, status, priority, category, origin,
        reported_at, created_at, updated_at,
        requester_employee_id, requester_name_snapshot, requester_department_snapshot,
        created_by_user_id, created_by_name_snapshot,
        assigned_to_user_id, assigned_to_name_snapshot,
        affected_asset_id, affected_asset_label,
        affected_employee_id, affected_employee_label,
        report_evidence, is_internal, sla_response_minutes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now(),$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *`,
      [
        ticketNumber,
        input.title,
        input.description,
        "OPEN",
        input.priority,
        input.category,
        input.origin,
        reportedAt,
        input.requesterEmployeeId,
        requesterNameSnapshot,
        requesterDepartmentSnapshot,
        createdByUserId,
        createdByNameSnapshot,
        assignedToUserId,
        assignedToNameSnapshot,
        affectedAssetId,
        affectedAssetLabel,
        affectedEmployeeId,
        affectedEmployeeLabel,
        input.reportEvidence || null,
        Boolean(input.isInternal),
        slaMinutes
      ]
    );

    const ticketRow = insertRes.rows[0];

    // 8. Insert audit CREATE
    await client.query(
      `INSERT INTO helpdesk_ticket_audit (
        ticket_id, actor_user_id, actor_name_snapshot, action, note, occurred_at
      ) VALUES ($1, $2, $3, $4, $5, now())`,
      [
        ticketRow.id,
        actor.userId,
        actor.name,
        "CREATE",
        `Tiket ${ticketNumber} dicatat oleh ${actor.name} atas nama ${requesterNameSnapshot} via ${input.origin}`
      ]
    );

    await client.query("COMMIT");
    return mapTicketRowToDetail(ticketRow, [], []);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateTicket(actor: TicketActor, ticketId: number, patch: UpdateTicketDTO): Promise<TicketDetail> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tRes = await client.query("SELECT * FROM helpdesk_tickets WHERE id = $1 FOR UPDATE", [ticketId]);
    if (tRes.rowCount === 0) {
      throw new Error("Tiket tidak ditemukan");
    }

    const current = tRes.rows[0];
    const auditEntries: Array<{ action: string; field: string; oldVal: string | null; newVal: string | null; note?: string }> = [];

    // Validasi permission helpdesk.admin untuk field sensitif
    const isAdmin = actor.permissions.includes("helpdesk.admin") || actor.permissions.includes("*");

    if (patch.reportedAt !== undefined) {
      if (!isAdmin) {
        throw new Error("Perubahan reported_at wajib memiliki permission helpdesk.admin");
      }
      const newReported = new Date(patch.reportedAt);
      if (newReported.getTime() > new Date(current.created_at).getTime()) {
        throw new Error("Waktu laporan (reported_at) tidak boleh lebih maju daripada waktu pencatatan tiket (created_at)");
      }
      if (newReported.toISOString() !== new Date(current.reported_at).toISOString()) {
        auditEntries.push({
          action: "UPDATE",
          field: "reported_at",
          oldVal: new Date(current.reported_at).toISOString(),
          newVal: newReported.toISOString(),
          note: "Tanggal laporan disesuaikan oleh admin"
        });
        current.reported_at = newReported;
      }
    }

    if (patch.isInternal !== undefined && patch.isInternal !== current.is_internal) {
      if (!isAdmin) {
        throw new Error("Perubahan status tiket internal wajib memiliki permission helpdesk.admin");
      }
      auditEntries.push({
        action: "UPDATE",
        field: "is_internal",
        oldVal: String(current.is_internal),
        newVal: String(patch.isInternal),
        note: "Klasifikasi tiket internal diubah"
      });
      current.is_internal = patch.isInternal;
    }

    // Status transisi
    if (patch.status && patch.status !== current.status) {
      if (current.status === "CLOSED" && patch.status === "OPEN") {
        if (!isAdmin) {
          throw new Error("Hanya helpdesk.admin yang berhak membuka kembali tiket yang sudah ditutup");
        }
        auditEntries.push({
          action: "REOPEN",
          field: "status",
          oldVal: current.status,
          newVal: patch.status,
          note: patch.reopenJustification || "Tiket dibuka kembali"
        });
      } else {
        validateStatusTransition(current.status as TicketStatus, patch.status as TicketStatus);
        let action = "STATUS_CHANGE";
        if (patch.status === "RESOLVED") action = "RESOLVE";
        if (patch.status === "CLOSED") action = "CLOSE";
        if (patch.status === "OPEN" && current.status === "RESOLVED") action = "REOPEN";

        auditEntries.push({
          action,
          field: "status",
          oldVal: current.status,
          newVal: patch.status,
          note: patch.resolutionNote || undefined
        });
      }

      current.status = patch.status;
      if (patch.status === "RESOLVED" || patch.status === "CLOSED") {
        current.resolved_at = current.resolved_at || new Date();
      }
    }

    // Assignee
    if (patch.assignedToUserId !== undefined) {
      const oldAssigned = current.assigned_to_user_id ? String(current.assigned_to_user_id) : null;
      const newAssigned = patch.assignedToUserId ? String(patch.assignedToUserId) : null;

      if (oldAssigned !== newAssigned) {
        let newName: string | null = null;
        if (patch.assignedToUserId) {
          const uRes = await client.query(
            "SELECT u.id, u.username, COALESCE(e.full_name, u.username) AS name " +
            "FROM users u LEFT JOIN employees e ON u.employee_id = e.id " +
            "WHERE u.id = $1",
            [patch.assignedToUserId]
          );
          if (uRes.rowCount && uRes.rowCount > 0) {
            newName = uRes.rows[0].name;
          }
        }

        auditEntries.push({
          action: "ASSIGN",
          field: "assigned_to_user_id",
          oldVal: current.assigned_to_name_snapshot || "Belum ditugaskan",
          newVal: newName || "Tidak ditugaskan",
          note: `Penugasan diubah ke ${newName || "kosong"}`
        });

        current.assigned_to_user_id = patch.assignedToUserId;
        current.assigned_to_name_snapshot = newName;
      }
    }

    // Update field lain
    if (patch.title !== undefined && patch.title !== current.title) {
      auditEntries.push({ action: "UPDATE", field: "title", oldVal: current.title, newVal: patch.title });
      current.title = patch.title;
    }
    if (patch.description !== undefined && patch.description !== current.description) {
      auditEntries.push({ action: "UPDATE", field: "description", oldVal: current.description, newVal: patch.description });
      current.description = patch.description;
    }
    if (patch.priority !== undefined && patch.priority !== current.priority) {
      auditEntries.push({ action: "UPDATE", field: "priority", oldVal: current.priority, newVal: patch.priority });
      current.priority = patch.priority;
      current.sla_response_minutes = getDefaultSlaMinutes(patch.priority);
    }
    if (patch.category !== undefined && patch.category !== current.category) {
      auditEntries.push({ action: "UPDATE", field: "category", oldVal: current.category, newVal: patch.category });
      current.category = patch.category;
    }
    if (patch.origin !== undefined && patch.origin !== current.origin) {
      auditEntries.push({ action: "UPDATE", field: "origin", oldVal: current.origin, newVal: patch.origin });
      current.origin = patch.origin;
    }
    if (patch.resolutionNote !== undefined) {
      current.resolution_note = patch.resolutionNote;
    }
    if (patch.resolutionConfirmedBy !== undefined) {
      current.resolution_confirmed_by = patch.resolutionConfirmedBy;
    }
    if (patch.resolutionConfirmedAt !== undefined) {
      current.resolution_confirmed_at = patch.resolutionConfirmedAt ? new Date(patch.resolutionConfirmedAt) : null;
    }
    if (patch.resolutionConfirmationChannel !== undefined) {
      current.resolution_confirmation_channel = patch.resolutionConfirmationChannel;
    }
    if (patch.feedbackScore !== undefined) {
      current.feedback_score = patch.feedbackScore;
      current.feedback_source = "STAFF_RECORDED";
    }
    if (patch.feedbackNote !== undefined) {
      current.feedback_note = patch.feedbackNote;
    }
    if (patch.reportEvidence !== undefined) {
      current.report_evidence = patch.reportEvidence;
    }

    // Simpan perubahan ke DB
    await client.query(
      `UPDATE helpdesk_tickets SET
        title = $1, description = $2, status = $3, priority = $4, category = $5, origin = $6,
        reported_at = $7, updated_at = now(), resolved_at = $8,
        assigned_to_user_id = $9, assigned_to_name_snapshot = $10,
        resolution_note = $11, resolution_confirmed_by = $12, resolution_confirmed_at = $13,
        resolution_confirmation_channel = $14, feedback_score = $15, feedback_note = $16,
        feedback_source = $17, report_evidence = $18, is_internal = $19, sla_response_minutes = $20
      WHERE id = $21`,
      [
        current.title,
        current.description,
        current.status,
        current.priority,
        current.category,
        current.origin,
        current.reported_at,
        current.resolved_at,
        current.assigned_to_user_id,
        current.assigned_to_name_snapshot,
        current.resolution_note,
        current.resolution_confirmed_by,
        current.resolution_confirmed_at,
        current.resolution_confirmation_channel,
        current.feedback_score,
        current.feedback_note,
        current.feedback_source,
        current.report_evidence,
        current.is_internal,
        current.sla_response_minutes,
        ticketId
      ]
    );

    // Insert audit entries
    for (const audit of auditEntries) {
      await client.query(
        `INSERT INTO helpdesk_ticket_audit (
          ticket_id, actor_user_id, actor_name_snapshot, action, field_changed, old_value, new_value, note, occurred_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
        [ticketId, actor.userId, actor.name, audit.action, audit.field, audit.oldVal, audit.newVal, audit.note || null]
      );
    }

    await client.query("COMMIT");
    return getTicketById(ticketId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function addComment(actor: TicketActor, ticketId: number, input: AddCommentDTO): Promise<TicketComment> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tRes = await client.query("SELECT id, first_response_at FROM helpdesk_tickets WHERE id = $1 FOR UPDATE", [ticketId]);
    if (tRes.rowCount === 0) {
      throw new Error("Tiket tidak ditemukan");
    }

    const ticket = tRes.rows[0];
    const now = new Date();

    // 1. Insert komentar
    const cRes = await client.query(
      `INSERT INTO helpdesk_ticket_comments (ticket_id, author_user_id, author_name_snapshot, body, is_internal_note, created_at)
       VALUES ($1, $2, $3, $4, $5, now()) RETURNING *`,
      [ticketId, actor.userId, actor.name, input.body, Boolean(input.isInternalNote)]
    );
    const comment = cRes.rows[0];

    // 2. Set first_response_at jika komentar publik pertama
    if (!input.isInternalNote && !ticket.first_response_at) {
      await client.query(
        "UPDATE helpdesk_tickets SET first_response_at = now(), updated_at = now() WHERE id = $1",
        [ticketId]
      );
    }

    // 3. Catat di audit trail
    await client.query(
      `INSERT INTO helpdesk_ticket_audit (
        ticket_id, actor_user_id, actor_name_snapshot, action, note, occurred_at
      ) VALUES ($1, $2, $3, $4, $5, now())`,
      [
        ticketId,
        actor.userId,
        actor.name,
        "COMMENT",
        input.isInternalNote ? "Catatan internal ditambahkan" : "Komentar publik ditambahkan"
      ]
    );

    await client.query("COMMIT");
    return {
      id: String(comment.id),
      ticketId: String(comment.ticket_id),
      authorUserId: Number(comment.author_user_id),
      authorName: comment.author_name_snapshot,
      body: comment.body,
      isInternalNote: comment.is_internal_note,
      createdAt: new Date(comment.created_at).toISOString(),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getTicketById(ticketId: number): Promise<TicketDetail> {
  const tRes = await pool.query("SELECT * FROM helpdesk_tickets WHERE id = $1", [ticketId]);
  if (tRes.rowCount === 0) {
    throw new Error("Tiket tidak ditemukan");
  }

  const commentsRes = await pool.query(
    "SELECT * FROM helpdesk_ticket_comments WHERE ticket_id = $1 ORDER BY created_at ASC",
    [ticketId]
  );
  const attachmentsRes = await pool.query(
    "SELECT * FROM helpdesk_attachments WHERE ticket_id = $1 ORDER BY uploaded_at DESC",
    [ticketId]
  );

  return mapTicketRowToDetail(tRes.rows[0], commentsRes.rows, attachmentsRes.rows);
}

export interface TicketListFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  origin?: TicketOrigin;
  isInternal?: boolean;
  assignedToUserId?: number;
  requesterDept?: string;
  startDate?: string;
  endDate?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export async function listTickets(filters: TicketListFilters = {}): Promise<Page<TicketSummary>> {
  const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
  const conditions: string[] = ["1=1"];
  const params: any[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filters.priority) {
    params.push(filters.priority);
    conditions.push(`priority = $${params.length}`);
  }
  if (filters.category) {
    params.push(filters.category);
    conditions.push(`category = $${params.length}`);
  }
  if (filters.origin) {
    params.push(filters.origin);
    conditions.push(`origin = $${params.length}`);
  }
  if (filters.isInternal !== undefined) {
    params.push(filters.isInternal);
    conditions.push(`is_internal = $${params.length}`);
  }
  if (filters.assignedToUserId) {
    params.push(filters.assignedToUserId);
    conditions.push(`assigned_to_user_id = $${params.length}`);
  }
  if (filters.requesterDept) {
    params.push(`%${filters.requesterDept}%`);
    conditions.push(`requester_department_snapshot ILIKE $${params.length}`);
  }
  if (filters.startDate) {
    params.push(new Date(filters.startDate));
    conditions.push(`reported_at >= $${params.length}`);
  }
  if (filters.endDate) {
    params.push(new Date(filters.endDate));
    conditions.push(`reported_at <= $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    conditions.push(`(ticket_number ILIKE $${params.length} OR title ILIKE $${params.length} OR requester_name_snapshot ILIKE $${params.length})`);
  }
  if (filters.cursor) {
    const cursorDate = new Date(filters.cursor);
    params.push(cursorDate);
    conditions.push(`created_at < $${params.length}`);
  }

  // Count total
  const countRes = await pool.query(
    `SELECT count(*) AS total FROM helpdesk_tickets WHERE ${conditions.slice(0, filters.cursor ? -1 : undefined).join(" AND ")}`,
    filters.cursor ? params.slice(0, -1) : params
  );
  const totalCount = parseInt(countRes.rows[0].total, 10);

  // Fetch items
  params.push(limit);
  const query = `SELECT * FROM helpdesk_tickets WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT $${params.length}`;
  const res = await pool.query(query, params);

  const items: TicketSummary[] = res.rows.map(mapTicketRowToSummary);
  const nextCursor = res.rows.length === limit ? new Date(res.rows[res.rows.length - 1].created_at).toISOString() : null;

  return { items, nextCursor, totalCount };
}

export async function getTicketAuditTrail(ticketId: number): Promise<TicketAuditEntry[]> {
  const res = await pool.query(
    "SELECT * FROM helpdesk_ticket_audit WHERE ticket_id = $1 ORDER BY occurred_at ASC",
    [ticketId]
  );
  return res.rows.map((row) => ({
    id: String(row.id),
    ticketId: String(row.ticket_id),
    actorUserId: Number(row.actor_user_id),
    actorName: row.actor_name_snapshot,
    action: row.action,
    fieldChanged: row.field_changed,
    oldValue: row.old_value,
    newValue: row.new_value,
    note: row.note,
    occurredAt: new Date(row.occurred_at).toISOString(),
  }));
}

function mapTicketRowToSummary(row: any): TicketSummary {
  return {
    id: String(row.id),
    ticketNumber: row.ticket_number,
    title: row.title,
    status: row.status,
    priority: row.priority,
    category: row.category,
    origin: row.origin,
    isInternal: row.is_internal,
    reportedAt: new Date(row.reported_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    requester: {
      employeeId: Number(row.requester_employee_id),
      nameSnapshot: row.requester_name_snapshot,
      departmentSnapshot: row.requester_department_snapshot,
    },
    createdBy: {
      userId: Number(row.created_by_user_id),
      nameSnapshot: row.created_by_name_snapshot,
    },
    assignedTo: row.assigned_to_user_id ? {
      userId: Number(row.assigned_to_user_id),
      nameSnapshot: row.assigned_to_name_snapshot,
    } : null,
  };
}

function mapTicketRowToDetail(row: any, comments: any[], attachments: any[]): TicketDetail {
  const summary = mapTicketRowToSummary(row);
  return {
    ...summary,
    description: row.description,
    reportEvidence: row.report_evidence,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    resolutionNote: row.resolution_note,
    resolutionConfirmedBy: row.resolution_confirmed_by,
    resolutionConfirmedAt: row.resolution_confirmed_at ? new Date(row.resolution_confirmed_at).toISOString() : null,
    resolutionConfirmationChannel: row.resolution_confirmation_channel,
    feedbackScore: row.feedback_score,
    feedbackNote: row.feedback_note,
    feedbackSource: row.feedback_source,
    affectedAsset: row.affected_asset_id ? {
      id: String(row.affected_asset_id),
      label: row.affected_asset_label || "",
    } : null,
    affectedEmployee: row.affected_employee_id ? {
      id: String(row.affected_employee_id),
      label: row.affected_employee_label || "",
    } : null,
    firstResponseAt: row.first_response_at ? new Date(row.first_response_at).toISOString() : null,
    slaResponseMinutes: row.sla_response_minutes,
    comments: comments.map((c) => ({
      id: String(c.id),
      ticketId: String(c.ticket_id),
      authorUserId: Number(c.author_user_id),
      authorName: c.author_name_snapshot,
      body: c.body,
      isInternalNote: c.is_internal_note,
      createdAt: new Date(c.created_at).toISOString(),
    })),
    attachments: attachments.map((a) => ({
      id: String(a.id),
      ticketId: String(a.ticket_id),
      filename: a.filename,
      storagePath: a.storage_path,
      mimeType: a.mime_type,
      sizeBytes: Number(a.size_bytes),
      uploadedByUserId: Number(a.uploaded_by_user_id),
      uploadedAt: new Date(a.uploaded_at).toISOString(),
    })),
  };
}
