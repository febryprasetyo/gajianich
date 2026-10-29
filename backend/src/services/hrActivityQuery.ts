import type {RequestScope} from '../domain/organizationAccess';
import {requireHrScope} from './hrOrganizationScope';
import {inArray} from 'drizzle-orm';
function auditScope(scope?:RequestScope) {
 const checked = requireHrScope({organizationScope:scope});
 // Global admin viewing all groups (includeUnmapped + no groupId filter) → no restriction
 if (checked.includeUnmapped && !checked.groupIds.length) return sql`true`;
 const column = sql`(${hrAuditEvents.metadata}->>'groupId')::bigint`;
 const mapped = checked.groupIds.length ? sql`${column} in (${sql.join(checked.groupIds.map(id=>sql`${id}`),sql`,`)})` : sql`false`;
 return checked.includeUnmapped ? or(mapped,sql`${column} is null`)! : mapped;
}
import { and, desc, asc, eq, gte, lt, or, sql, ilike } from "drizzle-orm";
import { db } from "../db";
import { hrAuditEvents, hrAuditTargets } from "../db/schema/hrAudit";
import {
  type ParsedHrActivityQuery,
  encodeCursor,
  escapeIlike,
} from "../domain/hrActivityQuery";

export interface HrActivityActor {
  id: string;
  username: string;
  name: string;
}

export interface HrActivitySummary {
  id: string;
  operationId: string;
  occurredAt: string;
  actor: HrActivityActor;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  outcome: string;
  summary: string;
}

export interface HrActivityTargetSummary {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changedFields?: string[];
}

export interface HrActivityDetail {
  event: HrActivitySummary;
  metadata: Record<string, unknown> | null;
  targets: HrActivityTargetSummary[];
  nextTargetCursor: string | null;
}

