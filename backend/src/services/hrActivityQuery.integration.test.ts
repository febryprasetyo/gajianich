import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import path from "node:path";
import { createHrAuditTestDatabase } from "../testing/hrAuditDatabase";
import { runMigrations } from "../db/migrate";
import { hrAuditEvents, hrAuditTargets } from "../db/schema/hrAudit";
import { users, roles } from "../db/schema/users";
import { parseHrActivityQuery } from "../domain/hrActivityQuery";
import {
  listHrActivities,
  getHrActivity,
  listHrActivityTargets,
  listHrActivityActors,
} from "./hrActivityQuery";

const migrations = path.resolve(__dirname, "../../drizzle");

test("HR Activity Query & Read API Integration Tests", async (t) => {
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

  const adminDb = drizzle(owner);
  const testDb = drizzle(runtime);
  const scope = {module:"hr" as const,groupIds:[],includeUnmapped:true,selectedGroupId:null};

  // Seed sample actors and audit events
  const [user1] = await adminDb
    .insert(users)
    .values({
      username: "hr_admin_1",
      email: "hr1@example.com",
      passwordHash: "hash",
    })
    .returning();

  const [user2] = await adminDb
    .insert(users)
    .values({
      username: "hr_admin_2",
      email: "hr2@example.com",
      passwordHash: "hash",
    })
    .returning();

  // Create events across dates (UTC)
  // Date 1: 2026-10-10 10:00:00 UTC
  const [event1] = await adminDb
    .insert(hrAuditEvents)
    .values({
      operationId: randomUUID(),
      occurredAt: new Date("2026-10-10T10:00:00.000Z"),
      actorId: BigInt(user1.id),
      actorUsername: "hr_admin_1",
      actorName: "HR Administrator One",
      action: "LOCK",
      entityType: "attendance_lock",
      entityId: "2026-10-10",
      entityLabel: "Lock 2026-10-10",
      outcome: "SUCCESS",
      summary: "Mengunci tanggal absensi 2026-10-10",
    })
    .returning();

  // Date 2: 2026-10-11 18:00:00 UTC (Which is 2026-10-12 01:00:00 WIB)
  const [event2] = await adminDb
    .insert(hrAuditEvents)
    .values({
      operationId: randomUUID(),
      occurredAt: new Date("2026-10-11T18:00:00.000Z"),
      actorId: BigInt(user1.id),
      actorUsername: "hr_admin_1",
      actorName: "HR Administrator One",
      action: "UPDATE",
      entityType: "attendance_record",
      entityId: "101",
      entityLabel: "Koreksi EMP_001 (100% Valid)",
      outcome: "SUCCESS",
      summary: "Koreksi jam masuk karyawan EMP_001",
    })
    .returning();

  // Date 3: 2026-10-12 03:00:00 UTC (Which is 2026-10-12 10:00:00 WIB)
  const [event3] = await adminDb
    .insert(hrAuditEvents)
    .values({
      operationId: randomUUID(),
      occurredAt: new Date("2026-10-12T03:00:00.000Z"),
      actorId: BigInt(user2.id),
      actorUsername: "hr_admin_2",
      actorName: "HR Officer Two",
      action: "IMPORT",
      entityType: "attendance_batch",
      entityId: "201",
      entityLabel: "Import Batch #201",
      outcome: "SUCCESS",
      summary: "Impor absensi harian",
    })
    .returning();

  // Seed targets for event3
  const targetsData = [];
  for (let i = 1; i <= 60; i++) {
    targetsData.push({
      eventId: event3.id,
      entityType: "attendance_row",
      entityId: `ROW_${i}`,
      entityLabel: `Baris ${i} - Karyawan EMP_${i}`,
      changedFields: ["attendance_status"],
    });
  }
  await adminDb.insert(hrAuditTargets).values(targetsData);

  await t.test("listHrActivities filters by WIB date range correctly", async () => {
    // 2026-10-12 WIB covers 2026-10-11T17:00:00Z to 2026-10-12T17:00:00Z
    // This should capture event2 and event3, but NOT event1 (which is 2026-10-10)
    const query = parseHrActivityQuery({
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    });

    const result = await listHrActivities(query, testDb,scope);
    assert.strictEqual(result.items.length, 2);
    const ids = result.items.map((i) => i.id);
    assert.ok(ids.includes(String(event2.id)));
    assert.ok(ids.includes(String(event3.id)));
    assert.ok(!ids.includes(String(event1.id)));
  });

  await t.test("listHrActivities searches literal % and _ without regex or wildcard distortion", async () => {
    const query = parseHrActivityQuery({
      startDate: "2026-10-01",
      endDate: "2026-10-15",
      q: "100%", // should match event2 literal '100% Valid'
    });

    const result = await listHrActivities(query, testDb,scope);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].id, String(event2.id));
  });

  await t.test("listHrActivities supports cursor keyset pagination", async () => {
    const queryPage1 = parseHrActivityQuery({
      startDate: "2026-10-01",
      endDate: "2026-10-15",
      limit: 2,
    });

    const page1 = await listHrActivities(queryPage1, testDb,scope);
    assert.strictEqual(page1.items.length, 2);
    assert.ok(page1.nextCursor);

    // Page 2 using cursor
    const queryPage2 = parseHrActivityQuery({
      startDate: "2026-10-01",
      endDate: "2026-10-15",
      limit: 2,
      cursor: page1.nextCursor,
    });

    const page2 = await listHrActivities(queryPage2, testDb,scope);
    assert.strictEqual(page2.items.length, 1);
    assert.strictEqual(page2.nextCursor, null);
    assert.strictEqual(page2.items[0].id, String(event1.id));
  });

  await t.test("getHrActivity returns detail with first 50 targets and nextTargetCursor", async () => {
    const detail = await getHrActivity(String(event3.id), testDb,scope);
    assert.ok(detail);
    assert.strictEqual(detail.event.id, String(event3.id));
    assert.strictEqual(detail.targets.length, 50);
    assert.ok(detail.nextTargetCursor);

    // Fetch next targets page
    const nextTargets = await listHrActivityTargets(String(event3.id), detail.nextTargetCursor, 50, testDb,scope);
    assert.strictEqual(nextTargets.targets.length, 10);
    assert.strictEqual(nextTargets.nextCursor, null);
  });

  await t.test("listHrActivityActors returns distinct list of all actors", async () => {
    const actors = await listHrActivityActors(undefined, undefined, 25, testDb,scope);
    assert.strictEqual(actors.items.length, 2);
    const usernames = actors.items.map((a) => a.username);
    assert.ok(usernames.includes("hr_admin_1"));
    assert.ok(usernames.includes("hr_admin_2"));
  });
});
