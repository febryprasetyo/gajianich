import test from 'node:test';
import assert from 'node:assert/strict';
import { login, changePassword } from './authController';
import { createUser as rawCreateUser, resetPassword as rawResetPassword, deleteUser as rawDeleteUser } from './userController';
import {bindScopedCaller} from '../testing/scopedCaller';
const createUser=bindScopedCaller(rawCreateUser),resetPassword=bindScopedCaller(rawResetPassword),deleteUser=bindScopedCaller(rawDeleteUser);
import { db } from '../db';
import { users, roles } from '../db/schema/users';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

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

test('authController: username login works case-insensitively and returns mustChangePassword', async () => {
  // Test login with default admin
  const req: any = {
    body: {
      username: 'ADMIN', // uppercase test
      password: 'Admin123!',
    },
  };
  const res = mockRes();
  await login(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.username, 'admin');
  assert.equal(typeof res.body.mustChangePassword, 'boolean');
});

test('authController: login fails with wrong username or password', async () => {
  const badUserReq: any = {
    body: {
      username: 'non_existent_user_xyz',
      password: 'SomePassword123!',
    },
  };
  const badUserRes = mockRes();
  await login(badUserReq, badUserRes);
  assert.equal(badUserRes.statusCode, 401);

  const badPassReq: any = {
    body: {
      username: 'admin',
      password: 'WrongPassword!',
    },
  };
  const badPassRes = mockRes();
  await login(badPassReq, badPassRes);
  assert.equal(badPassRes.statusCode, 401);
});

test('authController & userController: full temporary password lifecycle', async () => {
  const role = (await db.select().from(roles).limit(1))[0];
  assert.ok(role);

  const username = `tempuser_${Date.now()}`;
  const email = `${username}@example.com`;

  // 1. Admin creates user without explicit password -> auto-generates temporary password & mustChangePassword=true
  const createReq: any = {
    body: {
      username,
      email,
      roleId: role.id,
      status: 'active',
    },
  };
  const createRes = mockRes();
  await createUser(createReq, createRes);
  assert.equal(createRes.statusCode, 201);
  assert.ok(createRes.body.temporaryPassword, 'temporaryPassword must be returned to admin');
  assert.ok(createRes.body.temporaryPassword.length >= 8);

  const createdUserId = createRes.body.user.id;
  const tempPass = createRes.body.temporaryPassword;

  // 2. User logs in with temporary password -> succeeds and indicates mustChangePassword: true
  const loginReq: any = {
    body: {
      username,
      password: tempPass,
    },
  };
  const loginRes = mockRes();
  await login(loginReq, loginRes);
  assert.equal(loginRes.statusCode, 200);
  assert.equal(loginRes.body.mustChangePassword, true);
  const token = loginRes.body.token;

  // 3. User attempts to change password with weak password (violates policy) -> 400
  const weakReq: any = {
    user: { userId: createdUserId, username, roleId: role.id, roleName: role.name },
    body: {
      newPassword: 'weak',
      confirmPassword: 'weak',
    },
  };
  const weakRes = mockRes();
  await changePassword(weakReq, weakRes);
  assert.equal(weakRes.statusCode, 400);

  // 4. User changes password with strong password matching policy -> 200 and mustChangePassword=false
  const strongReq: any = {
    user: { userId: createdUserId, username, roleId: role.id, roleName: role.name },
    body: {
      newPassword: 'Perm@nentPassword99!',
      confirmPassword: 'Perm@nentPassword99!',
    },
  };
  const strongRes = mockRes();
  await changePassword(strongReq, strongRes);
  assert.equal(strongRes.statusCode, 200);
  assert.equal(strongRes.body.mustChangePassword, false);

  // 5. Subsequent login with new permanent password -> mustChangePassword is false
  const permanentLoginReq: any = {
    body: {
      username,
      password: 'Perm@nentPassword99!',
    },
  };
  const permanentLoginRes = mockRes();
  await login(permanentLoginReq, permanentLoginRes);
  assert.equal(permanentLoginRes.statusCode, 200);
  assert.equal(permanentLoginRes.body.mustChangePassword, false);

  // 6. Admin resets user password -> auto-generates new temporary password & resets mustChangePassword=true
  const resetReq: any = {
    params: { id: String(createdUserId) },
    body: {},
  };
  const resetRes = mockRes();
  await resetPassword(resetReq, resetRes);
  assert.equal(resetRes.statusCode, 200);
  assert.ok(resetRes.body.temporaryPassword);
  const newTempPass = resetRes.body.temporaryPassword;

  // 7. Login with new temporary password -> mustChangePassword is true again!
  const secondTempLoginReq: any = {
    body: {
      username,
      password: newTempPass,
    },
  };
  const secondTempLoginRes = mockRes();
  await login(secondTempLoginReq, secondTempLoginRes);
  assert.equal(secondTempLoginRes.statusCode, 200);
  assert.equal(secondTempLoginRes.body.mustChangePassword, true);

  // Clean up
  const deleteReq: any = {
    user: { userId: 999999 },
    params: { id: String(createdUserId) },
  };
  const deleteRes = mockRes();
  await deleteUser(deleteReq, deleteRes);
  assert.equal(deleteRes.statusCode, 200);
});
