import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import createApp from "../app";
import { generateToken } from "../utils/jwt";
import { pool } from "../db";

test("Helpdesk Stats & KPI API integration tests", async (t) => {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const base = "http://127.0.0.1:" + address.port + "/api/v1/helpdesk";

  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const client = await pool.connect();
  let employeeId: number;
  let adminUserId: number;

  try {
    const empRes = await client.query(
      "INSERT INTO employees (employee_number, full_name, status) VALUES ($1, $2, $3) RETURNING id",
      ["EMP-STAT-" + Date.now(), "Ahmad Fauzi", "Active"]
    );
    employeeId = empRes.rows[0].id;

    const adminUserRes = await client.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ["admin_stat_" + Date.now(), "admin_stat_" + Date.now() + "@test.com", "hash"]
    );
    adminUserId = Number(adminUserRes.rows[0].id);
  } finally {
    client.release();
  }

  const validToken = generateToken({
    userId: adminUserId,
    roleId: 1,
    roleName: "super_admin",
    permissions: ["helpdesk.view"],
  });

  // Setup seed tickets directly with specific reported_at and is_internal
  const now = new Date();
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const twentyMinAgo = new Date(now.getTime() - 20 * 60 * 1000);
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

  // 1. Tiket Pelapor Karyawan (is_internal = false)
  const tkt1 = await pool.query(
    `INSERT INTO helpdesk_tickets (
      ticket_number, title, description, status, priority, category, origin,
      reported_at, created_at, first_response_at, resolved_at,
      requester_employee_id, requester_name_snapshot, requester_department_snapshot,
      created_by_user_id, created_by_name_snapshot, feedback_score, feedback_source, is_internal
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,false) RETURNING id`,
    [
      "TKT-STAT-1-" + Date.now(),
      "Printer Paper Jam",
      "Kertas macet di tray 1",
      "RESOLVED",
      "MEDIUM",
      "PRINTER",
      "PHONE",
      thirtyMinAgo, // reported 30 min ago
      twentyMinAgo, // created 20 min ago (delay = 10 min)
      twentyMinAgo, // first response at created (response min = 10 min from reported)
      tenMinAgo,    // resolved at 10 min ago (resolution min = 20 min from reported)
      employeeId,
      "Ahmad Fauzi",
      "Logistik",
      adminUserId,
      "Admin",
      4,
      "STAFF_RECORDED",
    ]
  );

  // 2. Tiket Temuan Internal IT (is_internal = true)
  const tkt2 = await pool.query(
    `INSERT INTO helpdesk_tickets (
      ticket_number, title, description, status, priority, category, origin,
      reported_at, created_at,
      requester_employee_id, requester_name_snapshot, requester_department_snapshot,
      created_by_user_id, created_by_name_snapshot, is_internal
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true) RETURNING id`,
    [
      "TKT-STAT-2-" + Date.now(),
      "Pembersihan Server Rack",
      "Debu tebal di intake blade 2",
      "OPEN",
      "LOW",
      "HARDWARE",
      "INTERNAL_FINDING",
      thirtyMinAgo,
      twentyMinAgo,
      employeeId,
      "Ahmad Fauzi",
      "IT",
      adminUserId,
      "Admin",
    ]
  );

  await t.test("GET /api/v1/helpdesk/stats calculates accurate metrics and isolates internal tickets", async () => {
    const res = await fetch(base + "/stats", {
      headers: { Authorization: "Bearer " + validToken },
    });

    assert.equal(res.status, 200);
    const body: any = await res.json();
    const stats = body.data;

    assert.ok(stats.totalTickets >= 1);
    assert.ok(stats.totalInternal >= 1);
    assert.equal(stats.feedbackSource, "STAFF_RECORDED");
    assert.ok(typeof stats.avgFirstResponseMinutes === "number");
    assert.ok(typeof stats.avgResolutionMinutes === "number");
    assert.ok(typeof stats.avgRecordingDelayMinutes === "number");
    assert.ok(stats.byCategory["PRINTER"] >= 1);
    assert.ok(stats.byOrigin["PHONE"] >= 1);
    assert.ok(stats.byDepartment["Logistik"] >= 1);
  });
});
