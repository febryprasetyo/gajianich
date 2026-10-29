import type { RequestScope } from '../domain/organizationAccess';
import { custodianScopePredicate, locationScopePredicate, employeeAssetScopePredicate } from './assetOrganizationScope';
import { and, asc, eq, getTableColumns, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { assetCustodians } from '../db/schema/assetCustodians';
import { assets, assetCategories, assetComputerSpecs, assetAccessories } from '../db/schema/assets';
import { employees } from '../db/schema/employees';
import { departments, locations } from '../db/schema/master';
import { auditLogs } from '../db/schema/system';
import { CustodianError, findCustodianCandidates, manualCustodianSchema, normalizeCustodianName, rankEmployeeMatches, type ManualCustodianInput } from '../domain/assetCustodian';

export type CustodianTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type Custodian = typeof assetCustodians.$inferSelect;
/** Acquire BEFORE asset or custodian row locks in every holder-affecting transaction.
* A shared mutation lock also makes similar-name acknowledgement reliable across concurrent inserts.
*/

export async function lockCustodianDirectory(tx: CustodianTransaction): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('asset_custodian_mutation'))`);
}

async function audit(tx: CustodianTransaction, action: string, custodian: Custodian, actorUserId: number, oldValues?: unknown) {
  await tx.insert(auditLogs).values({
    userId: actorUserId,
    action,
    entity: 'ASSET_CUSTODIAN',
    entityId: custodian.id,
    oldValues,
    newValues: custodian,
  });
}

async function requireLocation(tx: CustodianTransaction, locationId?: number | null) {
  if (locationId != null && !(await tx.select({ id: locations.id })
    .from(locations)
    .where(eq(locations.id, locationId))
    .limit(1)).length) {
    throw new CustodianError('Location not found', 400);
  }
}

async function requireEmployee(tx: CustodianTransaction, employeeId: number) {
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
    throw new CustodianError('Invalid employee ID');
  }
  const [employee] = await tx.select().from(employees).where(eq(employees.id, employeeId)).for('share');
  if (!employee) {
    throw new CustodianError('Employee not found', 404);
  }
  if (employee.status.toLowerCase() !== 'active') {
    throw new CustodianError('Employee is inactive', 409);
  }
  return employee;
}

export async function requireActiveCustodian(tx: CustodianTransaction, custodianId: number): Promise<Custodian> {
  await lockCustodianDirectory(tx);
  if (!Number.isSafeInteger(custodianId) || custodianId <= 0) {
    throw new CustodianError('Invalid custodian ID');
  }
  const [custodian] = await tx.select().from(assetCustodians).where(eq(assetCustodians.id, custodianId)).for('update');
  if (!custodian) {
    throw new CustodianError('Custodian not found', 404);
  }
  if (custodian.recordStatus !== 'ACTIVE') {
    throw new CustodianError('Custodian is inactive or merged', 409);
  }
  return custodian;
}

export async function createManualCustodian(tx: CustodianTransaction, input: ManualCustodianInput, actorUserId: number, scope?: RequestScope): Promise<Custodian> {
  const parsed = manualCustodianSchema.parse(input);
  await lockCustodianDirectory(tx);
  await requireLocation(tx, parsed.locationId);
  const custodians = await tx.select().from(assetCustodians).where(and(eq(assetCustodians.recordStatus, 'ACTIVE'),scope ? custodianScopePredicate(scope) : undefined));
  const employeeCandidates = await listEmployeeCandidates(tx,scope);
  const candidates = [
    ...findCustodianCandidates(parsed.displayName, custodians).map(custodian => ({ ...custodian, candidateType: 'CUSTODIAN' as const })),
    ...findCustodianCandidates(parsed.displayName, employeeCandidates.filter(employee => employee.custodianId === null))
      .map(employee => ({ ...employee, displayName: employee.fullName, candidateType: 'EMPLOYEE' as const })),
  ];
  if (candidates.length && !parsed.duplicateAcknowledged) {
    throw new CustodianError('Similar holders already exist; confirm these are different people', 409, 'DUPLICATE_CANDIDATES', candidates);
  }
  const { duplicateAcknowledged: _, ...fields } = parsed;
  const [custodian] = await tx.insert(assetCustodians)
    .values({ ...fields, normalizedName: normalizeCustodianName(fields.displayName), createdByUserId: actorUserId })
    .returning();
  await audit(tx, 'CREATE', custodian, actorUserId);
  return custodian;
}

export async function resolveEmployeeCustodian(tx: CustodianTransaction, employeeId: number, actorUserId: number): Promise<Custodian> {
  await lockCustodianDirectory(tx);
  const employee = await requireEmployee(tx, employeeId);
  const [existing] = await tx.select()
    .from(assetCustodians)
    .where(and(eq(assetCustodians.employeeId, employeeId), eq(assetCustodians.recordStatus, 'ACTIVE')))
    .for('update');
  if (existing) {
    return existing;
  }
  // A deliberately inactive linked holder must be reactivated by an administrator.
  const [inactive] = await tx.select()
    .from(assetCustodians)
    .where(and(eq(assetCustodians.employeeId, employeeId), eq(assetCustodians.recordStatus, 'INACTIVE')))
    .limit(1);
  if (inactive) {
    throw new CustodianError('Employee has an inactive custodian; ask an administrator to reactivate it', 409);
  }
  const [department] = employee.departmentId ? await tx.select()
    .from(departments)
    .where(eq(departments.id, employee.departmentId)) : [];
  const [custodian] = await tx.insert(assetCustodians).values({
    displayName: employee.fullName.trim().replace(/\s+/gu, ' '),
    normalizedName: normalizeCustodianName(employee.fullName),
    origin: 'HRD',
    verificationStatus: 'VERIFIED',
    employeeId,
    locationId: employee.locationId,
    unitText: department?.name ?? null,
    createdByUserId: actorUserId,
  }).returning();
  await audit(tx, 'CREATE', custodian, actorUserId);
  return custodian;
}

export async function resolveCustodianSelection(tx: CustodianTransaction, selection: {
  custodianId?: number | null;
  newCustodian?: ManualCustodianInput;
}, actorUserId: number, canCreateManual: boolean, scope?:RequestScope): Promise<Custodian> {
  const hasId = selection.custodianId != null;
  const hasNew = selection.newCustodian !== undefined;
  if (hasId === hasNew || (hasNew && Object.prototype.hasOwnProperty.call(selection, 'custodianId'))) {
    throw new CustodianError('Select exactly one existing or new custodian');
  }
  if (hasNew) {
    if (!canCreateManual) {
      throw new CustodianError('Only administrators can create manual custodians', 403);
    }
    return createManualCustodian(tx, selection.newCustodian!, actorUserId,scope);
  }
  return requireActiveCustodian(tx, selection.custodianId!);
}

export async function updateCustodian(tx: CustodianTransaction, id: number, input: Partial<ManualCustodianInput> & {
  recordStatus?: 'ACTIVE' | 'INACTIVE';
}, actorUserId: number) {
  await lockCustodianDirectory(tx);
  const [before] = await tx.select().from(assetCustodians).where(eq(assetCustodians.id, id)).for('update');
  if (!before) {
    throw new CustodianError('Custodian not found', 404);
  }
  if (before.recordStatus === 'MERGED') {
    throw new CustodianError('Merged custodians cannot be edited or reactivated', 409);
  }
  if (input.recordStatus === 'INACTIVE' && (await tx.select({ id: assets.id })
    .from(assets)
    .where(eq(assets.currentCustodianId, id))
    .limit(1)).length) {
    throw new CustodianError('Return or transfer all assets before deactivating this custodian', 409);
  }
  await requireLocation(tx, input.locationId);
  if (input.recordStatus === 'ACTIVE' && before.employeeId) {
    const [canonical] = await tx.select()
      .from(assetCustodians)
      .where(and(eq(assetCustodians.employeeId, before.employeeId), eq(assetCustodians.recordStatus, 'ACTIVE')));
    if (canonical && canonical.id !== id) {
      throw new CustodianError('Employee already has an active custodian; merge the records', 409);
    }
  }
  const { duplicateAcknowledged: _, ...fields } = input;
  const [custodian] = await tx.update(assetCustodians)
    .set({ ...fields, ...(input.displayName !== undefined ? { normalizedName: normalizeCustodianName(input.displayName) } : {}), updatedAt: new Date() })
    .where(eq(assetCustodians.id, id))
    .returning();
  await audit(tx, 'UPDATE', custodian, actorUserId, before);
  return custodian;
}

export async function linkCustodianEmployee(tx: CustodianTransaction, id: number, employeeId: number, actorUserId: number) {
  await lockCustodianDirectory(tx);
  const before = await requireActiveCustodian(tx, id);
  await requireEmployee(tx, employeeId);
  if (before.employeeId && before.employeeId !== employeeId) {
    throw new CustodianError('Custodian is already linked to another employee', 409);
  }
  const [canonical] = await tx.select()
    .from(assetCustodians)
    .where(and(eq(assetCustodians.employeeId, employeeId), eq(assetCustodians.recordStatus, 'ACTIVE')));
  if (canonical && canonical.id !== id) {
    throw new CustodianError('Employee already has an active custodian; merge into that record', 409);
  }
  const [custodian] = await tx.update(assetCustodians)
    .set({ employeeId, verificationStatus: 'VERIFIED', updatedAt: new Date() })
    .where(eq(assetCustodians.id, id))
    .returning();
  await audit(tx, 'LINK_EMPLOYEE', custodian, actorUserId, before);
  return custodian;
}

export async function mergeCustodians(tx: CustodianTransaction, sourceId: number, targetId: number, actorUserId: number) {
  await lockCustodianDirectory(tx);
  if (sourceId === targetId) {
    throw new CustodianError('Cannot merge a custodian into itself');
  }
  const rows = await tx.select()
    .from(assetCustodians)
    .where(inArray(assetCustodians.id, [sourceId, targetId]))
    .orderBy(asc(assetCustodians.id))
    .for('update');
  const source = rows.find(c => c.id === sourceId);
  const target = rows.find(c => c.id === targetId);
  if (!source || !target) {
    throw new CustodianError('Custodian not found', 404);
  }
  if (source.recordStatus === 'MERGED' || target.recordStatus !== 'ACTIVE') {
    throw new CustodianError('Choose an unmerged source and active target', 409);
  }
  if (source.employeeId && target.employeeId && source.employeeId !== target.employeeId) {
    throw new CustodianError('Cannot merge holders linked to different employees', 409);
  }
  if (source.employeeId && !target.employeeId) {
    throw new CustodianError('Merge into the verified employee custodian to preserve its HR identity', 409);
  }
  await tx.update(assets)
    .set({ currentCustodianId: targetId, updatedAt: new Date() })
    .where(eq(assets.currentCustodianId, sourceId));
  const [custodian] = await tx.update(assetCustodians)
    .set({ recordStatus: 'MERGED', mergedIntoCustodianId: targetId, updatedAt: new Date() })
    .where(eq(assetCustodians.id, sourceId))
    .returning();
  // Historical references and both display snapshots deliberately stay attached to the original identity.
  await audit(tx, 'MERGE', custodian, actorUserId, source);
  return custodian;
}

export async function listEmployeeCandidates(queryDb: CustodianTransaction | typeof db = db, scope?: RequestScope) {
  return queryDb.select({
    id: employees.id,
    employeeCode: employees.employeeCode,
    fullName: employees.fullName,
    locationId: employees.locationId,
    locationName: locations.name,
    departmentName: departments.name,
    custodianId: assetCustodians.id,
  })
    .from(employees)
    .leftJoin(locations, eq(employees.locationId, locations.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(assetCustodians, and(
      eq(assetCustodians.employeeId, employees.id),
      eq(assetCustodians.recordStatus, 'ACTIVE'),
    ))
    .where(and(sql`lower(${employees.status}) = 'active'`,scope ? employeeAssetScopePredicate(scope) : undefined))
    .orderBy(asc(employees.fullName));
}

export async function searchCustodians(search: string, status: string, scope?: RequestScope) {
  const normalized = normalizeCustodianName(search);
  const [custodians, employeeCandidates] = await Promise.all([
    db.select({
      ...getTableColumns(assetCustodians),
      employeeCode: employees.employeeCode,
      locationName: locations.name,
      assignedAssetCount: sql<number>`(SELECT count(*)::int FROM assets WHERE assets.current_custodian_id = ${assetCustodians.id} and ${scope ? locationScopePredicate(scope,assets.locationId) : sql`true`})`.as('assigned_asset_count'),
    })
      .from(assetCustodians)
      .leftJoin(employees, eq(assetCustodians.employeeId, employees.id))
      .leftJoin(locations, eq(assetCustodians.locationId, locations.id))
      .where(and(status === 'ALL' ? undefined : eq(assetCustodians.recordStatus, status),scope ? custodianScopePredicate(scope) : undefined))
      .orderBy(asc(assetCustodians.displayName)),
    listEmployeeCandidates(db,scope),
  ]);
  return {
    custodians: custodians.filter(c => !normalized || c.normalizedName.includes(normalized) || c.employeeCode?.toLowerCase().includes(normalized)),
    employees: employeeCandidates.filter(e => !normalized || normalizeCustodianName(e.fullName).includes(normalized) || e.employeeCode.toLowerCase().includes(normalized)),
  };
}

export async function reconciliationCandidates(scope?: RequestScope) {
  const [custodians, candidates] = await Promise.all([
    db.select().from(assetCustodians).where(and(
      eq(assetCustodians.recordStatus, 'ACTIVE'),
      eq(assetCustodians.verificationStatus, 'UNVERIFIED'),
      scope ? custodianScopePredicate(scope) : undefined,
    )),
    listEmployeeCandidates(db,scope),
  ]);
  return custodians.map(custodian => ({
    custodian,
    matches: rankEmployeeMatches(custodian, candidates),
  }));
}


export async function getCustodianAssets(custodianId: number, scope?: RequestScope) {
  const [custodian] = await db.select({
    ...getTableColumns(assetCustodians),
    employeeCode: employees.employeeCode,
    locationName: locations.name,
  })
    .from(assetCustodians)
    .leftJoin(employees, eq(assetCustodians.employeeId, employees.id))
    .leftJoin(locations, eq(assetCustodians.locationId, locations.id))
    .where(and(eq(assetCustodians.id, custodianId),scope ? custodianScopePredicate(scope) : undefined));

  if (!custodian) {
    throw new CustodianError('Custodian not found', 404);
  }

  const assignedAssets = await db.select({
    id: assets.id,
    assetCode: assets.assetCode,
    name: assets.name,
    categoryId: assets.categoryId,
    categoryName: assetCategories.name,
    serialNumber: assets.serialNumber,
    status: assets.status,
    condition: assets.condition,
    notes: assets.notes,
    locationId: assets.locationId,
    locationName: locations.name,
    createdAt: assets.createdAt,
  })
    .from(assets)
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(locations, eq(assets.locationId, locations.id))
    .where(and(eq(assets.currentCustodianId, custodianId),scope ? locationScopePredicate(scope,assets.locationId) : undefined))
    .orderBy(asc(assets.name));

  const assetIds = assignedAssets.map(a => a.id);
  const specs = assetIds.length > 0
    ? await db.select().from(assetComputerSpecs).where(inArray(assetComputerSpecs.assetId, assetIds))
    : [];
  const accessories = assetIds.length > 0
    ? await db.select().from(assetAccessories).where(inArray(assetAccessories.assetId, assetIds))
    : [];

  const specsByAssetId = new Map(specs.map(s => [s.assetId, s]));
  const accessoriesByAssetId = new Map<number, typeof accessories>();
  for (const acc of accessories) {
    const list = accessoriesByAssetId.get(acc.assetId) ?? [];
    list.push(acc);
    accessoriesByAssetId.set(acc.assetId, list);
  }

  const detailedAssets = assignedAssets.map(asset => ({
    ...asset,
    computerSpecs: specsByAssetId.get(asset.id) ?? null,
    accessories: accessoriesByAssetId.get(asset.id) ?? [],
  }));

  return {
    custodian,
    assets: detailedAssets,
  };
}
