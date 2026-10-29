import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRecords, summarizeEmployees, durationLabel, reportCsv, validatePeriod, parseImportRows, subtractOneMonth, getDefaultAttendancePeriod, sortRecordsDescending } from './domain.ts';
import { applyCommand } from './commands.ts';

const seed = {
  schemaVersion: 1,
  meta: { defaultDate: '2026-09-25', periodStart: '2026-09-01', actor: 'Test HR', role: 'HR_ADMIN', canManageAccess: true },
  departments: [{ id: 1, code: 'HR', name: 'Human Resources', isActive: true }], locations: [], sources: [{ id: 1, code: 'MACHINE', name: 'Mesin', isActive: true }],
  employees: [{ id: 1, employeeCode: 'EMP-001', fullName: 'Test Employee', email: '', departmentId: 1, locationId: null, position: 'Staff', isActive: true }],
  identities: [{ id: 1, sourceId: 1, externalNoId: '001', employeeId: 1 }],
  records: [{ id: 1, employeeId: 1, workDate: '2026-09-20', shift: null, scheduleIn: null, scheduleOut: null, scanIn: '08:00', scanOut: '17:00', rawScanIn: '08:00', rawScanOut: '17:00', lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0, attendanceStatus: 'PRESENT', isDayOff: false, normalized: false, revision: 1, sourceBatchId: null }],
  batches: [], audit: [], revisions: [], grants: [], locks: [],
};
const fixture = () => structuredClone(seed);
const range = { startDate: seed.meta.periodStart, endDate: seed.meta.defaultDate };

