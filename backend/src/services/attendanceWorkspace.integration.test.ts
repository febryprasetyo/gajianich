import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import path from "node:path";
import { createHrAuditTestDatabase } from "../testing/hrAuditDatabase";
import { runMigrations } from "../db/migrate";
import { hrAuditEvents, hrAuditTargets } from "../db/schema/hrAudit";
import { users, roles } from "../db/schema/users";
import { departments } from "../db/schema/master";
import { employees } from "../db/schema/employees";
import {
  attendanceSources,
  attendanceShifts,
  attendanceShiftAssignments,
  attendanceLocks,
  attendanceGrants,
  attendanceIdentities,
} from "../db/schema/attendanceWorkspace";
import { attendanceBatches, attendanceRecords } from "../db/schema/attendance";
import {
  loadAttendanceWorkspace,
  executeAttendanceCommand,
} from "./attendanceWorkspace";
import { repairOfficeShiftConfiguration } from "../scripts/repairOfficeShiftConfiguration";
import type { AuditContext } from "../domain/hrAudit";
import type { ServerAttendanceCommand } from "../domain/attendanceCommands";

const migrations = path.resolve(__dirname, "../../drizzle");

test("Attendance Workspace & Commands Integration Tests", async (t) => {
  const fixture = await createHrAuditTestDatabase();
  t.after(async () => {
    await fixture.cleanup();
  });
  const { owner, runtime, runtimeRole, ownerUrl } = fixture;

  await runMigrations(ownerUrl, migrations, runtimeRole);

  // Grant runtime role permissions for test tables
  await owner.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO "${runtimeRole}"`);
  await owner.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${runtimeRole}"`);
  await owner.query(`REVOKE UPDATE, DELETE, TRUNCATE ON hr_audit_events, hr_audit_targets, hr_mutation_receipts FROM "${runtimeRole}"`);

  const adminDb = drizzle(owner);
  const db = drizzle(runtime);

  const [role] = await adminDb
    .insert(roles)
    .values({
      name: "HR Admin",
      code: "hr_admin",
      isSystem: true,
    })
    .returning();

  const [user] = await adminDb
    .insert(users)
    .values({
      username: "hradmin_ws",
      email: "hradmin_ws@company.local",
      passwordHash: "dummy",
      roleId: role.id,
    })
    .returning();

  const [dept] = await adminDb
    .insert(departments)
    .values({
      name: "Engineering",
      code: "ENG",
    })
    .returning();

  const [emp] = await adminDb
    .insert(employees)
    .values({
      employeeCode: "EMP-WS-01",
      fullName: "Alice Engineer",
      email: "alice@company.local",
      departmentId: dept.id,
      status: "Active",
    })
    .returning();

  const context: AuditContext = {
    actor: {
      id: String(user.id),
      username: user.username,
      name: "Alice HR Admin",
    },
    operationId: randomUUID(),
  };

  await t.test("empty database returns empty collections without dummy/mock rows", async () => {
    const ws = await db.transaction(async (tx) => {
      return await loadAttendanceWorkspace(tx, context);
    });

    assert.equal(ws.schemaVersion, 1);
    assert.equal(ws.records.length, 0);
    assert.equal(ws.batches.length, 0);
    assert.equal(ws.locks.length, 0);
    assert.equal(ws.shifts.length, 0);
    assert.equal(ws.shiftAssignments.length, 0);
    assert.equal(ws.identities.length, 0);
    assert.equal(ws.sources.length, 0);
    assert.equal(ws.audit.length, 0);
    assert.equal(ws.employees.length, 1);
    assert.equal(ws.departments.length, 1);
  });

  await t.test("round-trip source, shift, assignment, identity, lock, grant commands and audit capture", async () => {
    // 1. Source
    const resSource = await db.transaction(async (tx) => {
      return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
        type: "source",
        action: "create",
        source: { id: 0, code: "FINGER_01", name: "Mesin Fingerprint Utama", isActive: true },
      });
    });
    assert.ok(resSource.eventId);
    assert.equal(resSource.data.sources.length, 1);
    const sourceId = resSource.data.sources[0].id;

    // 2. Identity
    const resId = await db.transaction(async (tx) => {
      return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
        type: "identity",
        value: { id: 0, sourceId, externalNoId: "1001", employeeId: emp.id },
      });
    });
    assert.ok(resId.eventId);
    assert.equal(resId.data.identities.length, 1);

    // 3. Shift
    const resShift = await db.transaction(async (tx) => {
      return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
        type: "shift",
        action: "create",
        shift: {
          id: 0,
          code: "OFFICE_REG",
          name: "Office Reguler",
          scheduleIn: "08:30",
          scheduleOut: "17:30",
          workDays: 5,
          isDefault: true,
          isActive: true,
        },
      });
    });
    assert.ok(resShift.eventId);
    const shiftId = resShift.data.shifts[0].id;

    // 4. Shift Assignment
    const resAssign = await db.transaction(async (tx) => {
      return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
        type: "assign_shift",
        assignment: { id: 0, shiftId, employeeId: emp.id },
      });
    });
    assert.ok(resAssign.eventId);
    assert.equal(resAssign.data.shiftAssignments.length, 1);

    // 5. Lock
    const resLock = await db.transaction(async (tx) => {
      return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
        type: "lock",
        workDate: "2026-10-15",
        locked: true,
        reason: "Tutup periode payroll",
      });
    });
    assert.ok(resLock.eventId);
    assert.equal(resLock.data.locks.length, 1);

    // 6. Grant
    const resGrant = await db.transaction(async (tx) => {
      return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
        type: "grant",
        value: { id: 0, principalKey: "group:hr_payroll", displayName: "HR Payroll Group", role: "HR_ADMIN", isActive: true },
        action: "save",
      });
    });
    assert.ok(resGrant.eventId);
    assert.equal(resGrant.data.grants.length, 1);
  });

  await t.test("lock prevents record correction on locked date", async () => {
    // Insert an attendance record on locked date 2026-10-15 directly
    const [rec] = await adminDb
      .insert(attendanceRecords)
      .values({
        employeeId: emp.id,
        workDate: "2026-10-15",
        scanIn: "08:30",
        scanOut: "17:30",
        attendanceStatus: "PRESENT",
        revision: 1,
      })
      .returning();

    await assert.rejects(
      async () => {
        await db.transaction(async (tx) => {
          return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
            type: "correct",
            recordId: rec.id,
            expectedRevision: 1,
            values: { scanIn: "08:45", scanOut: "17:30", lateMinutes: 15, overtimeMinutes: 0, attendanceStatus: "PRESENT" },
            reason: "Koreksi jam masuk",
          });
        });
      },
      /dikunci/i
    );
  });

  await t.test("record correction succeeds when date is unlocked and tracks revision and audit", async () => {
    // Unlock date
    await db.transaction(async (tx) => {
      return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
        type: "lock",
        workDate: "2026-10-15",
        locked: false,
        reason: "Buka kunci untuk koreksi",
      });
    });

    const [rec] = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.employeeId, emp.id));

    // Stale revision test (expectedRevision: 99 -> error)
    await assert.rejects(
      async () => {
        await db.transaction(async (tx) => {
          return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
            type: "correct",
            recordId: rec.id,
            expectedRevision: 99,
            values: { scanIn: "08:45", scanOut: "17:30", lateMinutes: 15, overtimeMinutes: 0, attendanceStatus: "PRESENT" },
            reason: "Koreksi jam masuk",
          });
        });
      },
      /Data sudah berubah/i
    );

    // Valid revision
    const resCorrect = await db.transaction(async (tx) => {
      return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
        type: "correct",
        recordId: rec.id,
        expectedRevision: rec.revision,
        values: { scanIn: "08:45", scanOut: "17:30", lateMinutes: 15, overtimeMinutes: 0, attendanceStatus: "PRESENT" },
        reason: "Koreksi jam masuk terlambat",
      });
    });

    assert.ok(resCorrect.eventId);
    const updatedRec = resCorrect.data.records.find((r) => r.id === rec.id);
    assert.equal(updatedRec?.lateMinutes, 15);
    assert.equal(updatedRec?.revision, rec.revision + 1);

    // Verify revision record exists
    assert.equal(resCorrect.data.revisions.length, 1);
    assert.equal(resCorrect.data.revisions[0].recordId, rec.id);
  });

  await t.test("Dinas Luar persists shift scans on days off and clears penalties on correction and overwrite", async () => {
    const execute = (command: ServerAttendanceCommand) => db.transaction(tx =>
      executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, command));
    const shift = await adminDb.select().from(attendanceShifts);
    const created = await execute({ type: "record_attendance", employeeId: emp.id, workDate: "2026-10-18", attendanceStatus: "DINAS_LUAR", shiftId: shift[0].id, isDayOff: true, scanIn: "11:00", scanOut: "12:00" });
    const record = created.data.records.find(r => r.workDate === "2026-10-18")!;
    assert.equal(record.scanIn, "08:30");
    assert.equal(record.scanOut, "17:30");
    assert.equal(record.scheduleIn, "08:30");
    assert.equal(record.isDayOff, false);
    assert.equal(record.rawScanIn, null);
    assert.equal(record.rawScanOut, null);
    assert.equal(record.lateMinutes, 0);
    assert.ok(created.eventId);

    const [existing] = await adminDb.insert(attendanceRecords).values({ employeeId: emp.id, workDate: "2026-10-19", attendanceStatus: "PRESENT", scanIn: "09:00", scanOut: "16:00", rawScanIn: "09:00", rawScanOut: "16:00", lateMinutes: 30, earlyMinutes: 90, overtimeMinutes: 60, revision: 1 }).returning();
    const corrected = await execute({ type: "correct", recordId: existing.id, expectedRevision: 1, reason: "Kunjungan klien", values: { attendanceStatus: "DINAS_LUAR", isDayOff: true, scanIn: null, scanOut: null, lateMinutes: 99, overtimeMinutes: 99 } });
    const result = corrected.data.records.find(r => r.id === existing.id)!;
    assert.equal(result.scanIn, "08:30");
    assert.equal(result.scanOut, "17:30");
    assert.equal(result.rawScanIn, "09:00");
    assert.equal(result.rawScanOut, "16:00");
    assert.equal(result.isDayOff, false);
    assert.equal(result.lateMinutes, 0);
    assert.equal(result.earlyMinutes, 0);
    assert.equal(result.overtimeMinutes, 0);
    assert.equal(result.revision, 2);
    assert.ok(corrected.data.revisions.some(r => r.recordId === existing.id));

    await adminDb.update(attendanceRecords).set({ lateMinutes: 10, earlyMinutes: 20, overtimeMinutes: 30 }).where(eq(attendanceRecords.id, existing.id));
    const overwritten = await execute({ type: "record_attendance", employeeId: emp.id, workDate: "2026-10-19", attendanceStatus: "DINAS_LUAR" });
    const saved = overwritten.data.records.find(r => r.id === existing.id)!;
    assert.equal(saved.rawScanIn, "09:00");
    assert.equal(saved.lateMinutes, 0);
    assert.equal(saved.earlyMinutes, 0);
    assert.equal(saved.overtimeMinutes, 0);
    assert.equal(saved.revision, 3);

    await assert.rejects(() => execute({ type: "correct", recordId: existing.id, expectedRevision: 1, reason: "Stale", values: { attendanceStatus: "DINAS_LUAR", scanIn: null, scanOut: null, lateMinutes: 0, overtimeMinutes: 0 } }), /Data sudah berubah/);
    await execute({ type: "lock", workDate: "2026-10-19", locked: true, reason: "Payroll" });
    await assert.rejects(() => execute({ type: "record_attendance", employeeId: emp.id, workDate: "2026-10-19", attendanceStatus: "DINAS_LUAR" }), /dikunci/);
  });

  await t.test("import draft, review row, stale batch revision, commit, and delete draft without losing audit", async () => {
    // 1. Import draft
    const resImport = await db.transaction(async (tx) => {
      return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
        type: "import",
        filename: "fingerprint_oct.xlsx",
        rows: [
          {
            id: 0,
            externalNoId: "1001",
            employeeId: emp.id,
            workDate: "2026-10-16",
            scanIn: "08:32",
            scanOut: "17:35",
            lateMinutes: 2,
            earlyMinutes: 0,
            overtimeMinutes: 5,
            reviewStatus: "READY",
            note: "Tervalidasi",
            attendanceStatus: "PRESENT",
          },
        ],
      });
    });

    assert.ok(resImport.eventId);
    const batch = resImport.data.batches[0];
    assert.equal(batch.status, "DRAFT");
    assert.equal(batch.revision, 1);
    assert.equal(batch.rows.length, 1);
    const rowId = batch.rows[0].id;

    // 2. Review row with stale expectedBatchRevision (expected 99 -> error)
    await assert.rejects(
      async () => {
        await db.transaction(async (tx) => {
          return await executeAttendanceCommand(
            tx,
            { ...context, operationId: randomUUID() },
            {
              type: "review",
              batchId: batch.id,
              rowId,
              employeeId: emp.id,
              skipped: false,
              reason: "Verifikasi review",
              values: { scanIn: "08:30" },
            },
            99
          );
        });
      },
      /Data batch sudah berubah/i
    );

    // 3. Review row with correct expectedBatchRevision
    const resReview = await db.transaction(async (tx) => {
      return await executeAttendanceCommand(
        tx,
        { ...context, operationId: randomUUID() },
        {
          type: "review",
          batchId: batch.id,
          rowId,
          employeeId: emp.id,
          skipped: false,
          reason: "Verifikasi review sukses",
          values: { scanIn: "08:30" },
        },
        batch.revision
      );
    });

    assert.ok(resReview.eventId);
    const reviewedBatch = resReview.data.batches.find((b) => b.id === batch.id);
    assert.equal(reviewedBatch?.revision, 2);

    // 4. Commit batch
    const resCommit = await db.transaction(async (tx) => {
      return await executeAttendanceCommand(
        tx,
        { ...context, operationId: randomUUID() },
        {
          type: "batch",
          batchId: batch.id,
          action: "commit",
        },
        reviewedBatch?.revision
      );
    });

    assert.ok(resCommit.eventId);
    const committedBatch = resCommit.data.batches.find((b) => b.id === batch.id);
    assert.equal(committedBatch?.status, "COMMITTED");

    // 5. Verify record 2026-10-16 created in attendanceRecords
    const commRec = resCommit.data.records.find((r) => r.workDate === "2026-10-16");
    assert.ok(commRec);
    assert.equal(commRec.employeeId, emp.id);

    // 6. Delete draft: create a 2nd draft then delete it
    const resDraft2 = await db.transaction(async (tx) => {
      return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
        type: "import",
        filename: "draft_to_delete.xlsx",
        rows: [],
      });
    });
    const draft2Id = resDraft2.data.batches.find((b) => b.filename === "draft_to_delete.xlsx")!.id;

    const resDelDraft = await db.transaction(async (tx) => {
      return await executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, {
        type: "batch",
        batchId: draft2Id,
        action: "delete",
      });
    });
    assert.ok(resDelDraft.eventId);

    // Verify all past audit events are still immutable and present in hr_audit_events
    const allAuditEvents = await adminDb.select().from(hrAuditEvents);
    assert.ok(allAuditEvents.length >= 8, "All HR audit events must persist after draft deletion");
  });
  await t.test("import resolves master ID and source identity without client employeeId; commit is atomic", async () => {
    const execute = (command: ServerAttendanceCommand) => db.transaction(tx =>
      executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, command));
    const row = { id: 0, externalNoId: emp.employeeCode, employeeId: null, workDate: "2026-11-01", scanIn: "08:30", scanOut: "17:30", lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0, reviewStatus: "READY" as const, note: "" };
    const imported = await execute({ type: "import", filename: "server-mapping.xls", rows: [row, { ...row, externalNoId: "1001", workDate: "2026-11-02" }, { ...row, externalNoId: "UNKNOWN", employeeId: emp.id, workDate: "2026-11-03" }] });
    const batch = imported.data.batches.find(b => b.filename === "server-mapping.xls")!;
    assert.equal(batch.rows[0].employeeId, emp.id);
    assert.equal(batch.rows[1].employeeId, emp.id);
    assert.equal(batch.rows[2].employeeId, null);
    assert.equal(batch.rows[2].reviewStatus, "BLOCKED");
    await assert.rejects(() => execute({ type: "batch", batchId: batch.id, action: "commit" }), /pemetaan|karyawan|review/i);
    const workspace = await db.transaction(tx => loadAttendanceWorkspace(tx, context));
    assert.equal(workspace.batches.find(b => b.id === batch.id)?.status, "DRAFT");
    assert.equal(workspace.records.filter(r => r.sourceBatchId === batch.id).length, 0);
    await execute({ type: "review", batchId: batch.id, rowId: batch.rows[2].id, skipped: true, reason: "Unknown employee" });
    const committed = await execute({ type: "batch", batchId: batch.id, action: "commit" });
    assert.equal(committed.data.records.filter(r => r.sourceBatchId === batch.id).length, 2);
    await assert.rejects(() => execute({ type: "batch", batchId: batch.id, action: "commit" }), /draft|DRAFT/i);
  });

  await t.test("HR can review and commit a corrected import with historical parser issues", async () => {
    const execute = (command: ServerAttendanceCommand) => db.transaction(tx =>
      executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, command));
    const imported = await execute({ type: "import", filename: "corrected-validation.xls", rows: [{ id: 0, externalNoId: emp.employeeCode, employeeId: null, workDate: "2026-11-04", scanIn: "08:30", scanOut: "17:30", lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0, reviewStatus: "READY", note: "", issues: ["Scan belum lengkap"] }] });
    const batch = imported.data.batches.find(b => b.filename === "corrected-validation.xls")!;
    assert.equal(batch.rows[0].reviewStatus, "BLOCKED");
    await assert.rejects(() => execute({ type: "batch", batchId: batch.id, action: "commit" }), /review/i);
    await execute({ type: "review", batchId: batch.id, rowId: batch.rows[0].id, employeeId: emp.id, skipped: false, values: { scanIn: "08:30", scanOut: "17:30" }, reason: "Jam diverifikasi dari sumber" });
    const committed = await execute({ type: "batch", batchId: batch.id, action: "commit" });
    assert.equal(committed.data.records.filter(r => r.sourceBatchId === batch.id).length, 1);
  });

  await t.test("import and manual attendance persist department schedules with Saturday hours and employee overrides", async () => {
    const execute = (command: ServerAttendanceCommand) => db.transaction(tx => executeAttendanceCommand(tx, { ...context, operationId: randomUUID() }, command));
    const created = await execute({ type: "shift", action: "create", shift: { id: 0, code: "PROD_TEST", name: "Produksi Test", scheduleIn: "08:00", scheduleOut: "16:00", workDays: 6, saturdayScheduleIn: "08:00", saturdayScheduleOut: "14:00", isDefault: false, isActive: true } });
    const prod = created.data.shifts.find(s => s.code === "PROD_TEST")!;
    await execute({ type: "assign_shift", assignment: { id: 0, shiftId: prod.id, departmentId: dept.id } });
    const [worker] = await adminDb.insert(employees).values({ employeeCode: "SHIFT-WORKER", fullName: "Shift Worker", departmentId: dept.id }).returning();
    const imported = await execute({ type: "import", filename: "shift-saturday.xls", rows: [{ id: 0, externalNoId: worker.employeeCode, employeeId: null, workDate: "2026-11-07", scanIn: "07:55", scanOut: "14:05", lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 5, reviewStatus: "READY", note: "" }] });
    const batch = imported.data.batches.find(b => b.filename === "shift-saturday.xls")!;
    const committed = await execute({ type: "batch", batchId: batch.id, action: "commit" });
    const record = committed.data.records.find(r => r.sourceBatchId === batch.id)!;
    assert.equal(record.shift, prod.name);
    assert.equal(record.scheduleIn, "08:00");
    assert.equal(record.scheduleOut, "14:00");
    assert.equal(record.scanIn, "07:55");
    assert.equal(record.scanOut, "14:05");
    assert.equal(record.overtimeMinutes, 5);
    const manual = await execute({ type: "record_attendance", employeeId: worker.id, workDate: "2026-11-09", attendanceStatus: "PRESENT", scanIn: "07:50", scanOut: "16:05" });
    const saved = manual.data.records.find(r => r.employeeId === worker.id && r.workDate === "2026-11-09")!;
    assert.equal(saved.shift, prod.name);
    assert.equal(saved.scheduleOut, "16:00");
    assert.equal(saved.scanIn, "07:50");
    const override = await execute({ type: "record_attendance", employeeId: emp.id, workDate: "2026-11-09", attendanceStatus: "PRESENT", scanIn: "08:30", scanOut: "17:30" });
    assert.equal(override.data.records.find(r => r.employeeId === emp.id && r.workDate === "2026-11-09")?.shift, "Office Reguler");
    await assert.rejects(() => execute({ type: "assign_shift", assignment: { id: 0, shiftId: 999999, departmentId: dept.id } }), /shift.*aktif|shift.*ditemukan/i);
  });

  await t.test("Office recovery persists department assignments, fills only missing schedules and is idempotent", async () => {
    const [worker] = await adminDb.select().from(employees).where(eq(employees.employeeCode, "SHIFT-WORKER"));
    const [missing] = await adminDb.insert(attendanceRecords).values({ employeeId: worker.id, workDate: "2026-12-01", scanIn: "08:03", scanOut: "17:04", lateMinutes: 3, overtimeMinutes: 4, attendanceStatus: "PRESENT" }).returning();
    const [historical] = await adminDb.insert(attendanceRecords).values({ employeeId: worker.id, workDate: "2026-12-02", shift: "Historical schedule", scheduleIn: "09:00", scheduleOut: "18:00", scanIn: "09:00", scanOut: "18:00" }).returning();
    const [locked] = await adminDb.insert(attendanceRecords).values({ employeeId: worker.id, workDate: "2026-12-03", scanIn: "08:00", scanOut: "17:00" }).returning();
    await adminDb.insert(attendanceLocks).values({ workDate: locked.workDate, reason: "Locked test", actorId: user.id });
    const preview = await db.transaction(tx => repairOfficeShiftConfiguration(tx, { ...context, operationId: randomUUID() }, false));
    assert.ok(preview.scheduleChanges > 0);
    const [unchanged] = await adminDb.select().from(attendanceRecords).where(eq(attendanceRecords.id, missing.id));
    assert.equal(unchanged.shift, null);
    const applied = await db.transaction(tx => repairOfficeShiftConfiguration(tx, { ...context, operationId: randomUUID() }, true));
    assert.ok(applied.scheduleChanges > 0);
    const [saved] = await adminDb.select().from(attendanceRecords).where(eq(attendanceRecords.id, missing.id));
    assert.equal(saved.shift, "Office Reguler (Default)");
    assert.equal(saved.scheduleIn, "08:00");
    assert.equal(saved.scheduleOut, "17:00");
    assert.equal(saved.scanIn, missing.scanIn);
    assert.equal(saved.scanOut, missing.scanOut);
    assert.equal(saved.lateMinutes, 3);
    assert.equal(saved.overtimeMinutes, 4);
    const [old] = await adminDb.select().from(attendanceRecords).where(eq(attendanceRecords.id, historical.id));
    assert.deepEqual(old, historical);
    const [stillLocked] = await adminDb.select().from(attendanceRecords).where(eq(attendanceRecords.id, locked.id));
    assert.deepEqual(stillLocked, locked);
    const again = await db.transaction(tx => repairOfficeShiftConfiguration(tx, { ...context, operationId: randomUUID() }, false));
    assert.equal(again.scheduleChanges, 0);
    assert.equal(again.departmentChanges, 0);
    const ws = await db.transaction(tx => loadAttendanceWorkspace(tx, context));
    assert.ok(ws.shifts.some(s => s.code === "OFFICE"));
    assert.equal(ws.shiftAssignments.find(a => a.departmentId === dept.id)?.shiftId, ws.shifts.find(s => s.code === "OFFICE")!.id);
  });

});
