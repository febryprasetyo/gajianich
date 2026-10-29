import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTalentaKpi, filterTalentaRows,
  formatTalentaDate,
  formatTalentaRow,
} from './talentaCard.ts';

test('formatTalentaDate formats ISO date to Wed, 23 Sep 2026 style', () => {
  assert.equal(formatTalentaDate('2026-09-23'), 'Wed, 23 Sep 2026');
  assert.equal(formatTalentaDate('2026-09-26'), 'Sat, 26 Sep 2026');
  assert.equal(formatTalentaDate('2026-09-27'), 'Sun, 27 Sep 2026');
});

test('formatTalentaRow correctly formats normal work day and dayoff rows', () => {
  // 1. Day off row
  const dayOffRow = {
    date: '2026-09-26',
    dayName: 'Sabtu',
    dayOfWeek: 6,
    isDayOff: true,
    shiftName: 'Office Standar (5 Hari)',
    scheduleIn: '00:00',
    scheduleOut: '00:00',
    record: null,
  };
  const formattedDayOff = formatTalentaRow(dayOffRow);
  assert.equal(formattedDayOff.dateDisplay, 'Sat, 26 Sep 2026');
  assert.equal(formattedDayOff.shiftCode, 'dayoff');
  assert.equal(formattedDayOff.isDayOff, true);
  assert.equal(formattedDayOff.scheduleIn, '00:00');
  assert.equal(formattedDayOff.scheduleOut, '00:00');
  assert.equal(formattedDayOff.clockIn, '-');
  assert.equal(formattedDayOff.clockOut, '-');
  assert.equal(formattedDayOff.attendanceCode, '-');
  assert.equal(formattedDayOff.timeOffCode, '-');
  assert.equal(formattedDayOff.overtime, '-');

  // 2. Normal working day with attendance
  const workDayRow = {
    date: '2026-09-23',
    dayName: 'Rabu',
    dayOfWeek: 3,
    isDayOff: false,
    shiftName: 'Office Standar (5 Hari)',
    scheduleIn: '08:00',
    scheduleOut: '17:00',
    record: {
      id: 101,
      employeeId: 1,
      workDate: '2026-09-23',
      scanIn: '08:05',
      scanOut: '17:15',
      lateMinutes: 5,
      earlyMinutes: 0,
      overtimeMinutes: 90,
      attendanceStatus: 'PRESENT',
      revision: 1,
    },
  };
  const formattedWorkDay = formatTalentaRow(workDayRow);
  assert.equal(formattedWorkDay.dateDisplay, 'Wed, 23 Sep 2026');
  assert.equal(formattedWorkDay.shiftCode, 'O');
  assert.equal(formattedWorkDay.isDayOff, false);
  assert.equal(formattedWorkDay.scheduleIn, '08:00');
  assert.equal(formattedWorkDay.scheduleOut, '17:00');
  assert.equal(formattedWorkDay.clockIn, '08:05');
  assert.equal(formattedWorkDay.clockOut, '17:15');
  assert.equal(formattedWorkDay.attendanceCode, 'H');
  assert.equal(formattedWorkDay.timeOffCode, '-');
  assert.equal(formattedWorkDay.late, '00:05');
  assert.equal(formattedWorkDay.overtime, '01:30');

  // 3. Sick day (Sakit)
  const sickRow = {
    date: '2026-09-24',
    dayName: 'Kamis',
    dayOfWeek: 4,
    isDayOff: false,
    shiftName: 'Office Standar (5 Hari)',
    scheduleIn: '08:00',
    scheduleOut: '17:00',
    record: {
      id: 102,
      employeeId: 1,
      workDate: '2026-09-24',
      scanIn: null,
      scanOut: null,
      lateMinutes: 0,
      earlyMinutes: 0,
      overtimeMinutes: 0,
      attendanceStatus: 'SAKIT',
      revision: 1,
    },
  };
  const formattedSick = formatTalentaRow(sickRow);
  assert.equal(formattedSick.attendanceCode, 'S');
  assert.equal(formattedSick.timeOffCode, 'S');
});

test('formatTalentaRow displays dinas luar as a worked day with DL code', () => {
  const formatted = formatTalentaRow({
    date: '2026-09-23',
    dayName: 'Rabu',
    dayOfWeek: 3,
    isDayOff: false,
    shiftName: 'Office',
    scheduleIn: '08:00',
    scheduleOut: '17:00',
    record: {
      id: 201,
      employeeId: 1,
      workDate: '2026-09-23',
      scanIn: '08:00',
      scanOut: '17:00',
      lateMinutes: 20,
      earlyMinutes: 0,
      overtimeMinutes: 20,
      attendanceStatus: 'DINAS_LUAR',
      revision: 1,
    },
  });
  assert.equal(formatted.attendanceCode, 'DL');
  assert.equal(formatted.clockIn, '08:00');
  assert.equal(formatted.clockOut, '17:00');
  assert.equal(formatted.late, '-');
  assert.equal(formatted.overtime, '-');
});