test('final records total per employee, without draft rows or duplicate identities', () => {
  const data = fixture();
  const base = data.records[0];
  data.records = [15, 20, 10].map((lateMinutes, i) => ({ ...base, id: i + 1, employeeId: 1, workDate: `2026-09-${21 + i}`, lateMinutes, overtimeMinutes: [60, 90, 0][i] }));
  const report = summarizeEmployees(data, { startDate: '2026-09-21', endDate: '2026-09-25' }).find(row => row.employee.id === 1);
  assert.equal(report.lateMinutes, 45);
  assert.equal(report.overtimeMinutes, 150);
  assert.equal(report.recordCount, 3);
  assert.equal(durationLabel(1500), '25 jam 0 menit');
});
test('summarizeEmployees counts LATE and EARLY_LEAVE records towards recordCount (Hadir)', () => {
  const data = fixture();
  const base = data.records[0];
  data.records = [
    { ...base, id: 1, workDate: '2026-09-21', attendanceStatus: 'PRESENT', lateMinutes: 0 },
    { ...base, id: 2, workDate: '2026-09-22', attendanceStatus: 'LATE', lateMinutes: 30 },
    { ...base, id: 3, workDate: '2026-09-23', attendanceStatus: 'EARLY_LEAVE', earlyMinutes: 20 },
    { ...base, id: 4, workDate: '2026-09-24', attendanceStatus: 'DINAS_LUAR' },
  ];
  const report = summarizeEmployees(data, { startDate: '2026-09-21', endDate: '2026-09-25' }).find(row => row.employee.id === 1);
  assert.equal(report.recordCount, 4);
  assert.equal(report.lateMinutes, 30);
});
test('date and department filters operate before aggregation; no records is distinct from zero', () => {
  const data = fixture();
  const rows = filterRecords(data, { ...range, departmentId: 1 });
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => data.employees.find(e => e.id === row.employeeId).departmentId === 1));
  assert.equal(filterRecords(data, { startDate: '2000-01-01', endDate: '2000-01-01' }).length, 0);
  assert.ok(summarizeEmployees(data, { startDate: '2000-01-01', endDate: '2000-01-01' }).every(row => row.recordCount === 0));
});
test('period and imports reject malformed dates, negative durations and missing fields', () => {
  assert.throws(() => validatePeriod('2026-09-25', '2026-09-01'));
  assert.throws(() => validatePeriod('2026-02-30', '2026-03-01'));
  assert.throws(() => validatePeriod('2020-01-01', '2026-09-25'));
  assert.throws(() => parseImportRows('[{"employeeId":1}]'));
  const row = { externalNoId: '001', workDate: '2026-09-26', scanIn: '08:00', scanOut: '16:00', lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 30 };
  assert.equal(parseImportRows(JSON.stringify([row]))[0].externalNoId, '001');
  assert.throws(() => parseImportRows(JSON.stringify([{ ...row, overtimeMinutes: -1 }])));
});
test('correction replaces totals, retains revision and rejects stale or locked edits', () => {
  let data = fixture();
  const r = data.records.find(r => r.attendanceStatus === 'PRESENT');
  const cmd = { type: 'correct', recordId: r.id, expectedRevision: r.revision, reason: 'Koreksi contoh', values: { scanIn: r.scanIn, scanOut: r.scanOut, lateMinutes: 45, overtimeMinutes: 90, attendanceStatus: 'PRESENT' } };
  data = applyCommand(data, cmd);
  assert.equal(data.records.find(row => row.id === r.id).lateMinutes, 45);
  assert.equal(data.revisions.at(-1).before.lateMinutes, r.lateMinutes);
  assert.throws(() => applyCommand(data, cmd), /berubah/);
  data = applyCommand(data, { type: 'lock', workDate: r.workDate, locked: true, reason: 'Final' });
  assert.throws(() => applyCommand(data, { ...cmd, expectedRevision: r.revision + 1 }), /dikunci/);
  assert.throws(() => applyCommand(data, { type: 'lock', workDate: r.workDate, locked: false, reason: '' }), /Alasan/);
});
test('unmapped import blocks commit; mapping, review and commit create records exactly once', () => {
  let data = fixture();
  const rows = parseImportRows(JSON.stringify([{ externalNoId: 'NEW-01', workDate: '2026-09-26', scanIn: '08:00', scanOut: '16:00', lateMinutes: 10, earlyMinutes: 0, overtimeMinutes: 45 }]));
  data = applyCommand(data, { type: 'import', filename: 'new.json', sourceId: 1, rows });
  const batchId = data.batches.at(-1).id;
  assert.throws(() => applyCommand(data, { type: 'batch', batchId, action: 'commit' }), /review/);
  data = applyCommand(data, { type: 'identity', value: { id: 0, sourceId: 1, externalNoId: 'NEW-01', employeeId: 1 } });
  data = applyCommand(data, { type: 'review', batchId, rowId: 1, employeeId: 1, skipped: false, reason: 'Pemetaan diperiksa' });
  const count = data.records.length;
  data = applyCommand(data, { type: 'batch', batchId, action: 'commit' });
  assert.equal(data.records.length, count + 1);
  data = applyCommand(data, { type: 'batch', batchId, action: 'commit' });
  assert.equal(data.records.length, count + 1);
});
test('conflicting import cannot overwrite or partially commit records', () => {
  let data = fixture();
  const existing = data.records[0];
  const identity = data.identities.find(i => i.employeeId === existing.employeeId);
  const rows = parseImportRows(JSON.stringify([{ externalNoId: identity.externalNoId, workDate: existing.workDate, scanIn: '08:00', scanOut: '16:00', lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0 }]));
  data = applyCommand(data, { type: 'import', filename: 'duplicate.json', sourceId: identity.sourceId, rows });
  assert.throws(() => applyCommand(data, { type: 'batch', batchId: data.batches.at(-1).id, action: 'commit' }), /duplikat|review/);
});
test('read-only demo role cannot mutate attendance and non-present correction clears durations', () => {
  const data = fixture();
  data.meta.role = 'REPORT_VIEWER';
  assert.throws(() => applyCommand(data, { type: 'lock', workDate: range.endDate, locked: true, reason: 'Test' }), /akses/);
  const editable = fixture();
  const r = editable.records[0];
  const corrected = applyCommand(editable, { type: 'correct', recordId: r.id, expectedRevision: r.revision, reason: 'Izin', values: { attendanceStatus: 'IZIN', scanIn: '08:00', scanOut: '16:00', lateMinutes: 30, overtimeMinutes: 40 } });
  assert.equal(corrected.records[0].scanIn, null);
  assert.equal(corrected.records[0].overtimeMinutes, 0);
});
test('CSV quotes names and protects spreadsheet formulas', () => {
  const data = fixture();
  data.employees[0].fullName = '=SUM(1,2)';
  const csv = reportCsv(summarizeEmployees(data, range), range);
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('Keterlambatan (menit)'));
});

test('review cannot acknowledge away immutable parser errors', () => {
  let data = fixture();
  const identity = data.identities[0];
  const bad = { id: 1, externalNoId: identity.externalNoId, employeeId: null, workDate: '2026-09-26', scanIn: '08:00', scanOut: '16:00', lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0, reviewStatus: 'BLOCKED', note: 'Durasi tidak valid: 01:60', issues: ['Durasi tidak valid: 01:60'] };
  data = applyCommand(data, { type: 'import', filename: 'bad.xls', sourceId: identity.sourceId, rows: [bad] });
  assert.throws(() => applyCommand(data, { type: 'review', batchId: data.batches.at(-1).id, rowId: 1, employeeId: identity.employeeId, skipped: false, reason: 'Ditinjau' }), /Durasi/);
});

