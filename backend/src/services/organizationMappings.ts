import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { organizationGroups, organizations, departmentOrganizationMappings, locationOrganizationMappings } from '../db/schema/organizations';
import { departments, locations } from '../db/schema/master';
import type { GroupCode } from '../domain/organizationScope';

type Reader = Pick<NodePgDatabase, 'select'>;
type Transaction = Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];
export type MappingResolution = {groupId: number; groupCode: GroupCode; organizationId: number | null} | null;
export interface ApprovedManifest {
  targetDatabase: string;
  targetEnvironmentId: string;
  approvalReference: string;
  mappings: Array<{source: 'department' | 'location'; sourceId: number; sourceCode: string; groupCode: GroupCode | null; organizationCode: string | null}>;
}
async function resolveMapping(db: Reader, source: 'department' | 'location', id: number | null): Promise<MappingResolution> {
  if (id === null) return null;
  const table = source === 'department' ? departmentOrganizationMappings : locationOrganizationMappings;
  const idColumn = source === 'department' ? departmentOrganizationMappings.departmentId : locationOrganizationMappings.locationId;
  const rows = await db.select({groupId: table.groupId, groupCode: organizationGroups.code, organizationId: table.organizationId})
    .from(table).innerJoin(organizationGroups, and(eq(table.groupId, organizationGroups.id), eq(organizationGroups.isActive, true)))
    .where(eq(idColumn, id)).limit(1);
  return rows[0] ?? null;
}
export const resolveDepartmentMapping = (db: Reader, id: number | null) => resolveMapping(db, 'department', id);
export const resolveLocationMapping = (db: Reader, id: number | null) => resolveMapping(db, 'location', id);

/** Operator-only service: never expose approvalReference as an authorization flag on an HTTP route. */
export async function applyOrganizationManifest(tx: Transaction, manifest: ApprovedManifest) {
  if (!manifest.approvalReference?.trim() || manifest.approvalReference.length > 255) throw new Error('Manifest approval reference required');
  const environment = await tx.execute<{name: string; environment_id: string | null}>(sql`SELECT current_database() AS name, current_setting('gajianich.organization_environment_id', true) AS environment_id`);
  if (environment.rows[0]?.name !== manifest.targetDatabase) throw new Error('Manifest target database mismatch');
  if (!manifest.targetEnvironmentId?.trim() || environment.rows[0]?.environment_id !== manifest.targetEnvironmentId) {
    throw new Error('Manifest environment identifier unset or mismatched');
  }
  await tx.execute(sql`SELECT pg_advisory_xact_lock(743901526)`);
  let inserted = 0, unchanged = 0, unresolved = 0;
  const seen = new Set<string>();
  for (const row of manifest.mappings) {
    if (!['department','location'].includes(row.source) || !Number.isSafeInteger(row.sourceId) || row.sourceId <= 0) throw new Error('Invalid manifest source');
    const key = `${row.source}:${row.sourceId}`;
    if (seen.has(key)) throw new Error('Duplicate manifest source');
    seen.add(key);
    if (row.groupCode === null) { unresolved++; continue; }
    if (!['CMC','MGM'].includes(row.groupCode)) throw new Error('Invalid manifest group');
    const group = (await tx.select().from(organizationGroups).where(and(eq(organizationGroups.code, row.groupCode), eq(organizationGroups.isActive, true))))[0];
    if (!group) throw new Error('Manifest group unavailable');
    let organizationId: number | null = null;
    if (row.organizationCode !== null) {
      const org = (await tx.select().from(organizations).where(and(eq(organizations.code, row.organizationCode), eq(organizations.groupId, group.id), eq(organizations.isActive, true))))[0];
      if (!org) throw new Error('Manifest organization unavailable or group mismatch');
      organizationId = org.id;
    }
    const master = row.source === 'department' ? departments : locations;
    const captured = (await tx.select({id: master.id}).from(master).where(and(eq(master.id, row.sourceId), eq(master.code, row.sourceCode))))[0];
    if (!captured) throw new Error('Manifest source code/ID mismatch');
    const table = row.source === 'department' ? departmentOrganizationMappings : locationOrganizationMappings;
    const idColumn = row.source === 'department' ? departmentOrganizationMappings.departmentId : locationOrganizationMappings.locationId;
    const existing = (await tx.select().from(table).where(eq(idColumn, row.sourceId)))[0];
    if (existing) {
      if (existing.groupId !== group.id || existing.organizationId !== organizationId) throw new Error('Mapping conflict: ownership changes require audited history policy');
      unchanged++;
      continue;
    }
    const ownership = {groupId: group.id, organizationId, approvalReference: manifest.approvalReference};
    if (row.source === 'department') await tx.insert(departmentOrganizationMappings).values({...ownership, departmentId: row.sourceId});
    else await tx.insert(locationOrganizationMappings).values({...ownership, locationId: row.sourceId});
    inserted++;
  }
  return {inserted, unchanged, unresolved};
}