test('calculateTalentaKpi calculates accurate 3-segment KPI stats', () => {
  const rows = [
    // Past dayoff (Sat, Sun) -> 2 days off
    { date: '2026-09-20', isDayOff: true, record: null },
    { date: '2026-09-21', isDayOff: false, record: { attendanceStatus: 'PRESENT', scanIn: '08:00', scanOut: '16:30', earlyMinutes: 30, lateMinutes: 0 } }, // Early clock out
    { date: '2026-09-22', isDayOff: false, record: { attendanceStatus: 'PRESENT', scanIn: '08:00', scanOut: null, earlyMinutes: 0, lateMinutes: 0 } }, // No clock out
    { date: '2026-09-23', isDayOff: false, record: { attendanceStatus: 'PRESENT', scanIn: null, scanOut: '17:00', earlyMinutes: 0, lateMinutes: 0 } }, // No clock in
    { date: '2026-09-24', isDayOff: false, record: { attendanceStatus: 'SAKIT', scanIn: null, scanOut: null, earlyMinutes: 0, lateMinutes: 0 } }, // Time off (Sakit)
    { date: '2026-09-25', isDayOff: false, record: null }, // Past unrecorded -> Absent
    { date: '2026-09-26', isDayOff: true, record: null }, // Day off
    // Future days (relative to 2026-09-26)
    { date: '2026-09-27', isDayOff: true, record: null }, // Future dayoff
    { date: '2026-09-28', isDayOff: false, record: null }, // Future workday (next workday)
    { date: '2026-09-29', isDayOff: false, record: null }, // Future workday (next workday)
  ];

  const todayStr = '2026-09-26';
  const kpi = calculateTalentaKpi(rows, todayStr);

  // Segment 1
  assert.equal(kpi.earlyClockOut, 1);
  assert.equal(kpi.noClockOut, 1);
  assert.equal(kpi.noClockIn, 1);
  assert.equal(kpi.invalid, 0);

  // Segment 2
  assert.equal(kpi.absent, 1); // unrecorded past work day
  assert.equal(kpi.dayOff, 3); // 4 total dayoffs in period
  assert.equal(kpi.timeOff, 1); // 1 SAKIT

  // Segment 3
  assert.equal(kpi.nextWorkdays, 2); // 28th and 29th
});

test('filterTalentaRows correctly filters rows based on selected KPI metric', () => {
  const rows = [
    { date: '2026-09-20', isDayOff: true, record: null },
    { date: '2026-09-21', isDayOff: false, record: { attendanceStatus: 'PRESENT', scanIn: '08:00', scanOut: '16:30', earlyMinutes: 30, lateMinutes: 0 } },
    { date: '2026-09-22', isDayOff: false, record: { attendanceStatus: 'PRESENT', scanIn: '08:00', scanOut: null, earlyMinutes: 0, lateMinutes: 0 } },
    { date: '2026-09-24', isDayOff: false, record: { attendanceStatus: 'SAKIT', scanIn: null, scanOut: null, earlyMinutes: 0, lateMinutes: 0 } },
    { date: '2026-09-25', isDayOff: false, record: null }, // Past unrecorded -> Absent
    { date: '2026-09-26', isDayOff: true, record: null }, // Day off
    { date: '2026-09-28', isDayOff: false, record: null }, // Future workday (next workday)
  ];

  const todayStr = '2026-09-26';

  // Filter: ABSENT -> should return only 2026-09-25
  const absentRows = filterTalentaRows(rows, 'ABSENT', todayStr);
  assert.equal(absentRows.length, 1);
  assert.equal(absentRows[0].date, '2026-09-25');

  // Filter: DAY_OFF -> should return 2026-09-20 and 2026-09-26
  const dayOffRows = filterTalentaRows(rows, 'DAY_OFF', todayStr);
  assert.equal(dayOffRows.length, 2);

  // Filter: EARLY_CLOCK_OUT -> should return 2026-09-21
  const earlyRows = filterTalentaRows(rows, 'EARLY_CLOCK_OUT', todayStr);
  assert.equal(earlyRows.length, 1);
  assert.equal(earlyRows[0].date, '2026-09-21');

  // Filter: TIME_OFF -> should return 2026-09-24
  const timeOffRows = filterTalentaRows(rows, 'TIME_OFF', todayStr);
  assert.equal(timeOffRows.length, 1);
  assert.equal(timeOffRows[0].date, '2026-09-24');

  // Filter: NEXT_WORKDAYS -> should return 2026-09-28
  const nextRows = filterTalentaRows(rows, 'NEXT_WORKDAYS', todayStr);
  assert.equal(nextRows.length, 1);
  assert.equal(nextRows[0].date, '2026-09-28');

  // Filter: ALL -> should return all rows
  const allRows = filterTalentaRows(rows, 'ALL', todayStr);
  assert.equal(allRows.length, rows.length);
});

