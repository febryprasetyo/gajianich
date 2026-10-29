import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { authenticateToken } from './auth';
import { generateToken } from '../utils/jwt';
import { db, closeDatabase } from '../db';
import { users } from '../db/schema/users';

test('current password requirement confines initial account to account and password endpoints', async () => {
  const [user] = await db.insert(users).values({username: `initial-password-${Date.now()}`, passwordHash: 'unused', mustChangePassword: true, role: 'Employee'}).returning();
  const token = generateToken({userId: user.id, roleId: 0, roleName: 'Employee', mustChangePassword: false});
  async function invoke(path: string, method: string) {
    let nextCalled = false, status = 0;
    const req: any = {headers: {authorization: `Bearer ${token}`}, originalUrl: path, method};
    const res: any = {status(code: number) {status=code;return this;}, json() {return this;}};
    await authenticateToken(req, res, () => {nextCalled=true;});
    return {nextCalled, status};
  }
  try {
    assert.deepEqual(await invoke('/api/v1/employees', 'GET'), {nextCalled: false, status: 403});
    assert.equal((await invoke('/api/v1/auth/me','GET')).nextCalled, true);
    assert.equal((await invoke('/api/v1/auth/change-password','POST')).nextCalled, true);
    await db.update(users).set({mustChangePassword: false}).where(eq(users.id,user.id));
    assert.equal((await invoke('/api/v1/employees','GET')).nextCalled, true);
  } finally {
    await db.delete(users).where(eq(users.id,user.id));
    await closeDatabase();
  }
});
