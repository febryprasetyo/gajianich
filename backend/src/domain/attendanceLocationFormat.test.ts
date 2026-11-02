import { test } from 'node:test';
import assert from 'node:assert';
import { formatLocationUpdate, extractCityAndProvince, shouldAutoHighlightEmployee } from './attendanceLocationFormat';

test('formatLocationUpdate returns static Jakarta/ Kantor for ADMS machine scan', () => {
  const result = formatLocationUpdate({
    sourceType: 'ADMS',
    rawAddress: null,
  });
  assert.strictEqual(result, 'Jakarta/ Kantor');
});

test('formatLocationUpdate formats mobile face scan with Kabupaten/Kota and Provinsi', () => {
  const result = formatLocationUpdate({
    sourceType: 'MOBILE',
    rawAddress: 'Jl. Malino, Somba Opu, Kabupaten Gowa, Sulawesi Selatan 92111, Indonesia',
  });
  assert.strictEqual(result, 'Kabupaten Gowa, Sulawesi Selatan');
});

test('formatLocationUpdate handles Serang, Banten correctly', () => {
  const result = formatLocationUpdate({
    sourceType: 'MOBILE',
    rawAddress: 'Kragilan, Kabupaten Serang, Banten, Indonesia',
  });
  assert.strictEqual(result, 'Kabupaten Serang, Banten');
});

test('formatLocationUpdate returns empty string when no attendance source or absent', () => {
  const result = formatLocationUpdate({
    sourceType: 'NONE',
    rawAddress: null,
  });
  assert.strictEqual(result, '');
});

test('shouldAutoHighlightEmployee returns true for koordinator or direktur', () => {
  assert.strictEqual(shouldAutoHighlightEmployee('KOORDINATOR MARKETING', 'Staff'), true);
  assert.strictEqual(shouldAutoHighlightEmployee('Marketing Staff', 'Koordinator'), true);
  assert.strictEqual(shouldAutoHighlightEmployee('DIREKTUR OPERASIONAL', 'Director'), true);
  assert.strictEqual(shouldAutoHighlightEmployee('Staff', 'Direktur'), true);
  assert.strictEqual(shouldAutoHighlightEmployee('MARKETING Staff', 'Staff'), false);
  assert.strictEqual(shouldAutoHighlightEmployee(null, null), false);
});
