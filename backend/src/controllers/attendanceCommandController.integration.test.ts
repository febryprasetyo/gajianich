import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import path from "node:path";
import { createHrAuditTestDatabase } from "../testing/hrAuditDatabase";
import { runMigrations } from "../db/migrate";
import { hrAuditEvents } from "../db/schema/hrAudit";
import { users, roles } from "../db/schema/users";
import {
  getAttendanceWorkspace,
  postAttendanceCommand,
} from "./attendanceCommandController";

const migrations = path.resolve(__dirname, "../../drizzle");

function mockRes() {
  const res: any = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.data = payload;
      return this;
    },
  };
  return res;
}

test("Attendance Command Controller Integration Tests", async (t) => {
  const fixture = await createHrAuditTestDatabase();
  t.after(async () => {
    await fixture.cleanup();
  });
  const { owner, runtime, runtimeRole, ownerUrl } = fixture;

  await runMigrations(ownerUrl, migrations, runtimeRole);

  // Grant runtime table permissions for testing
  await owner.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO "${runtimeRole}"`);
  await owner.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${runtimeRole}"`);
  await owner.query(`REVOKE UPDATE, DELETE, TRUNCATE ON hr_audit_events, hr_audit_targets, hr_mutation_receipts FROM "${runtimeRole}"`);

  const {rows:[group]} = await owner.query("INSERT INTO organization_groups(code,name) VALUES('CMC','CMC') RETURNING id");
  const organizationScope = {module:'hr',groupIds:[Number(group.id)],selectedGroupId:Number(group.id),includeUnmapped:false};
  const adminDb = drizzle(owner);
  const testDb = drizzle(runtime);

  // Seed role and test user
  const [role] = await adminDb
    .insert(roles)
    .values({
      name: "SuperAdmin",
      code: "superadmin",
      description: "HR Admin",
      isSystem: true,
    })
    .returning();

  const [testUser] = await adminDb
    .insert(users)
    .values({
      username: "audit_operator",
      email: "operator@example.com",
      passwordHash: "hash123",
      roleId: role.id,
      isActive: true,
    })
    .returning();

  await t.test("getAttendanceWorkspace returns success and clean workspace state", async () => {
    const req: any = {
      db: testDb,
      organizationScope,
      user: { userId: testUser.id, role: "admin", permissions: ["attendance.view"] },
    };
    const res = mockRes();

    await getAttendanceWorkspace(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data);
    assert.ok(Array.isArray(res.data.data.sources));
    assert.ok(Array.isArray(res.data.data.shifts));
  });

  await t.test("postAttendanceCommand executes valid lock command, creates audit event, and supports replay", async () => {
    const opId = randomUUID();
    const req: any = {
      db: testDb,
      organizationScope,
      user: { userId: testUser.id, permissions: ["attendance.manage"] },
      headers: {
        "idempotency-key": opId,
        "x-forwarded-for": "192.168.1.100",
      },
      ip: "192.168.1.100",
      body: {
        operationId: opId,
        command: {
          type: "lock",
          workDate: "2026-10-15",
          locked: true,
          reason: "Monthly payroll freeze",
        },
      },
    };
    const res1 = mockRes();
    await postAttendanceCommand(req, res1);

    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.data.success, true);

    // Verify audit event written to db
    const events = await testDb.select().from(hrAuditEvents).where(eq(hrAuditEvents.operationId, opId));
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].action, "LOCK");

    // Idempotent retry with same payload returns cached response
    const res2 = mockRes();
    await postAttendanceCommand(req, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.data.success, true);

    // Same operationId with changed payload returns 409 Conflict
    const reqConflicted = {
      ...req,
      body: {
        operationId: opId,
        command: {
          type: "lock",
          workDate: "2026-10-16",
          locked: true,
          reason: "Different date",
        },
      },
    };
    const resConflict = mockRes();
    await postAttendanceCommand(reqConflicted, resConflict);
    assert.strictEqual(resConflict.statusCode, 409);
  });

  await t.test("postAttendanceCommand rejects unauthorized command with 403", async () => {
    const req: any = {
      db: testDb,
      organizationScope,
      user: { userId: testUser.id, permissions: ["attendance.view"] }, // lacks attendance.manage
      headers: {},
      body: {
        operationId: randomUUID(),
        command: {
          type: "lock",
          workDate: "2026-10-20",
          locked: true,
          reason: "Unpermitted lock attempt",
        },
      },
    };
    const res = mockRes();
    await postAttendanceCommand(req, res);
    assert.strictEqual(res.statusCode, 403);
  });

  await t.test("postAttendanceCommand rejects mismatched Idempotency-Key header with 400", async () => {
    const req: any = {
      db: testDb,
      organizationScope,
      user: { userId: testUser.id, permissions: ["attendance.manage"] },
      headers: {
        "idempotency-key": randomUUID(),
      },
      body: {
        operationId: randomUUID(),
        command: {
          type: "lock",
          workDate: "2026-10-20",
          locked: true,
          reason: "Mismatch header test",
        },
      },
    };
    const res = mockRes();
    await postAttendanceCommand(req, res);
    assert.strictEqual(res.statusCode, 400);
  });
});
