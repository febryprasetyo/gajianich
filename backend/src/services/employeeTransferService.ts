import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { employees } from '../db/schema/employees';
import { departments, locations } from '../db/schema/master';
import {
  organizationGroups,
  departmentOrganizationMappings,
  locationOrganizationMappings,
  userOrganizationGroupAccess,
  employeeOrganizationTransfers,
} from '../db/schema/organizations';
import { users } from '../db/schema/users';
import { appendHrAudit, resolveAuditContext } from './hrAudit';
import { invalidateCache } from '../lib/redis';
import type { AuthenticatedRequest } from '../middleware/auth';

export interface EmployeeTransferParams {
  targetGroupId: number;
  targetDepartmentId: number;
  targetLocationId?: number | null;
  effectiveDate: string;
  reason: string;
}

export class EmployeeTransferError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'EmployeeTransferError';
    this.statusCode = statusCode;
  }
}

/**
 * Execute organizational transfer for an employee.
 * Validates target group & department mappings, mutates employee, records transfer history,
 * synchronizes linked user account's group access, and writes an HR audit event.
 */
export async function executeEmployeeTransfer(
  req: AuthenticatedRequest,
  employeeId: number,
  params: EmployeeTransferParams
) {
  if (!req.user?.userId) {
    throw new EmployeeTransferError('Authentication required', 401);
  }

  const { targetGroupId, targetDepartmentId, targetLocationId, effectiveDate, reason } = params;

  if (!Number.isSafeInteger(targetGroupId) || targetGroupId <= 0) {
    throw new EmployeeTransferError('Kelompok organisasi tujuan tidak valid', 400);
  }
  if (!Number.isSafeInteger(targetDepartmentId) || targetDepartmentId <= 0) {
    throw new EmployeeTransferError('Departemen tujuan tidak valid', 400);
  }
  if (!reason || reason.trim().length === 0) {
    throw new EmployeeTransferError('Alasan transfer wajib diisi', 400);
  }
  if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    throw new EmployeeTransferError('Format tanggal efektif tidak valid (YYYY-MM-DD)', 400);
  }

  // 1. Verify target group exists and is active
  const [targetGroup] = await db
    .select()
    .from(organizationGroups)
    .where(and(eq(organizationGroups.id, targetGroupId), eq(organizationGroups.isActive, true)));

  if (!targetGroup) {
    throw new EmployeeTransferError('Kelompok organisasi tujuan tidak ditemukan atau tidak aktif', 404);
  }

  // 2. Verify target department belongs to target organization group
  const [targetDeptMapping] = await db
    .select({
      departmentId: departmentOrganizationMappings.departmentId,
      groupId: departmentOrganizationMappings.groupId,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(departmentOrganizationMappings)
    .innerJoin(departments, eq(departments.id, departmentOrganizationMappings.departmentId))
    .where(
      and(
        eq(departmentOrganizationMappings.departmentId, targetDepartmentId),
        eq(departmentOrganizationMappings.groupId, targetGroupId)
      )
    );

  if (!targetDeptMapping) {
    throw new EmployeeTransferError(
      `Departemen tujuan tidak terdaftar pada kelompok organisasi ${targetGroup.name} (${targetGroup.code})`,
      400
    );
  }

  // 3. If targetLocationId is provided, verify it exists (and if mapped to a group, ensure compatibility)
  if (targetLocationId !== undefined && targetLocationId !== null) {
    const [loc] = await db.select().from(locations).where(eq(locations.id, targetLocationId));
    if (!loc) {
      throw new EmployeeTransferError('Lokasi tujuan tidak ditemukan', 404);
    }
  }

  const auditContext = await resolveAuditContext(req);

  return await db.transaction(async (tx) => {
    // Lock employee row
    await tx.execute(sql`SELECT id FROM employees WHERE id = ${employeeId} FOR UPDATE`);

    const [currentEmployee] = await tx
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        fullName: employees.fullName,
        departmentId: employees.departmentId,
        locationId: employees.locationId,
      })
      .from(employees)
      .where(eq(employees.id, employeeId));

    if (!currentEmployee) {
      throw new EmployeeTransferError('Karyawan tidak ditemukan', 404);
    }

    if (!currentEmployee.departmentId) {
      throw new EmployeeTransferError('Karyawan saat ini belum memiliki departemen terdaftar', 400);
    }

    // Get current department and group mapping
    const [currentDeptMapping] = await tx
      .select({
        departmentId: departmentOrganizationMappings.departmentId,
        groupId: departmentOrganizationMappings.groupId,
        groupCode: organizationGroups.code,
        groupName: organizationGroups.name,
        departmentName: departments.name,
      })
      .from(departmentOrganizationMappings)
      .innerJoin(organizationGroups, eq(organizationGroups.id, departmentOrganizationMappings.groupId))
      .innerJoin(departments, eq(departments.id, departmentOrganizationMappings.departmentId))
      .where(eq(departmentOrganizationMappings.departmentId, currentEmployee.departmentId));

    if (!currentDeptMapping) {
      throw new EmployeeTransferError('Pemetaan organisasi untuk departemen saat ini tidak ditemukan', 400);
    }

    const fromGroupId = currentDeptMapping.groupId;
    if (fromGroupId === targetGroupId) {
      throw new EmployeeTransferError(
        `Karyawan sudah berada di kelompok organisasi ${targetGroup.code}. Transfer hanya dapat dilakukan antar kelompok yang berbeda.`,
        400
      );
    }

    // Insert record to employee_organization_transfers
    const [transferRecord] = await tx
      .insert(employeeOrganizationTransfers)
      .values({
        employeeId,
        fromGroupId,
        toGroupId: targetGroupId,
        fromDepartmentId: currentEmployee.departmentId,
        toDepartmentId: targetDepartmentId,
        fromLocationId: currentEmployee.locationId,
        toLocationId: targetLocationId ?? currentEmployee.locationId,
        effectiveDate,
        reason: reason.trim(),
        transferredBy: req.user!.userId,
      })
      .returning();

    // Update employee's department and location
    const updateData: { departmentId: number; locationId?: number | null; updatedAt: Date } = {
      departmentId: targetDepartmentId,
      updatedAt: new Date(),
    };
    if (targetLocationId !== undefined) {
      updateData.locationId = targetLocationId;
    }

    const [updatedEmployee] = await tx
      .update(employees)
      .set(updateData)
      .where(eq(employees.id, employeeId))
      .returning();

    // If there is an associated user account, update group access
    const [linkedUser] = await tx
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.employeeId, employeeId));

    if (linkedUser) {
      // Remove previous group access and assign new group access
      await tx
        .delete(userOrganizationGroupAccess)
        .where(
          and(
            eq(userOrganizationGroupAccess.userId, linkedUser.id),
            eq(userOrganizationGroupAccess.groupId, fromGroupId)
          )
        );

      await tx
        .insert(userOrganizationGroupAccess)
        .values({
          userId: linkedUser.id,
          groupId: targetGroupId,
        })
        .onConflictDoNothing();
    }

    // Append HR Audit Log
    await appendHrAudit(tx, {
      operationId: auditContext.operationId,
      actor: auditContext.actor,
      action: 'UPDATE',
      entityType: 'employee_organization_transfer',
      entityId: String(employeeId),
      entityLabel: `${currentEmployee.fullName} (${currentEmployee.employeeCode})`,
      outcome: 'SUCCESS',
      summary: `Transfer karyawan dari ${currentDeptMapping.groupCode} (${currentDeptMapping.departmentName}) ke ${targetGroup.code} (${targetDeptMapping.departmentName}): ${reason}`,
      metadata: {
        transferId: transferRecord.id,
        fromGroupId,
        toGroupId: targetGroupId,
        fromDepartmentId: currentEmployee.departmentId,
        toDepartmentId: targetDepartmentId,
        effectiveDate,
        reason,
        linkedUserId: linkedUser?.id ?? null,
      },
      targets: [
        {
          entityType: 'employee',
          entityId: String(employeeId),
          entityLabel: currentEmployee.fullName,
          before: {
            departmentId: currentEmployee.departmentId,
            locationId: currentEmployee.locationId,
            groupId: fromGroupId,
          },
          after: {
            departmentId: targetDepartmentId,
            locationId: updateData.locationId ?? currentEmployee.locationId,
            groupId: targetGroupId,
          },
          changedFields: ['departmentId', 'locationId', 'groupId'],
        },
      ],
    });

    // Invalidate caches
    await Promise.all([
      invalidateCache('auth:org-access:*'),
      invalidateCache('ref:master:*'),
      invalidateCache('kpi:*'),
      invalidateCache('adms:pin:*'),
      linkedUser ? invalidateCache(`auth:org-access:${linkedUser.id}`) : Promise.resolve(),
    ]);

    return {
      transfer: transferRecord,
      employee: updatedEmployee,
      fromGroup: { id: fromGroupId, code: currentDeptMapping.groupCode, name: currentDeptMapping.groupName },
      toGroup: { id: targetGroupId, code: targetGroup.code, name: targetGroup.name },
      toDepartment: { id: targetDepartmentId, name: targetDeptMapping.departmentName },
    };
  });
}

