import { test } from 'node:test';
import {createHrScopeFixture,ownedFixtureDatabase} from '../testing/hrScopeFixture';
import { mkdtemp, writeFile, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { purgeExpiredAttendancePhotos } from './attendancePhotoStorage';
import assert from 'node:assert/strict';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { createHrAuditTestDatabase } from '../testing/hrAuditDatabase';
import { runMigrations } from '../db/migrate';
import { employees } from '../db/schema/employees';
import { users } from '../db/schema/users';
import { attendanceSelfLogs } from '../db/schema/attendanceSelfLogs';
import { attendanceRecords, attendanceBatches } from '../db/schema/attendance';
import { attendanceFaceProfiles } from '../db/schema/attendanceFaceProfiles';
import { attendanceFaceRequests } from '../db/schema/attendanceFaceRequests';
import { verifyAttendanceRecord as rawVerify, correctMobileAttendance, getMobileAttendanceHistory, getMobileTodaySummary, verifyFaceRequest as rawVerifyFace, recordMobileClock, listPendingVerifications as rawPending, listFaceRequests as rawFaces } from './mobileAttendanceService';
const fixtureScopes=new WeakMap<object,any>();
const verifyAttendanceRecord=(userId:number,input:any,database:any)=>rawVerify(userId,input,database,fixtureScopes.get(database));
const verifyFaceRequest=(userId:number,id:number,status:any,note:string,database:any)=>rawVerifyFace(userId,id,status,note,database,fixtureScopes.get(database));
const listPendingVerifications=(database:any)=>rawPending(database,fixtureScopes.get(database));
const listFaceRequests=(database:any)=>rawFaces(database,fixtureScopes.get(database));

test('mobile approvals preserve original evidence and project only approved scans', async t => {
  const fixture = await createHrAuditTestDatabase();
  t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const ownerDatabase = drizzle(fixture.owner);
  const hr=await createHrScopeFixture(ownerDatabase);
  const database=ownedFixtureDatabase(ownerDatabase,hr.scope,hr.department.id);
  fixtureScopes.set(database,hr.scope);
  const [employee] = await database.insert(employees).values({ employeeCode: 'MOB-01', fullName: 'Mobile Tester' }).returning();
  const [other] = await database.insert(employees).values({ employeeCode: 'MOB-02', fullName: 'Other Tester' }).returning();
  const [user] = await database.insert(users).values({ username: 'mobile-review', passwordHash: 'test-only', employeeId: employee.id }).returning();
  const [otherUser] = await database.insert(users).values({ username: 'mobile-other', passwordHash: 'test-only', employeeId: other.id }).returning();
  await t.test('migration grants runtime access to mobile review tables', async () => {
    const runtime = drizzle(fixture.runtime);
    await runtime.select().from(attendanceSelfLogs);
    await runtime.select().from(attendanceFaceProfiles);
    await runtime.insert(attendanceFaceRequests).values({ employeeId: employee.id, descriptor: '[0.1]', photoUrl: 'runtime-test', status: 'APPROVED' });
  });
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jayapura' }).format(new Date());
  const [entry, exit] = await database.insert(attendanceSelfLogs).values(['IN','OUT'].map((eventType,index) => ({ employeeId: employee.id, userId: user.id, eventType, workDate: date, scanDate: date, scanTime: index ? '17:15' : '08:10', shiftCode: 'OFFICE', shiftCategory: 'OFFICE', timeZone: 'Asia/Jayapura', scheduleIn: '08:00', scheduleOut: '17:00', txHash: `test-${eventType}`, latitude: '-2.53', longitude: '140.72', address: 'Jayapura', occurredAt: new Date(), approvalStatus: 'PENDING' }))).returning();
  await t.test('pending remains visible in mobile and absent from recap', async () => {
    assert.equal((await database.select().from(attendanceRecords)).length, 0);
    const history = await getMobileAttendanceHistory(user.id, 'CURRENT', database as any);
    assert.equal(history.records[0].approvalStatus, 'PENDING');
    assert.equal(history.records[0].events.length, 2);
    const summary = await getMobileTodaySummary(user.id, database as any);
    assert.equal(summary.attendance.checkedIn, true);
    assert.equal(summary.attendance.checkedOut, true);
  });
  await t.test('approving exit first does not count pending entry as a present day', async () => {
    await verifyAttendanceRecord(user.id, { logId: exit.id, status: 'APPROVED' }, database as any);
    assert.equal((await database.select().from(attendanceRecords)).length, 0);
    const summary = await getMobileTodaySummary(user.id, database as any);
    assert.equal(summary.attendance.approvalStatus, 'PENDING');
    assert.doesNotMatch(summary.attendance.approvalNote, /Disetujui/);
  });
  await t.test('rejection requires reason; correction is owner-only and keeps evidence', async () => {
    await assert.rejects(verifyAttendanceRecord(user.id, { logId: entry.id, status: 'REJECTED' }, database as any), /Alasan/);
    await verifyAttendanceRecord(user.id, { logId: entry.id, status: 'REJECTED', note: 'Periksa lokasi' }, database as any);
    await assert.rejects(correctMobileAttendance(otherUser.id, entry.id, 'Bukan milik saya', database as any));
    await correctMobileAttendance(user.id, entry.id, 'Saya bekerja di Jayapura', database as any);
    const [log] = await database.select().from(attendanceSelfLogs).where(eq(attendanceSelfLogs.id, entry.id));
    assert.equal(log.scanTime, '08:10'); assert.equal(log.address, 'Jayapura');
    assert.equal(log.approvalStatus, 'PENDING'); assert.equal(log.reviewHistory[0].status, 'REJECTED');
    assert.equal(log.reviewHistory[1].note, 'Saya bekerja di Jayapura');
    await verifyAttendanceRecord(user.id, { logId: entry.id, status: 'APPROVED' }, database as any);
    const [record] = await database.select().from(attendanceRecords);
    assert.equal(record.scanIn, '08:10'); assert.equal(record.scanOut, '17:15');
    assert.equal(record.lateMinutes, 10); assert.equal(record.overtimeMinutes, 15);
    await assert.rejects(verifyAttendanceRecord(user.id, { logId: entry.id, status: 'APPROVED' }, database as any), /sudah diproses/);
  });
  await t.test('without a face reference clock is rejected before any log is stored', async () => {
    await assert.rejects(recordMobileClock(otherUser.id, { eventType: 'IN', latitude: -6.2, longitude: 106.8, photoBase64: 'invalid' }, database as any), /Wajah belum terdaftar/);
    assert.equal((await database.select().from(attendanceSelfLogs).where(eq(attendanceSelfLogs.employeeId, other.id))).length, 0);
  });
  await t.test('photo replacement is inactive until approved and rejection keeps reference', async () => {
    await database.insert(attendanceFaceProfiles).values({ employeeId: employee.id, samplePhotoUrl: 'old-photo', faceDescriptorHash: '[0.1]' });
    await database.update(employees).set({ photoUrl: 'old-photo' }).where(eq(employees.id, employee.id));
    const [request] = await database.insert(attendanceFaceRequests).values({ employeeId: employee.id, descriptor: '[0.2]', photoUrl: 'new-photo' }).returning();
    const [before] = await database.select().from(employees).where(eq(employees.id, employee.id));
    assert.equal(before.photoUrl, 'old-photo');
    await verifyFaceRequest(user.id, request.id, 'REJECTED', 'Ulangi foto', database as any);
    const [rejected] = await database.select().from(employees).where(eq(employees.id, employee.id));
    assert.equal(rejected.photoUrl, 'old-photo');
    const [next] = await database.insert(attendanceFaceRequests).values({ employeeId: employee.id, descriptor: '[0.3]', photoUrl: 'approved-photo' }).returning();
    await verifyFaceRequest(user.id, next.id, 'APPROVED', '', database as any);
    const [approved] = await database.select().from(employees).where(eq(employees.id, employee.id));
    const [profile] = await database.select().from(attendanceFaceProfiles).where(eq(attendanceFaceProfiles.employeeId, employee.id));
    assert.equal(approved.photoUrl, 'approved-photo'); assert.equal(profile.samplePhotoUrl, 'approved-photo'); assert.equal(profile.faceDescriptorHash, '[0.3]');
  });
  await t.test('unreviewed evidence survives retention until the reviewer can inspect it', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'gajianich-retention-'));
    try {
      const file = path.join(dir, 'pending.webp'); await writeFile(file, 'evidence');
      const [pending] = await database.insert(attendanceSelfLogs).values({ employeeId: employee.id, userId: user.id, eventType: 'IN', workDate: '2026-01-01', scanTime: '08:00', shiftCode: 'OFFICE', shiftCategory: 'OFFICE', txHash: 'retention-test', approvalStatus: 'PENDING', photoUrl: file, createdAt: new Date(Date.now() - 30 * 86400_000) }).returning();
      assert.equal(await purgeExpiredAttendancePhotos(database), 0);
      assert.ok(await stat(file));
      await database.update(attendanceSelfLogs).set({ approvalStatus: 'APPROVED' }).where(eq(attendanceSelfLogs.id, pending.id));
      assert.equal(await purgeExpiredAttendancePhotos(database), 1);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  await t.test('machine absence remains absent in mobile history', async () => {
    const absentDate = date.slice(0,7) + (date.endsWith('-01') ? '-02' : '-01');
    await database.insert(attendanceRecords).values({ employeeId: employee.id, workDate: absentDate, attendanceStatus: 'ALPHA' });
    const history = await getMobileAttendanceHistory(user.id, 'CURRENT', database as any);
    const absent = history.records.find(record => record.workDate === absentDate);
    assert.equal(absent?.status, 'ABSENT'); assert.equal(absent?.statusText, 'Tidak hadir');
  });
  await t.test('machine records compute duration for day and night shifts while invalid or partial stays --', async () => {
    const currentPrefix = date.slice(0,7);
    const dayDate = `${currentPrefix}-10`;
    const nightDate = `${currentPrefix}-11`;
    const partialDate = `${currentPrefix}-12`;
    const invalidDate = `${currentPrefix}-13`;

    await database.insert(attendanceRecords).values([
      { employeeId: employee.id, workDate: dayDate, scanIn: '08:00', rawScanIn: '08:00', scanOut: '17:00', rawScanOut: '17:00', attendanceStatus: 'PRESENT' },
      { employeeId: employee.id, workDate: nightDate, scanIn: '22:00', rawScanIn: '22:00', scanOut: '06:00', rawScanOut: '06:00', scheduleIn: '22:00', scheduleOut: '06:00', attendanceStatus: 'PRESENT' },
      { employeeId: employee.id, workDate: partialDate, scanIn: '08:00', rawScanIn: '08:00', scanOut: null, rawScanOut: null, attendanceStatus: 'PRESENT' },
      { employeeId: employee.id, workDate: invalidDate, scanIn: 'invalid', rawScanIn: 'invalid', scanOut: '99:99', rawScanOut: '99:99', attendanceStatus: 'PRESENT' },
    ]);

    const history = await getMobileAttendanceHistory(user.id, 'CURRENT', database as any);
    const dayRec = history.records.find(r => r.workDate === dayDate);
    const nightRec = history.records.find(r => r.workDate === nightDate);
    const partialRec = history.records.find(r => r.workDate === partialDate);
    const invalidRec = history.records.find(r => r.workDate === invalidDate);

    assert.equal(dayRec?.workHours, '09h 00m');
    assert.equal(dayRec?.approvalStatus, undefined);
    assert.equal(nightRec?.workHours, '08h 00m');
    assert.equal(nightRec?.approvalStatus, undefined);
    assert.equal(partialRec?.workHours, '--');
    assert.equal(invalidRec?.workHours, '--');
  });

  await t.test('summary without logs returns checkedIn false and approvalStatus null', async () => {
    const summary = await getMobileTodaySummary(otherUser.id, database as any);
    assert.equal(summary.attendance.checkedIn, false);
    assert.equal(summary.attendance.checkedOut, false);
    assert.equal(summary.attendance.approvalStatus, null);
    assert.match(summary.attendance.approvalNote, /belum ada/i);
  });

  await t.test('independent machine or imported record blocks mobile IN approval and stays unchanged', async () => {
    const conflictDate = '2026-03-15';
    const [batch] = await database.insert(attendanceBatches).values({ filename: 'machine-import.xlsx' }).returning();
    const [importedRecord] = await database.insert(attendanceRecords).values({
      employeeId: employee.id,
      workDate: conflictDate,
      scanIn: '08:00',
      rawScanIn: '08:00',
      scanOut: '17:00',
      rawScanOut: '17:00',
      scheduleIn: '08:00',
      scheduleOut: '17:00',
      sourceBatchId: batch.id,
      revision: 1,
      attendanceStatus: 'PRESENT',
    }).returning();
    const [pendingInLog] = await database.insert(attendanceSelfLogs).values({
      employeeId: employee.id,
      userId: user.id,
      eventType: 'IN',
      workDate: conflictDate,
      scanDate: conflictDate,
      scanTime: '12:59',
      shiftCode: 'OFFICE',
      shiftCategory: 'OFFICE',
      timeZone: 'Asia/Jayapura',
      scheduleIn: '08:00',
      scheduleOut: '17:00',
      txHash: 'test-conflict-in',
      approvalStatus: 'PENDING',
      occurredAt: new Date(),
    }).returning();

    await assert.rejects(
      verifyAttendanceRecord(user.id, { logId: pendingInLog.id, status: 'APPROVED' }, database as any),
      /konflik/i
    );

    const [logAfter] = await database.select().from(attendanceSelfLogs).where(eq(attendanceSelfLogs.id, pendingInLog.id));
    assert.equal(logAfter.approvalStatus, 'PENDING');

    const [recordAfter] = await database.select().from(attendanceRecords).where(eq(attendanceRecords.id, importedRecord.id));
    assert.equal(recordAfter.scanIn, '08:00');
    assert.equal(recordAfter.rawScanIn, '08:00');
    assert.equal(recordAfter.sourceBatchId, 1);
  });

  await t.test('hybrid linking: machine IN and mobile OUT seamlessly connect on same workDate', async () => {
    const hybridDate = '2026-04-20';
    const [machineRecord] = await database.insert(attendanceRecords).values({
      employeeId: employee.id,
      workDate: hybridDate,
      scanIn: '07:55',
      rawScanIn: '07:55',
      scanOut: null,
      rawScanOut: null,
      scheduleIn: '08:00',
      scheduleOut: '17:00',
      shift: 'OFFICE',
      sourceBatchId: 1,
      attendanceStatus: 'PRESENT',
    }).returning();

    const [mobileOutLog] = await database.insert(attendanceSelfLogs).values({
      employeeId: employee.id,
      userId: user.id,
      eventType: 'OUT',
      workDate: hybridDate,
      scanDate: hybridDate,
      scanTime: '17:10',
      shiftCode: 'OFFICE',
      shiftCategory: 'OFFICE',
      timeZone: 'Asia/Jayapura',
      scheduleIn: '08:00',
      scheduleOut: '17:00',
      txHash: 'test-hybrid-out',
      approvalStatus: 'PENDING',
      occurredAt: new Date(),
    }).returning();

    // Verify mobile OUT approval succeeds without throwing conflict error
    await verifyAttendanceRecord(user.id, { logId: mobileOutLog.id, status: 'APPROVED' }, database as any);

    const [updatedRecord] = await database.select().from(attendanceRecords).where(eq(attendanceRecords.id, machineRecord.id));
    assert.equal(updatedRecord.scanIn, '07:55');
    assert.equal(updatedRecord.scanOut, '17:10');
    assert.equal(updatedRecord.lateMinutes, 0);
    assert.equal(updatedRecord.earlyMinutes, 0);
    assert.equal(updatedRecord.overtimeMinutes, 10);
  });

  await t.test('old pending requests stay visible after more than 500 processed requests', async () => {
    const [pendingLog] = await database.insert(attendanceSelfLogs).values({ employeeId: employee.id, eventType: 'IN', workDate: '2000-01-01', scanTime: '08:00', shiftCode: 'OFFICE', shiftCategory: 'OFFICE', txHash: 'old-pending', approvalStatus: 'PENDING' }).returning();
    const [pendingPhoto] = await database.insert(attendanceFaceRequests).values({ employeeId: employee.id, descriptor: '[0.1]', photoUrl: 'pending-photo' }).returning();
    await database.insert(attendanceSelfLogs).values(Array.from({ length: 501 }, (_,i) => ({ employeeId: employee.id, eventType: 'IN', workDate: '2001-01-01', scanTime: '08:00', shiftCode: 'OFFICE', shiftCategory: 'OFFICE', txHash: `processed-${i}`, approvalStatus: 'APPROVED' })));
    await database.insert(attendanceFaceRequests).values(Array.from({ length: 501 }, () => ({ employeeId: employee.id, descriptor: '[0.1]', photoUrl: 'processed-photo', status: 'APPROVED' })));
    assert.ok((await listPendingVerifications(database as any)).some(log => log.id === pendingLog.id));
    assert.ok((await listFaceRequests(database as any)).some(photo => photo.id === pendingPhoto.id));
  });

});
test('legacy recap readers hide pending scans while preserving stored evidence and independent records', async t => {
  const fixture = await createHrAuditTestDatabase(); t.after(() => fixture.cleanup());
  await runMigrations(fixture.ownerUrl, undefined, fixture.runtimeRole);
  const ownerDatabase = drizzle(fixture.owner);
  const hr=await createHrScopeFixture(ownerDatabase);
  const database=ownedFixtureDatabase(ownerDatabase,hr.scope,hr.department.id);
  fixtureScopes.set(database,hr.scope);
  const { approvedAttendanceRecords } = await import('./approvedAttendanceRecords');
  const { loadAttendanceWorkspace } = await import('./attendanceWorkspace');
  const [employee] = await database.insert(employees).values({ employeeCode: 'LEGACY-01', fullName: 'Legacy Employee' }).returning();
  const [user] = await database.insert(users).values({ username: 'legacy-reviewer', passwordHash: 'test-only' }).returning();
  const now = new Date();
  const [log] = await database.insert(attendanceSelfLogs).values({ employeeId: employee.id, userId: user.id, eventType: 'IN', workDate: '2026-01-01', scanDate: '2026-01-01', scanTime: '08:10', shiftCode: 'OFFICE', shiftCategory: 'OFFICE', scheduleIn: '08:00', scheduleOut: '17:00', txHash: 'legacy-evidence', approvalStatus: 'PENDING', createdAt: now }).returning();
  await database.insert(attendanceRecords).values([{ employeeId: employee.id, workDate: '2026-01-01', scanIn: '08:10', rawScanIn: '08:10', attendanceStatus: 'PRESENT', createdAt: now }, { employeeId: employee.id, workDate: '2026-01-02', scanIn: '08:00', rawScanIn: '08:00', attendanceStatus: 'PRESENT', createdAt: now }]);
  const records = await database.select().from(attendanceRecords);
  const visible = await approvedAttendanceRecords(records, database);
  assert.equal(visible.length, 1); assert.equal(visible[0].workDate, '2026-01-02');
  const workspace = await loadAttendanceWorkspace(database as any, { actor: { id: String(user.id), name: 'Reviewer' } } as any,hr.scope);
  assert.equal(workspace.records.length, 1);
  assert.equal((await database.select().from(attendanceRecords)).length, 2);
  await verifyAttendanceRecord(user.id, { logId: log.id, status: 'REJECTED', note: 'Koreksi keterangan' }, database as any);
  assert.equal((await approvedAttendanceRecords(await database.select().from(attendanceRecords), database)).length, 1);
  await database.update(attendanceSelfLogs).set({ approvalStatus: 'PENDING' }).where(eq(attendanceSelfLogs.id, log.id));
  await verifyAttendanceRecord(user.id, { logId: log.id, status: 'APPROVED' }, database as any);
  assert.equal((await approvedAttendanceRecords(await database.select().from(attendanceRecords), database)).length, 2);
});
