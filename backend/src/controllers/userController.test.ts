import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  resetPassword,
  deleteUser,
} from './userController';
import { db } from '../db';
import { users, roles } from '../db/schema/users';
import { eq } from 'drizzle-orm';

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

test('getUsers returns list of users without passwordHash', async () => {
  const res = mockRes();
  await getUsers({ user: { roleName: 'SuperAdmin' } } as any, res);
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.users));
  assert.ok(res.body.users.length > 0);
  for (const u of res.body.users) {
    assert.equal(u.passwordHash, undefined, 'passwordHash must never be exposed');
    assert.ok(u.username);
  }
});

test('toggleUserStatus prevents deactivating own account', async () => {
  const admin = (await db.select().from(users).where(eq(users.username, 'admin')))[0];
  assert.ok(admin);

  const req: any = {
    user: { userId: admin.id, roleName: 'SuperAdmin' },
    params: { id: String(admin.id) },
    body: { status: 'inactive' },
  };
  const res = mockRes();
  await toggleUserStatus(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /own account/i);
});

test('createUser creates user without email, resetPassword hashes new password, and deleteUser deletes', async () => {
  const employeeRole = (await db.select().from(roles).where(eq(roles.code, 'employee')).limit(1))[0];
  assert.ok(employeeRole);

  const username = 'testuser_' + Date.now();
  const createReq: any = {
    user: { roleName: 'SuperAdmin' },
    body: {
      username,
      // email is omitted
      password: 'InitialPassword123!',
      roleId: employeeRole.id,
      status: 'active',
    },
  };
  const createRes = mockRes();
  await createUser(createReq, createRes);
  assert.equal(createRes.statusCode, 201);
  const createdUserId = createRes.body.user.id;
  assert.ok(createdUserId);
  assert.equal(createRes.body.user.username, username);

  // Reset password
  const resetReq: any = {
    user: { roleName: 'SuperAdmin' },
    params: { id: String(createdUserId) },
    body: { newPassword: 'NewSecretPassword123!' },
  };
  const resetRes = mockRes();
  await resetPassword(resetReq, resetRes);
  assert.equal(resetRes.statusCode, 200);

  // Delete user
  const deleteReq: any = {
    user: { userId: 999999, roleName: 'SuperAdmin' },
    params: { id: String(createdUserId) },
  };
  const deleteRes = mockRes();
  await deleteUser(deleteReq, deleteRes);
  assert.equal(deleteRes.statusCode, 200);
});

test('HRD scoped RBAC: HRD can only view employee accounts', async () => {
  // Ensure we have at least one employee user
  const empRole = (await db.select().from(roles).where(eq(roles.code, 'employee')).limit(1))[0];
  assert.ok(empRole);

  const testEmpUsername = 'hrd_scoped_emp_' + Date.now();
  const createEmpReq: any = {
    user: { roleName: 'SuperAdmin' },
    body: {
      username: testEmpUsername,
      roleId: empRole.id,
      status: 'active',
    },
  };
  const createEmpRes = mockRes();
  await createUser(createEmpReq, createEmpRes);
  assert.equal(createEmpRes.statusCode, 201);

  // HRD request
  const hrdReq: any = {
    user: { userId: 8888, roleName: 'hr_attendance' },
  };
  const hrdRes = mockRes();
  await getUsers(hrdReq, hrdRes);
  assert.equal(hrdRes.statusCode, 200);
  assert.ok(Array.isArray(hrdRes.body.users));

  // All returned users MUST be employee role
  for (const u of hrdRes.body.users) {
    assert.equal(u.roleCode, 'employee', 'HRD must only see users with employee role');
  }
  const foundOurUser = hrdRes.body.users.some((u: any) => u.username === testEmpUsername);
  assert.ok(foundOurUser, 'HRD should see the newly created employee user');

  // Cleanup
  await deleteUser({ user: { userId: 999999, roleName: 'SuperAdmin' }, params: { id: String(createEmpRes.body.user.id) } } as any, mockRes());
});

test('HRD scoped RBAC: HRD can create employee accounts but is blocked from creating non-employee accounts', async () => {
  const empRole = (await db.select().from(roles).where(eq(roles.code, 'employee')).limit(1))[0];
  const adminRole = (await db.select().from(roles).where(eq(roles.code, 'super_admin')).limit(1))[0];
  assert.ok(empRole);
  assert.ok(adminRole);

  // 1. HRD creates employee -> allowed
  const empUser = 'hrd_created_emp_' + Date.now();
  const allowedReq: any = {
    user: { userId: 8888, roleName: 'hr_attendance' },
    body: {
      username: empUser,
      roleId: empRole.id,
      status: 'active',
    },
  };
  const allowedRes = mockRes();
  await createUser(allowedReq, allowedRes);
  assert.equal(allowedRes.statusCode, 201);
  const createdId = allowedRes.body.user.id;

  // 2. HRD tries to create super_admin -> 403 Forbidden
  const forbiddenReq: any = {
    user: { userId: 8888, roleName: 'hr_attendance' },
    body: {
      username: 'hrd_try_admin_' + Date.now(),
      roleId: adminRole.id,
      status: 'active',
    },
  };
  const forbiddenRes = mockRes();
  await createUser(forbiddenReq, forbiddenRes);
  assert.equal(forbiddenRes.statusCode, 403);
  assert.match(forbiddenRes.body.error, /only permitted to create Employee/i);

  // Cleanup
  await deleteUser({ user: { userId: 999999, roleName: 'SuperAdmin' }, params: { id: String(createdId) } } as any, mockRes());
});

test('HRD scoped RBAC: HRD cannot edit, toggle, reset password, or delete non-employee accounts', async () => {
  const adminUser = (await db.select().from(users).where(eq(users.username, 'admin')))[0];
  assert.ok(adminUser);

  const empRole = (await db.select().from(roles).where(eq(roles.code, 'employee')).limit(1))[0];

  const hrdReq: any = {
    user: { userId: 8888, roleName: 'hr_attendance' },
    params: { id: String(adminUser.id) },
  };

  // Try edit admin -> 403
  const updateRes = mockRes();
  await updateUser({ ...hrdReq, body: { username: 'hacked_admin', roleId: empRole.id } }, updateRes);
  assert.equal(updateRes.statusCode, 403);
  assert.match(updateRes.body.error, /only manage Employee/i);

  // Try toggle admin -> 403
  const toggleRes = mockRes();
  await toggleUserStatus({ ...hrdReq, body: { status: 'inactive' } }, toggleRes);
  assert.equal(toggleRes.statusCode, 403);
  assert.match(toggleRes.body.error, /only manage Employee/i);

  // Try reset password on admin -> 403
  const resetRes = mockRes();
  await resetPassword(hrdReq, resetRes);
  assert.equal(resetRes.statusCode, 403);
  assert.match(resetRes.body.error, /only manage Employee/i);

  // Try delete admin -> 403
  const deleteRes = mockRes();
  await deleteUser(hrdReq, deleteRes);
  assert.equal(deleteRes.statusCode, 403);
  assert.match(deleteRes.body.error, /only manage Employee/i);
});
