import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import createApp from "../app";
import { generateToken } from "../utils/jwt";
import { pool } from "../db";

test("Helpdesk Routes API integration test suite", async (t) => {
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
  let unauthorizedUserId: number;

  try {
    const empRes = await client.query(
      "INSERT INTO employees (employee_number, full_name, status) VALUES ($1, $2, $3) RETURNING id",
      ["EMP-API-" + Date.now(), "Rina Kartika", "Active"]
    );
    employeeId = Number(empRes.rows[0].id);

    const adminUserRes = await client.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ["admin_api_" + Date.now(), "admin_api_" + Date.now() + "@test.com", "hash"]
    );
    adminUserId = Number(adminUserRes.rows[0].id);

    const unauthRes = await client.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ["unauth_" + Date.now(), "unauth_" + Date.now() + "@test.com", "hash"]
    );
    unauthorizedUserId = Number(unauthRes.rows[0].id);
    await client.query("UPDATE users SET role='Employee' WHERE id=$1", [unauthorizedUserId]);
  } finally {
    client.release();
  }

  const validToken = generateToken({
    userId: adminUserId,
    roleId: 1,
    roleName: "super_admin",
    permissions: ["helpdesk.view", "helpdesk.manage", "helpdesk.admin"],
  });

  const unauthPermToken = generateToken({
    userId: unauthorizedUserId,
    roleId: 99,
    roleName: "employee",
    permissions: ["some.other.permission"],
  });

  let createdTicketId: number;

  await t.test("POST /api/v1/helpdesk/tickets rejects request without token with 401", async () => {
    const res = await fetch(base + "/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", description: "Test" }),
    });
    assert.equal(res.status, 401);
  });

  await t.test("POST /api/v1/helpdesk/tickets rejects user without helpdesk.manage with 403", async () => {
    const res = await fetch(base + "/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + unauthPermToken,
      },
      body: JSON.stringify({
        title: "Test Ticket",
        description: "Test Ticket Desc",
        priority: "MEDIUM",
        category: "HARDWARE",
        origin: "WHATSAPP",
        requesterEmployeeId: employeeId,
      }),
    });
    assert.equal(res.status, 403);
  });

  await t.test("POST /api/v1/helpdesk/tickets rejects client trying to supply created_by or ticket_number with 400", async () => {
    const res = await fetch(base + "/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + validToken,
      },
      body: JSON.stringify({
        title: "Test Ticket Injection",
        description: "Test Ticket Desc Injection",
        priority: "MEDIUM",
        category: "HARDWARE",
        origin: "WHATSAPP",
        requesterEmployeeId: employeeId,
        createdBy: 999,
        ticketNumber: "TKT-FAKE-0001",
      }),
    });
    assert.equal(res.status, 400);
    const body: any = await res.json();
    assert.match(body.error, /dilarang mengirim field/i);
  });

  await t.test("POST /api/v1/helpdesk/tickets succeeds with valid payload and sets three identities", async () => {
    const res = await fetch(base + "/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + validToken,
      },
      body: JSON.stringify({
        title: "Monitor bergaris horizontal merah",
        description: "Tampak garis merah horizontal melintang di tengah layar",
        priority: "MEDIUM",
        category: "HARDWARE",
        origin: "WALK_IN",
        requesterEmployeeId: employeeId,
        reportEvidence: "Pelapor datang langsung ke ruang IT",
        isInternal: false,
      }),
    });

    const body: any = await res.json();
    if (res.status !== 201) console.error("POST 400 error body:", body);
    assert.equal(res.status, 201);
    assert.ok(body.data.id);
    createdTicketId = Number(body.data.id);
    assert.equal(body.data.requester.nameSnapshot, "Rina Kartika");
    assert.equal(body.data.status, "OPEN");
  });

  await t.test("GET /api/v1/helpdesk/tickets lists tickets with filters", async () => {
    const res = await fetch(base + "/tickets?status=OPEN&category=HARDWARE", {
      headers: { Authorization: "Bearer " + validToken },
    });

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.some((t: any) => t.id === String(createdTicketId)));
  });

  await t.test("GET /api/v1/helpdesk/tickets/:id returns full detail", async () => {
    const res = await fetch(base + "/tickets/" + createdTicketId, {
      headers: { Authorization: "Bearer " + validToken },
    });

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.data.id, String(createdTicketId));
    assert.equal(body.data.description, "Tampak garis merah horizontal melintang di tengah layar");
    assert.ok(Array.isArray(body.data.comments));
  });

  await t.test("POST /api/v1/helpdesk/tickets/:id/comments adds a comment", async () => {
    const res = await fetch(base + "/tickets/" + createdTicketId + "/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + validToken,
      },
      body: JSON.stringify({
        body: "Monitor pengganti sedang disiapkan",
        isInternalNote: false,
      }),
    });

    assert.equal(res.status, 201);
    const body: any = await res.json();
    assert.equal(body.data.body, "Monitor pengganti sedang disiapkan");
  });

  await t.test("PATCH /api/v1/helpdesk/tickets/:id rejects invalid transition with 400", async () => {
    const res = await fetch(base + "/tickets/" + createdTicketId, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + validToken,
      },
      body: JSON.stringify({
        status: "PENDING", // OPEN -> PENDING is not allowed directly
      }),
    });

    assert.equal(res.status, 400);
  });

  await t.test("PATCH /api/v1/helpdesk/tickets/:id resolves ticket with confirmation", async () => {
    const res = await fetch(base + "/tickets/" + createdTicketId, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + validToken,
      },
      body: JSON.stringify({
        status: "RESOLVED",
        resolutionNote: "Monitor diganti unit cadangan Dell P2419H",
        resolutionConfirmedBy: "Rina Kartika",
        resolutionConfirmationChannel: "WALK_IN",
        feedbackScore: 5,
        feedbackNote: "Pelayanan sangat cepat",
      }),
    });

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.data.status, "RESOLVED");
    assert.equal(body.data.feedbackSource, "STAFF_RECORDED");
  });

  await t.test("GET /api/v1/helpdesk/tickets/:id/audit returns audit events", async () => {
    const res = await fetch(base + "/tickets/" + createdTicketId + "/audit", {
      headers: { Authorization: "Bearer " + validToken },
    });

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 2);
  });

  await t.test("GET /api/v1/helpdesk/employees returns matching employees", async () => {
    const res = await fetch(base + "/employees?q=Rina", {
      headers: { Authorization: "Bearer " + validToken },
    });

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.some((e: any) => e.fullName === "Rina Kartika"));
  });

  await t.test("GET /api/v1/helpdesk/assignees returns matching assignees", async () => {
    const res = await fetch(base + "/assignees?q=admin_api", {
      headers: { Authorization: "Bearer " + validToken },
    });

    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.ok(Array.isArray(body.items));
    assert.ok(body.items.length >= 1);
  });
});
