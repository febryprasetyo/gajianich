import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import { pool } from "../../db";

export interface TicketStats {
  totalTickets: number;         // is_internal = false
  totalInternal: number;        // is_internal = true
  openTickets: number;
  inProgressTickets: number;
  pendingTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  avgFirstResponseMinutes: number;   // SLA dari reported_at ke first_response_at
  avgResolutionMinutes: number;      // SLA dari reported_at ke resolved_at
  avgRecordingDelayMinutes: number;  // Selisih created_at - reported_at
  byCategory: Record<string, number>;
  byOrigin: Record<string, number>;
  byDepartment: Record<string, number>;
  feedbackAvg: number | null;
  feedbackCount: number;
  feedbackSource: "STAFF_RECORDED";
}

export async function calculateTicketStats(startDate?: string, endDate?: string): Promise<TicketStats> {
  const conditions: string[] = ["1=1"];
  const params: any[] = [];

  if (startDate) {
    params.push(new Date(startDate));
    conditions.push(`reported_at >= $${params.length}`);
  }
  if (endDate) {
    params.push(new Date(endDate));
    conditions.push(`reported_at <= $${params.length}`);
  }

  const whereClause = conditions.join(" AND ");

  const query = `
    SELECT
      COUNT(*) FILTER (WHERE is_internal = false) AS total_tickets,
      COUNT(*) FILTER (WHERE is_internal = true) AS total_internal,
      COUNT(*) FILTER (WHERE is_internal = false AND status = 'OPEN') AS open_tickets,
      COUNT(*) FILTER (WHERE is_internal = false AND status = 'IN_PROGRESS') AS in_progress_tickets,
      COUNT(*) FILTER (WHERE is_internal = false AND status = 'PENDING') AS pending_tickets,
      COUNT(*) FILTER (WHERE is_internal = false AND status = 'RESOLVED') AS resolved_tickets,
      COUNT(*) FILTER (WHERE is_internal = false AND status = 'CLOSED') AS closed_tickets,
      -- SLA Response (menit dari reported_at ke first_response_at)
      AVG(EXTRACT(EPOCH FROM (first_response_at - reported_at)) / 60)
        FILTER (WHERE is_internal = false AND first_response_at IS NOT NULL AND first_response_at >= reported_at) AS avg_response_min,
      -- SLA Resolution (menit dari reported_at ke resolved_at)
      AVG(EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 60)
        FILTER (WHERE is_internal = false AND resolved_at IS NOT NULL AND resolved_at >= reported_at) AS avg_resolution_min,
      -- Selisih Keterlambatan Pencatatan (menit dari reported_at ke created_at)
      AVG(EXTRACT(EPOCH FROM (created_at - reported_at)) / 60)
        FILTER (WHERE is_internal = false AND created_at >= reported_at) AS avg_delay_min,
      -- Feedback
      AVG(feedback_score) FILTER (WHERE is_internal = false AND feedback_score IS NOT NULL) AS feedback_avg,
      COUNT(feedback_score) FILTER (WHERE is_internal = false AND feedback_score IS NOT NULL) AS feedback_count
    FROM helpdesk_tickets
    WHERE ${whereClause}
  `;

  const statsRes = await pool.query(query, params);
  const row = statsRes.rows[0];

  // Breakdown by Category
  const catRes = await pool.query(
    `SELECT category, COUNT(*) AS cnt FROM helpdesk_tickets WHERE is_internal = false AND ${whereClause} GROUP BY category`,
    params
  );
  const byCategory: Record<string, number> = {};
  for (const c of catRes.rows) {
    byCategory[c.category] = parseInt(c.cnt, 10);
  }

  // Breakdown by Origin
  const origRes = await pool.query(
    `SELECT origin, COUNT(*) AS cnt FROM helpdesk_tickets WHERE is_internal = false AND ${whereClause} GROUP BY origin`,
    params
  );
  const byOrigin: Record<string, number> = {};
  for (const o of origRes.rows) {
    byOrigin[o.origin] = parseInt(o.cnt, 10);
  }

  // Breakdown by Department
  const deptRes = await pool.query(
    `SELECT requester_department_snapshot, COUNT(*) AS cnt FROM helpdesk_tickets WHERE is_internal = false AND ${whereClause} GROUP BY requester_department_snapshot`,
    params
  );
  const byDepartment: Record<string, number> = {};
  for (const d of deptRes.rows) {
    byDepartment[d.requester_department_snapshot] = parseInt(d.cnt, 10);
  }

  return {
    totalTickets: parseInt(row.total_tickets || "0", 10),
    totalInternal: parseInt(row.total_internal || "0", 10),
    openTickets: parseInt(row.open_tickets || "0", 10),
    inProgressTickets: parseInt(row.in_progress_tickets || "0", 10),
    pendingTickets: parseInt(row.pending_tickets || "0", 10),
    resolvedTickets: parseInt(row.resolved_tickets || "0", 10),
    closedTickets: parseInt(row.closed_tickets || "0", 10),
    avgFirstResponseMinutes: Math.round(parseFloat(row.avg_response_min || "0") * 10) / 10,
    avgResolutionMinutes: Math.round(parseFloat(row.avg_resolution_min || "0") * 10) / 10,
    avgRecordingDelayMinutes: Math.round(parseFloat(row.avg_delay_min || "0") * 10) / 10,
    byCategory,
    byOrigin,
    byDepartment,
    feedbackAvg: row.feedback_avg ? Math.round(parseFloat(row.feedback_avg) * 10) / 10 : null,
    feedbackCount: parseInt(row.feedback_count || "0", 10),
    feedbackSource: "STAFF_RECORDED",
  };
}

export async function getHelpdeskStatsHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
    const stats = await calculateTicketStats(startDate, endDate);
    res.json({ data: stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal menghitung statistik helpdesk" });
  }
}