test('re-uploading same file with same content hash always creates a new draft batch', () => {
  let data = fixture();
  const rows = parseImportRows(JSON.stringify([{ externalNoId: data.identities[0].externalNoId, workDate: '2026-09-26', scanIn: '08:00', scanOut: '16:00', lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0 }]));
  const cmd = { type: 'import', sourceId: 1, filename: 'same.xls', fileHash: 'test-content-hash', rows };
  data = applyCommand(data, cmd);
  const count = data.batches.length;
  data = applyCommand(data, { ...cmd, filename: 'renamed.xls' });
  assert.equal(data.batches.length, count + 1);
  assert.notEqual(data.batches[data.batches.length - 1].id, data.batches[data.batches.length - 2].id);
});

test("import command defaults to active source if sourceId is omitted", () => {
  let data = fixture();
  const rows = parseImportRows(JSON.stringify([{ externalNoId: data.identities[0].externalNoId, workDate: "2026-09-26", scanIn: "08:00", scanOut: "16:00", lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0 }]));
  const countBefore = data.batches.length;
  // Omit sourceId entirely
  const cmd = { type: "import", filename: "no-source.xls", rows };
  data = applyCommand(data, cmd);
  assert.equal(data.batches.length, countBefore + 1);
  const createdBatch = data.batches.at(-1);
  assert.ok(createdBatch.sourceId > 0, "Batch should have a valid default sourceId");
  assert.equal(createdBatch.rows[0].employeeId, data.identities[0].employeeId, "Employee should be mapped via externalNoId");
});

test('sync_employees updates employee list and departments in attendance dataset', () => {
  let data = fixture();
  const newEmployees = [
    { id: 101, employeeCode: 'EMP001', fullName: 'Talenta User 1', email: 'user1@company.com', departmentId: 99, locationId: null, position: 'Staff', isActive: true }
  ];
  const newDepts = [
    { id: 99, code: 'HR', name: 'Human Resources', isActive: true }
  ];
  data = applyCommand(data, { type: 'sync_employees', employees: newEmployees, departments: newDepts });
  assert.equal(data.employees.length, 1);
  assert.equal(data.employees[0].fullName, 'Talenta User 1');
  assert.equal(data.departments.length, 1);
  assert.equal(data.departments[0].name, 'Human Resources');
});

test('subtractOneMonth calculates exact 1 month period across variable month lengths', () => {
  assert.equal(subtractOneMonth('2026-09-30'), '2026-08-30');
  assert.equal(subtractOneMonth('2026-09-25'), '2026-08-25');
  assert.equal(subtractOneMonth('2026-03-31'), '2026-02-28');
  assert.equal(subtractOneMonth('2026-01-15'), '2025-12-15');
});

test('getDefaultAttendancePeriod returns exact 21st to 20th cut-off cycle', () => {
  const data = fixture();
  // seed has record at workDate: '2026-09-20' and meta defaultDate: '2026-09-25'
  const period = getDefaultAttendancePeriod(data, 1);
  assert.ok(period.startDate < period.endDate);
  assert.ok(period.startDate.endsWith('-21'));
  assert.ok(period.endDate.endsWith('-20'));
  assert.doesNotThrow(() => validatePeriod(period.startDate, period.endDate));

  // empty records and empty meta defaults to today cut-off
  const emptyData = {
    schemaVersion: 1,
    meta: { defaultDate: '', periodStart: '', actor: '', role: 'HR_ADMIN', canManageAccess: true },
    departments: [], locations: [], sources: [], employees: [], identities: [], records: [], batches: [], audit: [], revisions: [], grants: [], locks: []
  };
  const emptyPeriod = getDefaultAttendancePeriod(emptyData);
  assert.ok(emptyPeriod.startDate < emptyPeriod.endDate);
  assert.ok(emptyPeriod.startDate.endsWith('-21'));
  assert.ok(emptyPeriod.endDate.endsWith('-20'));
  assert.doesNotThrow(() => validatePeriod(emptyPeriod.startDate, emptyPeriod.endDate));
});

