import { and, eq, inArray, isNull, or, sql, type SQL, type AnyColumn } from 'drizzle-orm';
import type { Request } from 'express';
import { db } from '../db';
import { assets } from '../db/schema/assets';
import { assetCustodians } from '../db/schema/assetCustodians';
import { employees } from '../db/schema/employees';
import { departmentOrganizationMappings, locationOrganizationMappings, organizationGroups } from '../db/schema/organizations';
import { CustodianError } from '../domain/assetCustodian';
import type { RequestScope } from '../domain/organizationAccess';
import type { OrganizationScopedRequest } from '../middleware/organizationScope';
import { loadGroupAccess } from './organizationScope';

export function assetRequestScope(req: Request): RequestScope {
  const scope = (req as OrganizationScopedRequest).organizationScope;
  if (!scope || scope.module !== 'assets') throw new CustodianError('Organization scope required',403);
  return scope;
}

export function locationScopePredicate(scope: RequestScope, locationColumn: AnyColumn): SQL {
  const mapped = sql`exists (select 1 from ${locationOrganizationMappings} inner join ${organizationGroups} on ${organizationGroups.id} = ${locationOrganizationMappings.groupId} and ${organizationGroups.isActive} = true where ${locationOrganizationMappings.locationId} = ${locationColumn} and ${inArray(locationOrganizationMappings.groupId,scope.groupIds)})`;
  const unresolved = sql`not exists (select 1 from ${locationOrganizationMappings} inner join ${organizationGroups} on ${organizationGroups.id} = ${locationOrganizationMappings.groupId} and ${organizationGroups.isActive} = true where ${locationOrganizationMappings.locationId} = ${locationColumn})`;
  return scope.includeUnmapped ? or(mapped,unresolved)! : mapped;
}
export function assetScopePredicate(req: Request): SQL { return locationScopePredicate(assetRequestScope(req),assets.locationId); }

export function historyGroupPredicate(scope: RequestScope, groupColumn: AnyColumn): SQL {
  return scope.includeUnmapped ? or(inArray(groupColumn,scope.groupIds),isNull(groupColumn))! : inArray(groupColumn,scope.groupIds);
}

export function employeeAssetScopePredicate(scope: RequestScope): SQL {
  return sql`exists (select 1 from ${departmentOrganizationMappings} inner join ${organizationGroups} on ${organizationGroups.id}=${departmentOrganizationMappings.groupId} and ${organizationGroups.isActive}=true where ${departmentOrganizationMappings.departmentId}=${employees.departmentId} and ${inArray(departmentOrganizationMappings.groupId,scope.groupIds)})`;
}

export async function requireAssetLocation(runner: any, req: Request, locationId: number | null | undefined): Promise<number> {
  const scope = assetRequestScope(req);
  if (!scope.selectedGroupId || !locationId) throw new CustodianError('Choose a mapped primary facility in the destination group',403);
  const [mapping] = await runner.select({groupId:locationOrganizationMappings.groupId}).from(locationOrganizationMappings)
    .innerJoin(organizationGroups,and(eq(organizationGroups.id,locationOrganizationMappings.groupId),eq(organizationGroups.isActive,true)))
    .where(and(eq(locationOrganizationMappings.locationId,locationId),eq(locationOrganizationMappings.groupId,scope.selectedGroupId))).for('share');
  if (!mapping) throw new CustodianError('Primary facility is outside the destination group',403);
  return mapping.groupId;
}

export async function authorizeAssetMutation(runner: any, req: Request, existing: typeof assets.$inferSelect, destination?: number | null) {
  const [visible] = await runner.select({id:assets.id}).from(assets).where(and(eq(assets.id,existing.id),assetScopePredicate(req)));
  if (!visible) {
    const userId = (req as OrganizationScopedRequest).user?.userId;
    const access = userId ? await loadGroupAccess(userId,runner) : null;
    if (!access?.isGlobalAdministrator || destination === undefined) throw new CustodianError('Asset not found',404);
  }
  const nextLocation = destination === undefined ? existing.locationId : destination;
  await requireAssetLocation(runner,req,nextLocation);
  if (nextLocation !== existing.locationId && existing.locationId !== null) {
    const [old] = await runner.select().from(locationOrganizationMappings).where(eq(locationOrganizationMappings.locationId,existing.locationId));
    const scope = assetRequestScope(req);
    if (old?.groupId !== scope.selectedGroupId) {
      const access = await loadGroupAccess((req as OrganizationScopedRequest).user!.userId,runner);
      if (!access.isGlobalAdministrator) throw new CustodianError('Cross-group transfer requires a global administrator',403);
    }
  }
}

export async function requireScopedAsset(runner: any, req: Request, id: number) {
  const [asset] = await runner.select().from(assets).where(and(eq(assets.id,id),assetScopePredicate(req))).for('update');
  if (!asset) throw new CustodianError('Asset not found',404);
  return asset;
}

export function custodianScopePredicate(scope: RequestScope): SQL {
  return or(locationScopePredicate(scope,assetCustodians.locationId),
    sql`exists (select 1 from ${assets} where ${assets.currentCustodianId}=${assetCustodians.id} and ${locationScopePredicate(scope,assets.locationId)})`,
    sql`exists (select 1 from ${employees} where ${employees.id}=${assetCustodians.employeeId} and ${employeeAssetScopePredicate(scope)})`)!;
}
export async function requireScopedCustodian(runner: any, req: Request, id: number, mutation = false) {
  const scope = assetRequestScope(req);
  const [holder] = await runner.select().from(assetCustodians).where(and(eq(assetCustodians.id,id),custodianScopePredicate(scope))).for('update');
  if (!holder) throw new CustodianError('Custodian not found',404);
  if (mutation) {
    const [outside] = await runner.select({id:assets.id}).from(assets).where(and(eq(assets.currentCustodianId,id),sql`not (${locationScopePredicate(scope,assets.locationId)})`)).limit(1);
    if (outside) throw new CustodianError('Shared holder changes require global review',403);
  }
  return holder;
}
export async function requireScopedEmployee(runner: any, req: Request, id: number) {
  const [employee] = await runner.select({id:employees.id}).from(employees).where(and(eq(employees.id,id),employeeAssetScopePredicate(assetRequestScope(req))));
  if (!employee) throw new CustodianError('Employee not found',404);
}

export async function authorizeCustodianSelection(runner: any, req: Request, input: {custodianId?:number|null;newCustodian?:{locationId?:number|null}}, locationId:number|null|undefined) {
  if (input.custodianId != null) await requireScopedCustodian(runner,req,input.custodianId);
  if (input.newCustodian) {
    input.newCustodian.locationId ??= locationId;
    await requireAssetLocation(runner,req,input.newCustodian.locationId);
  }
}
