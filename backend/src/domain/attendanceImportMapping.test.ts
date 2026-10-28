import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveImportEmployee } from './attendanceImportMapping';

const employees = [
  { id: 1, employeeCode: '00123', barcode: 'BC-1' },
  { id: 2, employeeCode: 'EMP-2', barcode: 'BC-2' },
];
test('exact employee number, barcode and whole numeric IDs resolve uniquely', () => {
  assert.equal(resolveImportEmployee('00123', 1, employees, []), 1);
  assert.equal(resolveImportEmployee('123', 1, employees, []), 1);
  assert.equal(resolveImportEmployee(' bc-2 ', 1, employees, []), 2);
  assert.equal(resolveImportEmployee('123abc', 1, employees, []), null);
  assert.equal(resolveImportEmployee('UNKNOWN', 1, employees, []), null);
});
test('identity is source-specific and ambiguous fallback never selects first employee', () => {
  const identities = [{ sourceId: 2, externalNoId: '00123', employeeId: 2 }];
  assert.equal(resolveImportEmployee('00123', 1, employees, identities), 1);
  assert.equal(resolveImportEmployee('00123', 2, employees, identities), 2);
  assert.equal(resolveImportEmployee('123', 1, [...employees, { id: 3, employeeCode: '000123', barcode: null }], []), null);
  assert.equal(resolveImportEmployee('00123', 1, [...employees, { id: 3, employeeCode: '00123', barcode: null }], []), null);
});
