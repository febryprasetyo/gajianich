import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db } from '../db';
import { organizationGroups, userOrganizationGroupAccess, departmentOrganizationMappings } from '../db/schema/organizations';
import { users } from '../db/schema/users';
import { employees } from '../db/schema/employees';
import { loadCurrentIdentity } from './currentIdentity';
import { OrganizationScopeError, type GroupAccess } from '../domain/organizationAccess';
export { resolveRequestScope } from '../domain/organizationAccess';
export type {GroupAccess, RequestScope, ScopeModule} from '../domain/organizationAccess';

export async function loadOrganizationAccess(userId: number, database: Pick<NodePgDatabase, 'select'> = db) {
  const current = await loadCurrentIdentity(userId, database);
  if (!current) throw new OrganizationScopeError('Account unavailable');
  const columns = {id: organizationGroups.id, code: organizationGroups.code, name: organizationGroups.name};
  if (current.isGlobalAdministrator) {
    const availableGroups = await database.select(columns).from(organizationGroups).where(eq(organizationGroups.isActive, true)).orderBy(organizationGroups.code);
    return {organizationAccess: {groupIds: availableGroups.map(g => g.id), isGlobalAdministrator: true}, availableGroups};
  }

  const explicitGroups = await database.select(columns).from(userOrganizationGroupAccess).innerJoin(organizationGroups,
    and(eq(userOrganizationGroupAccess.groupId, organizationGroups.id), eq(organizationGroups.isActive, true)))
    .where(eq(userOrganizationGroupAccess.userId, userId));

  const employeeGroups = await database.select(columns).from(users)
    .innerJoin(employees, eq(users.employeeId, employees.id))
    .innerJoin(departmentOrganizationMappings, eq(employees.departmentId, departmentOrganizationMappings.departmentId))
    .innerJoin(organizationGroups, and(eq(departmentOrganizationMappings.groupId, organizationGroups.id), eq(organizationGroups.isActive, true)))
    .where(eq(users.id, userId));

  const groupMap = new Map<number, {id: number; code: string; name: string}>();
  for (const g of [...explicitGroups, ...employeeGroups]) {
    groupMap.set(g.id, g);
  }
  const availableGroups = Array.from(groupMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  return {organizationAccess: {groupIds: availableGroups.map(g => g.id), isGlobalAdministrator: false}, availableGroups};
}
export async function loadGroupAccess(userId: number, database: Pick<NodePgDatabase, 'select'> = db): Promise<GroupAccess> {
  return (await loadOrganizationAccess(userId, database)).organizationAccess;
}
