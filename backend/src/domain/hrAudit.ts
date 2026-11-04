import { createHash } from 'node:crypto';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'IMPORT'
  | 'REVIEW'
  | 'LINK'
  | 'UNLINK'
  | 'APPROVE'
  | 'REJECT'
  | 'CANCEL'
  | 'REOPEN'
  | 'LOCK'
  | 'UNLOCK'
  | 'ASSIGN'
  | 'UNASSIGN';

export type AuditOutcome = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface AuditActor {
  id: string;
  username: string;
  name: string;
}

export type SafeSnapshot = Record<string, string | number | boolean | null>;

export interface AuditTargetInput {
  entityType: string;
  entityId: string;
  entityLabel: string;
  before: SafeSnapshot | null;
  after: SafeSnapshot | null;
  changedFields: string[];
}

export interface AuditEventInput {
  operationId: string;
  actor: AuditActor;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  outcome: AuditOutcome;
  summary: string;
  metadata?: Record<string, unknown>;
  targets?: AuditTargetInput[];
}

export type HrActivitySummary = Omit<AuditEventInput, 'operationId' | 'metadata' | 'targets'> & {
  id: string;
  occurredAt: string;
};

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AuditContext {
  actor: AuditActor;
  operationId: string;
}

export const SENSITIVE_KEY_REGEX = /password|secret|token|hash|salt|nik|npwp|rekening|bank|credit|credential|auth/i;

export const ALLOWED_ENTITY_FIELDS: Record<string, string[]> = {
  employee: [
    'id', 'code', 'employeeCode', 'name', 'fullName', 'firstName', 'lastName',
    'departmentId', 'department', 'position', 'status', 'employmentStatus',
    'joinDate', 'resignDate', 'branch', 'grade',
  ],
  department: ['id', 'code', 'name', 'description'],
  location: ['id', 'code', 'name', 'address'],
  attendance_record: [
    'id', 'employeeId', 'employeeName', 'workDate', 'checkIn', 'checkOut',
    'status', 'source', 'notes',
  ],
  attendance_batch: [
    'id', 'name', 'status', 'periodStart', 'periodEnd', 'totalRows',
    'strictIntegrity', 'revision',
  ],
  attendance_lock: ['workDate', 'lockedAt', 'reason', 'actorId'],
  attendance_grant: ['id', 'principalKey', 'permission', 'scope'],
  attendance_source: ['id', 'code', 'name', 'type'],
  attendance_shift: ['id', 'code', 'name', 'startTime', 'endTime'],
  attendance_shift_assignment: ['id', 'shiftId', 'employeeId', 'departmentId', 'startDate', 'endDate'],
  leave_request: [
    'id', 'employeeId', 'employeeCode', 'employeeName', 'organizationId', 'leaveType',
    'startDate', 'endDate', 'durationDays', 'status', 'requestNumber', 'reason',
  ],
  leave_balance: [
    'id', 'employeeId', 'year', 'baseQuota', 'usedQuota', 'remainingQuota',
    'cleanAnnualQuota', 'carriedOverQuota', 'isCustomQuota',
  ],
  hr_setting: ['key', 'value'],
  system_setting: ['key', 'value'],
};

/**
 * Deterministically serialize any JSON value into canonical string
 * (sorted keys, stable representation).
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

/**
 * Hash canonicalized request payload to SHA-256 hex string.
 */
export function hashRequestPayload(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

/**
 * Sanitize an object to primitive SafeSnapshot based on allowlist and sensitive key filter.
 */
export function sanitizeSnapshot(entityType: string, record: unknown): SafeSnapshot | null {
  if (!record || typeof record !== 'object') return null;

  const allowedFields = ALLOWED_ENTITY_FIELDS[entityType];
  const obj = record as Record<string, unknown>;
  const result: SafeSnapshot = {};

  const keys = Object.keys(obj);
  for (const key of keys) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      continue; // sensitive field stripped
    }
    if (allowedFields && !allowedFields.includes(key)) {
      continue; // not in allowlist
    }

    const val = obj[key];
    if (val === null || val === undefined) {
      result[key] = null;
    } else if (typeof val === 'boolean' || typeof val === 'number') {
      result[key] = val;
    } else if (val instanceof Date) {
      result[key] = val.toISOString();
    } else if (typeof val === 'string') {
      result[key] = val.trim();
    } else if (typeof val === 'bigint') {
      result[key] = val.toString();
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Sanitize target before/after records into an AuditTargetInput.
 */
export function sanitizeAuditTarget(
  entityType: string,
  before: unknown,
  after: unknown,
  targetIdentity?: { entityId: string; entityLabel: string }
): AuditTargetInput {
  let entityId = targetIdentity?.entityId;
  let entityLabel = targetIdentity?.entityLabel;

  const primaryObj = (after || before) as Record<string, unknown> | null;
  if (!entityId && primaryObj) {
    const rawId = primaryObj.id ?? primaryObj.entityId ?? primaryObj.code ?? primaryObj.key;
    if (rawId !== undefined && rawId !== null && rawId !== '') {
      entityId = String(rawId);
    }
  }

  if (!entityLabel && primaryObj) {
    const rawLabel = primaryObj.label ?? primaryObj.name ?? primaryObj.fullName ?? primaryObj.code ?? primaryObj.key ?? entityId;
    if (rawLabel !== undefined && rawLabel !== null && rawLabel !== '') {
      entityLabel = String(rawLabel);
    }
  }

  if (!entityId || !entityLabel) {
    throw new Error(`Invalid target identity for ${entityType}: entityId and entityLabel are required`);
  }

  const safeBefore = sanitizeSnapshot(entityType, before);
  const safeAfter = sanitizeSnapshot(entityType, after);

  const allKeys = new Set<string>([
    ...Object.keys(safeBefore || {}),
    ...Object.keys(safeAfter || {}),
  ]);

  const changedFields: string[] = [];
  for (const key of allKeys) {
    const valBefore = safeBefore ? safeBefore[key] : undefined;
    const valAfter = safeAfter ? safeAfter[key] : undefined;
    if (valBefore !== valAfter) {
      changedFields.push(key);
    }
  }

  return {
    entityType,
    entityId,
    entityLabel,
    before: safeBefore,
    after: safeAfter,
    changedFields: changedFields.sort(),
  };
}