export async function listHrActivities(
  query: ParsedHrActivityQuery,
  database: any = db,
  scope?: RequestScope
): Promise<{ items: HrActivitySummary[]; nextCursor: string | null }> {
  const conditions = [
    auditScope(scope),
    gte(hrAuditEvents.occurredAt, query.dateFrom),
    lt(hrAuditEvents.occurredAt, query.dateTo),
  ];

  if (query.action) {
    conditions.push(eq(hrAuditEvents.action, query.action));
  }

  if (query.actorId) {
    conditions.push(eq(hrAuditEvents.actorId, BigInt(query.actorId)));
  }

  if (query.entityType) {
    conditions.push(eq(hrAuditEvents.entityType, query.entityType));
  }

  if (query.q && query.q.length > 0) {
    const escaped = escapeIlike(query.q);
    const pattern = `%${escaped}%`;

    const summaryMatch = sql`${hrAuditEvents.summary} ILIKE ${pattern} ESCAPE '\\'`;
    const labelMatch = sql`${hrAuditEvents.entityLabel} ILIKE ${pattern} ESCAPE '\\'`;
    const targetMatch = sql`EXISTS (
      SELECT 1 FROM ${hrAuditTargets}
      WHERE ${hrAuditTargets.eventId} = ${hrAuditEvents.id}
      AND (
        ${hrAuditTargets.entityLabel} ILIKE ${pattern} ESCAPE '\\'
        OR ${hrAuditTargets.entityId} ILIKE ${pattern} ESCAPE '\\'
      )
    )`;

    conditions.push(or(summaryMatch, labelMatch, targetMatch)!);
  }

  if (query.cursor) {
    const { occurredAt, id } = query.cursor;
    const cursorCondition = or(
      lt(hrAuditEvents.occurredAt, occurredAt),
      and(eq(hrAuditEvents.occurredAt, occurredAt), lt(hrAuditEvents.id, id))
    );
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }
  }

  const rows = await database
    .select({
      id: hrAuditEvents.id,
      operationId: hrAuditEvents.operationId,
      occurredAt: hrAuditEvents.occurredAt,
      actorId: hrAuditEvents.actorId,
      actorUsername: hrAuditEvents.actorUsername,
      actorName: hrAuditEvents.actorName,
      action: hrAuditEvents.action,
      entityType: hrAuditEvents.entityType,
      entityId: hrAuditEvents.entityId,
      entityLabel: hrAuditEvents.entityLabel,
      outcome: hrAuditEvents.outcome,
      summary: hrAuditEvents.summary,
    })
    .from(hrAuditEvents)
    .where(and(...conditions))
    .orderBy(desc(hrAuditEvents.occurredAt), desc(hrAuditEvents.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const itemsRows = hasMore ? rows.slice(0, query.limit) : rows;

  const items: HrActivitySummary[] = itemsRows.map((r: any) => ({
    id: String(r.id),
    operationId: r.operationId,
    occurredAt: r.occurredAt.toISOString(),
    actor: {
      id: String(r.actorId),
      username: r.actorUsername,
      name: r.actorName,
    },
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    entityLabel: r.entityLabel,
    outcome: r.outcome,
    summary: r.summary,
  }));

  let nextCursor: string | null = null;
  if (hasMore && itemsRows.length > 0) {
    const last = itemsRows[itemsRows.length - 1];
    nextCursor = encodeCursor(last.occurredAt, last.id, query.filterFingerprint);
  }

  return { items, nextCursor };
}

export async function getHrActivity(
  id: string,
  database: any = db,
  scope?: RequestScope
): Promise<HrActivityDetail | null> {
  let eventBigInt: bigint;
  try {
    eventBigInt = BigInt(id);
  } catch {
    return null;
  }

  const [row] = await database
    .select()
    .from(hrAuditEvents)
    .where(and(eq(hrAuditEvents.id, eventBigInt),auditScope(scope)))
    .limit(1);

  if (!row) {
    return null;
  }

  const targetRows = await database
    .select()
    .from(hrAuditTargets)
    .where(eq(hrAuditTargets.eventId, eventBigInt))
    .orderBy(asc(hrAuditTargets.id))
    .limit(51);

  const hasMore = targetRows.length > 50;
  const targetItems = hasMore ? targetRows.slice(0, 50) : targetRows;

  let nextTargetCursor: string | null = null;
  if (hasMore && targetItems.length > 0) {
    nextTargetCursor = String(targetItems[targetItems.length - 1].id);
  }

  return {
    event: {
      id: String(row.id),
      operationId: row.operationId,
      occurredAt: row.occurredAt.toISOString(),
      actor: {
        id: String(row.actorId),
        username: row.actorUsername,
        name: row.actorName,
      },
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      entityLabel: row.entityLabel,
      outcome: row.outcome,
      summary: row.summary,
    },
    metadata: row.metadata as Record<string, unknown> | null,
    targets: targetItems.map((t: any) => ({
      id: String(t.id),
      entityType: t.entityType,
      entityId: t.entityId,
      entityLabel: t.entityLabel,
      before: t.before,
      after: t.after,
      changedFields: t.changedFields,
    })),
    nextTargetCursor,
  };
}

export async function listHrActivityTargets(
  id: string,
  cursor?: string,
  limit = 50,
  database: any = db,
  scope?: RequestScope
): Promise<{ targets: HrActivityTargetSummary[]; nextCursor: string | null }> {
  let eventBigInt: bigint;
  try {
    eventBigInt = BigInt(id);
  } catch {
    const err = new Error("Invalid event ID format");
    (err as any).statusCode = 400;
    throw err;
  }

  const parent = await getHrActivity(id,database,scope);
  if (!parent) return {targets:[],nextCursor:null};
  const conditions = [eq(hrAuditTargets.eventId, eventBigInt)];

  if (cursor) {
    try {
      const cursorBigInt = BigInt(cursor);
      conditions.push(sql`${hrAuditTargets.id} > ${cursorBigInt}`);
    } catch {
      const err = new Error("Invalid target cursor");
      (err as any).statusCode = 400;
      throw err;
    }
  }

  const clampedLimit = Math.max(1, Math.min(100, limit));
  const rows = await database
    .select()
    .from(hrAuditTargets)
    .where(and(...conditions))
    .orderBy(asc(hrAuditTargets.id))
    .limit(clampedLimit + 1);

  const hasMore = rows.length > clampedLimit;
  const targetItems = hasMore ? rows.slice(0, clampedLimit) : rows;

  let nextCursor: string | null = null;
  if (hasMore && targetItems.length > 0) {
    nextCursor = String(targetItems[targetItems.length - 1].id);
  }

  return {
    targets: targetItems.map((t: any) => ({
      id: String(t.id),
      entityType: t.entityType,
      entityId: t.entityId,
      entityLabel: t.entityLabel,
      before: t.before,
      after: t.after,
      changedFields: t.changedFields,
    })),
    nextCursor,
  };
}

export async function listHrActivityActors(
  q?: string,
  cursor?: string,
  limit = 25,
  database: any = db,
  scope?: RequestScope
): Promise<{ items: HrActivityActor[]; nextCursor: string | null }> {
  const conditions: any[] = [auditScope(scope)];

  if (q && q.trim().length > 0) {
    const escaped = escapeIlike(q.trim());
    const pattern = `%${escaped}%`;
    conditions.push(
      or(
        sql`${hrAuditEvents.actorUsername} ILIKE ${pattern} ESCAPE '\\'`,
        sql`${hrAuditEvents.actorName} ILIKE ${pattern} ESCAPE '\\'`
      )!
    );
  }

  const clampedLimit = Math.max(1, Math.min(100, limit));

  // Query distinct actors from hrAuditEvents
  const distinctQuery = database
    .selectDistinct({
      id: hrAuditEvents.actorId,
      username: hrAuditEvents.actorUsername,
      name: hrAuditEvents.actorName,
    })
    .from(hrAuditEvents);

  if (conditions.length > 0) {
    distinctQuery.where(and(...conditions));
  }

  distinctQuery.orderBy(asc(hrAuditEvents.actorName), asc(hrAuditEvents.actorId)).limit(clampedLimit + 1);

  const rows = await distinctQuery;
  const hasMore = rows.length > clampedLimit;
  const actorItems = hasMore ? rows.slice(0, clampedLimit) : rows;

  return {
    items: actorItems.map((a: any) => ({
      id: String(a.id),
      username: a.username,
      name: a.name,
    })),
    nextCursor: null,
  };
}
