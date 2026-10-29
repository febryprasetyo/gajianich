import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { parseAttendanceBiff, parseAttendanceWorkbook } from './biff.ts';
import * as XLSX from 'xlsx';

const realXlsUrl = new URL('../../../../docs/21-7.xls', import.meta.url);

function record(type, payload = Buffer.alloc(0)) { const h = Buffer.alloc(4); h.writeUInt16LE(type); h.writeUInt16LE(payload.length, 2); return Buffer.concat([h, payload]); }
function fixture(overrides = {}) {
  const cells = { 'No. ID': '001', Nama: 'Karyawan Uji', Tanggal: '14/10/2025', 'Jam Kerja': 'Reguler', 'Jam Masuk': '08:00', 'Jam Pulang': '16:00', 'Scan Masuk': '08:15', 'Scan Pulang': '17:00', Terlambat: '00:15', 'Plg. Cepat': '', Lembur: '01:00', ...overrides };
  const labels = [];
  for (const [col, [header, value]] of Object.entries(cells).entries()) {
    for (const [row, text] of [[0, header], [1, value]]) {
      const bytes = Buffer.from(text); const payload = Buffer.alloc(8 + bytes.length); payload.writeUInt16LE(row); payload.writeUInt16LE(col, 2); payload[7] = bytes.length; bytes.copy(payload, 8); labels.push(record(4, payload));
    }
  }
  return new Uint8Array(Buffer.concat([record(0x0009, Buffer.alloc(4)), ...labels, record(10)]));
}
test('machine BIFF preserves leading zeros, schedules and source durations', () => {
  const row = parseAttendanceBiff(fixture())[0];
  assert.equal(row.externalNoId, '001'); assert.equal(row.workDate, '2025-10-14');
  assert.equal(row.lateMinutes, 15); assert.equal(row.overtimeMinutes, 60); assert.equal(row.scheduleOut, '16:00');
});
test('machine BIFF converts a serial date stored as text', () => {
  const row = parseAttendanceBiff(fixture({ Tanggal: '46285' }))[0];
  assert.equal(row.workDate, '2026-09-20');
  assert.equal(row.reviewStatus, 'READY');
});
test('missing single scan uses schedule and zeros only its associated duration', () => {
  const row = parseAttendanceBiff(fixture({ 'Scan Masuk': '', Terlambat: '00:30', 'Plg. Cepat': '00:10', Lembur: '25:00' }))[0];
  assert.equal(row.rawScanIn, null); assert.equal(row.scanIn, '08:00'); assert.equal(row.normalized, true);
  assert.equal(row.lateMinutes, 0); assert.equal(row.earlyMinutes, 10); assert.equal(row.overtimeMinutes, 1500);
});
test('both empty scans stay skipped and invalid duration blocks the row', () => {
  assert.equal(parseAttendanceBiff(fixture({ 'Scan Masuk': '', 'Scan Pulang': '' }))[0].reviewStatus, 'SKIPPED');
  assert.equal(parseAttendanceBiff(fixture({ Lembur: '01:60' }))[0].reviewStatus, 'BLOCKED');
});
test('broken signatures, truncated streams and impossible dates fail explicitly', () => {
  assert.throws(() => parseAttendanceBiff(new Uint8Array([1, 2, 3, 4])));
  const bytes = fixture(); assert.throws(() => parseAttendanceBiff(bytes.slice(0, -2)), /terpotong|rusak/);
  assert.throws(() => parseAttendanceBiff(fixture({ Tanggal: '30/02/2025' })), /Tanggal/);
});

test('real OLE2 Excel file (docs/21-7.xls) parses all rows and converts serial dates', {
  skip: !existsSync(realXlsUrl) ? 'docs/21-7.xls is not present in CI environment' : false
}, () => {
  const fileBytes = readFileSync(realXlsUrl);
  const rows = parseAttendanceBiff(new Uint8Array(fileBytes));
  assert.equal(rows.length, 3261);
  const row1 = rows[0];
  assert.equal(row1.externalNoId, '1');
  assert.equal(row1.employeeName, 'Dwi Fianti');
  assert.equal(row1.workDate, '2026-09-20');
  assert.equal(row1.reviewStatus, 'SKIPPED');

  const row2 = rows[1];
  assert.equal(row2.workDate, '2026-09-21');
  assert.equal(row2.scanIn, '07:15');
  assert.equal(row2.scanOut, '17:00');
  assert.equal(row2.overtimeMinutes, 60);
  assert.equal(row2.reviewStatus, 'READY');
});

test('modern .xlsx format parses correctly with serial date and formatted string', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['No. ID', 'Nama', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Scan Masuk', 'Scan Pulang', 'Terlambat', 'Plg. Cepat', 'Lembur'],
    ['101', 'Budi Santoso', 46285, '08:00', '17:00', '08:05', '17:15', '00:05', '', '00:15'],
    ['102', 'Siti Rahma', '21/09/2026', '08:00', '17:00', '08:00', '17:00', '', '', '']
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet 1');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const rows = parseAttendanceWorkbook(new Uint8Array(buf));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].externalNoId, '101');
  assert.equal(rows[0].workDate, '2026-09-20');
  assert.equal(rows[0].lateMinutes, 5);
  assert.equal(rows[0].overtimeMinutes, 15);
  assert.equal(rows[1].externalNoId, '102');
  assert.equal(rows[1].workDate, '2026-09-21');
  assert.equal(rows[1].lateMinutes, 0);
  assert.equal(rows[1].reviewStatus, 'READY');
});
