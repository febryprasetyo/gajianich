/** Incident repair: all departments use Office, as confirmed on 22 October 2026. */
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../db';
import { employees } from '../db/schema/employees';
import { departments } from '../db/schema/master';
import { users } from '../db/schema/users';
import { attendanceRecords } from '../db/schema/attendance';
import { attendanceShifts, attendanceShiftAssignments, attendanceLocks } from '../db/schema/attendanceWorkspace';
import { DEFAULT_OFFICE_SHIFT, getAttendanceSchedule } from '../domain/attendanceSchedule';
import type { WorkShift } from '../domain/attendanceTypes';
import type { AuditContext } from '../domain/hrAudit';
import { appendHrAudit, type AuditTx } from '../services/hrAudit';

export async function repairOfficeShiftConfiguration(tx: AuditTx, context: AuditContext, apply: boolean) {
  await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('office-shift-repair-2026-10-22'))`);
  const shifts = await tx.select().from(attendanceShifts);
  let office = shifts.find(s => s.code === 'OFFICE');
  if (office && (office.scheduleIn !== '08:00' || office.scheduleOut !== '17:00' || office.workDays !== 5 || !office.isActive)) {
    throw new Error('Existing OFFICE definition differs from confirmed 08:00–17:00; inspect before repair');
  }
  const masterChanges = !office || !office.isDefault || shifts.some(s => s.code !== 'OFFICE' && s.isDefault);
  if (apply) {
    for (const shift of shifts.filter(s => s.code !== 'OFFICE' && s.isDefault)) await tx.update(attendanceShifts).set({ isDefault: false, updatedAt: new Date() }).where(eq(attendanceShifts.id, shift.id));
    if (!office) {
      const { id, ...values } = DEFAULT_OFFICE_SHIFT;
      [office] = await tx.insert(attendanceShifts).values(values).returning();
    } else if (!office.isDefault) {
      [office] = await tx.update(attendanceShifts).set({ isDefault: true, updatedAt: new Date() }).where(eq(attendanceShifts.id, office.id)).returning();
    }
  }
  const effectiveOffice = office ?? { ...DEFAULT_OFFICE_SHIFT, id: -1 };
  const depts = await tx.select().from(departments);
  const assignments = await tx.select().from(attendanceShiftAssignments);
  const changedDepartments = depts.filter(d => !assignments.some(a => a.departmentId === d.id && !a.employeeId && a.shiftId === effectiveOffice.id));
  if (apply) {
    for (const dept of changedDepartments) {
      const existing = assignments.find(a => a.departmentId === dept.id && !a.employeeId);
      if (existing) await tx.update(attendanceShiftAssignments).set({ shiftId: effectiveOffice.id, updatedAt: new Date() }).where(eq(attendanceShiftAssignments.id, existing.id));
      else await tx.insert(attendanceShiftAssignments).values({ departmentId: dept.id, shiftId: effectiveOffice.id });
    }
  }
  const effectiveAssignments = [...assignments.filter(a => a.employeeId), ...depts.map(d => ({ id: 0, employeeId: null, departmentId: d.id, shiftId: effectiveOffice.id }))];
  const effectiveShifts = [...shifts.filter(s => s.code !== 'OFFICE').map(s => ({ ...s, isDefault: false })), { ...effectiveOffice, isDefault: true }];
  const employeeRows = await tx.select().from(employees);
  const missing = sql`nullif(trim(${attendanceRecords.shift}), '') IS NULL OR nullif(trim(${attendanceRecords.scheduleIn}), '') IS NULL OR nullif(trim(${attendanceRecords.scheduleOut}), '') IS NULL`;
  const initial = await tx.select().from(attendanceRecords).where(missing);
  for (const date of [...new Set(initial.map(r => r.workDate))].sort()) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'att_date_' + date}))`);
  const records = await tx.select().from(attendanceRecords).where(missing).for('update');
  const locked = new Set((await tx.select().from(attendanceLocks)).map(l => l.workDate));
  const targets = [];
  let skippedLocked = 0;
  for (const record of records) {
    if (locked.has(record.workDate)) { skippedLocked++; continue; }
    const employee = employeeRows.find(e => e.id === record.employeeId);
    if (!employee) throw new Error('Attendance employee missing');
    const schedule = getAttendanceSchedule(employee, record.workDate, effectiveShifts as WorkShift[], effectiveAssignments);
    const before = { shift: record.shift, scheduleIn: record.scheduleIn, scheduleOut: record.scheduleOut };
    const after = { shift: record.shift?.trim() ? record.shift : schedule.shift, scheduleIn: record.scheduleIn?.trim() ? record.scheduleIn : schedule.scheduleIn, scheduleOut: record.scheduleOut?.trim() ? record.scheduleOut : schedule.scheduleOut };
    if (apply) await tx.update(attendanceRecords).set({ ...after, revision: record.revision + 1, updatedAt: new Date() }).where(eq(attendanceRecords.id, record.id));
    targets.push({ entityType: 'attendance_record', entityId: String(record.id), entityLabel: `Absensi #${record.id} (${record.workDate})`, before, after, changedFields: Object.keys(after).filter(key => before[key as keyof typeof before] !== after[key as keyof typeof after]) });
  }
  if (apply && (masterChanges || changedDepartments.length || targets.length)) {
    await appendHrAudit(tx, { operationId: context.operationId, actor: context.actor, action: 'UPDATE', entityType: 'attendance_shift', entityId: String(effectiveOffice.id), entityLabel: effectiveOffice.name, outcome: 'SUCCESS', summary: `Pemulihan Office 08:00–17:00: ${changedDepartments.length} departemen disimpan, ${targets.length} jadwal absensi dilengkapi; scan dan status tetap.`, metadata: { repair: 'office-shift-2026-10-22', confirmedAllOffice: true, executedBy: 'maintenance-script', departmentChanges: changedDepartments.length, scheduleChanges: targets.length, skippedLocked }, targets });
  }
  return { mode: apply ? 'apply' : 'preview', masterChanges: Boolean(masterChanges), departments: depts.length, departmentChanges: changedDepartments.length, scheduleChanges: targets.length, skippedLocked };
}

async function main() {
  const result = await db.transaction(async tx => {
    const [actor] = await tx.select().from(users).where(eq(users.id, 4));
    if (!actor) throw new Error('Incident operator account missing');
    return repairOfficeShiftConfiguration(tx, { operationId: randomUUID(), actor: { id: String(actor.id), username: actor.username, name: actor.username } }, process.argv.includes('--apply'));
  });
  console.log(JSON.stringify(result, null, 2));
}
if (/repairOfficeShiftConfiguration\.(js|ts)$/.test(process.argv[1] || '')) {
  main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
}
