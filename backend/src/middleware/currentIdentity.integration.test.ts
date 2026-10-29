import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db, closeDatabase } from '../db';
import { users, roles } from '../db/schema/users';
import { organizationGroups, userOrganizationGroupAccess, departmentOrganizationMappings } from '../db/schema/organizations';
import { departments } from '../db/schema/master';
import { employees } from '../db/schema/employees';
import { authenticateToken, requirePermission } from './auth';
import { loadGroupAccess, loadOrganizationAccess } from '../services/organizationScope';
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
  }
});

test('user linked to employee inherits department organization group access without explicit userOrganizationGroupAccess', async () => {
  const [employeeRole] = await db.select().from(roles).where(eq(roles.code, 'employee'));
  assert.ok(employeeRole);
  const stamp = Date.now();
  const [dept] = await db.insert(departments).values({code: `DA_${stamp}`, name: `Dept Auto ${stamp}`}).returning();
  const [group] = await db.insert(organizationGroups).values({code: 'CMC', name: 'CMC'}).onConflictDoUpdate({target: organizationGroups.code, set: {isActive: true}}).returning();
  await db.insert(departmentOrganizationMappings).values({departmentId: dept.id, groupId: group.id, approvalReference: 'test'}).onConflictDoUpdate({target: departmentOrganizationMappings.departmentId, set: {groupId: group.id}});
  const [emp] = await db.insert(employees).values({employeeCode: `EMP_${stamp}`, fullName: 'Test Employee Auto', departmentId: dept.id, status: 'Active'}).returning();
  const [user] = await db.insert(users).values({username: `auto-emp-${stamp}`, passwordHash: 'unused', roleId: employeeRole.id, employeeId: emp.id, status: 'active'}).returning();

  try {
    const access = await loadOrganizationAccess(user.id);
    assert.deepEqual(access.organizationAccess, {groupIds: [group.id], isGlobalAdministrator: false});
    assert.equal(access.availableGroups.length, 1);
    assert.equal(access.availableGroups[0].id, group.id);
  } finally {
    await db.delete(users).where(eq(users.id, user.id));
    await db.delete(employees).where(eq(employees.id, emp.id));
    await db.delete(departmentOrganizationMappings).where(eq(departmentOrganizationMappings.departmentId, dept.id));
    await db.delete(departments).where(eq(departments.id, dept.id));
    await closeDatabase();
  }
});
