import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { createHrAuditTestDatabase } from '../testing/hrAuditDatabase';
import { runMigrations } from '../db/migrate';
import { roles, permissions, rolePermissions, users } from '../db/schema/users';
import { employees } from '../db/schema/employees';
import { attendanceSelfLogs } from '../db/schema/attendanceSelfLogs';
import { attendanceFaceRequests } from '../db/schema/attendanceFaceRequests';
import { generateToken } from '../utils/jwt';
test('mobile API requires dedicated reviewer permission and protects employee evidence', async t => {
  const fixture = await createHrAuditTestDatabase();
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const original = process.env.DATABASE_URL;
  process.env.DATABASE_URL = fixture.ownerUrl;
  const { createApp } = await import('../app');
  const { getPool } = await import('../db');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await getPool().end(); process.env.DATABASE_URL = original; await fixture.cleanup(); });
  const database = drizzle(fixture.owner);
  const {rows:[group]} = await fixture.owner.query("INSERT INTO organization_groups(code,name) VALUES('CMC','CMC') RETURNING id");
  const {rows:[department]} = await fixture.owner.query("INSERT INTO departments(code,name) VALUES('MOBILE-API','Mobile API') RETURNING id");
  await fixture.owner.query("INSERT INTO department_organization_mappings(department_id,group_id,approval_reference) VALUES($1,$2,'test-approved')",[department.id,group.id]);
  const [reviewRole, employeeRole] = await database.insert(roles).values([{ code: 'custom_mobile_reviewer', name: 'Custom Mobile Reviewer' }, { code: 'custom_mobile_employee', name: 'Custom Mobile Employee' }]).returning();
  const [permission] = await database.select().from(permissions).where(eq(permissions.code, 'attendance.mobile.verify'));
  await database.insert(rolePermissions).values({ roleId: reviewRole.id, permissionId: permission.id });
  const [employee, other] = await database.insert(employees).values([{ employeeCode: 'API-01', fullName: 'API Employee', departmentId:Number(department.id) }, { employeeCode: 'API-02', fullName: 'Other API Employee', departmentId:Number(department.id) }]).returning();
  const [owner, reviewer, outsider] = await database.insert(users).values([{ username: 'api-owner', passwordHash: 'test-only', employeeId: employee.id, roleId: employeeRole.id }, { username: 'api-reviewer', passwordHash: 'test-only', roleId: reviewRole.id }, { username: 'api-outsider', passwordHash: 'test-only', employeeId: other.id, roleId: employeeRole.id }]).returning();
  await fixture.owner.query('INSERT INTO user_organization_group_access(user_id,group_id) VALUES($1,$2)',[reviewer.id,group.id]);
  await fixture.owner.query('INSERT INTO user_organization_group_access(user_id,group_id) VALUES($1,$3),($2,$3)',[owner.id,outsider.id,group.id]);
  const token = (user: typeof owner, role: typeof reviewRole) => generateToken({ userId: user.id, roleId: role.id, roleName: role.name, email: null });
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/api/v1/attendance/mobile`;
  const get = (endpoint: string, auth?: string) => fetch(url + endpoint, { headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
  const employeeToken = token(owner, employeeRole); const reviewerToken = token(reviewer, reviewRole);
  for (const endpoint of ['/verifications','/approval-settings','/face-requests','/badge-count']) {
    assert.equal((await get(endpoint)).status, 401);
    assert.equal((await get(endpoint, employeeToken)).status, 403);
    assert.equal((await get(endpoint, reviewerToken)).status, 200);
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gajianich-private-photo-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const photo = path.join(dir, 'photo.webp'); await writeFile(photo, 'test-evidence');
  const [log] = await database.insert(attendanceSelfLogs).values({ groupId:Number(group.id), employeeId: employee.id, eventType: 'IN', workDate: '2026-10-23', scanTime: '08:00', shiftCode: 'OFFICE', shiftCategory: 'OFFICE', txHash: 'api-evidence', photoUrl: photo }).returning();
  assert.equal((await get(`/photos/${log.id}`, employeeToken)).status, 200);
  assert.equal((await get(`/photos/${log.id}`, token(outsider, employeeRole))).status, 403);
  assert.equal((await get(`/photos/${log.id}`, reviewerToken)).status, 200);
  // Test badge-count response format and counts
  const badgeRes = await get('/badge-count', reviewerToken);
  assert.equal(badgeRes.status, 200);
  const badgeBody = await badgeRes.json() as { success: boolean; data: { pendingAttendance: number; pendingPhotos: number; totalPending: number } };
  assert.equal(badgeBody.success, true);
  assert.equal(typeof badgeBody.data.pendingAttendance, 'number');
  assert.equal(typeof badgeBody.data.pendingPhotos, 'number');
  assert.equal(badgeBody.data.totalPending, badgeBody.data.pendingAttendance + badgeBody.data.pendingPhotos);

  // Insert a pending face request and verify counter increments
  await database.insert(attendanceFaceRequests).values({
    groupId:Number(group.id),
    employeeId: employee.id,
    descriptor: '[0.1, 0.2]',
    photoUrl: 'face-evidence',
    status: 'PENDING',
  });
  const updatedBadgeRes = await get('/badge-count', reviewerToken);
  const updatedBadgeBody = await updatedBadgeRes.json() as { success: boolean; data: { pendingAttendance: number; pendingPhotos: number; totalPending: number } };
  assert.equal(updatedBadgeBody.data.pendingPhotos, badgeBody.data.pendingPhotos + 1);
  assert.equal(updatedBadgeBody.data.totalPending, badgeBody.data.totalPending + 1);
});