/**
 * Fetch transfer history of an employee.
 */
export async function getEmployeeTransferHistory(employeeId: number) {
  return await db
    .select({
      id: employeeOrganizationTransfers.id,
      employeeId: employeeOrganizationTransfers.employeeId,
      fromGroupId: employeeOrganizationTransfers.fromGroupId,
      toGroupId: employeeOrganizationTransfers.toGroupId,
      fromDepartmentId: employeeOrganizationTransfers.fromDepartmentId,
      toDepartmentId: employeeOrganizationTransfers.toDepartmentId,
      fromLocationId: employeeOrganizationTransfers.fromLocationId,
      toLocationId: employeeOrganizationTransfers.toLocationId,
      effectiveDate: employeeOrganizationTransfers.effectiveDate,
      reason: employeeOrganizationTransfers.reason,
      transferredBy: employeeOrganizationTransfers.transferredBy,
      createdAt: employeeOrganizationTransfers.createdAt,
      transferredByName: users.username,
    })
    .from(employeeOrganizationTransfers)
    .leftJoin(users, eq(users.id, employeeOrganizationTransfers.transferredBy))
    .where(eq(employeeOrganizationTransfers.employeeId, employeeId))
    .orderBy(sql`${employeeOrganizationTransfers.createdAt} DESC`);
}

/**
 * Get active organization groups and their associated departments.
 */
export async function getOrganizationGroupsWithDepartments() {
  const groups = await db
    .select({
      id: organizationGroups.id,
      code: organizationGroups.code,
      name: organizationGroups.name,
    })
    .from(organizationGroups)
    .where(eq(organizationGroups.isActive, true))
    .orderBy(organizationGroups.code);

  const mappings = await db
    .select({
      groupId: departmentOrganizationMappings.groupId,
      departmentId: departments.id,
      departmentCode: departments.code,
      departmentName: departments.name,
    })
    .from(departmentOrganizationMappings)
    .innerJoin(departments, eq(departments.id, departmentOrganizationMappings.departmentId))
    .where(eq(departments.isActive, true))
    .orderBy(departments.name);

  return groups.map((g) => ({
    ...g,
    departments: mappings
      .filter((m) => m.groupId === g.id)
      .map((m) => ({
        id: m.departmentId,
        code: m.departmentCode,
        name: m.departmentName,
      })),
  }));
}

