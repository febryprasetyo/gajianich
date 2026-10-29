import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db } from '../db';
import { organizationGroups, userOrganizationGroupAccess } from '../db/schema/organizations';
import { loadCurrentIdentity } from './currentIdentity';
import { OrganizationScopeError, type GroupAccess } from '../domain/organizationAccess';
export { resolveRequestScope } from '../domain/organizationAccess';
export type {GroupAccess, RequestScope, ScopeModule} from '../domain/organizationAccess';

export async function loadOrganizationAccess(userId: number, database: Pick<NodePgDatabase, 'select'> = db) {
  const current = await loadCurrentIdentity(userId, database);
  if (!current) throw new OrganizationScopeError('Account unavailable');
  const columns = {id: organizationGroups.id, code: organizationGroups.code, name: organizationGroups.name};
  const availableGroups = current.isGlobalAdministrator
    ? await database.select(columns).from(organizationGroups).where(eq(organizationGroups.isActive, true)).orderBy(organizationGroups.code)
    : await database.select(columns).from(userOrganizationGroupAccess).innerJoin(organizationGroups,
      and(eq(userOrganizationGroupAccess.groupId, organizationGroups.id), eq(organizationGroups.isActive, true)))
      .where(eq(userOrganizationGroupAccess.userId, userId)).orderBy(organizationGroups.code);
  return {organizationAccess: {groupIds: availableGroups.map(g => g.id), isGlobalAdministrator: current.isGlobalAdministrator}, availableGroups};
}
export async function loadGroupAccess(userId: number, database: Pick<NodePgDatabase, 'select'> = db): Promise<GroupAccess> {
  return (await loadOrganizationAccess(userId, database)).organizationAccess;
}
