import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db, closeDatabase } from '../db';
import { users, roles } from '../db/schema/users';
import { organizationGroups, userOrganizationGroupAccess } from '../db/schema/organizations';
import { authenticateToken, requirePermission } from './auth';
import { loadGroupAccess } from '../services/organizationScope';
import { generateToken } from '../utils/jwt';

test('current database identity overrides stale JWT privileges, status and membership', async () => {
  const [employeeRole] = await db.select().from(roles).where(eq(roles.code, 'employee'));
  assert.ok(employeeRole);
  const [user] = await db.insert(users).values({username: `scope-auth-${Date.now()}`, passwordHash: 'unused', role: 'SuperAdmin', roleId: employeeRole.id}).returning();
  const token = generateToken({userId: user.id, roleId: 1, roleName: 'SuperAdmin', mustChangePassword: false});
  async function invoke(path = '/api/v1/employees') {
    let nextCalled = false;
    const req: any = {headers: {authorization: `Bearer ${token}`}, originalUrl: path, method: 'GET'};
    const res: any = {statusCode: 200, status(code: number) {this.statusCode=code;return this;}, json(body: unknown) {this.body=body;return this;}};
    await authenticateToken(req, res, () => {nextCalled = true;});
    return {req, res, nextCalled};
  }
  try {
    let result = await invoke();
    assert.equal(result.nextCalled, true);
    assert.equal(result.req.user.roleName, employeeRole.name, 'token role is not authoritative');
    let permission = false;
    await requirePermission('attendance.manage')(result.req, result.res, () => {permission=true;});
    assert.equal(permission, false, 'forged SuperAdmin cannot grant HR');
    assert.deepEqual(await loadGroupAccess(user.id), {groupIds: [], isGlobalAdministrator: false}, 'no employee link grants no global access');
    const [group] = await db.insert(organizationGroups).values({code: 'CMC', name: 'CMC'}).onConflictDoUpdate({target: organizationGroups.code, set: {isActive: true}}).returning();
    await db.insert(userOrganizationGroupAccess).values({userId: user.id, groupId: group.id});
    assert.deepEqual((await loadGroupAccess(user.id)).groupIds, [group.id]);
    await db.delete(userOrganizationGroupAccess).where(eq(userOrganizationGroupAccess.userId, user.id));
    assert.deepEqual((await loadGroupAccess(user.id)).groupIds, []);
    await db.update(users).set({mustChangePassword: true}).where(eq(users.id,user.id));
    assert.equal((await invoke()).res.statusCode, 403, 'password reset takes effect despite old JWT');
    assert.equal((await invoke('/api/v1/auth/me')).nextCalled, true);
    await db.update(users).set({status: 'inactive'}).where(eq(users.id,user.id));
    assert.equal((await invoke('/api/v1/auth/me')).nextCalled, false);
    await assert.rejects(loadGroupAccess(user.id));
  } finally {
    await db.delete(userOrganizationGroupAccess).where(eq(userOrganizationGroupAccess.userId,user.id));
    await db.delete(users).where(eq(users.id,user.id));
    await closeDatabase();
  }
});
