import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAttendanceApproval } from './attendanceVerificationPolicy';
import { resolveActiveEmployeeShift } from './attendanceSchedule';

test('new and unassigned shifts require review for both events', () => {
  for (const event of ['IN', 'OUT'] as const) {
    assert.equal(evaluateAttendanceApproval(null, event, true).approvalStatus, 'PENDING');
    assert.equal(evaluateAttendanceApproval({ autoApproveIn: false, autoApproveOut: false }, event, true).approvalStatus, 'PENDING');
  }
});

test('auto approval switches act independently and use no category heuristic', () => {
  const shift = { autoApproveIn: false, autoApproveOut: true };
  assert.equal(evaluateAttendanceApproval(shift, 'IN', true).approvalStatus, 'PENDING');
  assert.equal(evaluateAttendanceApproval(shift, 'OUT', false).approvalStatus, 'APPROVED');
});

test('shift resolution: individual active overrides division', () => {
  const shifts = [
    { id: 1, code: 'INDIV', name: 'Indiv Shift', isActive: true, autoApproveIn: true, autoApproveOut: true },
    { id: 2, code: 'DEPT', name: 'Dept Shift', isActive: true, autoApproveIn: false, autoApproveOut: false },
    { id: 3, code: 'DEFAULT', name: 'Default Shift', isActive: true, isDefault: true, autoApproveIn: true, autoApproveOut: true },
  ] as any;
  const assignments = [
    { shiftId: 1, employeeId: 10 },
    { shiftId: 2, departmentId: 5 },
  ] as any;
  const result = resolveActiveEmployeeShift({ id: 10, departmentId: 5 }, shifts, assignments);
  assert.equal(result.shift.code, 'INDIV');
  assert.equal(result.hasActiveAssignment, true);
});

test('shift resolution: inactive individual falls back to active division', () => {
  const shifts = [
    { id: 1, code: 'INACTIVE_INDIV', name: 'Inactive Indiv', isActive: false, autoApproveIn: false, autoApproveOut: false },
    { id: 2, code: 'DEPT', name: 'Dept Shift', isActive: true, autoApproveIn: true, autoApproveOut: true },
    { id: 3, code: 'DEFAULT', name: 'Default Shift', isActive: true, isDefault: true, autoApproveIn: false, autoApproveOut: false },
  ] as any;
  const assignments = [
    { shiftId: 1, employeeId: 10 },
    { shiftId: 2, departmentId: 5 },
  ] as any;
  const result = resolveActiveEmployeeShift({ id: 10, departmentId: 5 }, shifts, assignments);
  assert.equal(result.shift.code, 'DEPT');
  assert.equal(result.hasActiveAssignment, true);
});

test('shift resolution: unassigned or inactive division yields default schedule but requires review', () => {
  const shifts = [
    { id: 1, code: 'INACTIVE_INDIV', name: 'Inactive Indiv', isActive: false },
    { id: 2, code: 'INACTIVE_DEPT', name: 'Inactive Dept', isActive: false },
    { id: 3, code: 'DEFAULT', name: 'Default Shift', isActive: true, isDefault: true, autoApproveIn: true, autoApproveOut: true },
  ] as any;
  const assignments = [
    { shiftId: 1, employeeId: 10 },
    { shiftId: 2, departmentId: 5 },
  ] as any;
  const result = resolveActiveEmployeeShift({ id: 10, departmentId: 5 }, shifts, assignments);
  assert.equal(result.shift.code, 'DEFAULT');
  assert.equal(result.hasActiveAssignment, false);
});