test('summarizeEmployees computes accurate counts for SAKIT, IZIN, and CUTI', () => {
  const data = fixture();
  const base = data.records[0];
  data.records = [
    { ...base, id: 101, employeeId: 1, workDate: '2026-09-21', attendanceStatus: 'PRESENT', lateMinutes: 10, overtimeMinutes: 30 },
    { ...base, id: 102, employeeId: 1, workDate: '2026-09-22', attendanceStatus: 'SAKIT', lateMinutes: 0, overtimeMinutes: 0 },
    { ...base, id: 103, employeeId: 1, workDate: '2026-09-23', attendanceStatus: 'IZIN', lateMinutes: 0, overtimeMinutes: 0 },
    { ...base, id: 104, employeeId: 1, workDate: '2026-09-24', attendanceStatus: 'CUTI', lateMinutes: 0, overtimeMinutes: 0 },
    { ...base, id: 105, employeeId: 1, workDate: '2026-09-25', attendanceStatus: 'SAKIT', lateMinutes: 0, overtimeMinutes: 0 },
  ];
  const report = summarizeEmployees(data, { startDate: '2026-09-21', endDate: '2026-09-25' }).find(row => row.employee.id === 1);
  assert.equal(report.recordCount, 1);
  assert.equal(report.sakitCount, 2);
  assert.equal(report.izinCount, 1);
  assert.equal(report.cutiCount, 1);
});

test('sortRecordsDescending places the newest day at the very top', () => {
  const records = [
    { id: 1, workDate: '2026-09-01' },
    { id: 2, workDate: '2026-09-25' },
    { id: 3, workDate: '2026-09-10' },
  ];
  const sorted = sortRecordsDescending(records);
  assert.equal(sorted[0].workDate, '2026-09-25');
  assert.equal(sorted[1].workDate, '2026-09-10');
  assert.equal(sorted[2].workDate, '2026-09-01');
});

test("review command allows manual update of scan times, durations, and employee mapping", () => {
  let data = fixture();
  const incompleteRow = {
    id: 1,
    externalNoId: "UNKNOWN-999",
    employeeId: null,
    workDate: "2026-09-28",
    scanIn: "08:15",
    scanOut: null,
    lateMinutes: 0,
    earlyMinutes: 0,
    overtimeMinutes: 0,
    reviewStatus: "BLOCKED",
    note: "Scan belum lengkap.",
  };
  data = applyCommand(data, {
    type: "import",
    filename: "incomplete.xls",
    sourceId: 1,
    rows: [incompleteRow],
  });

  const batchId = data.batches.at(-1).id;
  assert.equal(data.batches.at(-1).rows[0].reviewStatus, "BLOCKED");

  data = applyCommand(data, {
    type: "review",
    batchId,
    rowId: 1,
    employeeId: 1,
    skipped: false,
    reason: "Koreksi manual scan pulang & lembur",
    values: {
      scanIn: "08:10",
      scanOut: "17:30",
      lateMinutes: 10,
      overtimeMinutes: 30,
    },
  });

  const reviewedRow = data.batches.at(-1).rows[0];
  assert.equal(reviewedRow.reviewStatus, "READY");
  assert.equal(reviewedRow.employeeId, 1);
  assert.equal(reviewedRow.scanIn, "08:10");
  assert.equal(reviewedRow.scanOut, "17:30");
  assert.equal(reviewedRow.lateMinutes, 10);
  assert.equal(reviewedRow.overtimeMinutes, 30);
  assert.equal(reviewedRow.note, "Koreksi manual scan pulang & lembur");

  data = applyCommand(data, {
    type: "batch",
    batchId,
    action: "commit",
  });

  const committedRecord = data.records.find(r => r.workDate === "2026-09-28" && r.employeeId === 1);
  assert.ok(committedRecord);
  assert.equal(committedRecord.scanIn, "08:10");
  assert.equal(committedRecord.scanOut, "17:30");
  assert.equal(committedRecord.lateMinutes, 10);
  assert.equal(committedRecord.overtimeMinutes, 30);
});

test("review command validates scan time format when manual values provided", () => {
  let data = fixture();
  const row = {
    id: 1,
    externalNoId: data.identities[0].externalNoId,
    employeeId: null,
    workDate: "2026-09-28",
    scanIn: "08:00",
    scanOut: "17:00",
    lateMinutes: 0,
    earlyMinutes: 0,
    overtimeMinutes: 0,
  };
  data = applyCommand(data, {
    type: "import",
    filename: "test.xls",
    sourceId: 1,
    rows: [row],
  });

  const batchId = data.batches.at(-1).id;

  assert.throws(
    () => applyCommand(data, {
      type: "review",
      batchId,
      rowId: 1,
      employeeId: 1,
      skipped: false,
      reason: "Format salah",
      values: { scanIn: "25:99" },
    }),
    /Format jam masuk harus HH:mm/
  );
});

