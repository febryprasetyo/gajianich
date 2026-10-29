import type {RequestScope} from '../domain/organizationAccess';
import {employeeScopePredicate,historicalScopePredicate,requireHrScope,requireScopedEmployee,requireScopedDepartment} from './hrOrganizationScope';
import {departmentOrganizationMappings,locationOrganizationMappings} from '../db/schema/organizations';
import {loadCurrentIdentity} from './currentIdentity';
import { eq, and, sql, asc, inArray } from "drizzle-orm";
import { db } from "../db";
import { approvedAttendanceRecords } from "./approvedAttendanceRecords";
import { employees } from "../db/schema/employees";
import { departments, locations } from "../db/schema/master";
import { systemSettings } from "../db/schema/system";
import {
  attendanceBatches,
  attendanceRecords,
} from "../db/schema/attendance";
import {
  attendanceSources,
  attendanceIdentities,
  attendanceShifts,
  attendanceShiftAssignments,
  attendanceLocks,
  attendanceGrants,
  attendanceImportRows,
  attendanceRevisions,
} from "../db/schema/attendanceWorkspace";
import { appendHrAudit, type AuditTx } from "./hrAudit";
import { sanitizeAuditTarget, type AuditContext } from "../domain/hrAudit";
import type {
  AttendanceDataset,
  WorkShift,
  ShiftAssignment,
  MasterItem,
  EmployeeSummary,
  Identity,
  AttendanceRecord,
  ImportBatch,
  ImportRow,
  AttendanceRevision,
  AttendanceGrant,
  AttendanceLock,
} from "../domain/attendanceTypes";
import type { ServerAttendanceCommand } from "../domain/attendanceCommands";
import { getAttendanceSchedule } from "../domain/attendanceSchedule";

import { resolveImportEmployee } from "../domain/attendanceImportMapping";

async function employeeScheduleValues(tx: AuditTx, employeeId: number, workDate: string, shiftId?: number) {
  const [employee] = await tx.select().from(employees).where(eq(employees.id, employeeId));
  if (!employee) throw new ValidationError("Karyawan tidak ditemukan");
  const shifts = await tx.select().from(attendanceShifts);
  const assignments = await tx.select().from(attendanceShiftAssignments);
  return getAttendanceSchedule(employee, workDate, shifts as WorkShift[], assignments, shiftId);
}

async function fieldDutyValues(tx: AuditTx, employeeId: number, workDate: string, shiftId?: number) {
  const schedule = await employeeScheduleValues(tx, employeeId, workDate, shiftId);
  return {
    ...schedule,
    scanIn: schedule.scheduleIn,
    scanOut: schedule.scheduleOut,
    isDayOff: false,
    lateMinutes: 0,
    earlyMinutes: 0,
    overtimeMinutes: 0,
  };
}

export class ConflictError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
    this.statusCode = 409;
  }
}

export class ValidationError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

async function lockWorkDates(tx: any, dates: string[]): Promise<void> {
  const sorted = Array.from(new Set(dates)).sort();
  for (const date of sorted) {
    const lockKey = "att_date_" + date;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
  }
}

async function checkDateUnlocked(tx: any, date: string): Promise<void> {
  const [locked] = await tx
    .select()
    .from(attendanceLocks)
    .where(eq(attendanceLocks.workDate, date))
    .limit(1);
  if (locked) {
    throw new ValidationError(`Data tanggal ini (${date}) dikunci. Buka kunci sebelum mengubah data.`);
  }
}

