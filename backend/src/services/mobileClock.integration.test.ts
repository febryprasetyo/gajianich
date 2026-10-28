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
import { systemSettings } from '../db/schema/system';
import { FACE_DESCRIPTOR_VERSION } from './faceRecognition';
import { localAttendanceTime } from '../domain/attendanceTime';
const photoUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const descriptor = Array(128).fill(0.1);
test('clock validates identity and uses server instant in GPS zone; OUT retains initial zone', async t => {
  const photoDir = await mkdtemp(path.join(os.tmpdir(), 'gajianich-clock-'));
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
  await database.insert(systemSettings).values({ key: 'attendance_mobile_strict_clock', value: 'true' });
  const payload = { eventType: 'IN' as const, latitude: -2.53, longitude: 140.72, photoBase64: photoUrl, workDate: '2000-01-01', scanTime: '00:00' };
  await assert.rejects(recordMobileClock(user.id, payload, database as any, async () => ({ descriptor: Array(128).fill(0.9), photoUrl })), /tidak cocok/);
  assert.equal((await database.select().from(attendanceSelfLogs)).length, 0);
  const input = await recordMobileClock(user.id, payload, database as any, async () => ({ descriptor, photoUrl }));
  assert.equal(input.data.timeZoneLabel, 'WIT'); assert.notEqual(input.data.workDate, '2000-01-01');
  assert.equal(input.data.scanTime, localAttendanceTime(new Date(), 'Asia/Jayapura').scanTime);
  assert.equal(input.data.approvalStatus, 'APPROVED');
  await database.update(attendanceSelfLogs).set({ occurredAt: new Date(Date.now() - 3600000) }).where(eq(attendanceSelfLogs.employeeId, employee.id));
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
  const photoDir = await mkdtemp(path.join(os.tmpdir(), 'gajianich-clock-conflict-'));
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
  const photoDir = await mkdtemp(path.join(os.tmpdir(), 'gajianich-clock-default-review-'));
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

test('Smart Clock Selection: isDirectOut without IN records [DIRECT_OUT] as PENDING', async t => {
  const photoDir = await mkdtemp(path.join(os.tmpdir(), 'gajianich-clock-direct-out-'));
  process.env.ATTENDANCE_PHOTO_DIR = photoDir;
  t.after(() => rm(photoDir, { recursive: true, force: true }));
  const { recordMobileClock, getMobileTodaySummary } = await import('./mobileAttendanceService');
  const fixture = await createHrAuditTestDatabase(); t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const database = drizzle(fixture.owner);
  const [employee] = await database.insert(employees).values({ employeeCode: 'DIRECT-01', fullName: 'Direct Out Tester' }).returning();
  const [user] = await database.insert(users).values({ username: 'direct-tester', passwordHash: 'test-only', employeeId: employee.id }).returning();
  await database.insert(attendanceFaceProfiles).values({ employeeId: employee.id, isEnrolled: true, samplePhotoUrl: photoUrl, faceDescriptorHash: JSON.stringify(descriptor), descriptorVersion: FACE_DESCRIPTOR_VERSION });
  const [shift] = await database.insert(attendanceShifts).values({ code: 'OFFICE-DIR', name: 'Office Direct', scheduleIn: '08:00', scheduleOut: '17:00', autoApproveIn: true, autoApproveOut: true }).returning();
  await database.insert(attendanceShiftAssignments).values({ shiftId: shift.id, employeeId: employee.id });

  // Direct OUT without notes should be rejected
  await assert.rejects(
    recordMobileClock(user.id, { eventType: 'OUT', isDirectOut: true, notes: '', latitude: -6.2, longitude: 106.8, photoBase64: photoUrl }, database as any, async () => ({ descriptor, photoUrl })),
    /Keterangan wajib diisi/i
  );

  // Direct OUT with notes succeeds
  const res = await recordMobileClock(
    user.id,
    { eventType: 'OUT', isDirectOut: true, notes: 'Lupa absen masuk pagi, hadir pukul 08:00', latitude: -6.2, longitude: 106.8, photoBase64: photoUrl },
    database as any,
    async () => ({ descriptor, photoUrl })
  );

  assert.equal(res.data.approvalStatus, 'PENDING');
  assert.match(res.data.notes || '', /\[DIRECT_OUT\]/);

  const logs = await database.select().from(attendanceSelfLogs).where(eq(attendanceSelfLogs.employeeId, employee.id));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].eventType, 'OUT');
  assert.equal(logs[0].approvalStatus, 'PENDING');
  assert.match(logs[0].notes || '', /\[DIRECT_OUT\] Lupa absen masuk pagi, hadir pukul 08:00/);

  // Verify getMobileTodaySummary
  const summary = await getMobileTodaySummary(user.id, database as any);
  assert.equal(summary.attendance.checkedIn, false);
  assert.equal(summary.attendance.checkedOut, true);
  assert.equal(summary.attendance.status, 'COMPLETED');
  assert.ok(summary.attendance.shiftWindow);
});

