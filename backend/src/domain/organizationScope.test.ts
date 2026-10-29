import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDepartmentCandidates, buildLocationCandidates, resolveCandidate } from './organizationScope';
const rows = [
  { id: 1, code: 'MGM', name: 'MULTI GAS MEDIKA' },
  { id: 2, code: 'MSI', name: 'MEDICARE SOLUSI INDONESIA' },
  { id: 3, code: 'ENG', name: 'ENGINEERING' },
  { id: 4, code: 'NEW', name: 'MULTI GAS MEDIKA BARU' },
];
test('preview identifies exact MGM departments and explicit review candidates only', () => {
  const result = buildDepartmentCandidates(rows);
  assert.deepEqual(result.map(r => [r.sourceId, r.groupCode, r.evidence]), [
    [1, 'MGM', 'USER_CONFIRMED'], [2, 'MGM', 'USER_CONFIRMED'],
    [3, 'CMC', 'REQUIRES_REVIEW'], [4, 'CMC', 'REQUIRES_REVIEW'],
  ]);
  assert.ok(result.every(r => r.organizationCode === null));
});
test('resolution uses captured IDs; new, missing and null masters never fall back to CMC', () => {
  const captured = buildDepartmentCandidates(rows);
  assert.equal(resolveCandidate(captured, 'department', 1)?.groupCode, 'MGM');
  assert.equal(resolveCandidate(captured, 'department', 999), null);
  assert.equal(resolveCandidate(captured, 'department', null), null);
  assert.equal(resolveCandidate(captured, 'location', 1), null);
  assert.deepEqual(buildDepartmentCandidates([]), []);
});
test('locations remain unresolved without explicit mapping evidence', () => {
  assert.deepEqual(buildLocationCandidates([rows[0]]), [{
    source: 'location', sourceId: 1, sourceCode: 'MGM', sourceName: 'MULTI GAS MEDIKA',
    groupCode: null, organizationCode: null, evidence: 'REQUIRES_REVIEW',
  }]);
});
