import type {RequestScope} from '../domain/organizationAccess';
import {requireHrScope,requireScopedEmployee,requireScopedDepartment} from './hrOrganizationScope';
import { eq, sql } from 'drizzle-orm';
import { departments, locations } from '../db/schema/master';
import { employees } from '../db/schema/employees';
import { systemSettings } from '../db/schema/system';
import { attendanceShifts, attendanceShiftAssignments } from '../db/schema/attendanceWorkspace';
import { sanitizeAuditTarget, type AuditContext } from '../domain/hrAudit';
import { appendHrAudit, type AuditTx } from './hrAudit';
import { assessEmployeeDeletion, getAttendanceDeletionCheck } from '../domain/employeeDeletion';

export type DepartmentCommand =
  | { type: 'CREATE'; data: { name: string; code: string; isActive?: boolean } }
  | { type: 'UPDATE'; id: number; data: Partial<{ name: string; code: string; isActive?: boolean }> }
  | { type: 'DELETE'; id: number };

export type LocationCommand =
  | { type: 'CREATE'; data: { name: string; code: string; address?: string | null; isActive?: boolean } }
  | { type: 'UPDATE'; id: number; data: Partial<{ name: string; code: string; address?: string | null; isActive?: boolean }> }
  | { type: 'DELETE'; id: number };

export type EmployeeCommand =
  | { type: 'CREATE'; data: any }
  | { type: 'UPDATE'; id: number; data: any }
  | { type: 'DELETE'; id: number };

