import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planImportRecovery } from './attendanceImportRecovery';

const row = { id: 1, batchId: 140, sourceId: 1, employeeId: null, externalNoId: '50003', workDate: '2026-10-01', reviewStatus: 'READY', scanIn: '08:00', scanOut: '17:00', issues: null };
const employees = [{ id: 5, employeeCode: '50003' }];
test('recovery maps all statuses and picks latest batch once without overwriting records or locked dates', () => {
  const rows = [row, { ...row, id: 2, batchId: 143, scanIn: '08:15' }, { ...row, id: 3, workDate: '2026-10-02' }, { ...row, id: 4, workDate: '2026-10-03' }, { ...row, id: 5, workDate: '2026-10-04', reviewStatus: 'SKIPPED' }, { ...row, id: 6, workDate: '2026-10-05', reviewStatus: 'NEEDS_REVIEW' }, { ...row, id: 7, workDate: '2026-10-06', externalNoId: 'UNKNOWN' }];
  const plan = planImportRecovery(rows, employees, [], [{ employeeId: 5, workDate: '2026-10-02' }], ['2026-10-03']);
  assert.equal(plan.rows.filter(r => r.employeeId === 5).length, 6);
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.candidates[0].id, 2);
  assert.equal(plan.rows[6].employeeId, null);
});
test('recovery excludes invalid scans, issues and conflicting rows within the same batch', () => {
  const plan = planImportRecovery([row, { ...row, id: 2, scanIn: '09:00' }, { ...row, id: 3, workDate: '2026-10-02', scanIn: 'invalid' }, { ...row, id: 4, workDate: '2026-10-03', issues: ['Invalid duration'] }], employees, [], [], []);
  assert.equal(plan.candidates.length, 0);
});
