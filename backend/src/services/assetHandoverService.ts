import { and, asc, desc, eq, ilike, or, sql, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { assetHandovers, assetHandoverItems } from '../db/schema/assetHandovers';
import { organizations } from '../db/schema/organizations';
import { employees } from '../db/schema/employees';
import { assets } from '../db/schema/assets';
import { auditLogs } from '../db/schema/system';
import {
  formatHandoverNumber,
  validateHandoverInput,
  HandoverInputError,
  type HandoverInput,
} from '../domain/assetHandover';

export interface ListHandoversOptions {
  search?: string;
  itemType?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface HandoverStats {
  total: number;
  thisMonth: number;
  withLaptopsOrPc: number;
  activeCount: number;
}

export async function listHandovers(
  db: NodePgDatabase<any>,
  options: ListHandoversOptions = {}
) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, Math.min(100, options.limit || 10));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (options.status && options.status.trim() !== '') {
    conditions.push(eq(assetHandovers.status, options.status.trim()));
  }

  if (options.itemType && options.itemType.trim() !== '') {
    const typeLower = options.itemType.trim().toLowerCase();
    conditions.push(sql`${assetHandovers.itemTypes}::jsonb @> ${JSON.stringify([typeLower])}::jsonb`);
  }

  if (options.search && options.search.trim() !== '') {
    const s = `%${options.search.trim()}%`;
    conditions.push(
      or(
        ilike(assetHandovers.handoverNumber, s),
        ilike(assetHandovers.recipientName, s),
        ilike(assetHandovers.recipientPosition, s),
        ilike(assetHandovers.givenByName, s),
        sql`EXISTS (
          SELECT 1 FROM ${assetHandoverItems} i
          WHERE i.handover_id = ${assetHandovers.id}
            AND (i.item_name ILIKE ${s} OR i.description ILIKE ${s})
        )`
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assetHandovers)
    .where(whereClause);

  const total = countResult?.count ?? 0;

  const rows = await db
    .select({
      id: assetHandovers.id,
      handoverNumber: assetHandovers.handoverNumber,
      handoverDate: assetHandovers.handoverDate,
      organizationId: assetHandovers.organizationId,
      employeeId: assetHandovers.employeeId,
      recipientName: assetHandovers.recipientName,
      recipientPosition: assetHandovers.recipientPosition,
      recipientPhone: assetHandovers.recipientPhone,
      recipientAddress: assetHandovers.recipientAddress,
      itemTypes: assetHandovers.itemTypes,
      itemTypesCustom: assetHandovers.itemTypesCustom,
      givenByName: assetHandovers.givenByName,
      givenByTitle: assetHandovers.givenByTitle,
      receivedByName: assetHandovers.receivedByName,
      status: assetHandovers.status,
      notes: assetHandovers.notes,
      createdAt: assetHandovers.createdAt,
      updatedAt: assetHandovers.updatedAt,
      itemsCount: sql<number>`(SELECT count(*)::int FROM ${assetHandoverItems} WHERE ${assetHandoverItems.handoverId} = ${assetHandovers.id})`,
      firstItemName: sql<string | null>`(SELECT ${assetHandoverItems.itemName} FROM ${assetHandoverItems} WHERE ${assetHandoverItems.handoverId} = ${assetHandovers.id} ORDER BY ${assetHandoverItems.itemOrder} ASC LIMIT 1)`,
    })
    .from(assetHandovers)
    .where(whereClause)
    .orderBy(desc(assetHandovers.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getHandoverStats(db: NodePgDatabase<any>): Promise<HandoverStats> {
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      thisMonth: sql<number>`count(*) filter (where ${assetHandovers.handoverDate}::text like ${currentMonthPrefix + '%'})::int`,
      withLaptopsOrPc: sql<number>`count(*) filter (where ${assetHandovers.itemTypes}::jsonb ? 'laptop' or ${assetHandovers.itemTypes}::jsonb ? 'pc')::int`,
      activeCount: sql<number>`count(*) filter (where ${assetHandovers.status} = 'COMPLETED')::int`,
    })
    .from(assetHandovers);

  return {
    total: stats?.total ?? 0,
    thisMonth: stats?.thisMonth ?? 0,
    withLaptopsOrPc: stats?.withLaptopsOrPc ?? 0,
    activeCount: stats?.activeCount ?? 0,
  };
}

export async function getHandoverById(db: NodePgDatabase<any>, id: number) {
  const [handover] = await db
    .select({
      id: assetHandovers.id,
      handoverNumber: assetHandovers.handoverNumber,
      handoverDate: assetHandovers.handoverDate,
      organizationId: assetHandovers.organizationId,
      organizationName: organizations.name,
      employeeId: assetHandovers.employeeId,
      recipientName: assetHandovers.recipientName,
      recipientAddress: assetHandovers.recipientAddress,
      recipientPosition: assetHandovers.recipientPosition,
      recipientPhone: assetHandovers.recipientPhone,
      itemTypes: assetHandovers.itemTypes,
      itemTypesCustom: assetHandovers.itemTypesCustom,
      givenByName: assetHandovers.givenByName,
      givenByTitle: assetHandovers.givenByTitle,
      givenByUserId: assetHandovers.givenByUserId,
      receivedByName: assetHandovers.receivedByName,
      status: assetHandovers.status,
      notes: assetHandovers.notes,
      createdById: assetHandovers.createdById,
      createdAt: assetHandovers.createdAt,
      updatedAt: assetHandovers.updatedAt,
    })
    .from(assetHandovers)
    .leftJoin(organizations, eq(organizations.id, assetHandovers.organizationId))
    .where(eq(assetHandovers.id, id));

  if (!handover) {
    throw new HandoverInputError('Dokumen tanda terima tidak ditemukan', 404);
  }

  const items = await db
    .select({
      id: assetHandoverItems.id,
      handoverId: assetHandoverItems.handoverId,
      itemOrder: assetHandoverItems.itemOrder,
      assetId: assetHandoverItems.assetId,
      assetCode: assets.assetCode,
      itemName: assetHandoverItems.itemName,
      description: assetHandoverItems.description,
      createdAt: assetHandoverItems.createdAt,
    })
    .from(assetHandoverItems)
    .leftJoin(assets, eq(assets.id, assetHandoverItems.assetId))
    .where(eq(assetHandoverItems.handoverId, id))
    .orderBy(asc(assetHandoverItems.itemOrder));

  return {
    ...handover,
    items,
  };
}

export async function createHandover(
  db: NodePgDatabase<any>,
  rawInput: unknown,
  actorUserId?: number | null
) {
  const input = validateHandoverInput(rawInput);

  return await db.transaction(async (tx) => {
    // Generate handover number based on date and count in the current month
    const monthPrefix = input.handoverDate.slice(0, 7); // YYYY-MM
    const [monthCountRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(assetHandovers)
      .where(sql`${assetHandovers.handoverDate}::text like ${monthPrefix + '%'}`);

    const seq = (monthCountRow?.count || 0) + 1;
    const handoverNumber = formatHandoverNumber(input.handoverDate, seq);

    const [created] = await tx
      .insert(assetHandovers)
      .values({
        handoverNumber,
        handoverDate: input.handoverDate,
        organizationId: input.organizationId ?? null,
        employeeId: input.employeeId ?? null,
        recipientName: input.recipientName || null,
        recipientAddress: input.recipientAddress ?? null,
        recipientPosition: input.recipientPosition ?? null,
        recipientPhone: input.recipientPhone ?? null,
        itemTypes: input.itemTypes,
        itemTypesCustom: input.itemTypesCustom ?? null,
        givenByName: input.givenByName,
        givenByTitle: input.givenByTitle ?? null,
        givenByUserId: input.givenByUserId ?? actorUserId ?? null,
        receivedByName: input.receivedByName || null,
        notes: input.notes ?? null,
        status: input.status ?? 'COMPLETED',
        createdById: actorUserId ?? null,
      })
      .returning();

    const itemsToInsert = input.items.map((item, idx) => ({
      handoverId: created.id,
      itemOrder: item.itemOrder || idx + 1,
      assetId: item.assetId ?? null,
      itemName: item.itemName,
      description: item.description ?? null,
    }));

    const insertedItems = await tx
      .insert(assetHandoverItems)
      .values(itemsToInsert)
      .returning();

    if (actorUserId) {
      await tx.insert(auditLogs).values({
        userId: actorUserId,
        action: 'ASSET_HANDOVER_CREATE',
        entity: 'ASSET_HANDOVER',
        entityId: created.id,
        newValues: {
          handoverNumber: created.handoverNumber,
          recipientName: created.recipientName,
          itemsCount: insertedItems.length,
        },
      });
    }

    return {
      ...created,
      items: insertedItems,
    };
  });
}

export async function updateHandover(
  db: NodePgDatabase<any>,
  id: number,
  rawInput: unknown,
  actorUserId?: number | null
) {
  const input = validateHandoverInput(rawInput);

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(assetHandovers)
      .where(eq(assetHandovers.id, id));

    if (!existing) {
      throw new HandoverInputError('Dokumen tanda terima tidak ditemukan', 404);
    }

    const [updated] = await tx
      .update(assetHandovers)
      .set({
        handoverDate: input.handoverDate,
        organizationId: input.organizationId ?? null,
        employeeId: input.employeeId ?? null,
        recipientName: input.recipientName || null,
        recipientAddress: input.recipientAddress ?? null,
        recipientPosition: input.recipientPosition ?? null,
        recipientPhone: input.recipientPhone ?? null,
        itemTypes: input.itemTypes,
        itemTypesCustom: input.itemTypesCustom ?? null,
        givenByName: input.givenByName,
        givenByTitle: input.givenByTitle ?? null,
        givenByUserId: input.givenByUserId ?? null,
        receivedByName: input.receivedByName || null,
        notes: input.notes ?? null,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(assetHandovers.id, id))
      .returning();

    await tx
      .delete(assetHandoverItems)
      .where(eq(assetHandoverItems.handoverId, id));

    const itemsToInsert = input.items.map((item, idx) => ({
      handoverId: id,
      itemOrder: item.itemOrder || idx + 1,
      assetId: item.assetId ?? null,
      itemName: item.itemName,
      description: item.description ?? null,
    }));

    const insertedItems = await tx
      .insert(assetHandoverItems)
      .values(itemsToInsert)
      .returning();

    if (actorUserId) {
      await tx.insert(auditLogs).values({
        userId: actorUserId,
        action: 'ASSET_HANDOVER_UPDATE',
        entity: 'ASSET_HANDOVER',
        entityId: id,
        oldValues: existing,
        newValues: updated,
      });
    }

    return {
      ...updated,
      items: insertedItems,
    };
  });
}

export async function deleteHandover(
  db: NodePgDatabase<any>,
  id: number,
  actorUserId?: number | null
) {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(assetHandovers)
      .where(eq(assetHandovers.id, id));

    if (!existing) {
      throw new HandoverInputError('Dokumen tanda terima tidak ditemukan', 404);
    }

    await tx
      .delete(assetHandovers)
      .where(eq(assetHandovers.id, id));

    if (actorUserId) {
      await tx.insert(auditLogs).values({
        userId: actorUserId,
        action: 'ASSET_HANDOVER_DELETE',
        entity: 'ASSET_HANDOVER',
        entityId: id,
        oldValues: existing,
      });
    }

    return { success: true };
  });
}

