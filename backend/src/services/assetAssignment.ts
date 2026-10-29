import { and, eq, isNull } from 'drizzle-orm';
import type { AuthenticatedRequest } from '../middleware/auth';
import type { db } from '../db';
import { assets, assetAssignmentHistory } from '../db/schema/assets';
import { assetCustodians } from '../db/schema/assetCustodians';
import { locations } from '../db/schema/master';
import { auditLogs } from '../db/schema/system';
import { locationOrganizationMappings } from '../db/schema/organizations';
import { CustodianError } from '../domain/assetCustodian';

export type AssetTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Asset = typeof assets.$inferSelect;
type Custodian = typeof assetCustodians.$inferSelect;

export function assignmentActor(req: AuthenticatedRequest): number {
  const id = req.user?.userId;
  if (!id || !Number.isSafeInteger(id) || id <= 0) throw new CustodianError('Authenticated operator is required', 401);
  return id;
}

export function canCreateManualCustodian(req: AuthenticatedRequest): boolean {
  return ['superadmin', 'itadmin'].includes((req.user?.roleName || '').toLowerCase().replace(/_/g, ''));
}

export async function requireAssignmentLocation(tx: AssetTransaction, locationId: number | null) {
  if (locationId === null) return null;
  const [location] = await tx.select().from(locations).where(eq(locations.id, locationId));
  if (!location) throw new CustodianError('Assigned location not found', 400);
  return location;
}

// Callers first acquire lockCustodianDirectory, then lock the asset row.
// This operation never alters identity snapshots in existing history rows.
export async function writeAssetAssignment(
  tx: AssetTransaction,
  existing: Asset,
  custodian: Custodian | null,
  actorId: number,
  input: {
    locationId?: number | null;
    conditionOnAssign?: string;
    conditionOnReturn?: string;
    handoverNotes?: string | null;
    returnNotes?: string | null;
    notes?: string | null;
    action?: 'ASSIGN' | 'UNASSIGN';
  } = {},
) {
  const locationId = input.locationId === undefined ? existing.locationId : input.locationId;
  const location = await requireAssignmentLocation(tx, locationId);
  const now = new Date();
  await tx.update(assetAssignmentHistory).set({
    returnedAt: now,
    conditionOnReturn: input.conditionOnReturn ?? existing.condition,
    returnNotes: input.returnNotes ?? 'Asset reassigned / returned',
  }).where(and(eq(assetAssignmentHistory.assetId, existing.id), isNull(assetAssignmentHistory.returnedAt)));
  const [mapping] = locationId === null ? [] : await tx.select().from(locationOrganizationMappings).where(eq(locationOrganizationMappings.locationId,locationId));
  if (custodian) {
    await tx.insert(assetAssignmentHistory).values({
      assetId: existing.id,
      groupId: mapping?.groupId ?? null,
      custodianId: custodian.id,
      custodianNameSnapshot: custodian.displayName,
      locationNameSnapshot: location?.name ?? null,
      assignedByUserId: actorId,
      assignedAt: now,
      conditionOnAssign: input.conditionOnAssign ?? existing.condition,
      handoverNotes: input.handoverNotes ?? input.notes ?? null,
    });
  }
  const [updated] = await tx.update(assets).set({
    currentCustodianId: custodian?.id ?? null,
    status: custodian ? 'Assigned' : 'Available',
    locationId,
    condition: input.conditionOnReturn ?? input.conditionOnAssign ?? existing.condition,
    notes: input.notes === undefined ? existing.notes : input.notes,
    updatedAt: now,
  }).where(eq(assets.id, existing.id)).returning();
  await tx.insert(auditLogs).values({
    userId: actorId,
    action: input.action ?? (custodian ? 'ASSIGN' : 'UNASSIGN'),
    entity: 'ASSET',
    entityId: existing.id,
    oldValues: { currentCustodianId: existing.currentCustodianId, locationId: existing.locationId, status: existing.status },
    newValues: { groupId:mapping?.groupId ?? null, currentCustodianId: custodian?.id ?? null, custodianName: custodian?.displayName ?? null, locationId, status: updated.status },
  });
  return updated;
}