test('projectApprovedLog: approving DIRECT_OUT projects record with scanIn = null and scanOut set', async t => {
  const photoDir = await mkdtemp(path.join(os.tmpdir(), 'gajianich-clock-approve-dir-'));
  process.env.ATTENDANCE_PHOTO_DIR = photoDir;
  t.after(() => rm(photoDir, { recursive: true, force: true }));
  const { recordMobileClock, verifyAttendanceRecord } = await import('./mobileAttendanceService');
  const fixture = await createHrAuditTestDatabase(); t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const database = drizzle(fixture.owner);
  const [employee] = await database.insert(employees).values({ employeeCode: 'DIR-APP-01', fullName: 'Direct Approve Tester' }).returning();
  const [user] = await database.insert(users).values({ username: 'dir-app-tester', passwordHash: 'test-only', employeeId: employee.id }).returning();
  const [hrUser] = await database.insert(users).values({ username: 'hr-verifier', passwordHash: 'test-only' }).returning();
  await database.insert(attendanceFaceProfiles).values({ employeeId: employee.id, isEnrolled: true, samplePhotoUrl: photoUrl, faceDescriptorHash: JSON.stringify(descriptor), descriptorVersion: FACE_DESCRIPTOR_VERSION });
  const [shift] = await database.insert(attendanceShifts).values({ code: 'OFFICE-APP', name: 'Office App', scheduleIn: '08:00', scheduleOut: '17:00' }).returning();
  await database.insert(attendanceShiftAssignments).values({ shiftId: shift.id, employeeId: employee.id });

  const clockResult = await recordMobileClock(
    user.id,
    { eventType: 'OUT', isDirectOut: true, notes: 'Lupa absen masuk karena meeting pagi', latitude: -6.2088, longitude: 106.8456, photoBase64: photoUrl },
    database as any,
    async () => ({ descriptor, photoUrl })
  );

  // HR approves the direct out
  await verifyAttendanceRecord(hrUser.id, { logId: clockResult.data.id, status: 'APPROVED' }, database as any);

  const [record] = await database.select().from(attendanceRecords).where(eq(attendanceRecords.employeeId, employee.id));
  assert.ok(record, 'attendanceRecords should be created');
  assert.equal(record.scanIn, null);
  assert.equal(record.scanOut, clockResult.data.scanTime);
  assert.equal(record.lateMinutes, 0);
  assert.equal(record.attendanceStatus, 'PRESENT');
});