test("grant creation, update, and deletion operate cleanly", () => {
  let data = fixture();
  // Create grant
  data = applyCommand(data, {
    type: "grant",
    value: { id: 0, principalKey: "hr.specialist@gajianich.id", displayName: "HR Specialist", role: "HR_STAFF", isActive: true }
  });
  assert.equal(data.grants.length, 1);
  assert.equal(data.grants[0].principalKey, "hr.specialist@gajianich.id");

  // Update grant
  const grantId = data.grants[0].id;
  data = applyCommand(data, {
    type: "grant",
    value: { id: grantId, principalKey: "hr.specialist@gajianich.id", displayName: "HR Lead", role: "HR_ADMIN", isActive: true }
  });
  assert.equal(data.grants[0].displayName, "HR Lead");
  assert.equal(data.grants[0].role, "HR_ADMIN");

  // Delete grant using delete_grant
  data = applyCommand(data, { type: "delete_grant", id: grantId });
  assert.equal(data.grants.length, 0);

  // Re-add and delete using grant action delete
  data = applyCommand(data, {
    type: "grant",
    value: { id: 0, principalKey: "hr.viewer@gajianich.id", displayName: "Viewer", role: "REPORT_VIEWER", isActive: true }
  });
  assert.equal(data.grants.length, 1);
  data = applyCommand(data, {
    type: "grant",
    action: "delete",
    value: data.grants[0]
  });
  assert.equal(data.grants.length, 0);
});

test('dayoff correction preserves scans and excludes lateness from reports', () => {
  const data = fixture();
  data.records[0].lateMinutes = 30;
  const values = { ...data.records[0], isDayOff: true };
  const result = applyCommand(data, { type: 'correct', recordId: 1, expectedRevision: 1, reason: 'Jadwal off', values });
  assert.equal(result.records[0].scanIn, '08:00');
  assert.equal(result.records[0].rawScanIn, '08:00');
  assert.equal(result.revisions[0].after.isDayOff, true);
  assert.equal(summarizeEmployees(result, range)[0].lateMinutes, 0);
  const restored = applyCommand(result, { type: 'correct', recordId: 1, expectedRevision: 2, reason: 'Hari kerja', values: { ...values, isDayOff: false } });
  assert.equal(summarizeEmployees(restored, range)[0].lateMinutes, 30);
});

test('manual dayoff overrides working schedule and remains on later edits', () => {
  let data = applyCommand(fixture(), { type: 'record_attendance', employeeId: 1, workDate: '2026-09-21', attendanceStatus: 'PRESENT', scanIn: '09:00', scanOut: '16:00', isDayOff: true });
  let record = data.records.find(r => r.workDate === '2026-09-21');
  assert.equal(record.isDayOff, true);
  assert.equal(record.lateMinutes, 0);
  assert.equal(record.earlyMinutes, 0);
  data = applyCommand(data, { type: 'record_attendance', employeeId: 1, workDate: record.workDate, attendanceStatus: 'PRESENT', scanIn: record.scanIn, scanOut: record.scanOut });
  record = data.records.find(r => r.workDate === '2026-09-21');
  assert.equal(record.isDayOff, true);
});

test('dayoff correction still rejects locked dates and report viewers', () => {
  const data = fixture();
  const command = { type: 'correct', recordId: 1, expectedRevision: 1, reason: 'Off', values: { ...data.records[0], isDayOff: true } };
  data.locks.push({ workDate: data.records[0].workDate });
  assert.throws(() => applyCommand(data, command), /dikunci/);
  data.locks = [];
  data.meta.role = 'REPORT_VIEWER';
  assert.throws(() => applyCommand(data, command), /akses/);
});

test('marking one attendance day as dayoff reduces report attendance count', () => {
  const data = fixture();
  data.records.push({ ...data.records[0], id: 2, workDate: '2026-09-21' });
  assert.equal(summarizeEmployees(data, range)[0].recordCount, 2);
  const result = applyCommand(data, { type: 'correct', recordId: 1, expectedRevision: 1, reason: 'Seharusnya off', values: { ...data.records[0], isDayOff: true } });
  assert.equal(summarizeEmployees(result, range)[0].recordCount, 1);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].scanIn, '08:00');
});