export async function loadAttendanceWorkspace(
  tx: AuditTx,
  context: AuditContext,
  scope?: RequestScope
): Promise<AttendanceDataset> {
  scope = requireHrScope({organizationScope:scope});
  const [
    deptRows,
    locRows,
    sourceRows,
    empRows,
    idRows,
    recRows,
    batchRows,
    rowRows,
    revRows,
    grantRows,
    lockRows,
    shiftRows,
    assignRows,
    strictSetting,
  ] = await Promise.all([
    tx.select().from(departments).where(scope.includeUnmapped && !scope.groupIds.length ? sql`true` : sql`exists(select 1 from ${departmentOrganizationMappings} where ${departmentOrganizationMappings.departmentId} = ${departments.id} and ${scope.groupIds.length ? inArray(departmentOrganizationMappings.groupId,scope.groupIds) : sql`false`})`),
    tx.select().from(locations).where(scope.includeUnmapped && !scope.groupIds.length ? sql`true` : sql`exists(select 1 from ${locationOrganizationMappings} where ${locationOrganizationMappings.locationId} = ${locations.id} and ${scope.groupIds.length ? inArray(locationOrganizationMappings.groupId,scope.groupIds) : sql`false`})`),
    tx.select().from(attendanceSources),
    tx.select().from(employees).where(employeeScopePredicate(scope)),
    tx.select().from(attendanceIdentities).where(sql`${attendanceIdentities.employeeId} in (select ${employees.id} from ${employees} where ${employeeScopePredicate(scope)})`),
    tx.select().from(attendanceRecords).where(historicalScopePredicate(scope,attendanceRecords.groupId)).orderBy(asc(attendanceRecords.workDate)),
    tx.select().from(attendanceBatches).where(historicalScopePredicate(scope,attendanceBatches.groupId)),
    tx.select().from(attendanceImportRows).where(sql`${attendanceImportRows.batchId} in (select ${attendanceBatches.id} from ${attendanceBatches} where ${historicalScopePredicate(scope,attendanceBatches.groupId)})`),
    tx.select().from(attendanceRevisions).where(sql`${attendanceRevisions.recordId} in (select ${attendanceRecords.id} from ${attendanceRecords} where ${historicalScopePredicate(scope,attendanceRecords.groupId)})`),
    tx.select().from(attendanceGrants),
    tx.select().from(attendanceLocks),
    tx.select().from(attendanceShifts),
    tx.select().from(attendanceShiftAssignments).where(scope.includeUnmapped && !scope.groupIds.length ? sql`true` : sql`(${attendanceShiftAssignments.employeeId} in (select ${employees.id} from ${employees} where ${employeeScopePredicate(scope)})) or (${attendanceShiftAssignments.departmentId} in (select ${departmentOrganizationMappings.departmentId} from ${departmentOrganizationMappings} where ${scope.groupIds.length ? inArray(departmentOrganizationMappings.groupId,scope.groupIds) : sql`false`}))`),
    tx.select().from(systemSettings).where(eq(systemSettings.key, "attendance_strict_integrity")).limit(1),
  ]);

  const rowsByBatch = new Map<number, ImportRow[]>();
  for (const r of rowRows) {
    const list = rowsByBatch.get(r.batchId) || [];
    list.push({
      id: r.id,
      externalNoId: r.externalNoId,
      employeeId: r.employeeId,
      workDate: r.workDate,
      scanIn: r.scanIn,
      scanOut: r.scanOut,
      lateMinutes: r.lateMinutes,
      earlyMinutes: r.earlyMinutes,
      overtimeMinutes: r.overtimeMinutes,
      reviewStatus: r.reviewStatus as any,
      note: r.note,
      attendanceStatus: r.attendanceStatus as any,
      rawScanIn: r.rawScanIn,
      rawScanOut: r.rawScanOut,
      normalized: r.normalized,
      issues: r.issues || undefined,
    });
    rowsByBatch.set(r.batchId, list);
  }

  const batches: ImportBatch[] = batchRows.map((b) => ({
    id: b.id,
    filename: b.filename,
    sourceId: b.sourceId,
    fileHash: b.fileHash,
    createdAt: b.createdAt.toISOString(),
    status: b.status as any,
    rows: rowsByBatch.get(b.id) || [],
    strictIntegrity: b.strictIntegrity,
    totalRows: b.totalRows,
    revision: b.revision,
  }));

  const today = new Date().toISOString().split("T")[0];
  const periodStart = today.slice(0, 7) + "-01";
  const strictIntegrity = strictSetting.length > 0 && String(strictSetting[0].value) === "true";

  return {
    schemaVersion: 1,
    meta: {
      defaultDate: today,
      periodStart,
      actor: context.actor.name,
      role: "HR_ADMIN",
      canManageAccess: true,
      strictIntegrity,
    },
    departments: deptRows.map((d) => ({ id: d.id, code: d.code, name: d.name, isActive: Boolean(d.isActive) })),
    locations: locRows.map((l) => ({ id: l.id, code: l.code, name: l.name, isActive: true })),
    sources: sourceRows.map((s) => ({ id: s.id, code: s.code, name: s.name, isActive: s.isActive })),
    employees: empRows.map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      email: e.email,
      departmentId: e.departmentId,
      locationId: e.locationId,
      position: e.position,
      isActive: e.status === "Active",
    })),
    identities: idRows.map((i) => ({
      id: i.id,
      sourceId: i.sourceId ?? 0,
      externalNoId: i.externalNoId,
      employeeId: i.employeeId,
    })),
    records: (await approvedAttendanceRecords(recRows, tx)).map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      workDate: r.workDate,
      shift: r.shift,
      scheduleIn: r.scheduleIn,
      scheduleOut: r.scheduleOut,
      scanIn: r.scanIn,
      scanOut: r.scanOut,
      rawScanIn: r.rawScanIn,
      rawScanOut: r.rawScanOut,
      lateMinutes: r.lateMinutes,
      earlyMinutes: r.earlyMinutes,
      overtimeMinutes: r.overtimeMinutes,
      attendanceStatus: r.attendanceStatus as any,
      isDayOff: r.isDayOff,
      normalized: r.normalized,
      revision: r.revision,
      sourceBatchId: r.sourceBatchId,
    })),
    batches,
    audit: [],
    revisions: revRows.map((rv) => ({
      id: rv.id,
      recordId: rv.recordId,
      reason: rv.reason,
      createdAt: rv.createdAt.toISOString(),
      actor: rv.actor,
      before: rv.before as any,
      after: rv.after as any,
    })),
    grants: grantRows.map((g) => ({
      id: g.id,
      principalKey: g.principalKey,
      displayName: g.displayName,
      role: g.role as any,
      isActive: g.isActive,
    })),
    locks: lockRows.map((l) => ({
      workDate: l.workDate,
      reason: l.reason,
      createdAt: l.createdAt.toISOString(),
    })),
    shifts: shiftRows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      scheduleIn: s.scheduleIn,
      scheduleOut: s.scheduleOut,
      workDays: s.workDays as any,
      saturdayScheduleIn: s.saturdayScheduleIn,
      saturdayScheduleOut: s.saturdayScheduleOut,
      description: s.description ?? undefined,
      isDefault: s.isDefault,
      isActive: s.isActive,
    })),
    shiftAssignments: assignRows.map((a) => ({
      id: a.id,
      shiftId: a.shiftId,
      departmentId: a.departmentId,
      employeeId: a.employeeId,
    })),
  };
}

