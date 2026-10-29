import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import createApp from "../app";
import { generateToken } from "../utils/jwt";
import { pool } from "../db";

test("Helpdesk Attachment Upload and Download integration tests", async (t) => {
  const tempStorage = await mkdtemp(path.join(tmpdir(), "helpdesk-att-test-"));
  process.env.HELPDESK_STORAGE_DIR = tempStorage;

  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const base = "http://127.0.0.1:" + address.port + "/api/v1/helpdesk";

  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(tempStorage, { recursive: true, force: true });
  });

  const client = await pool.connect();
  let employeeId: number;
  let adminUserId: number;
  let unauthorizedUserId: number;

  try {
    const empRes = await client.query(
      "INSERT INTO employees (employee_number, full_name, status) VALUES ($1, $2, $3) RETURNING id",
      ["EMP-ATT-" + Date.now(), "Dewi Sartika", "Active"]
    );
    employeeId = empRes.rows[0].id;

    const adminUserRes = await client.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ["admin_att_" + Date.now(), "admin_att_" + Date.now() + "@test.com", "hash"]
    );
    adminUserId = Number(adminUserRes.rows[0].id);

    const unauthRes = await client.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ["unauth_att_" + Date.now(), "unauth_att_" + Date.now() + "@test.com", "hash"]
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
    permissions: ["helpdesk.view", "helpdesk.manage"],
  });

  const unauthToken = generateToken({
    userId: unauthorizedUserId,
    roleId: 99,
    roleName: "employee",
    permissions: ["some.unrelated.permission"],
  });

  // Create a ticket to attach to
  const createRes = await fetch(base + "/tickets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + validToken,
    },
    body: JSON.stringify({
      title: "Bluescreen Kernel Panic",
      description: "Error code: 0x0000000A",
      priority: "CRITICAL",
      category: "SOFTWARE",
      origin: "EMAIL",
      requesterEmployeeId: Number(employeeId),
    }),
  });
  assert.equal(createRes.status, 201);
  const ticketBody: any = await createRes.json();
  const ticketId = ticketBody.data.id;

  let createdAttachmentId: string;

  await t.test("uploads a valid image attachment", async () => {
    const formData = new FormData();
    const fakeImageBuffer = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;");
    formData.append("file", new Blob([fakeImageBuffer], { type: "image/gif" }), "screenshot_bluescreen.gif");

    const res = await fetch(`${base}/tickets/${ticketId}/attachments`, {
      method: "POST",
      headers: { Authorization: "Bearer " + validToken },
      body: formData,
    });

    assert.equal(res.status, 201);
    const body: any = await res.json();
    assert.ok(body.data.id);
    createdAttachmentId = body.data.id;
    assert.equal(body.data.filename, "screenshot_bluescreen.gif");
    assert.equal(body.data.mimeType, "image/gif");
    assert.notEqual(body.data.storagePath, "screenshot_bluescreen.gif");
  });

  await t.test("downloads uploaded attachment and sets proper headers", async () => {
    const res = await fetch(`${base}/tickets/${ticketId}/attachments/${createdAttachmentId}`, {
      headers: { Authorization: "Bearer " + validToken },
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/gif");
    assert.match(res.headers.get("content-disposition") || "", /screenshot_bluescreen.gif/);
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 0);
  });

  await t.test("rejects file upload exceeding 10 MB with 413 Payload Too Large", async () => {
    const formData = new FormData();
    // 10.5 MB buffer
    const largeBuffer = Buffer.alloc(10.5 * 1024 * 1024, 0);
    formData.append("file", new Blob([largeBuffer], { type: "application/pdf" }), "giant_manual.pdf");

    const res = await fetch(`${base}/tickets/${ticketId}/attachments`, {
      method: "POST",
      headers: { Authorization: "Bearer " + validToken },
      body: formData,
    });

    assert.equal(res.status, 413);
  });

  await t.test("rejects disallowed MIME type with 400", async () => {
    const formData = new FormData();
    formData.append("file", new Blob([Buffer.from("malicious binary")], { type: "application/x-msdos-program" }), "virus.exe");

    const res = await fetch(`${base}/tickets/${ticketId}/attachments`, {
      method: "POST",
      headers: { Authorization: "Bearer " + validToken },
      body: formData,
    });

    assert.equal(res.status, 400);
    const body: any = await res.json();
    assert.match(body.error, /Tipe file tidak diizinkan/i);
  });

  await t.test("rejects upload without helpdesk.manage with 403", async () => {
    const formData = new FormData();
    formData.append("file", new Blob([Buffer.from("test")], { type: "application/pdf" }), "doc.pdf");

    const res = await fetch(`${base}/tickets/${ticketId}/attachments`, {
      method: "POST",
      headers: { Authorization: "Bearer " + unauthToken },
      body: formData,
    });

    assert.equal(res.status, 403);
  });
});