test('dinas luar correction uses employee schedule as effective scans and clears penalties', () => {
  const data = fixture();
  data.shifts = [{ id: 7, code: 'FIELD', name: 'Shift Lapangan', scheduleIn: '07:30', scheduleOut: '16:30', workDays: 5, isDefault: true, isActive: true }];
  data.shiftAssignments = [];
  data.records[0].lateMinutes = 75;
  data.records[0].earlyMinutes = 30;
  data.records[0].overtimeMinutes = 45;

  const result = applyCommand(data, {
    type: 'correct',
    recordId: 1,
    expectedRevision: 1,
    reason: 'Dinas luar kantor',
    values: { attendanceStatus: 'DINAS_LUAR', isDayOff: true, scanIn: null, scanOut: null, lateMinutes: 75, overtimeMinutes: 45 },
  });

  const record = result.records[0];
  assert.equal(record.attendanceStatus, 'DINAS_LUAR');
  assert.equal(record.isDayOff, false);
  assert.equal(record.scheduleIn, '07:30');
  assert.equal(record.scheduleOut, '16:30');
  assert.equal(record.scanIn, '07:30');
  assert.equal(record.scanOut, '16:30');
  assert.equal(record.rawScanIn, '08:00');
  assert.equal(record.rawScanOut, '17:00');
  assert.equal(record.lateMinutes, 0);
  assert.equal(record.earlyMinutes, 0);
  assert.equal(record.overtimeMinutes, 0);
  assert.equal(summarizeEmployees(result, range)[0].recordCount, 1);
});

test('new dinas luar on a scheduled day creates schedule-based effective scans without fake raw scans', () => {
  const data = fixture();
  data.shifts = [{ id: 8, code: 'OFFICE', name: 'Office', scheduleIn: '08:15', scheduleOut: '17:15', workDays: 5, isDefault: true, isActive: true }];
  data.shiftAssignments = [];

  const result = applyCommand(data, {
    type: 'record_attendance', employeeId: 1, workDate: '2026-09-21', attendanceStatus: 'DINAS_LUAR', reason: 'Kunjungan klien',
  });
  const record = result.records.find(row => row.workDate === '2026-09-21');
  assert.equal(record.scanIn, '08:15');
  assert.equal(record.scanOut, '17:15');
  assert.equal(record.rawScanIn, null);
  assert.equal(record.rawScanOut, null);
  assert.equal(record.isDayOff, false);
});

test('Tidak Hadir counts recorded Alpha only, excluding missing days, time off and future dates', () => {
  const data = fixture();
  const base = data.records[0];
  data.records = [
    ['2026-09-21', 'PRESENT'], ['2026-09-22', 'ALPHA'], ['2026-09-23', 'IZIN'],
    ['2026-09-24', 'SAKIT'], ['2026-09-25', 'CUTI'], ['2026-09-28', 'DINAS_LUAR'],
    ['2026-10-01', 'ALPHA'],
  ].map(([workDate, attendanceStatus], i) => ({ ...base, id: i + 1, workDate, attendanceStatus }));
  const period = { startDate: '2026-09-21', endDate: '2026-10-02' };
  const rows = summarizeEmployees(data, period, '2026-09-30');
  assert.equal(rows[0].absentCount, 1); // Only recorded Alpha on Sep 22; missing Sep 29/30 are not Alpha.
  assert.match(reportCsv(rows, period), /Tidak Hadir/);
  assert.match(reportCsv(rows, period, true), /Tidak Hadir/);
});

test('Tidak Hadir excludes dayoff and missing records, and counts each recorded date once', () => {
  const data = fixture();
  data.employees.push({ ...data.employees[0], id: 2, employeeCode: 'EMP-002', fullName: 'Tanpa Catatan' });
  data.records = [{ ...data.records[0], workDate: '2026-09-25', attendanceStatus: 'ALPHA' }];
  data.records.push({ ...data.records[0], id: 2 });
  data.records.push({ ...data.records[0], id: 3, workDate: '2026-09-26', isDayOff: true });
  const rows = summarizeEmployees(data, { startDate: '2026-09-25', endDate: '2026-09-27' }, '2026-09-30');
  assert.equal(rows[0].absentCount, 1);
  assert.equal(rows[1].absentCount, 0);
  assert.equal(summarizeEmployees(data, { startDate: '2026-10-01', endDate: '2026-10-02' }, '2026-09-30')[0].absentCount, 0);
});
