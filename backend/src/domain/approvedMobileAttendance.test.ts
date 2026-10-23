import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvedMobileRecord } from './approvedMobileAttendance';
import type { attendanceRecords } from '../db/schema/attendance';
import type { attendanceSelfLogs } from '../db/schema/attendanceSelfLogs';
const createdAt = new Date('2026-10-20T01:00:00Z');
const record = { id: 1, employeeId: 1, workDate: '2026-10-20', scanIn: '08:00', scanOut: '17:00', rawScanIn: '08:00', rawScanOut: '17:00', sourceBatchId: null, revision: 1, normalized: false, isDayOff: false, attendanceStatus: 'PRESENT', earlyMinutes: 5, overtimeMinutes: 10, createdAt } as typeof attendanceRecords.$inferSelect;
const entry = { employeeId: 1, workDate: record.workDate, eventType: 'IN', scanTime: '08:00', approvalStatus: 'PENDING', createdAt } as typeof attendanceSelfLogs.$inferSelect;
const exit = { ...entry, eventType: 'OUT', scanTime: '17:00' };
test('legacy mobile pending and rejected scans are excluded without mutating storage', () => {
  assert.equal(approvedMobileRecord(record, [entry,exit]), null);
  assert.equal(approvedMobileRecord(record, [{ ...entry, approvalStatus: 'REJECTED' }]), null);
  const partial = approvedMobileRecord(record, [{ ...entry, approvalStatus: 'APPROVED' }, exit]);
  assert.equal(partial?.scanIn, '08:00'); assert.equal(partial?.scanOut, null);
  assert.equal(partial?.overtimeMinutes, 0); assert.equal(record.scanOut, '17:00');
});
test('imported, corrected, normalized and independently created records are preserved', () => {
  for (const change of [{ sourceBatchId: 1 }, { revision: 2 }, { normalized: true }, { createdAt: new Date('2026-10-19T01:00:00Z') }]) {
    const independent = { ...record, ...change };
    assert.deepEqual(approvedMobileRecord(independent, [entry,exit]), independent);
  }
});
