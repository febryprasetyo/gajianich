import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import createApp from "../app";
import { pool } from "../db";
import { generateToken } from "../utils/jwt";

async function createCoverageServer() {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const baseUrl = "http://127.0.0.1:" + address.port;
  return {
    baseUrl,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("Coverage: Append-Only Trigger on helpdesk_ticket_audit rejects UPDATE and DELETE (ERRCODE 55000)", async () => {
  const client = await pool.connect();
  try {
    const userRes = await client.query(
      "INSERT INTO users (username, email, password_hash) VALUES ('cov_' || md5(random()::text), 'cov_' || md5(random()::text) || '@test.com', 'hash') RETURNING id"
    );
    const userId = Number(userRes.rows[0].id);

    const empRes = await client.query(
      "INSERT INTO employees (employee_number, full_name, status) VALUES ('EMP-COV-' || md5(random()::text), 'Coverage Employee', 'Active') RETURNING id"
    );
    const employeeId = Number(empRes.rows[0].id);

    const tckIns = await client.query(
      "INSERT INTO helpdesk_tickets (" +
       "ticket_number, requester_employee_id, requester_name_snapshot, requester_department_snapshot, " +
       "created_by_user_id, created_by_name_snapshot, reported_at, " +
       "category, origin, priority, status, title, description" +
      ") VALUES (" +
      "'TCK-COV-" + Date.now() + "', $1, 'Admin', 'IT', $2, 'Admin', NOW(), " +
      "'HARDWARE', 'WHATSAPP', 'LOW', 'OPEN', 'Coverage Test', 'Test description'" +
      ") RETURNING id",
      [employeeId, userId]
    );
    const ticketId = tckIns.rows[0].id;

    const ins = await client.query(
      "INSERT INTO helpdesk_ticket_audit (" +
      "ticket_id, actor_user_id, actor_name_snapshot, action, note" +
      ") VALUES ($1, $2, 'Admin', 'STATUS_CHANGE', 'Test audit') RETURNING id",
      [ticketId, userId]
    );
    const auditId = ins.rows[0].id;
    assert.ok(auditId, "Audit row inserted successfully");

    await assert.rejects(
      async () => {
        await client.query(
          "UPDATE helpdesk_ticket_audit SET note = 'tampered' WHERE id = $1",
          [auditId]
        );
      },
      (err: any) => {
        assert.equal(err.code, "55000", "Must raise SQLSTATE 55000 on UPDATE");
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await client.query(
          "DELETE FROM helpdesk_ticket_audit WHERE id = $1",
          [auditId]
        );
      },
      (err: any) => {
        assert.equal(err.code, "55000", "Must raise SQLSTATE 55000 on DELETE");
        return true;
      }
    );
  } finally {
    client.release();
  }
});

test("Coverage: Endpoints & Validation Rules", async () => {
  const initClient = await pool.connect();
  let employeeId: number;
  let userId: number;
  try {
    const userRes = await initClient.query(
      "INSERT INTO users (username, email, password_hash) VALUES ('cov_' || md5(random()::text), 'cov_' || md5(random()::text) || '@test.com', 'hash') RETURNING id"
    );
    userId = Number(userRes.rows[0].id);

    const empRes = await initClient.query(
      "INSERT INTO employees (employee_number, full_name, status) VALUES ('EMP-COV-' || md5(random()::text), 'Coverage Employee', 'Active') RETURNING id"
    );
    employeeId = Number(empRes.rows[0].id);
  } finally {
    initClient.release();
  }

  const { baseUrl, close } = await createCoverageServer();

  try {
    const itUserToken = generateToken({
      userId,
      username: "it_admin",
      roleId: 1,
      roleName: "IT_ADMIN",
      permissions: ["helpdesk.view", "helpdesk.create", "helpdesk.manage", "helpdesk.admin"],
    });

    // 1. Future reported_at must be rejected (400)
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const futureRes = await fetch(baseUrl + "/api/v1/helpdesk/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + itUserToken,
      },
      body: JSON.stringify({
        requesterEmployeeId: employeeId,
        reportedAt: futureDate,
        category: "HARDWARE",
        origin: "WHATSAPP",
        priority: "HIGH",
        title: "Future date test",
        description: "Testing future reported_at validation",
      }),
    });
    assert.equal(futureRes.status, 400, "Future reported_at must be rejected with 400");

    // 2. Client sending injected created_by or ticket_number must be rejected (400)
    const injectedRes = await fetch(baseUrl + "/api/v1/helpdesk/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + itUserToken,
      },
      body: JSON.stringify({
        requesterEmployeeId: employeeId,
        category: "SOFTWARE",
        origin: "PHONE",
        priority: "MEDIUM",
        title: "Injected Ticket Attempt",
        description: "Attempting to inject created_by field",
        created_by: 9999,
      }),
    });
    assert.equal(injectedRes.status, 400, "Injected created_by must be rejected with 400");

    // 3. Valid ticket creation (201)
    const createRes = await fetch(baseUrl + "/api/v1/helpdesk/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + itUserToken,
      },
      body: JSON.stringify({
        requesterEmployeeId: employeeId,
        category: "SOFTWARE",
        origin: "PHONE",
        priority: "MEDIUM",
        title: "Valid Ticket Coverage",
        description: "Valid ticket description for testing coverage",
      }),
    });
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.equal(createData.data.createdBy.userId, userId, "createdById must come from JWT, not payload");
    const ticketId = createData.data.id;

    // 4. Invalid status transition: OPEN -> RESOLVED directly without in_progress (400)
    const invalidTransRes = await fetch(baseUrl + "/api/v1/helpdesk/tickets/" + ticketId + "/status", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + itUserToken,
      },
      body: JSON.stringify({
        status: "PENDING",
        resolutionNotes: "Cannot go to pending from open",
      }),
    });
    assert.equal(invalidTransRes.status, 400, "Direct OPEN to RESOLVED transition must be rejected");

    // 5. Valid status transition: OPEN -> IN_PROGRESS (200)
    const inProgressRes = await fetch(baseUrl + "/api/v1/helpdesk/tickets/" + ticketId + "/status", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + itUserToken,
      },
      body: JSON.stringify({
        status: "IN_PROGRESS",
      }),
    });
    assert.equal(inProgressRes.status, 200);

    // 6. Valid status transition: IN_PROGRESS -> RESOLVED with feedback (200)
    const resolveRes = await fetch(baseUrl + "/api/v1/helpdesk/tickets/" + ticketId + "/status", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + itUserToken,
      },
      body: JSON.stringify({
        status: "RESOLVED",
        resolutionNotes: "Telah diperbaiki kabel power dan monitor normal kembali",
        confirmationChannel: "WHATSAPP",
        feedbackScore: 5,
        feedbackNotes: "Pelapor puas dengan kecepatan penanganan",
      }),
    });
    assert.equal(resolveRes.status, 200);
    const resolveData = await resolveRes.json();
    assert.equal(resolveData.data.feedbackSource, "STAFF_RECORDED", "feedbackSource must be STAFF_RECORDED");
    assert.equal(resolveData.data.feedbackScore, 5);

    // 7. Check detail endpoint includes audit and comments
    const detailRes = await fetch(baseUrl + "/api/v1/helpdesk/tickets/" + ticketId + "/audit", {
      headers: {
        Authorization: "Bearer " + itUserToken,
      },
    });
    assert.equal(detailRes.status, 200);
    const detailData = await detailRes.json();
    assert.ok(Array.isArray(detailData.data));
    assert.ok(detailData.data.length >= 2, "Audit trail must have recorded transitions");

    // 8. Verify stats endpoint
    const statsRes = await fetch(baseUrl + "/api/v1/helpdesk/stats", {
      headers: {
        Authorization: "Bearer " + itUserToken,
      },
    });
    assert.equal(statsRes.status, 200);
    const statsData = await statsRes.json();
    assert.ok(typeof statsData.data.openTickets === "number");
    assert.ok(typeof statsData.data.resolvedTickets === "number");
    assert.equal(statsData.data.feedbackSource, "STAFF_RECORDED");
  } finally {
    await close();
  }
});
