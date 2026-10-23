import { test } from 'node:test';
import assert from 'node:assert/strict';
import { determineShiftCategory, evaluateAttendanceApproval } from './attendanceVerificationPolicy';
test('shift category remains descriptive and does not grant auto approval', () => {
  assert.equal(determineShiftCategory({ code: 'OFFICE' }), 'OFFICE');
  assert.equal(determineShiftCategory({ name: 'Produksi' }), 'PRODUCTION');
  assert.equal(evaluateAttendanceApproval({}, 'OUT', true).approvalStatus, 'PENDING');
});
