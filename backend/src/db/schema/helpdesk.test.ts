import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, pool } from "../index";
import {
  helpdeskTickets,
  helpdeskTicketComments,
  helpdeskTicketAudit,
  helpdeskAttachments,
  helpdeskTicketCounters
} from "../../modules/ticket/schema";
import { employees } from "./employees";
import { users, roles } from "./users";

test("Helpdesk schema and append-only audit enforcement", async (t) => {
  // Setup fixture employee and user
  const client = await pool.connect();
  let employeeId: number;
  let userId: number;
  const testNum = "TEST-EMP-" + Date.now();

  try {
    const empRes = await client.query(
      "INSERT INTO employees (employee_number, full_name, status) VALUES ($1, $2, $3) RETURNING id",
      [testNum, "Tester Employee", "Active"]
    );
    employeeId = empRes.rows[0].id;

    const userRes = await client.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ["testuser_" + Date.now(), "test_" + Date.now() + "@example.com", "hash"]
    );
    userId = userRes.rows[0].id;
  } finally {
    client.release();
  }

  t.after(async () => {
    const cleanup = await pool.connect();
    try {
      await cleanup.query("DELETE FROM helpdesk_ticket_comments WHERE author_user_id = $1", [userId]);
      await cleanup.query("DELETE FROM helpdesk_attachments WHERE uploaded_by_user_id = $1", [userId]);
      // Note: helpdesk_ticket_audit cannot be deleted via runtime due to append-only trigger, so we leave it or bypass if superuser
      await cleanup.query("DELETE FROM helpdesk_tickets WHERE created_by_user_id = $1", [userId]);
      await cleanup.query("DELETE FROM users WHERE id = $1", [userId]);
      await cleanup.query("DELETE FROM employees WHERE id = $1", [employeeId]);
    } catch (e) {
      // ignore cleanup errors in test
    } finally {
      cleanup.release();
    }
  });

  const now = new Date();
  const ticketNumber = "TKT-TEST-" + Date.now();

  await t.test("inserts a valid helpdesk ticket with 3 explicit identities", async () => {
    const [inserted] = await db.insert(helpdeskTickets).values({
      ticketNumber,
      title: "Laptop Bluescreen",
      description: "Laptop mati saat membuka Excel",
      status: "OPEN",
      priority: "HIGH",
      category: "HARDWARE",
      origin: "WHATSAPP",
      reportedAt: now,
      requesterEmployeeId: employeeId,
      requesterNameSnapshot: "Tester Employee",
      requesterDepartmentSnapshot: "Finance",
      createdByUserId: userId,
      createdByNameSnapshot: "IT Staf Tester",
      assignedToUserId: userId,
      assignedToNameSnapshot: "IT Staf Tester",
      isInternal: false,
    }).returning();

    assert.ok(inserted.id);
    assert.equal(inserted.ticketNumber, ticketNumber);
    assert.equal(inserted.requesterNameSnapshot, "Tester Employee");
    assert.equal(inserted.createdByNameSnapshot, "IT Staf Tester");
    assert.equal(inserted.assignedToNameSnapshot, "IT Staf Tester");
  });

  await t.test("rejects ticket insertion when requester_employee_id does not exist", async () => {
    await assert.rejects(
      async () => {
        await db.insert(helpdeskTickets).values({
          ticketNumber: "TKT-FAIL-" + Date.now(),
          title: "Invalid Requester",
          description: "Should fail FK",
          status: "OPEN",
          priority: "LOW",
          category: "OTHER",
          origin: "WALK_IN",
          reportedAt: now,
          requesterEmployeeId: 99999999, // non-existent
          requesterNameSnapshot: "Ghost",
          requesterDepartmentSnapshot: "Unknown",
          createdByUserId: userId,
          createdByNameSnapshot: "IT Staf",
          isInternal: false,
        });
      },
      (err: any) => {
        const code = err?.code || err?.cause?.code;
        const msg = (err?.message || "") + " " + (err?.cause?.message || "");
        assert.ok(code === "23503" || msg.includes("foreign key") || msg.includes("violates"));
        return true;
      }
    );
  });

  await t.test("inserts comment and links to ticket", async () => {
    const [ticket] = await db.select().from(helpdeskTickets).where(eq(helpdeskTickets.ticketNumber, ticketNumber));
    assert.ok(ticket);

    const [comment] = await db.insert(helpdeskTicketComments).values({
      ticketId: ticket.id,
      authorUserId: userId,
      authorNameSnapshot: "IT Staf Tester",
      body: "Sedang dicek ke meja pelapor",
      isInternalNote: false,
    }).returning();

    assert.ok(comment.id);
    assert.equal(comment.ticketId, ticket.id);
    assert.equal(comment.isInternalNote, false);
  });

  await t.test("append-only trigger blocks UPDATE and DELETE on helpdesk_ticket_audit", async () => {
    const [ticket] = await db.select().from(helpdeskTickets).where(eq(helpdeskTickets.ticketNumber, ticketNumber));
    assert.ok(ticket);

    const [auditEntry] = await db.insert(helpdeskTicketAudit).values({
      ticketId: ticket.id,
      actorUserId: userId,
      actorNameSnapshot: "IT Staf Tester",
      action: "CREATE",
      note: "Tiket dibuat via WhatsApp",
    }).returning();

    assert.ok(auditEntry.id);

    // Attempt UPDATE - must fail with code 55000
    await assert.rejects(
      async () => {
        await db.update(helpdeskTicketAudit)
          .set({ note: "Manipulated" })
          .where(eq(helpdeskTicketAudit.id, auditEntry.id));
      },
      (err: any) => {
        const code = err?.code || err?.cause?.code;
        const msg = (err?.message || "") + " " + (err?.cause?.message || "");
        assert.ok(code === "55000" || msg.includes("append-only"));
        return true;
      }
    );

    // Attempt DELETE - must fail with code 55000
    await assert.rejects(
      async () => {
        await db.delete(helpdeskTicketAudit)
          .where(eq(helpdeskTicketAudit.id, auditEntry.id));
      },
      (err: any) => {
        const code = err?.code || err?.cause?.code;
        const msg = (err?.message || "") + " " + (err?.cause?.message || "");
        assert.ok(code === "55000" || msg.includes("append-only"));
        return true;
      }
    );
  });

  await t.test("helpdeskTicketCounters supports atomic upsert for monthly sequence", async () => {
    const yyyymm = "202610";
    const client2 = await pool.connect();
    try {
      const res1 = await client2.query(
        "INSERT INTO helpdesk_ticket_counters (year_month, last_seq) VALUES ($1, 1) " +
        "ON CONFLICT (year_month) DO UPDATE SET last_seq = helpdesk_ticket_counters.last_seq + 1, updated_at = now() " +
        "RETURNING last_seq",
        [yyyymm]
      );
      assert.ok(res1.rows[0].last_seq >= 1);
    } finally {
      client2.release();
    }
  });
});