test('filterTalentaRows handles explicit ALPHA, NO_CLOCK_OUT, NO_CLOCK_IN, and INVALID filters', () => {
  const rows = [
    { date: '2026-09-21', isDayOff: false, record: { attendanceStatus: 'PRESENT', scanIn: '08:00', scanOut: null } },
    { date: '2026-09-22', isDayOff: false, record: { attendanceStatus: 'PRESENT', scanIn: null, scanOut: '17:00' } },
    { date: '2026-09-23', isDayOff: false, record: { attendanceStatus: 'INVALID', scanIn: null, scanOut: null } },
    { date: '2026-09-24', isDayOff: false, record: { attendanceStatus: 'ALPHA', scanIn: null, scanOut: null } },
  ];

  const todayStr = '2026-09-26';

  const noOutRows = filterTalentaRows(rows, 'NO_CLOCK_OUT', todayStr);
  assert.equal(noOutRows.length, 1);
  assert.equal(noOutRows[0].date, '2026-09-21');

  const noInRows = filterTalentaRows(rows, 'NO_CLOCK_IN', todayStr);
  assert.equal(noInRows.length, 1);
  assert.equal(noInRows[0].date, '2026-09-22');

  const invalidRows = filterTalentaRows(rows, 'INVALID', todayStr);
  assert.equal(invalidRows.length, 1);
  assert.equal(invalidRows[0].date, '2026-09-23');

  const alphaRows = filterTalentaRows(rows, 'ABSENT', todayStr);
  assert.equal(alphaRows.length, 1);
  assert.equal(alphaRows[0].date, '2026-09-24');
});

test('dayoff with scans is counted as off without early or missing punch issues', () => {
  const rows = [{ date: '2026-09-21', isDayOff: true, record: { attendanceStatus: 'PRESENT', scanIn: '09:00', scanOut: null, earlyMinutes: 60, lateMinutes: 60 } }];
  const kpi = calculateTalentaKpi(rows, '2026-09-22');
  assert.equal(kpi.dayOff, 1);
  assert.equal(kpi.late, 0);
  assert.equal(kpi.earlyClockOut, 0);
  assert.equal(kpi.noClockOut, 0);
  assert.equal(filterTalentaRows(rows, 'EARLY_CLOCK_OUT', '2026-09-22').length, 0);
  assert.equal(filterTalentaRows(rows, 'NO_CLOCK_OUT', '2026-09-22').length, 0);
  assert.equal(filterTalentaRows(rows, 'ALL', '2026-09-22').length, 1);
  assert.equal(filterTalentaRows(rows, 'LATE', '2026-09-22').length, 0);
  assert.equal(formatTalentaRow(rows[0]).late, '-');
});

test('late KPI and filter count working days with positive late minutes', () => {
  const rows = [
    { date: '2026-09-21', isDayOff: false, record: { attendanceStatus: 'PRESENT', lateMinutes: 15 } },
    { date: '2026-09-22', isDayOff: false, record: { attendanceStatus: 'PRESENT', lateMinutes: 0 } },
    { date: '2026-09-23', isDayOff: true, record: { attendanceStatus: 'PRESENT', lateMinutes: 20 } },
  ];

  assert.equal(calculateTalentaKpi(rows, '2026-09-24').late, 1);
  const lateRows = filterTalentaRows(rows, 'LATE', '2026-09-24');
  assert.equal(lateRows.length, 1);
  assert.equal(lateRows[0].date, '2026-09-21');
});

test('formatTalentaRow and calculateTalentaKpi recognize LATE and EARLY_LEAVE attendance statuses', () => {
  const row = {
    date: '2026-09-21',
    dayName: 'Senin',
    dayOfWeek: 1,
    isDayOff: false,
    shiftName: 'Office',
    scheduleIn: '08:00',
    scheduleOut: '17:00',
    record: {
      id: 301,
      employeeId: 1,
      workDate: '2026-09-21',
      scanIn: '08:30',
      scanOut: '17:00',
      lateMinutes: 30,
      earlyMinutes: 0,
      overtimeMinutes: 0,
      attendanceStatus: 'LATE',
      revision: 1,
    },
  };
  const formatted = formatTalentaRow(row);
  assert.equal(formatted.attendanceCode, 'H');
  assert.equal(formatted.late, '00:30');

  const kpi = calculateTalentaKpi([row], '2026-09-22');
  assert.equal(kpi.late, 1);
});
