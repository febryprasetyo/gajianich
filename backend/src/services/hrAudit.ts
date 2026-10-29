import {departmentOrganizationMappings} from '../db/schema/organizations';
import {attendanceBatches,attendanceRecords} from '../db/schema/attendance';
import {leaveRequests} from '../db/schema/leaves';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { hrAuditEvents, hrAuditTargets } from '../db/schema/hrAudit';
import { users } from '../db/schema/users';
import { employees } from '../db/schema/employees';
import type { AuthenticatedRequest } from '../middleware/auth';
import type { AuditContext, AuditEventInput } from '../domain/hrAudit';

export type AuditTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AuditStorageError extends Error {
  statusCode: number;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AuditStorageError';
    this.statusCode = 503;
    if (cause) (this as any).cause = cause;
  }
}

/**
 * Resolve audit context from authenticated request and database user account.
 * Guarantees actor is derived from verified JWT & DB account, not from body or client fallback.
 */
export async function resolveAuditContext(
  req: AuthenticatedRequest,
  database: any = db
): Promise<AuditContext> {
  const userId = req.user?.userId;
  if (!userId) {
    const err = new Error('Authentication required');
    (err as any).statusCode = 401;
    throw err;
  }

  const [user] = await database
    .select({
      id: users.id,
      username: users.username,
      employeeName: employees.fullName,
    })
    .from(users)
    .leftJoin(employees, eq(users.employeeId, employees.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    const err = new Error('Authenticated account not found');
    (err as any).statusCode = 403;
    throw err;
  }

  const headerOpId = (req.headers && (req.headers['idempotency-key'] || req.headers['x-operation-id'])) as string | undefined;
  const bodyOpId = (req.body && typeof req.body === 'object' && req.body !== null ? req.body.operationId : undefined) as string | undefined;

  if (headerOpId && bodyOpId && headerOpId !== bodyOpId) {
    const err = new Error('Mismatched operationId and Idempotency-Key header');
    (err as any).statusCode = 400;
    throw err;
  }

  const candidateOpId = headerOpId || bodyOpId;
  let operationId: string;
  if (candidateOpId) {
    if (!UUID_REGEX.test(candidateOpId)) {
      const err = new Error('Invalid operationId format: must be a valid UUID');
      (err as any).statusCode = 400;
      throw err;
    }
    operationId = candidateOpId;
  } else {
    operationId = randomUUID();
  }

  const actorName = user.employeeName?.trim() || user.username;

  return {
    actor: {
      id: String(user.id),
      username: user.username,
      name: actorName,
    },
    operationId,
  };
}

/**
 * Append audit event and targets atomically within the provided transaction.
 */
export async function appendHrAudit(
  tx: AuditTx,
  input: AuditEventInput
): Promise<string> {
  try {
    const actorName = input.actor.name?.trim() || input.actor.username;
    let groupId: number | null = typeof input.metadata?.groupId === 'number' ? input.metadata.groupId : null;
    const entityId = Number(input.entityId);
    if (!groupId && Number.isSafeInteger(entityId) && entityId > 0) {
      if (input.entityType === 'employee') {
        const [row] = await tx.select({groupId:departmentOrganizationMappings.groupId}).from(employees).innerJoin(departmentOrganizationMappings,eq(employees.departmentId,departmentOrganizationMappings.departmentId)).where(eq(employees.id,entityId));
        groupId = row?.groupId ?? null;
      } else {
        const table = input.entityType === 'attendance_record' ? attendanceRecords : input.entityType === 'attendance_batch' ? attendanceBatches : input.entityType === 'leave_request' ? leaveRequests : null;
        if (table) {const [row] = await tx.select({groupId:table.groupId}).from(table).where(eq(table.id,entityId));groupId = row?.groupId ?? null;}
      }
    }
    const [event] = await (tx as any)
      .insert(hrAuditEvents)
      .values({
        operationId: input.operationId,
        actorId: BigInt(input.actor.id),
        actorUsername: input.actor.username,
        actorName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel,
        outcome: input.outcome,
        summary: input.summary,
        metadata: {...input.metadata,groupId},
        schemaVersion: 1,
      })
      .returning({ id: hrAuditEvents.id });

    if (input.targets && input.targets.length > 0) {
      const targetRows = input.targets.map((t) => ({
        eventId: event.id,
        entityType: t.entityType,
        entityId: t.entityId,
        entityLabel: t.entityLabel,
        before: t.before,
        after: t.after,
        changedFields: t.changedFields,
      }));
      await (tx as any).insert(hrAuditTargets).values(targetRows);
    }

    return String(event.id);
  } catch (error: any) {
    if (error.statusCode) throw error;
    throw new AuditStorageError('Audit storage unavailable', error);
  }
}
