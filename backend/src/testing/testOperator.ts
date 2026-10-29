import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs } from '../db/schema/system';
import { users, roles } from '../db/schema/users';
import { generateToken } from '../utils/jwt';
import {organizationGroups,departmentOrganizationMappings,locationOrganizationMappings,userOrganizationGroupAccess} from '../db/schema/organizations';
import {departments,locations} from '../db/schema/master';

/** Each integration test owns its operator; no seeded user IDs are required. */
export async function createTestOperator() {
  const suffix = randomUUID();
  await db.insert(organizationGroups).values({code:'CMC',name:'CMC'}).onConflictDoNothing();
  const [group]=await db.select().from(organizationGroups).where(eq(organizationGroups.code,'CMC'));
  const [location]=await db.insert(locations).values({code:`T-${suffix.slice(0,12)}`,name:`Facility ${suffix}`}).returning();
  const [department]=await db.insert(departments).values({code:`T-${suffix.slice(0,12)}`,name:`Department ${suffix}`}).returning();
  await db.insert(locationOrganizationMappings).values({locationId:location.id,groupId:group.id,approvalReference:'Disposable test fixture'});
  await db.insert(departmentOrganizationMappings).values({departmentId:department.id,groupId:group.id,approvalReference:'Disposable test fixture'});
  const [user] = await db.insert(users).values({
    username: `test-operator-${suffix}`,
    email: `test-operator-${suffix}@example.test`,
    passwordHash: 'test-fixture-no-password-login',
    role: 'SuperAdmin',
  }).returning();
  const identities = new Map([['SuperAdmin', user]]);
  for (const name of ['Employee', 'ITAdmin', 'ITStaff']) {
    const [role] = await db.select().from(roles).where(eq(roles.name, name));
    const [identity] = await db.insert(users).values({
      username: `test-${name}-${suffix}`, passwordHash: 'test-fixture-no-password-login',
      role: name, roleId: role?.id ?? null,
    }).returning();
    identities.set(name, identity);
  }
  await db.insert(userOrganizationGroupAccess).values([...identities.values()].map(identity=>({userId:identity.id,groupId:group.id})));

  return {
    userId: user.id,
    groupId:group.id,locationId:location.id,locationCode:location.code,departmentId:department.id,
    scope:{module:'assets' as const,groupIds:[group.id],selectedGroupId:group.id,includeUnmapped:false},
    headers(token?:string){return {Authorization:`Bearer ${token??generateToken({userId:user.id,roleId:0,roleName:'SuperAdmin'})}`,'X-Organization-Group-Id':String(group.id)};},
    userIdForRole(roleName: string) { return identities.get(roleName)!.id; },
    email: user.email || "",
    token(roleName = 'SuperAdmin') {
      const identity = identities.get(roleName);
      if (!identity) throw new Error(`Missing test identity for ${roleName}`);
      return generateToken({ userId: identity.id, email: identity.email, roleId: identity.roleId ?? 0, roleName });
    },
    // Delete this test's assets/history/custodians before its operator.
    async cleanup() {
      await db.transaction(async tx => {
        const ids = [...identities.values()].map(identity => identity.id);
        await tx.delete(auditLogs).where(inArray(auditLogs.userId, ids));
        await tx.delete(users).where(inArray(users.id, ids));
      });
    },
  };
}