test('Multi-clocking in default mode: multiple OUT clocks are allowed as PENDING, HR approval picks chosen one', async t => {
  const photoDir = await mkdtemp(path.join(os.tmpdir(), 'gajianich-clock-multi-'));
  process.env.ATTENDANCE_PHOTO_DIR = photoDir;
  t.after(() => rm(photoDir, { recursive: true, force: true }));
  const { recordMobileClock, verifyAttendanceRecord } = await import('./mobileAttendanceService');
  const fixture = await createHrAuditTestDatabase(); t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const database = drizzle(fixture.owner);
  const [employee] = await database.insert(employees).values({ employeeCode: 'MULTI-01', fullName: 'Multi Clock Tester' }).returning();
  const [user] = await database.insert(users).values({ username: 'multi-tester', passwordHash: 'test-only', employeeId: employee.id }).returning();
  const [hrUser] = await database.insert(users).values({ username: 'hr-multi', passwordHash: 'test-only' }).returning();
  await database.insert(attendanceFaceProfiles).values({ employeeId: employee.id, isEnrolled: true, samplePhotoUrl: photoUrl, faceDescriptorHash: JSON.stringify(descriptor), descriptorVersion: FACE_DESCRIPTOR_VERSION });
  const [shift] = await database.insert(attendanceShifts).values({ code: 'OFFICE-MUL', name: 'Office Multi', scheduleIn: '08:00', scheduleOut: '17:00', autoApproveIn: true, autoApproveOut: false }).returning();
  await database.insert(attendanceShiftAssignments).values({ shiftId: shift.id, employeeId: employee.id });

  // 1. Clock IN
  await recordMobileClock(user.id, { eventType: 'IN', latitude: -6.2, longitude: 106.8, photoBase64: photoUrl }, database as any, async () => ({ descriptor, photoUrl }));
  await database.update(attendanceSelfLogs).set({ occurredAt: new Date(Date.now() - 3600000) }).where(eq(attendanceSelfLogs.employeeId, employee.id));

  // 2. First OUT (e.g. at regular time 17:00 - autoApproveOut is false so status is PENDING)
  const out1 = await recordMobileClock(user.id, { eventType: 'OUT', latitude: -6.2, longitude: 106.8, photoBase64: photoUrl }, database as any, async () => ({ descriptor, photoUrl }));
  assert.equal(out1.data.approvalStatus, 'PENDING');

  // 3. Second OUT (e.g. overtime at 19:00 - also recorded as PENDING)
  const out2 = await recordMobileClock(user.id, { eventType: 'OUT', latitude: -6.2, longitude: 106.8, photoBase64: photoUrl }, database as any, async () => ({ descriptor, photoUrl }));
  assert.equal(out2.data.approvalStatus, 'PENDING');

  const logs = await database.select().from(attendanceSelfLogs).where(eq(attendanceSelfLogs.employeeId, employee.id));
  assert.equal(logs.length, 3); // 1 IN + 2 OUT

  // 4. When HR approves the second OUT (out2), projectApprovedLog updates scanOut to out2 time
  await verifyAttendanceRecord(hrUser.id, { logId: out2.data.id, status: 'APPROVED' }, database as any);

  const [record] = await database.select().from(attendanceRecords).where(eq(attendanceRecords.employeeId, employee.id));
  assert.equal(record.scanOut, out2.data.scanTime);
});

test('Multi-clocking with autoApproveOut enabled: multiple OUT clocks are auto-approved and update Last Out immediately', async t => {
  const photoDir = await mkdtemp(path.join(os.tmpdir(), 'gajianich-clock-auto-out-'));
  process.env.ATTENDANCE_PHOTO_DIR = photoDir;
  t.after(() => rm(photoDir, { recursive: true, force: true }));
  const { recordMobileClock } = await import('./mobileAttendanceService');
  const fixture = await createHrAuditTestDatabase(); t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const database = drizzle(fixture.owner);
  const [employee] = await database.insert(employees).values({ employeeCode: 'MULTI-AUTO-01', fullName: 'Multi Auto Tester' }).returning();
  const [user] = await database.insert(users).values({ username: 'multi-auto-tester', passwordHash: 'test-only', employeeId: employee.id }).returning();
  await database.insert(attendanceFaceProfiles).values({ employeeId: employee.id, isEnrolled: true, samplePhotoUrl: photoUrl, faceDescriptorHash: JSON.stringify(descriptor), descriptorVersion: FACE_DESCRIPTOR_VERSION });
  const [shift] = await database.insert(attendanceShifts).values({ code: 'OFFICE-AUTO', name: 'Office Auto', scheduleIn: '08:00', scheduleOut: '17:00', autoApproveIn: true, autoApproveOut: true }).returning();
  await database.insert(attendanceShiftAssignments).values({ shiftId: shift.id, employeeId: employee.id });

  // 1. Clock IN
  await recordMobileClock(user.id, { eventType: 'IN', latitude: -6.2, longitude: 106.8, photoBase64: photoUrl }, database as any, async () => ({ descriptor, photoUrl }));
  await database.update(attendanceSelfLogs).set({ occurredAt: new Date(Date.now() - 3600000) }).where(eq(attendanceSelfLogs.employeeId, employee.id));

  // 2. First OUT
  const out1 = await recordMobileClock(user.id, { eventType: 'OUT', latitude: -6.2, longitude: 106.8, photoBase64: photoUrl }, database as any, async () => ({ descriptor, photoUrl }));
  assert.equal(out1.data.approvalStatus, 'APPROVED');

  // 3. Second OUT (auto-approved and updates Last Out)
  const out2 = await recordMobileClock(user.id, { eventType: 'OUT', latitude: -6.2, longitude: 106.8, photoBase64: photoUrl }, database as any, async () => ({ descriptor, photoUrl }));
  assert.equal(out2.data.approvalStatus, 'APPROVED');

  const [record] = await database.select().from(attendanceRecords).where(eq(attendanceRecords.employeeId, employee.id));
  assert.equal(record.scanOut, out2.data.scanTime);
});