export async function mutateDepartment(
  tx: AuditTx,
  context: AuditContext,
  command: DepartmentCommand
): Promise<{ department: any; eventId: string | null }> {
  if (command.type === 'CREATE') {
    const [inserted] = await (tx as any).insert(departments).values(command.data).returning();

    // Auto-assign default office shift ke departemen baru
    try {
      const [defaultShift] = await (tx as any)
        .select()
        .from(attendanceShifts)
        .where(eq(attendanceShifts.isDefault, true))
        .limit(1);
      const officeShift = defaultShift || (
        await (tx as any)
          .select()
          .from(attendanceShifts)
          .where(eq(attendanceShifts.code, 'OFFICE'))
          .limit(1)
      )[0];

      if (officeShift) {
        await (tx as any).insert(attendanceShiftAssignments).values({
          departmentId: inserted.id,
          shiftId: officeShift.id,
          isDefault: true,
        });
      }
    } catch {
      // Abaikan jika tabel absensi belum tersedia pada bootstrap awal
    }

    const target = sanitizeAuditTarget('department', null, inserted, {
      entityId: String(inserted.id),
      entityLabel: `${inserted.code} - ${inserted.name}`,
    });
    const eventId = await appendHrAudit(tx, {
      operationId: context.operationId,
      actor: context.actor,
      action: 'CREATE',
      entityType: 'department',
      entityId: String(inserted.id),
      entityLabel: `${inserted.code} - ${inserted.name}`,
      outcome: 'SUCCESS',
      summary: `Departemen ${inserted.name} (${inserted.code}) dibuat`,
      targets: [target],
    });
    return { department: inserted, eventId };
  }

  if (command.type === 'UPDATE') {
    const [before] = await (tx as any).select().from(departments).where(eq(departments.id, command.id)).limit(1);
    if (!before) {
      const err = new Error('Department not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const [updated] = await (tx as any)
      .update(departments)
      .set(command.data)
      .where(eq(departments.id, command.id))
      .returning();

    const target = sanitizeAuditTarget('department', before, updated, {
      entityId: String(command.id),
      entityLabel: `${updated.code} - ${updated.name}`,
    });

    if (target.changedFields.length === 0) {
      return { department: before, eventId: null };
    }

    const eventId = await appendHrAudit(tx, {
      operationId: context.operationId,
      actor: context.actor,
      action: 'UPDATE',
      entityType: 'department',
      entityId: String(command.id),
      entityLabel: `${updated.code} - ${updated.name}`,
      outcome: 'SUCCESS',
      summary: `Departemen ${updated.name} diperbarui: ${target.changedFields.join(', ')}`,
      targets: [target],
    });
    return { department: updated, eventId };
  }

  if (command.type === 'DELETE') {
    const [before] = await (tx as any).select().from(departments).where(eq(departments.id, command.id)).limit(1);
    if (!before) {
      const err = new Error('Department not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const [deleted] = await (tx as any)
      .delete(departments)
      .where(eq(departments.id, command.id))
      .returning();

    const target = sanitizeAuditTarget('department', before, null, {
      entityId: String(command.id),
      entityLabel: `${before.code} - ${before.name}`,
    });

    const eventId = await appendHrAudit(tx, {
      operationId: context.operationId,
      actor: context.actor,
      action: 'DELETE',
      entityType: 'department',
      entityId: String(command.id),
      entityLabel: `${before.code} - ${before.name}`,
      outcome: 'SUCCESS',
      summary: `Departemen ${before.name} (${before.code}) dihapus`,
      targets: [target],
    });
    return { department: deleted, eventId };
  }

  throw new Error(`Unsupported department command type: ${(command as any).type}`);
}

export async function mutateLocation(
  tx: AuditTx,
  context: AuditContext,
  command: LocationCommand
): Promise<{ location: any; eventId: string | null }> {
  if (command.type === 'CREATE') {
    const [inserted] = await (tx as any).insert(locations).values(command.data).returning();
    const target = sanitizeAuditTarget('location', null, inserted, {
      entityId: String(inserted.id),
      entityLabel: `${inserted.code} - ${inserted.name}`,
    });
    const eventId = await appendHrAudit(tx, {
      operationId: context.operationId,
      actor: context.actor,
      action: 'CREATE',
      entityType: 'location',
      entityId: String(inserted.id),
      entityLabel: `${inserted.code} - ${inserted.name}`,
      outcome: 'SUCCESS',
      summary: `Lokasi ${inserted.name} (${inserted.code}) dibuat`,
      targets: [target],
    });
    return { location: inserted, eventId };
  }

  if (command.type === 'UPDATE') {
    const [before] = await (tx as any).select().from(locations).where(eq(locations.id, command.id)).limit(1);
    if (!before) {
      const err = new Error('Location not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const [updated] = await (tx as any)
      .update(locations)
      .set(command.data)
      .where(eq(locations.id, command.id))
      .returning();

    const target = sanitizeAuditTarget('location', before, updated, {
      entityId: String(command.id),
      entityLabel: `${updated.code} - ${updated.name}`,
    });

    if (target.changedFields.length === 0) {
      return { location: before, eventId: null };
    }

    const eventId = await appendHrAudit(tx, {
      operationId: context.operationId,
      actor: context.actor,
      action: 'UPDATE',
      entityType: 'location',
      entityId: String(command.id),
      entityLabel: `${updated.code} - ${updated.name}`,
      outcome: 'SUCCESS',
      summary: `Lokasi ${updated.name} diperbarui: ${target.changedFields.join(', ')}`,
      targets: [target],
    });
    return { location: updated, eventId };
  }

  if (command.type === 'DELETE') {
    const [before] = await (tx as any).select().from(locations).where(eq(locations.id, command.id)).limit(1);
    if (!before) {
      const err = new Error('Location not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const [deleted] = await (tx as any)
      .delete(locations)
      .where(eq(locations.id, command.id))
      .returning();

    const target = sanitizeAuditTarget('location', before, null, {
      entityId: String(command.id),
      entityLabel: `${before.code} - ${before.name}`,
    });

    const eventId = await appendHrAudit(tx, {
      operationId: context.operationId,
      actor: context.actor,
      action: 'DELETE',
      entityType: 'location',
      entityId: String(command.id),
      entityLabel: `${before.code} - ${before.name}`,
      outcome: 'SUCCESS',
      summary: `Lokasi ${before.name} (${before.code}) dihapus`,
      targets: [target],
    });
    return { location: deleted, eventId };
  }

  throw new Error(`Unsupported location command type: ${(command as any).type}`);
}

export async function mutateEmployee(
  tx: AuditTx,
  context: AuditContext,
  command: EmployeeCommand,
  scope?: RequestScope
): Promise<{ employee: any; eventId: string | null }> {
  scope = requireHrScope({organizationScope:scope});
  if (command.type !== 'CREATE') await requireScopedEmployee(scope,command.id,tx);
  if (command.type === 'CREATE' || (command.type === 'UPDATE' && command.data.departmentId !== undefined)) await requireScopedDepartment(scope,command.data.departmentId,tx);
  if (command.type === 'CREATE') {
    const [inserted] = await (tx as any).insert(employees).values(command.data).returning();
    const label = `${inserted.employeeCode} - ${inserted.fullName}`;
    const target = sanitizeAuditTarget('employee', null, inserted, {
      entityId: String(inserted.id),
      entityLabel: label,
    });
    const eventId = await appendHrAudit(tx, {
      operationId: context.operationId,
      actor: context.actor,
      action: 'CREATE',
      entityType: 'employee',
      entityId: String(inserted.id),
      entityLabel: label,
      outcome: 'SUCCESS',
      summary: `Karyawan ${inserted.fullName} (${inserted.employeeCode}) dibuat`,
      targets: [target],
    });
    return { employee: inserted, eventId };
  }

  if (command.type === 'UPDATE') {
    const [before] = await (tx as any).select().from(employees).where(eq(employees.id, command.id)).limit(1);
    if (!before) {
      const err = new Error('Employee not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const [updated] = await (tx as any)
      .update(employees)
      .set({ ...command.data, updatedAt: new Date() })
      .where(eq(employees.id, command.id))
      .returning();

    const label = `${updated.employeeCode} - ${updated.fullName}`;
    const target = sanitizeAuditTarget('employee', before, updated, {
      entityId: String(command.id),
      entityLabel: label,
    });

    if (target.changedFields.length === 0) {
      return { employee: before, eventId: null };
    }

    const eventId = await appendHrAudit(tx, {
      operationId: context.operationId,
      actor: context.actor,
      action: 'UPDATE',
      entityType: 'employee',
      entityId: String(command.id),
      entityLabel: label,
      outcome: 'SUCCESS',
      summary: `Karyawan ${updated.fullName} diperbarui: ${target.changedFields.join(', ')}`,
      targets: [target],
    });
    return { employee: updated, eventId };
  }

  if (command.type === 'DELETE') {
    const [before] = await (tx as any).select().from(employees).where(eq(employees.id, command.id)).limit(1);
    if (!before) {
      const err = new Error('Employee not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const attendanceCheck = await getAttendanceDeletionCheck(command.id, tx as any);
    const decision = assessEmployeeDeletion({ attendanceCheck });
    if (!decision.allowed) {
      const err = new Error(decision.message);
      (err as any).statusCode = 409;
      throw err;
    }

    const [deleted] = await (tx as any)
      .delete(employees)
      .where(eq(employees.id, command.id))
      .returning();

    const label = `${before.employeeCode} - ${before.fullName}`;
    const target = sanitizeAuditTarget('employee', before, null, {
      entityId: String(command.id),
      entityLabel: label,
    });

    const eventId = await appendHrAudit(tx, {
      operationId: context.operationId,
      actor: context.actor,
      action: 'DELETE',
      entityType: 'employee',
      entityId: String(command.id),
      entityLabel: label,
      outcome: 'SUCCESS',
      summary: `Karyawan ${before.fullName} (${before.employeeCode}) dihapus`,
      targets: [target],
    });
    return { employee: deleted, eventId };
  }

  throw new Error(`Unsupported employee command type: ${(command as any).type}`);
}

export async function setHrSetting(
  tx: AuditTx,
  context: AuditContext,
  input: { key: string; value: unknown; description?: string }
): Promise<{ setting: any; eventId: string | null }> {
  const isHrKey = input.key === 'attendance_strict_integrity';

  const [before] = await (tx as any)
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, input.key))
    .limit(1);

  const [saved] = await (tx as any)
    .insert(systemSettings)
    .values({
      key: input.key,
      value: input.value,
      description: input.description ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: input.value,
        description: input.description !== undefined ? input.description : sql`COALESCE(${systemSettings.description}, NULL)`,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!isHrKey) {
    return { setting: saved, eventId: null };
  }

  const target = sanitizeAuditTarget('hr_setting', before, saved, {
    entityId: input.key,
    entityLabel: input.key,
  });

  if (target.changedFields.length === 0) {
    return { setting: saved, eventId: null };
  }

  const eventId = await appendHrAudit(tx, {
    operationId: context.operationId,
    actor: context.actor,
    action: 'UPDATE',
    entityType: 'hr_setting',
    entityId: input.key,
    entityLabel: input.key,
    outcome: 'SUCCESS',
    summary: `Pengaturan HR ${input.key} diubah`,
    targets: [target],
  });

  return { setting: saved, eventId };
}
