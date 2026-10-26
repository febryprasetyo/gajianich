import { Response } from "express";
import { AuthenticatedRequest, getUserPermissions } from "../../middleware/auth";
import { pool } from "../../db";
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  AddCommentSchema,
  TicketActor
} from "./types";
import {
  createTicket,
  updateTicket,
  addComment,
  getTicketById,
  listTickets,
  getTicketAuditTrail,
  TicketListFilters
} from "./service";

export async function resolveTicketActor(req: AuthenticatedRequest): Promise<TicketActor> {
  const user = req.user;
  if (!user || !user.userId) {
    throw new Error("Unauthorized");
  }

  let perms = user.permissions;
  if (!perms || perms.length === 0) {
    perms = await getUserPermissions(user.roleId, user.roleName);
  }

  let name = user.username || `User ${user.userId}`;
  const uRes = await pool.query(
    "SELECT u.username, COALESCE(e.full_name, u.username) AS display_name FROM users u LEFT JOIN employees e ON u.employee_id = e.id WHERE u.id = $1",
    [user.userId]
  );
  if (uRes.rowCount && uRes.rowCount > 0) {
    name = uRes.rows[0].display_name;
  }

  return {
    userId: user.userId,
    username: user.username || "",
    name,
    permissions: perms,
  };
}

export async function createTicketHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Klien tidak boleh mengirim created_by, ticket_number, atau snapshot
    if (
      req.body.created_by ||
      req.body.createdBy ||
      req.body.ticket_number ||
      req.body.ticketNumber ||
      req.body.requester_name_snapshot ||
      req.body.created_by_name_snapshot
    ) {
      res.status(400).json({ error: "Klien dilarang mengirim field created_by, ticket_number, atau snapshot identitas" });
      return;
    }

    const parsed = CreateTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validasi gagal", details: parsed.error.format() });
      return;
    }

    const actor = await resolveTicketActor(req);
    const ticket = await createTicket(actor, parsed.data);
    res.status(201).json({ data: ticket });
  } catch (err: any) {
    const status = err.message === "Unauthorized" ? 401 : err.message?.includes("tidak ditemukan") || err.message?.includes("tidak boleh") || err.message?.includes("dilarang") ? 400 : 500;
    res.status(status).json({ error: err.message || "Gagal membuat tiket" });
  }
}

export async function listTicketsHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters: TicketListFilters = {};
    if (req.query.status) filters.status = String(req.query.status) as any;
    if (req.query.priority) filters.priority = String(req.query.priority) as any;
    if (req.query.category) filters.category = String(req.query.category) as any;
    if (req.query.origin) filters.origin = String(req.query.origin) as any;
    if (req.query.isInternal !== undefined && req.query.isInternal !== "") {
      filters.isInternal = req.query.isInternal === "true" || req.query.isInternal === "1";
    }
    if (req.query.assignedTo) filters.assignedToUserId = parseInt(String(req.query.assignedTo), 10);
    if (req.query.requesterDept) filters.requesterDept = String(req.query.requesterDept);
    if (req.query.startDate) filters.startDate = String(req.query.startDate);
    if (req.query.endDate) filters.endDate = String(req.query.endDate);
    if (req.query.q) filters.q = String(req.query.q);
    if (req.query.cursor) filters.cursor = String(req.query.cursor);
    if (req.query.limit) filters.limit = parseInt(String(req.query.limit), 10);

    const result = await listTickets(filters);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal memuat daftar tiket" });
  }
}

export async function getTicketDetailHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID tiket tidak valid" });
      return;
    }

    const ticket = await getTicketById(id);
    res.json({ data: ticket });
  } catch (err: any) {
    if (err.message === "Tiket tidak ditemukan") {
      res.status(404).json({ error: "Tiket tidak ditemukan" });
      return;
    }
    res.status(500).json({ error: err.message || "Gagal memuat detail tiket" });
  }
}

export async function updateTicketHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID tiket tidak valid" });
      return;
    }

    // Klien dilarang mengirim created_by, ticket_number, atau snapshot
    if (
      req.body.created_by ||
      req.body.createdBy ||
      req.body.ticket_number ||
      req.body.ticketNumber
    ) {
      res.status(400).json({ error: "Field created_by dan ticket_number tidak dapat diubah" });
      return;
    }

    const parsed = UpdateTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validasi gagal", details: parsed.error.format() });
      return;
    }

    const actor = await resolveTicketActor(req);
    const updated = await updateTicket(actor, id, parsed.data);
    res.json({ data: updated });
  } catch (err: any) {
    if (err.message === "Tiket tidak ditemukan") {
      res.status(404).json({ error: "Tiket tidak ditemukan" });
      return;
    }
    if (err.message?.includes("Hanya helpdesk.admin") || err.message?.includes("wajib memiliki permission helpdesk.admin")) {
      res.status(403).json({ error: err.message });
      return;
    }
    if (err.message?.includes("tidak valid") || err.message?.includes("tidak boleh lebih maju")) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err.message || "Gagal memperbarui tiket" });
  }
}

export async function addCommentHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID tiket tidak valid" });
      return;
    }

    const parsed = AddCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validasi gagal", details: parsed.error.format() });
      return;
    }

    const actor = await resolveTicketActor(req);
    const comment = await addComment(actor, id, parsed.data);
    res.status(201).json({ data: comment });
  } catch (err: any) {
    if (err.message === "Tiket tidak ditemukan") {
      res.status(404).json({ error: "Tiket tidak ditemukan" });
      return;
    }
    res.status(500).json({ error: err.message || "Gagal menambahkan komentar" });
  }
}

export async function getTicketAuditHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID tiket tidak valid" });
      return;
    }

    const audit = await getTicketAuditTrail(id);
    res.json({ data: audit });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal memuat riwayat tiket" });
  }
}

export async function searchEmployeesHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "20"), 10), 1), 50);

    const query = `
      SELECT e.id, e.employee_number AS "employeeCode", e.full_name AS "fullName",
             d.name AS "departmentName", e.position
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.status = 'Active'
        AND ($1 = '' OR e.full_name ILIKE $2 OR e.employee_number ILIKE $2 OR d.name ILIKE $2)
      ORDER BY e.full_name ASC
      LIMIT $3
    `;

    const resDb = await pool.query(query, [q, `%${q}%`, limit]);
    res.json({ items: resDb.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal mencari karyawan" });
  }
}

export async function searchAssigneesHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "20"), 10), 1), 50);

    const query = `
      SELECT u.id, u.username, COALESCE(e.full_name, u.username) AS "fullName", u.role
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.status = 'active'
        AND ($1 = '' OR u.username ILIKE $2 OR e.full_name ILIKE $2)
      ORDER BY u.username ASC
      LIMIT $3
    `;

    const resDb = await pool.query(query, [q, `%${q}%`, limit]);
    res.json({ items: resDb.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal mencari petugas IT" });
  }
}
