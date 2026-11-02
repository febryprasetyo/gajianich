import assert from 'node:assert/strict';
import test from 'node:test';
import { isLifecycleStatus, normalizeEmployeeInput, calculateTalentaDuration } from './employeeInput';

test('normalizes blank Barcode to the Employee ID without changing the Employee ID', () => {
  const result = normalizeEmployeeInput({ employeeCode: '  EMP-001  ', barcode: '   ', email: '   ' });

  assert.equal(result.employeeCode, '  EMP-001  ');
  assert.equal(result.barcode, '  EMP-001  ');
  assert.equal(result.email, null);
});

test('keeps a supplied Barcode and optional email value', () => {
  const result = normalizeEmployeeInput({ employeeCode: 'EMP-002', barcode: 'BAR-002', email: 'employee@example.com' });

  assert.equal(result.barcode, 'BAR-002');
  assert.equal(result.email, 'employee@example.com');
});

test('recognizes each approved lifecycle status', () => {
  assert.equal(isLifecycleStatus('Active'), true);
  assert.equal(isLifecycleStatus('Inactive'), true);
  assert.equal(isLifecycleStatus('Resigned'), true);
});

test('rejects an unknown lifecycle status', () => {
  assert.equal(isLifecycleStatus('Terminated'), false);
});

test('calculates duration according to Talenta format', () => {
  const ref = new Date(2026, 8, 26); // 2026-09-26
  assert.equal(calculateTalentaDuration('1995-08-14', ref), '31 Year 1 Month 12 Day');
  assert.equal(calculateTalentaDuration('2017-10-11', ref), '8 Year 11 Month 15 Day');
  assert.equal(calculateTalentaDuration('2021-03-12', ref), '5 Year 6 Month 14 Day');
  assert.equal(calculateTalentaDuration(''), '');
  assert.equal(calculateTalentaDuration(null), '');
});

test('automatically calculates age and lengthOfService in normalizeEmployeeInput if missing', () => {
  const result = normalizeEmployeeInput({
    employeeCode: 'EMP-003',
    birthDate: '1995-08-14',
    joinDate: '2021-03-12',
  });

  assert.ok(result.age && (result.age as string).includes('Year'));
  assert.ok(result.lengthOfService && (result.lengthOfService as string).includes('Year'));
});

test('preserves existing Talenta string age and lengthOfService in normalizeEmployeeInput', () => {
  const result = normalizeEmployeeInput({
    employeeCode: 'EMP-089',
    birthDate: '1984-02-07',
    age: '42 Year 7 Month 19 Day',
    joinDate: '2017-03-13',
    lengthOfService: '9 Year 6 Month 13 Day',
  });

  assert.equal(result.age, '42 Year 7 Month 19 Day');
  assert.equal(result.lengthOfService, '9 Year 6 Month 13 Day');
});
