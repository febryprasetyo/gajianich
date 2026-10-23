import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localAttendanceTime, zoneAtLocation, attendanceMetrics } from './attendanceTime';
test('GPS resolves WIB WITA WIT without browser timezone', () => {
  assert.equal(zoneAtLocation(-6.2, 106.8), 'Asia/Jakarta');
  assert.equal(zoneAtLocation(-8.65, 115.22), 'Asia/Makassar');
  assert.equal(zoneAtLocation(-2.53, 140.72), 'Asia/Jayapura');
  assert.throws(() => zoneAtLocation(null, null));
});
test('same instant has local shift time and correct date', () => {
  const now = new Date('2026-10-22T16:30:00Z');
  assert.equal(localAttendanceTime(now, 'Asia/Jakarta').workDate, '2026-10-22');
  assert.equal(localAttendanceTime(now, 'Asia/Makassar').workDate, '2026-10-23');
  assert.equal(localAttendanceTime(now, 'Asia/Jayapura').scanTime, '01:30');
});
test('night shift calculates next-day early departure and overtime', () => {
  assert.deepEqual(attendanceMetrics('22:00', '06:00', '22:10', '05:45', 1), { lateMinutes: 10, earlyMinutes: 15, overtimeMinutes: 0 });
  assert.equal(attendanceMetrics('22:00', '06:00', '22:00', '06:30', 1).overtimeMinutes, 30);
});
test('zone boundaries follow Indonesian regions rather than longitude strips', () => {
  for (const [latitude,longitude] of [[-7.2575,112.7521],[-6.9667,110.4167],[-7.7956,110.3695],[-2.21,113.92]]) {
    assert.ok(['Asia/Jakarta','Asia/Pontianak'].includes(zoneAtLocation(latitude, longitude)));
  }
});