export async function executeAttendanceCommand(
  tx: AuditTx,
  context: AuditContext,
  command: ServerAttendanceCommand,
  expectedBatchRevision?: number,
  scope?: RequestScope
): Promise<{ changed: boolean; eventId: string | null; data: AttendanceDataset }> {
  scope = requireHrScope({organizationScope:scope});
  if (scope.selectedGroupId === null) throw new ValidationError('Choose a destination group');
  const writableScope = {...scope,includeUnmapped:false};
  if (['source','shift','grant','delete_grant','lock','set_strict_integrity'].includes(command.type)) {
    if (!(await loadCurrentIdentity(Number(context.actor.id),tx))?.isGlobalAdministrator) throw Object.assign(new Error('Shared attendance definitions require global administrator'),{statusCode:403});
  }
  if ('batchId' in command) {
    const [batch] = await tx.select().from(attendanceBatches).where(and(eq(attendanceBatches.id,command.batchId),historicalScopePredicate(writableScope,attendanceBatches.groupId))).for('update');
    if (!batch) throw new ValidationError('Batch unavailable in destination group');
  }
  if (command.type === 'correct') {
    const [record] = await tx.select().from(attendanceRecords).where(and(eq(attendanceRecords.id,command.recordId),historicalScopePredicate(writableScope,attendanceRecords.groupId))).for('update');
    if (!record) throw new ValidationError('Record unavailable in destination group');
  }
  if (command.type === 'record_attendance' || (command.type === 'review' && command.employeeId)) await requireScopedEmployee(writableScope,command.employeeId!,tx);
  if (command.type === 'identity') await requireScopedEmployee(writableScope,command.value.employeeId,tx);
  if (command.type === 'delete_identity') {
    const [identity] = await tx.select().from(attendanceIdentities).where(eq(attendanceIdentities.id,command.id));
    if (!identity) throw new ValidationError('Identity unavailable');
    await requireScopedEmployee(writableScope,identity.employeeId,tx);
  }
  if (command.type === 'assign_shift') {
    if (command.assignment.employeeId) await requireScopedEmployee(writableScope,command.assignment.employeeId,tx);
    else await requireScopedDepartment(writableScope,command.assignment.departmentId,tx);
  }
  let eventId: string | null = null;

  switch (command.type) {
    case "lock": {
      await lockWorkDates(tx, [command.workDate]);
      if (command.locked) {
        const [existing] = await tx
          .select()
          .from(attendanceLocks)
          .where(eq(attendanceLocks.workDate, command.workDate));
        if (existing) {
          await tx
            .update(attendanceLocks)
            .set({ reason: command.reason, actorId: Number(context.actor.id) })
            .where(eq(attendanceLocks.workDate, command.workDate));
        } else {
          await tx
            .insert(attendanceLocks)
            .values({
              workDate: command.workDate,
              reason: command.reason,
              actorId: Number(context.actor.id),
            });
        }
        eventId = await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: "LOCK",
          entityType: "attendance_lock",
          entityId: command.workDate,
          entityLabel: command.workDate,
          outcome: "SUCCESS",
          summary: `Mengunci data absensi tanggal ${command.workDate}: ${command.reason}`,
        });
      } else {
        await tx
          .delete(attendanceLocks)
          .where(eq(attendanceLocks.workDate, command.workDate));
        eventId = await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: "UNLOCK",
          entityType: "attendance_lock",
          entityId: command.workDate,
          entityLabel: command.workDate,
          outcome: "SUCCESS",
          summary: `Membuka kunci data absensi tanggal ${command.workDate}: ${command.reason}`,
        });
      }
      break;
    }

    case "correct": {
      const [existing] = await tx
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.id, command.recordId));
      if (!existing) {
        throw new ValidationError("Catatan absensi tidak ditemukan");
      }

      await checkDateUnlocked(tx, existing.workDate);
      await lockWorkDates(tx, [existing.workDate]);

      // Row lock and revision check
      const [lockedRec] = await tx
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.id, command.recordId))
        .for('update');
      if (!lockedRec) throw new ValidationError("Catatan absensi tidak ditemukan");
      if (lockedRec.revision !== command.expectedRevision) {
        throw new ConflictError("Data sudah berubah. Muat ulang sebelum menyimpan.");
      }

      for (const n of [command.values.lateMinutes, command.values.overtimeMinutes]) {
        if (n !== undefined && (!Number.isSafeInteger(n) || n < 0)) {
          throw new ValidationError("Durasi harus berupa menit nonnegatif.");
        }
      }
      for (const time of [command.values.scanIn, command.values.scanOut]) {
        if (time !== undefined && time !== null && time.trim() !== "" && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time.trim())) {
          throw new ValidationError("Jam harus dalam format HH:mm.");
        }
      }

      const normalizeTime = (t?: string | null) => {
        if (!t || !t.trim()) return null;
        const clean = t.trim();
        return clean.length >= 5 ? clean.slice(0, 5) : clean;
      };

      const cleanScanIn = normalizeTime(command.values.scanIn);
      const cleanScanOut = normalizeTime(command.values.scanOut);

      const updatedValues: Partial<typeof attendanceRecords.$inferInsert> = {
        scanIn: cleanScanIn,
        scanOut: cleanScanOut,
        lateMinutes: command.values.lateMinutes,
        overtimeMinutes: command.values.overtimeMinutes,
        attendanceStatus: command.values.attendanceStatus,
        isDayOff: command.values.isDayOff ?? existing.isDayOff,
        revision: existing.revision + 1,
        updatedAt: new Date(),
      };

      if (command.values.attendanceStatus === "DINAS_LUAR") {
        Object.assign(updatedValues, await fieldDutyValues(tx, existing.employeeId, existing.workDate));
      } else if (command.values.attendanceStatus !== "PRESENT") {
        updatedValues.scanIn = null;
        updatedValues.scanOut = null;
        updatedValues.lateMinutes = 0;
        updatedValues.earlyMinutes = 0;
        updatedValues.overtimeMinutes = 0;
      }

      const [updated] = await tx
        .update(attendanceRecords)
        .set(updatedValues)
        .where(eq(attendanceRecords.id, command.recordId))
        .returning();

      await tx.insert(attendanceRevisions).values({
        recordId: command.recordId,
        reason: command.reason,
        actor: context.actor.name,
        before: existing as any,
        after: updated as any,
      });

      const target = sanitizeAuditTarget("attendance_record", existing, updated, {
        entityId: String(command.recordId),
        entityLabel: `Absensi Karyawan #${existing.employeeId} (${existing.workDate})`,
      });

      eventId = await appendHrAudit(tx, {
        operationId: context.operationId,
        actor: context.actor,
        action: "UPDATE",
        entityType: "attendance_record",
        entityId: String(command.recordId),
        entityLabel: `Absensi Karyawan #${existing.employeeId} (${existing.workDate})`,
        outcome: "SUCCESS",
        summary: `Koreksi absensi ${existing.workDate}: ${command.reason}`,
        targets: [target],
      });
      break;
    }

    case "source": {
      if (command.action === "create") {
        const [inserted] = await tx
          .insert(attendanceSources)
          .values({
            code: command.source.code,
            name: command.source.name,
            isActive: command.source.isActive,
          })
          .returning();
        eventId = await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: "CREATE",
          entityType: "attendance_source",
          entityId: String(inserted.id),
          entityLabel: inserted.name,
          outcome: "SUCCESS",
          summary: `Menambah sumber absensi: ${inserted.name}`,
        });
      } else if (command.action === "update") {
        const [updated] = await tx
          .update(attendanceSources)
          .set({
            code: command.source.code,
            name: command.source.name,
            isActive: command.source.isActive,
            updatedAt: new Date(),
          })
          .where(eq(attendanceSources.id, command.source.id))
          .returning();
        eventId = await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: "UPDATE",
          entityType: "attendance_source",
          entityId: String(updated.id),
          entityLabel: updated.name,
          outcome: "SUCCESS",
          summary: `Memperbarui sumber absensi: ${updated.name}`,
        });
      } else if (command.action === "delete") {
        await tx.delete(attendanceSources).where(eq(attendanceSources.id, command.source.id));
        eventId = await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: "DELETE",
          entityType: "attendance_source",
          entityId: String(command.source.id),
          entityLabel: command.source.name,
          outcome: "SUCCESS",
          summary: `Menghapus sumber absensi: ${command.source.name}`,
        });
      }
      break;
    }

    case "identity": {
      const [existing] = await tx
        .select()
        .from(attendanceIdentities)
        .where(
          and(
            eq(attendanceIdentities.sourceId, command.value.sourceId),
            eq(attendanceIdentities.externalNoId, command.value.externalNoId)
          )
        );

      let targetId: number;
      if (existing) {
        const [updated] = await tx
          .update(attendanceIdentities)
          .set({ employeeId: command.value.employeeId, updatedAt: new Date() })
          .where(eq(attendanceIdentities.id, existing.id))
          .returning();
        targetId = updated.id;
      } else {
        const [inserted] = await tx
          .insert(attendanceIdentities)
          .values({
            sourceId: command.value.sourceId,
            externalNoId: command.value.externalNoId,
            employeeId: command.value.employeeId,
          })
          .returning();
        targetId = inserted.id;
      }

      eventId = await appendHrAudit(tx, {
        operationId: context.operationId,
        actor: context.actor,
        action: "LINK",
        entityType: "attendance_identity",
        entityId: String(targetId),
        entityLabel: `Mapping ID ${command.value.externalNoId} -> Karyawan #${command.value.employeeId}`,
        outcome: "SUCCESS",
        summary: `Menghubungkan ID mesin ${command.value.externalNoId} ke karyawan #${command.value.employeeId}`,
      });
      break;
    }

    case "delete_identity": {
      await tx.delete(attendanceIdentities).where(eq(attendanceIdentities.id, command.id));
      eventId = await appendHrAudit(tx, {
        operationId: context.operationId,
        actor: context.actor,
        action: "UNLINK",
        entityType: "attendance_identity",
        entityId: String(command.id),
        entityLabel: `Identity #${command.id}`,
        outcome: "SUCCESS",
        summary: `Menghapus mapping identitas absensi #${command.id}`,
      });
      break;
    }

    case "shift": {
      if (command.action === "create") {
        const [inserted] = await tx
          .insert(attendanceShifts)
          .values({
            code: command.shift.code,
            name: command.shift.name,
            scheduleIn: command.shift.scheduleIn,
            scheduleOut: command.shift.scheduleOut,
            workDays: command.shift.workDays,
            saturdayScheduleIn: command.shift.saturdayScheduleIn,
            saturdayScheduleOut: command.shift.saturdayScheduleOut,
            description: command.shift.description,
            isDefault: command.shift.isDefault,
            isActive: command.shift.isActive,
          })
          .returning();
        eventId = await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: "CREATE",
          entityType: "attendance_shift",
          entityId: String(inserted.id),
          entityLabel: inserted.name,
          outcome: "SUCCESS",
          summary: `Menambah jadwal shift: ${inserted.name}`,
        });
      } else if (command.action === "update") {
        const [updated] = await tx
          .update(attendanceShifts)
          .set({
            code: command.shift.code,
            name: command.shift.name,
            scheduleIn: command.shift.scheduleIn,
            scheduleOut: command.shift.scheduleOut,
            workDays: command.shift.workDays,
            saturdayScheduleIn: command.shift.saturdayScheduleIn,
            saturdayScheduleOut: command.shift.saturdayScheduleOut,
            description: command.shift.description,
            isDefault: command.shift.isDefault,
            isActive: command.shift.isActive,
            updatedAt: new Date(),
          })
          .where(eq(attendanceShifts.id, command.shift.id))
          .returning();
        eventId = await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: "UPDATE",
          entityType: "attendance_shift",
          entityId: String(updated.id),
          entityLabel: updated.name,
          outcome: "SUCCESS",
          summary: `Memperbarui jadwal shift: ${updated.name}`,
        });
      } else if (command.action === "delete") {
        await tx.delete(attendanceShifts).where(eq(attendanceShifts.id, command.shift.id));
        eventId = await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: "DELETE",
          entityType: "attendance_shift",
          entityId: String(command.shift.id),
          entityLabel: command.shift.name,
          outcome: "SUCCESS",
          summary: `Menghapus jadwal shift: ${command.shift.name}`,
        });
      }
      break;
    }

    case "assign_shift": {
      const [shift] = await tx.select().from(attendanceShifts).where(eq(attendanceShifts.id, command.assignment.shiftId));
      if (!shift?.isActive) throw new ValidationError("Shift aktif tidak ditemukan. Simpan master shift terlebih dahulu.");
      let targetId: number;
      if (command.assignment.employeeId) {
        const [existing] = await tx
          .select()
          .from(attendanceShiftAssignments)
          .where(eq(attendanceShiftAssignments.employeeId, command.assignment.employeeId));
        if (existing) {
          const [updated] = await tx
            .update(attendanceShiftAssignments)
            .set({ shiftId: command.assignment.shiftId, updatedAt: new Date() })
            .where(eq(attendanceShiftAssignments.id, existing.id))
            .returning();
          targetId = updated.id;
        } else {
          const [inserted] = await tx
            .insert(attendanceShiftAssignments)
            .values({
              shiftId: command.assignment.shiftId,
              employeeId: command.assignment.employeeId,
            })
            .returning();
          targetId = inserted.id;
        }
      } else if (command.assignment.departmentId) {
        const [existing] = await tx
          .select()
          .from(attendanceShiftAssignments)
          .where(eq(attendanceShiftAssignments.departmentId, command.assignment.departmentId));
        if (existing) {
          const [updated] = await tx
            .update(attendanceShiftAssignments)
            .set({ shiftId: command.assignment.shiftId, updatedAt: new Date() })
            .where(eq(attendanceShiftAssignments.id, existing.id))
            .returning();
          targetId = updated.id;
        } else {
          const [inserted] = await tx
            .insert(attendanceShiftAssignments)
            .values({
              shiftId: command.assignment.shiftId,
              departmentId: command.assignment.departmentId,
            })
            .returning();
          targetId = inserted.id;
        }
      } else {
        throw new ValidationError("Assignment must specify employeeId or departmentId");
      }

      eventId = await appendHrAudit(tx, {
        operationId: context.operationId,
        actor: context.actor,
        action: "ASSIGN",
        entityType: "attendance_shift_assignment",
        entityId: String(targetId),
        entityLabel: `Assignment #${targetId}`,
        outcome: "SUCCESS",
        summary: `Menetapkan shift #${command.assignment.shiftId}`,
      });
      break;
    }

    case "grant": {
      const [existing] = await tx
        .select()
        .from(attendanceGrants)
        .where(eq(attendanceGrants.principalKey, command.value.principalKey));

      let grantId: number;
      if (existing) {
        const [updated] = await tx
          .update(attendanceGrants)
          .set({
            displayName: command.value.displayName,
            role: command.value.role,
            isActive: command.value.isActive,
            updatedAt: new Date(),
          })
          .where(eq(attendanceGrants.id, existing.id))
          .returning();
        grantId = updated.id;
      } else {
        const [inserted] = await tx
          .insert(attendanceGrants)
          .values({
            principalKey: command.value.principalKey,
            displayName: command.value.displayName,
            role: command.value.role,
            isActive: command.value.isActive,
          })
          .returning();
        grantId = inserted.id;
      }

      eventId = await appendHrAudit(tx, {
        operationId: context.operationId,
        actor: context.actor,
        action: "CREATE",
        entityType: "attendance_grant",
        entityId: String(grantId),
        entityLabel: command.value.displayName,
        outcome: "SUCCESS",
        summary: `Menetapkan hak akses absensi: ${command.value.displayName} (${command.value.role})`,
      });
      break;
    }

    case "delete_grant": {
      await tx.delete(attendanceGrants).where(eq(attendanceGrants.id, command.id));
      eventId = await appendHrAudit(tx, {
        operationId: context.operationId,
        actor: context.actor,
        action: "DELETE",
        entityType: "attendance_grant",
        entityId: String(command.id),
        entityLabel: `Grant #${command.id}`,
        outcome: "SUCCESS",
        summary: `Menghapus hak akses absensi #${command.id}`,
      });
      break;
    }

    case "import": {
      if (command.rows.length > 10000) {
        const err = new Error("Jumlah baris impor melebihi batas maksimum 10.000");
        (err as any).statusCode = 413;
        throw err;
      }

      const employeeRows = await tx.select().from(employees).where(employeeScopePredicate(scope));
      const identities = await tx.select().from(attendanceIdentities).where(sql`${attendanceIdentities.employeeId} in (select ${employees.id} from ${employees} where ${employeeScopePredicate(scope)})`);
      const resolvedRows = command.rows.map(row => {
        const employeeId = resolveImportEmployee(row.externalNoId, command.sourceId ?? 1, employeeRows, identities);
        if (row.reviewStatus === "SKIPPED") return { ...row, employeeId };
        if (!employeeId) return { ...row, employeeId: null, reviewStatus: "BLOCKED" as const, note: "Karyawan tidak ditemukan atau ID ambigu. Periksa pemetaan karyawan." };
        if (row.issues?.length) return { ...row, employeeId, reviewStatus: "BLOCKED" as const, note: row.issues[0] };
        return { ...row, employeeId };
      });
      const [batch] = await tx
        .insert(attendanceBatches)
        .values({
          groupId:scope.selectedGroupId,
          filename: command.filename,
          sourceId: command.sourceId ?? 1,
          fileHash: command.fileHash || null,
          status: "DRAFT",
          totalRows: command.rows.length,
          validRows: resolvedRows.filter((r) => r.reviewStatus === "READY").length,
          skippedRows: resolvedRows.filter((r) => r.reviewStatus === "SKIPPED").length,
          createdById: Number(context.actor.id),
          strictIntegrity: false,
          revision: 1,
        })
        .returning();

      for (let i = 0; i < command.rows.length; i++) {
        const r = resolvedRows[i];
        await tx.insert(attendanceImportRows).values({
          batchId: batch.id,
          rowNumber: i + 1,
          externalNoId: r.externalNoId,
          employeeId: r.employeeId || null,
          workDate: r.workDate,
          scanIn: r.scanIn,
          scanOut: r.scanOut,
          rawScanIn: r.rawScanIn,
          rawScanOut: r.rawScanOut,
          lateMinutes: r.lateMinutes || 0,
          earlyMinutes: r.earlyMinutes || 0,
          overtimeMinutes: r.overtimeMinutes || 0,
          reviewStatus: r.reviewStatus,
          note: r.note || "",
          attendanceStatus: r.attendanceStatus,
          normalized: r.normalized || false,
          issues: r.issues || null,
        });
      }

      eventId = await appendHrAudit(tx, {
        operationId: context.operationId,
        actor: context.actor,
        action: "IMPORT",
        entityType: "attendance_batch",
        entityId: String(batch.id),
        entityLabel: command.filename,
        outcome: "SUCCESS",
        summary: `Mengimpor draft absensi ${command.filename} (${command.rows.length} baris)`,
        metadata: {
          batchId: batch.id,
          filename: command.filename,
          rowCount: command.rows.length,
        },
      });
      break;
    }

    case "review": {
      const [lockedBatch] = await tx
        .select()
        .from(attendanceBatches)
        .where(eq(attendanceBatches.id, command.batchId))
        .for('update');
      if (!lockedBatch) throw new ValidationError("Batch tidak ditemukan");
      if (expectedBatchRevision !== undefined && lockedBatch.revision !== expectedBatchRevision) {
        throw new ConflictError("Data batch sudah berubah. Muat ulang sebelum menyimpan.");
      }

      const updatePayload: Partial<typeof attendanceImportRows.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (command.employeeId !== undefined) updatePayload.employeeId = command.employeeId;
      if (command.attendanceStatus !== undefined) updatePayload.attendanceStatus = command.attendanceStatus;
      if (command.skipped) {
        updatePayload.reviewStatus = "SKIPPED";
        updatePayload.note = command.reason || "Dilewati oleh HR";
      } else {
        updatePayload.reviewStatus = "READY";
        updatePayload.note = command.reason || "Disetujui oleh HR";
      }
      if (command.values) {
        if (command.values.scanIn !== undefined) updatePayload.scanIn = command.values.scanIn;
        if (command.values.scanOut !== undefined) updatePayload.scanOut = command.values.scanOut;
        if (command.values.lateMinutes !== undefined) updatePayload.lateMinutes = command.values.lateMinutes;
        if (command.values.overtimeMinutes !== undefined) updatePayload.overtimeMinutes = command.values.overtimeMinutes;
      }

      await tx
        .update(attendanceImportRows)
        .set(updatePayload)
        .where(
          and(
            eq(attendanceImportRows.batchId, command.batchId),
            eq(attendanceImportRows.id, command.rowId)
          )
        );

      await tx
        .update(attendanceBatches)
        .set({ revision: lockedBatch.revision + 1 })
        .where(eq(attendanceBatches.id, command.batchId));

      eventId = await appendHrAudit(tx, {
        operationId: context.operationId,
        actor: context.actor,
        action: "REVIEW",
        entityType: "attendance_batch",
        entityId: String(command.batchId),
        entityLabel: `Batch #${command.batchId}`,
        outcome: "SUCCESS",
        summary: `Review baris #${command.rowId}: ${command.reason}`,
      });
      break;
    }

    case "batch": {
      const [lockedBatch] = await tx
        .select()
        .from(attendanceBatches)
        .where(eq(attendanceBatches.id, command.batchId))
        .for('update');
      if (!lockedBatch) throw new ValidationError("Batch tidak ditemukan");
      if (expectedBatchRevision !== undefined && lockedBatch.revision !== expectedBatchRevision) {
        throw new ConflictError("Data batch sudah berubah. Muat ulang sebelum menyimpan.");
      }

      if (command.action === "commit") {
        if (lockedBatch.status !== "DRAFT") throw new ValidationError("Hanya batch DRAFT yang dapat disimpan.");
        const rows = await tx
          .select()
          .from(attendanceImportRows)
          .where(eq(attendanceImportRows.batchId, command.batchId));

        const activeRows = rows.filter((r) => r.reviewStatus !== "SKIPPED");
        if (!activeRows.length) throw new ValidationError("Tidak ada baris aktif untuk disimpan.");
        if (activeRows.some(r => !r.employeeId || r.reviewStatus !== "READY")) {
          throw new ValidationError("Selesaikan review dan pemetaan karyawan pada seluruh baris aktif sebelum menyimpan.");
        }
        const workDates = activeRows.map((r) => r.workDate);

        // Check locks and lock workDates
        for (const date of workDates) {
          await checkDateUnlocked(tx, date);
        }
        await lockWorkDates(tx, workDates);

        const employeeRows = await tx.select().from(employees).where(employeeScopePredicate(scope));
        const shifts = await tx.select().from(attendanceShifts);
        const assignments = await tx.select().from(attendanceShiftAssignments);
        // Commit active rows into attendanceRecords
        for (const r of activeRows) {
          if (!r.employeeId) continue;
          const employee = employeeRows.find(e => e.id === r.employeeId);
          if (!employee) throw new ValidationError("Karyawan tidak ditemukan");
          const schedule = getAttendanceSchedule(employee, r.workDate, shifts as WorkShift[], assignments);
          const [existingRec] = await tx
            .select()
            .from(attendanceRecords)
            .where(
              and(
                eq(attendanceRecords.employeeId, r.employeeId),
                eq(attendanceRecords.workDate, r.workDate)
              )
            );

          const owner = await requireScopedEmployee(scope,r.employeeId,tx);
          if (existingRec && existingRec.groupId !== owner.groupId) throw new ValidationError("Historical attendance ownership mismatch");
          if (existingRec) {
            await tx
              .update(attendanceRecords)
              .set({
                scanIn: r.scanIn,
                scanOut: r.scanOut,
                lateMinutes: r.lateMinutes,
                earlyMinutes: r.earlyMinutes,
                overtimeMinutes: r.overtimeMinutes,
                attendanceStatus: r.attendanceStatus || "PRESENT",
                sourceBatchId: command.batchId,
                ...schedule,
                revision: existingRec.revision + 1,
                updatedAt: new Date(),
              })
              .where(eq(attendanceRecords.id, existingRec.id));
          } else {
            await tx.insert(attendanceRecords).values({
              groupId:owner.groupId,organizationId:owner.organizationId,
              employeeId: r.employeeId,
              workDate: r.workDate,
              scanIn: r.scanIn,
              scanOut: r.scanOut,
              rawScanIn: r.rawScanIn,
              rawScanOut: r.rawScanOut,
              lateMinutes: r.lateMinutes,
              earlyMinutes: r.earlyMinutes,
              overtimeMinutes: r.overtimeMinutes,
              attendanceStatus: r.attendanceStatus || "PRESENT",
              sourceBatchId: command.batchId,
              ...schedule,
              revision: 1,
            });
          }
        }

        await tx
          .update(attendanceBatches)
          .set({
            status: "COMMITTED",
            committedAt: new Date(),
            revision: lockedBatch.revision + 1,
          })
          .where(eq(attendanceBatches.id, command.batchId));

        eventId = await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: "APPROVE",
          entityType: "attendance_batch",
          entityId: String(command.batchId),
          entityLabel: `Batch #${command.batchId}`,
          outcome: "SUCCESS",
          summary: `Commit batch absensi #${command.batchId} (${activeRows.length} baris dicatat)`,
        });
      } else if (command.action === "cancel") {
        await tx
          .update(attendanceBatches)
          .set({ status: "CANCELLED", revision: lockedBatch.revision + 1 })
          .where(eq(attendanceBatches.id, command.batchId));
        eventId = await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: "CANCEL",
          entityType: "attendance_batch",
          entityId: String(command.batchId),
          entityLabel: `Batch #${command.batchId}`,
          outcome: "SUCCESS",
          summary: `Membatalkan draft batch absensi #${command.batchId}`,
        });
      } else if (command.action === "reopen") {
        await tx
          .update(attendanceBatches)
          .set({ status: "DRAFT", revision: lockedBatch.revision + 1 })
          .where(eq(attendanceBatches.id, command.batchId));
        eventId = await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: "REOPEN",
          entityType: "attendance_batch",
          entityId: String(command.batchId),
          entityLabel: `Batch #${command.batchId}`,
          outcome: "SUCCESS",
          summary: `Membuka kembali batch absensi #${command.batchId}`,
        });
      } else if (command.action === "delete") {
        await tx.delete(attendanceBatches).where(eq(attendanceBatches.id, command.batchId));
        eventId = await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: "DELETE",
          entityType: "attendance_batch",
          entityId: String(command.batchId),
          entityLabel: `Batch #${command.batchId}`,
          outcome: "SUCCESS",
          summary: `Menghapus draft batch absensi #${command.batchId}`,
        });
      }
      break;
    }

    case "delete_batch": {
      await tx.delete(attendanceBatches).where(eq(attendanceBatches.id, command.batchId));
      eventId = await appendHrAudit(tx, {
        operationId: context.operationId,
        actor: context.actor,
        action: "DELETE",
        entityType: "attendance_batch",
        entityId: String(command.batchId),
        entityLabel: `Batch #${command.batchId}`,
        outcome: "SUCCESS",
        summary: `Menghapus draft batch absensi #${command.batchId}`,
      });
      break;
    }

    case "toggle_strict_integrity": {
      await tx
        .update(attendanceBatches)
        .set({ strictIntegrity: command.enabled })
        .where(eq(attendanceBatches.id, command.batchId));
      eventId = await appendHrAudit(tx, {
        operationId: context.operationId,
        actor: context.actor,
        action: "UPDATE",
        entityType: "attendance_batch",
        entityId: String(command.batchId),
        entityLabel: `Batch #${command.batchId}`,
        outcome: "SUCCESS",
        summary: `Mengubah strict integrity batch #${command.batchId} ke ${command.enabled}`,
      });
      break;
    }

    case "set_strict_integrity": {
      await tx
        .insert(systemSettings)
        .values({
          key: "attendance_strict_integrity",
          value: command.enabled ? "true" : "false",
          description: "Mode integritas ketat absensi HR",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: command.enabled ? "true" : "false",
            updatedAt: new Date(),
          },
        });
      eventId = await appendHrAudit(tx, {
        operationId: context.operationId,
        actor: context.actor,
        action: "UPDATE",
        entityType: "hr_setting",
        entityId: "attendance_strict_integrity",
        entityLabel: "attendance_strict_integrity",
        outcome: "SUCCESS",
        summary: `Mengatur integritas ketat absensi sistem ke ${command.enabled}`,
      });
      break;
    }

    case "record_attendance": {
      await checkDateUnlocked(tx, command.workDate);
      await lockWorkDates(tx, [command.workDate]);

      const [existing] = await tx
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.employeeId, command.employeeId),
            eq(attendanceRecords.workDate, command.workDate)
          )
        );

      const owner = await requireScopedEmployee(scope,command.employeeId,tx);
      if (existing && existing.groupId !== owner.groupId) throw new ValidationError("Historical attendance ownership mismatch");
      const dutyValues = command.attendanceStatus === "DINAS_LUAR"
        ? await fieldDutyValues(tx, command.employeeId, command.workDate, command.shiftId)
        : await employeeScheduleValues(tx, command.employeeId, command.workDate, command.shiftId);
      let recordId: number;
      if (existing) {
        const [updated] = await tx
          .update(attendanceRecords)
          .set({
            attendanceStatus: command.attendanceStatus,
            scanIn: command.scanIn,
            scanOut: command.scanOut,
            isDayOff: command.isDayOff ?? existing.isDayOff,
            ...dutyValues,
            revision: existing.revision + 1,
            updatedAt: new Date(),
          })
          .where(eq(attendanceRecords.id, existing.id))
          .returning();
        recordId = updated.id;
      } else {
        const [inserted] = await tx
          .insert(attendanceRecords)
          .values({
            groupId:owner.groupId,organizationId:owner.organizationId,
            employeeId: command.employeeId,
            workDate: command.workDate,
            attendanceStatus: command.attendanceStatus,
            scanIn: command.scanIn,
            scanOut: command.scanOut,
            isDayOff: command.isDayOff ?? false,
            ...dutyValues,
            revision: 1,
          })
          .returning();
        recordId = inserted.id;
      }

      eventId = await appendHrAudit(tx, {
        operationId: context.operationId,
        actor: context.actor,
        action: "CREATE",
        entityType: "attendance_record",
        entityId: String(recordId),
        entityLabel: `Absensi Karyawan #${command.employeeId} (${command.workDate})`,
        outcome: "SUCCESS",
        summary: `Mencatat kehadiran karyawan #${command.employeeId} tanggal ${command.workDate}: ${command.attendanceStatus}`,
      });
      break;
    }
  }

  const data = await loadAttendanceWorkspace(tx, context,scope);
  return { changed: true, eventId, data };
}
