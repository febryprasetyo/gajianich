import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { createHrAuditTestDatabase } from '../testing/hrAuditDatabase';
import { runMigrations } from '../db/migrate';
import { employees } from '../db/schema/employees';
import { users } from '../db/schema/users';
import { attendanceFaceProfiles } from '../db/schema/attendanceFaceProfiles';
import { attendanceSelfLogs } from '../db/schema/attendanceSelfLogs';
import { attendanceRecords, attendanceBatches } from '../db/schema/attendance';
import { attendanceShifts, attendanceShiftAssignments } from '../db/schema/attendanceWorkspace';
import { FACE_DESCRIPTOR_VERSION } from './faceRecognition';
import { localAttendanceTime } from '../domain/attendanceTime';
const photoUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const descriptor = Array(128).fill(0.1);
test('clock validates identity and uses server instant in GPS zone; OUT retains initial zone', async t => {
  const photoDir = await mkdtemp(path.join(os.tmpdir(), 'ams-clock-'));
  process.env.ATTENDANCE_PHOTO_DIR = photoDir;
  t.after(() => rm(photoDir, { recursive: true, force: true }));
  const { recordMobileClock } = await import('./mobileAttendanceService');
  const fixture = await createHrAuditTestDatabase(); t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const database = drizzle(fixture.owner);
  const [employee] = await database.insert(employees).values({ employeeCode: 'CLOCK-01', fullName: 'Clock Tester' }).returning();
  const [user] = await database.insert(users).values({ username: 'clock-tester', passwordHash: 'test-only', employeeId: employee.id }).returning();
  await database.insert(attendanceFaceProfiles).values({ employeeId: employee.id, isEnrolled: true, samplePhotoUrl: photoUrl, faceDescriptorHash: JSON.stringify(descriptor), descriptorVersion: FACE_DESCRIPTOR_VERSION });
  const [shift] = await database.insert(attendanceShifts).values({ code: 'CLOCK', name: 'Clock Shift', scheduleIn: '08:00', scheduleOut: '17:00', autoApproveIn: true, autoApproveOut: true }).returning();
  await database.insert(attendanceShiftAssignments).values({ shiftId: shift.id, employeeId: employee.id });
  const payload = { eventType: 'IN' as const, latitude: -2.53, longitude: 140.72, photoBase64: photoUrl, workDate: '2000-01-01', scanTime: '00:00' };
  await assert.rejects(recordMobileClock(user.id, payload, database as any, async () => ({ descriptor: Array(128).fill(0.9), photoUrl })), /tidak cocok/);
  assert.equal((await database.select().from(attendanceSelfLogs)).length, 0);
  const input = await recordMobileClock(user.id, payload, database as any, async () => ({ descriptor, photoUrl }));
  assert.equal(input.data.timeZoneLabel, 'WIT'); assert.notEqual(input.data.workDate, '2000-01-01');
  assert.equal(input.data.scanTime, localAttendanceTime(new Date(), 'Asia/Jayapura').scanTime);
  assert.equal(input.data.approvalStatus, 'APPROVED');
  const attempts = await Promise.allSettled([1,2].map(() => recordMobileClock(user.id, { ...payload, eventType: 'OUT', latitude: -8.65, longitude: 115.22 }, database as any, async () => ({ descriptor, photoUrl }))));
  assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
  const logs = await database.select().from(attendanceSelfLogs);
  assert.equal(logs.length, 2); assert.ok(logs.every(log => log.timeZone === 'Asia/Jayapura'));
  const [record] = await database.select().from(attendanceRecords).where(eq(attendanceRecords.employeeId, employee.id));
  assert.equal(record.scanIn, input.data.scanTime);
});
test('first enrollment activates profile; subsequent changes await HRD', async t => {
  const fixture = await createHrAuditTestDatabase(); t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const database = drizzle(fixture.owner);
  const { updateFaceEnrollment, getFaceProfile } = await import('./mobileAttendanceService');
  const [employee] = await database.insert(employees).values({ employeeCode: 'FACE-01', fullName: 'Face Tester' }).returning();
  const [user] = await database.insert(users).values({ username: 'face-tester', passwordHash: 'test-only', employeeId: employee.id }).returning();
  await database.insert(attendanceFaceProfiles).values({ employeeId: employee.id, isEnrolled: false });
  const first = await updateFaceEnrollment(user.id, { samplePhotoBase64: photoUrl }, database as any, async () => ({ descriptor, photoUrl }));
  assert.equal(first.changeStatus, null); assert.equal(first.isEnrolled, true);
  const [employeePhoto] = await database.select().from(employees).where(eq(employees.id, employee.id));
  assert.equal(employeePhoto.photoUrl, photoUrl);
  const next = await updateFaceEnrollment(user.id, { samplePhotoBase64: photoUrl }, database as any, async () => ({ descriptor: Array(128).fill(0.2), photoUrl: 'new-photo' }));
  assert.equal(next.changeStatus, 'PENDING');
  const profile = await getFaceProfile(user.id, database as any);
  assert.equal(profile.data.samplePhotoUrl, photoUrl); assert.equal(profile.data.changeStatus, 'PENDING');
  await assert.rejects(updateFaceEnrollment(user.id, { isEnrolled: false }, database as any), /tidak dapat dinonaktifkan/);
  await assert.rejects(updateFaceEnrollment(user.id, { samplePhotoBase64: photoUrl }, database as any, async () => ({ descriptor, photoUrl })), /masih menunggu/);
});

