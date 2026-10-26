import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "../db";
import {
  createTicket,
  updateTicket,
  addComment,
  getTicketById,
  listTickets,
  getTicketAuditTrail
} from "../modules/ticket/service";
import { TicketActor } from "../modules/ticket/types";

test("Helpdesk domain service and audit trail integration tests", async (t) => {
  const client = await pool.connect();
  let employeeId: number;
  let adminUserId: number;
  let staffUserId: number;

  try {
    const empRes = await client.query(
      "INSERT INTO employees (employee_number, full_name, status) VALUES ($1, $2, $3) RETURNING id",
      ["EMP-SVC-" + Date.now(), "Budi Santoso", "Active"]
    );
    employeeId = empRes.rows[0].id;

    const adminUserRes = await client.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ["admin_" + Date.now(), "admin_" + Date.now() + "@test.com", "hash"]
    );
    adminUserId = adminUserRes.rows[0].id;

    const staffUserRes = await client.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ["staff_" + Date.now(), "staff_" + Date.now() + "@test.com", "hash"]
    );
    staffUserId = staffUserRes.rows[0].id;
  } finally {
    client.release();
  }

  const itStaffActor: TicketActor = {
    userId: staffUserId,
    name: "IT Staff Andi",
    username: "staff_andi",
    permissions: ["helpdesk.view", "helpdesk.manage"],
  };

  const itAdminActor: TicketActor = {
    userId: adminUserId,
    name: "IT Admin Super",
    username: "admin_super",
    permissions: ["helpdesk.view", "helpdesk.manage", "helpdesk.admin"],
  };

  let createdTicketId: number;

  await t.test("createTicket stores three identities and creates audit trail", async () => {
    const ticket = await createTicket(itStaffActor, {
      title: "Jaringan Wi-Fi Lambat di Lantai 3",
      description: "Kecepatan download hanya 100kbps sejak pagi",
      priority: "HIGH",
      category: "NETWORK",
      origin: "WHATSAPP",
      requesterEmployeeId: employeeId,
      assignedToUserId: staffUserId,
      reportEvidence: "Chat WA: Pak Wi-Fi lemot banget nih",
      isInternal: false,
    });

    assert.ok(ticket.id);
    createdTicketId = Number(ticket.id);
    assert.match(ticket.ticketNumber, /^TKT-\d{6}-\d{4}$/);
    assert.equal(ticket.requester.nameSnapshot, "Budi Santoso");
    assert.equal(ticket.createdBy.nameSnapshot, "IT Staff Andi");
    assert.ok(ticket.assignedTo?.nameSnapshot?.startsWith("staff_")); // fallback username or employee
    assert.equal(ticket.status, "OPEN");

    const audit = await getTicketAuditTrail(createdTicketId);
    assert.ok(audit.length >= 1);
    assert.equal(audit[0].action, "CREATE");
    assert.equal(audit[0].actorName, "IT Staff Andi");
  });

  await t.test("createTicket rejects reported_at in the future", async () => {
    const future = new Date(Date.now() + 1000 * 3600); // 1 jam ke depan
    await assert.rejects(
      async () => {
        await createTicket(itStaffActor, {
          title: "Future Ticket",
          description: "Should fail timestamp check",
          priority: "LOW",
          category: "OTHER",
          origin: "PHONE",
          requesterEmployeeId: employeeId,
          reportedAt: future.toISOString(),
          isInternal: false,
        });
      },
      /tidak boleh lebih maju/
    );
  });

  await t.test("createTicket rejects non-existent requester employee", async () => {
    await assert.rejects(
      async () => {
        await createTicket(itStaffActor, {
          title: "Ghost Requester",
          description: "Should fail requester check",
          priority: "LOW",
          category: "OTHER",
          origin: "WALK_IN",
          requesterEmployeeId: 99999999,
          isInternal: false,
        });
      },
      /tidak ditemukan di direktori/
    );
  });

  await t.test("addComment updates first_response_at on first public comment", async () => {
    // 1. Internal note first
    const internalComment = await addComment(itStaffActor, createdTicketId, {
      body: "Catatan internal teknisi: kemungkinan router butuh reboot",
      isInternalNote: true,
    });
    assert.equal(internalComment.isInternalNote, true);

    let ticket = await getTicketById(createdTicketId);
    assert.equal(ticket.firstResponseAt, null);

    // 2. Public comment
    const publicComment = await addComment(itStaffActor, createdTicketId, {
      body: "Halo Pak Budi, teknisi sedang menuju lokasi",
      isInternalNote: false,
    });
    assert.equal(publicComment.isInternalNote, false);

    ticket = await getTicketById(createdTicketId);
    assert.ok(ticket.firstResponseAt !== null);
  });

  await t.test("updateTicket handles status transitions and audits", async () => {
    // Valid transition: OPEN -> IN_PROGRESS
    const updated = await updateTicket(itStaffActor, createdTicketId, {
      status: "IN_PROGRESS",
    });
    assert.equal(updated.status, "IN_PROGRESS");

    // Invalid transition: IN_PROGRESS -> OPEN
    await assert.rejects(
      async () => {
        await updateTicket(itStaffActor, createdTicketId, {
          status: "OPEN",
        });
      },
      /tidak valid/
    );

    // Valid transition: IN_PROGRESS -> RESOLVED
    const resolved = await updateTicket(itStaffActor, createdTicketId, {
      status: "RESOLVED",
      resolutionNote: "Kabel LAN access point diganti",
      resolutionConfirmedBy: "Budi Santoso",
      resolutionConfirmationChannel: "WHATSAPP",
      feedbackScore: 5,
      feedbackNote: "Cepat dan tanggap",
    });
    assert.equal(resolved.status, "RESOLVED");
    assert.equal(resolved.feedbackSource, "STAFF_RECORDED");
    assert.ok(resolved.resolvedAt !== null);

    // Valid transition: RESOLVED -> CLOSED
    const closed = await updateTicket(itStaffActor, createdTicketId, {
      status: "CLOSED",
    });
    assert.equal(closed.status, "CLOSED");
  });

  await t.test("reopen closed ticket requires helpdesk.admin", async () => {
    // IT Staff cannot reopen closed ticket
    await assert.rejects(
      async () => {
        await updateTicket(itStaffActor, createdTicketId, {
          status: "OPEN",
          reopenJustification: "Problem recurred",
        });
      },
      /helpdesk.admin/
    );

    // IT Admin can reopen closed ticket
    const reopened = await updateTicket(itAdminActor, createdTicketId, {
      status: "OPEN",
      reopenJustification: "Problem recurred and verified by Admin",
    });
    assert.equal(reopened.status, "OPEN");
  });

  await t.test("changing reported_at requires helpdesk.admin", async () => {
    const newReportedDate = new Date(Date.now() - 3600 * 1000 * 24); // Kemarin

    // IT Staff cannot change reported_at
    await assert.rejects(
      async () => {
        await updateTicket(itStaffActor, createdTicketId, {
          reportedAt: newReportedDate.toISOString(),
        });
      },
      /helpdesk.admin/
    );

    // IT Admin can change reported_at
    const updated = await updateTicket(itAdminActor, createdTicketId, {
      reportedAt: newReportedDate.toISOString(),
    });
    assert.equal(new Date(updated.reportedAt).toISOString(), newReportedDate.toISOString());
  });

  await t.test("listTickets filters correctly and excludes internal finding when requested", async () => {
    // Create an internal ticket
    const internalTicket = await createTicket(itStaffActor, {
      title: "Pemeriksaan Rutin Server Bulanan",
      description: "Cek suhu dan pembersihan kipas blade",
      priority: "LOW",
      category: "HARDWARE",
      origin: "INTERNAL_FINDING",
      requesterEmployeeId: employeeId,
      isInternal: true,
    });

    const publicList = await listTickets({ isInternal: false });
    const hasInternalInPublic = publicList.items.some((t) => t.id === internalTicket.id);
    assert.equal(hasInternalInPublic, false);

    const internalList = await listTickets({ isInternal: true });
    const hasInternal = internalList.items.some((t) => t.id === internalTicket.id);
    assert.equal(hasInternal, true);
  });
});
