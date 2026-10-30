import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OFFICE_SHIFT,
  getWorkingScheduleForDate,
  resolveActiveEmployeeShift,
  resolveEmployeeShift,
} from './attendanceSchedule';
import type { WorkShift, WorkHoursTemplate, ShiftAssignment } from './attendanceTypes';

// Templates
const REGULER_HOURS: WorkHoursTemplate = {
  id: 101,
  name: 'Reguler Produksi',
  scheduleIn: '08:00',
  scheduleOut: '16:00',
  scanInStart: '06:00',
  scanInEnd: '10:30',
  scanOutStart: '14:00',
  scanOutEnd: '20:00',
  lateToleranceMinutes: 5,
  earlyLeaveToleranceMinutes: 5,
  requireCheckIn: true,
  requireCheckOut: true,
  isActive: true,
};

const SABTU_HOURS: WorkHoursTemplate = {
  id: 102,
  name: 'Sabtu Pendek',
  scheduleIn: '08:00',
  scheduleOut: '13:00',
  scanInStart: '06:00',
  scanInEnd: '10:30',
  scanOutStart: '11:00',
  scanOutEnd: '16:00',
  lateToleranceMinutes: 5,
  earlyLeaveToleranceMinutes: 5,
  requireCheckIn: true,
  requireCheckOut: true,
  isActive: true,
};

const MINGGU_HOURS: WorkHoursTemplate = {
  id: 103,
  name: 'Minggu Penuh (Opsional)',
  scheduleIn: '08:00',
  scheduleOut: '16:00',
  scanInStart: '06:00',
  scanInEnd: '10:30',
  scanOutStart: '14:00',
  scanOutEnd: '20:00',
  lateToleranceMinutes: 5,
  earlyLeaveToleranceMinutes: 5,
  requireCheckIn: true,
  requireCheckOut: true,
  isActive: true,
};

const workHoursMap = new Map<number, WorkHoursTemplate>([
  [101, REGULER_HOURS],
  [102, SABTU_HOURS],
  [103, MINGGU_HOURS],
]);

// Shift Produksi: Senin-Jumat (101), Sabtu (102), Minggu (103)
const PRODUCTION_SHIFT: WorkShift = {
  id: 2,
  code: 'PROD_WEEKLY',
  name: 'Shift Produksi Mingguan',
  mondayWorkHoursId: 101,
  tuesdayWorkHoursId: 101,
  wednesdayWorkHoursId: 101,
  thursdayWorkHoursId: 101,
  fridayWorkHoursId: 101,
  saturdayWorkHoursId: 102,
  sundayWorkHoursId: 103,
  isDefault: false,
  isActive: true,
};

test('Senin - Jumat menggunakan template Jam Kerja Reguler (08:00 - 16:00)', () => {
  // 2026-10-26 adalah Senin
  const mondaySchedule = getWorkingScheduleForDate('2026-10-26', PRODUCTION_SHIFT, workHoursMap);
  assert.equal(mondaySchedule.isDayOff, false);
  assert.equal(mondaySchedule.scheduleIn, '08:00');
  assert.equal(mondaySchedule.scheduleOut, '16:00');
  assert.equal(mondaySchedule.scanInStart, '06:00');
  assert.equal(mondaySchedule.scanOutEnd, '20:00');

  // 2026-10-30 adalah Jumat
  const fridaySchedule = getWorkingScheduleForDate('2026-10-30', PRODUCTION_SHIFT, workHoursMap);
  assert.equal(fridaySchedule.isDayOff, false);
  assert.equal(fridaySchedule.scheduleIn, '08:00');
  assert.equal(fridaySchedule.scheduleOut, '16:00');
});

test('Sabtu menggunakan template Jam Kerja Sabtu Pendek (08:00 - 13:00)', () => {
  // 2026-10-31 adalah Sabtu
  const satSchedule = getWorkingScheduleForDate('2026-10-31', PRODUCTION_SHIFT, workHoursMap);
  assert.equal(satSchedule.isDayOff, false);
  assert.equal(satSchedule.scheduleIn, '08:00');
  assert.equal(satSchedule.scheduleOut, '13:00');
  assert.equal(satSchedule.scanOutStart, '11:00');
});

test('Minggu dengan template Jam Kerja: jika ADA TAP dihitung jadwal aktif (08:00 - 16:00)', () => {
  // 2026-11-01 adalah Minggu
  const sunWithTap = getWorkingScheduleForDate('2026-11-01', PRODUCTION_SHIFT, workHoursMap, { hasTapRecord: true });
  assert.equal(sunWithTap.isDayOff, false);
  assert.equal(sunWithTap.isSundayOptional, false);
  assert.equal(sunWithTap.scheduleIn, '08:00');
  assert.equal(sunWithTap.scheduleOut, '16:00');
});

test('Minggu dengan template Jam Kerja: jika TIDAK ADA TAP dihitung LIBUR (isDayOff: true, bukan ALPHA)', () => {
  // 2026-11-01 adalah Minggu
  const sunNoTap = getWorkingScheduleForDate('2026-11-01', PRODUCTION_SHIFT, workHoursMap, { hasTapRecord: false });
  assert.equal(sunNoTap.isDayOff, true);
  assert.equal(sunNoTap.isSundayOptional, true);
  assert.equal(sunNoTap.scheduleIn, '08:00');
});

test('Minggu tanpa template Jam Kerja (null): selalu LIBUR', () => {
  const shiftNoSunday: WorkShift = {
    ...PRODUCTION_SHIFT,
    sundayWorkHoursId: null,
  };
  const sunSchedule = getWorkingScheduleForDate('2026-11-01', shiftNoSunday, workHoursMap, { hasTapRecord: true });
  assert.equal(sunSchedule.isDayOff, true);
});

test('Resolusi Multiple Shift per Departemen: memprioritaskan shift isDefault', () => {
  const shiftA: WorkShift = { id: 10, code: 'DEPT_DEF', name: 'Shift Reguler Dept', isDefault: false, isActive: true };
  const shiftB: WorkShift = { id: 20, code: 'DEPT_ALT', name: 'Shift Lembur Dept', isDefault: false, isActive: true };

  const assignments: ShiftAssignment[] = [
    { id: 1, shiftId: 10, departmentId: 5, isDefault: true },
    { id: 2, shiftId: 20, departmentId: 5, isDefault: false },
  ];

  const employee = { id: 100, departmentId: 5 };
  const resolved = resolveActiveEmployeeShift(employee, [shiftA, shiftB], assignments);
  assert.equal(resolved.shift.id, 10);
  assert.equal(resolved.hasActiveAssignment, true);
});

test('Resolusi Shift: Override karyawan langsung mengalahkan penugasan departemen', () => {
  const shiftDept: WorkShift = { id: 10, code: 'DEPT', name: 'Shift Dept', isDefault: false, isActive: true };
  const shiftPersonal: WorkShift = { id: 30, code: 'PERSONAL', name: 'Shift Khusus Karyawan', isDefault: false, isActive: true };

  const assignments: ShiftAssignment[] = [
    { id: 1, shiftId: 10, departmentId: 5, isDefault: true },
    { id: 2, shiftId: 30, employeeId: 100 },
  ];

  const employee = { id: 100, departmentId: 5 };
  const resolved = resolveEmployeeShift(employee, [shiftDept, shiftPersonal], assignments);
  assert.equal(resolved.id, 30);
});