test('clock IN is rejected directly when independent IN record already exists', async t => {
  const photoDir = await mkdtemp(path.join(os.tmpdir(), 'ams-clock-conflict-'));
  process.env.ATTENDANCE_PHOTO_DIR = photoDir;
  t.after(() => rm(photoDir, { recursive: true, force: true }));
  const { recordMobileClock } = await import('./mobileAttendanceService');
  const fixture = await createHrAuditTestDatabase(); t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const database = drizzle(fixture.owner);
  const [employee] = await database.insert(employees).values({ employeeCode: 'CLOCK-INDEP', fullName: 'Indep Tester' }).returning();
  const [user] = await database.insert(users).values({ username: 'clock-indep', passwordHash: 'test-only', employeeId: employee.id }).returning();
  await database.insert(attendanceFaceProfiles).values({ employeeId: employee.id, isEnrolled: true, samplePhotoUrl: photoUrl, faceDescriptorHash: JSON.stringify(descriptor), descriptorVersion: FACE_DESCRIPTOR_VERSION });
  const [shift] = await database.insert(attendanceShifts).values({ code: 'OFFICE', name: 'Office Shift', scheduleIn: '08:00', scheduleOut: '17:00', autoApproveIn: true, autoApproveOut: true }).returning();
  await database.insert(attendanceShiftAssignments).values({ shiftId: shift.id, employeeId: employee.id });

  const todayDate = localAttendanceTime(new Date(), 'Asia/Jakarta').workDate;
  const [batch] = await database.insert(attendanceBatches).values({ filename: 'machine-import.xlsx' }).returning();
  await database.insert(attendanceRecords).values({
    employeeId: employee.id,
    workDate: todayDate,
    scanIn: '08:00',
    rawScanIn: '08:00',
    sourceBatchId: batch.id,
    attendanceStatus: 'PRESENT',
  });

  const payload = { eventType: 'IN' as const, latitude: -6.2, longitude: 106.8, photoBase64: photoUrl };
  await assert.rejects(
    recordMobileClock(user.id, payload, database as any, async () => ({ descriptor, photoUrl })),
    /presensi masuk sudah tercatat/i
  );

  const logs = await database.select().from(attendanceSelfLogs).where(eq(attendanceSelfLogs.employeeId, employee.id));
  assert.equal(logs.length, 0);

  const { readdir } = await import('node:fs/promises');
  const files = await readdir(photoDir);
  assert.equal(files.length, 0);
});

test('unassigned employee remains PENDING even if default shift has autoApprove enabled', async t => {
  const photoDir = await mkdtemp(path.join(os.tmpdir(), 'ams-clock-default-review-'));
  process.env.ATTENDANCE_PHOTO_DIR = photoDir;
  t.after(() => rm(photoDir, { recursive: true, force: true }));
  const { recordMobileClock } = await import('./mobileAttendanceService');
  const fixture = await createHrAuditTestDatabase(); t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const database = drizzle(fixture.owner);
  const [employee] = await database.insert(employees).values({ employeeCode: 'UNASSIGNED-01', fullName: 'Unassigned Tester' }).returning();
  const [user] = await database.insert(users).values({ username: 'unassigned-tester', passwordHash: 'test-only', employeeId: employee.id }).returning();
  await database.insert(attendanceFaceProfiles).values({ employeeId: employee.id, isEnrolled: true, samplePhotoUrl: photoUrl, faceDescriptorHash: JSON.stringify(descriptor), descriptorVersion: FACE_DESCRIPTOR_VERSION });
  // Default shift has autoApproveIn: true and autoApproveOut: true
  await database.insert(attendanceShifts).values({ code: 'DEF-AUTO', name: 'Default Auto Shift', scheduleIn: '08:00', scheduleOut: '17:00', isDefault: true, autoApproveIn: true, autoApproveOut: true });

  const payload = { eventType: 'IN' as const, latitude: -6.2, longitude: 106.8, photoBase64: photoUrl };
  const res = await recordMobileClock(user.id, payload, database as any, async () => ({ descriptor, photoUrl }));
  assert.equal(res.data.approvalStatus, 'PENDING');
  assert.match(res.data.approvalNote, /menunggu/i);
});
