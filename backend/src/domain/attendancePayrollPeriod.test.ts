import test from 'node:test';
import assert from 'node:assert/strict';

test('mobile periods use the recap cycle named by its start month', async () => {
  const { attendancePayrollPeriod } = await import('./attendancePayrollPeriod');
  assert.deepEqual(attendancePayrollPeriod('2026-11-06'), { startDate: '2026-10-21', endDate: '2026-11-20', label: 'Oktober 2026' });
  assert.deepEqual(attendancePayrollPeriod('2026-11-20'), { startDate: '2026-10-21', endDate: '2026-11-20', label: 'Oktober 2026' });
  assert.deepEqual(attendancePayrollPeriod('2026-11-21'), { startDate: '2026-11-21', endDate: '2026-12-20', label: 'November 2026' });
});

test('previous cycle and year/leap transitions retain exact 21–20 boundaries', async () => {
  const { attendancePayrollPeriod } = await import('./attendancePayrollPeriod');
  assert.deepEqual(attendancePayrollPeriod('2026-11-06', 'PREVIOUS'), { startDate: '2026-09-21', endDate: '2026-10-20', label: 'September 2026' });
  assert.deepEqual(attendancePayrollPeriod('2027-01-01'), { startDate: '2026-12-21', endDate: '2027-01-20', label: 'Desember 2026' });
  assert.deepEqual(attendancePayrollPeriod('2024-02-29'), { startDate: '2024-02-21', endDate: '2024-03-20', label: 'Februari 2024' });
});
