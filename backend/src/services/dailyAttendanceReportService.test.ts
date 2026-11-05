import { test } from 'node:test';
import assert from 'node:assert';
import {
  formatDateHeader,
  formatTimeOnly,
  determineAttendanceSource,
  resolveKeterangan,
  computeIsLate,
  resolveHierarchicalRosterOrder,
} from './dailyAttendanceReportService';

test('formatDateHeader formats YYYY-MM-DD into DD-MMM-YY standard print header', () => {
  assert.strictEqual(formatDateHeader('2026-10-30'), '30-Oct-26');
  assert.strictEqual(formatDateHeader('2026-10-28'), '28-Oct-26');
  assert.strictEqual(formatDateHeader('2026-01-05'), '05-Jan-26');
});

test('formatTimeOnly formats HH:mm:ss to HH:mm', () => {
  assert.strictEqual(formatTimeOnly('07:55:12'), '07:55');
  assert.strictEqual(formatTimeOnly('08:10'), '08:10');
  assert.strictEqual(formatTimeOnly(null), null);
});

test('determineAttendanceSource correctly identifies ADMS, MOBILE, LEAVE, or NONE', () => {
  // Mobile scan present
  assert.strictEqual(determineAttendanceSource({ hasSelfLog: true, hasRecordScan: true, hasLeave: false }), 'MOBILE');
  // Machine scan present
  assert.strictEqual(determineAttendanceSource({ hasSelfLog: false, hasRecordScan: true, hasLeave: false }), 'ADMS');
  // Leave present
  assert.strictEqual(determineAttendanceSource({ hasSelfLog: false, hasRecordScan: false, hasLeave: true }), 'LEAVE');
  // Neither
  assert.strictEqual(determineAttendanceSource({ hasSelfLog: false, hasRecordScan: false, hasLeave: false }), 'NONE');
});

test('resolveKeterangan prioritizes manual notes, then leaves, then attendance status, then TDK ADA ABSEN', () => {
  // Manual note takes highest priority
  assert.strictEqual(
    resolveKeterangan({
      manualNote: 'SAKIT (SDH INFO PAK SENDY) ADA SURAT DOKTER',
      leaveReason: 'Sakit flu',
      attendanceStatus: 'SAKIT',
      hasScanIn: false,
    }),
    'SAKIT (SDH INFO PAK SENDY) ADA SURAT DOKTER'
  );

  // Leave reason takes priority over generic status
  assert.strictEqual(
    resolveKeterangan({
      manualNote: null,
      leaveReason: 'CUTI TAHUNAN',
      attendanceStatus: 'CUTI',
      hasScanIn: false,
    }),
    'CUTI TAHUNAN'
  );

  // Attendance status CUTI in attendance_records without manual note or leave reason
  assert.strictEqual(
    resolveKeterangan({
      manualNote: null,
      leaveReason: null,
      attendanceStatus: 'CUTI',
      hasScanIn: false,
    }),
    'CUTI'
  );

  // Attendance status SAKIT
  assert.strictEqual(
    resolveKeterangan({
      manualNote: null,
      leaveReason: null,
      attendanceStatus: 'SAKIT',
      hasScanIn: false,
    }),
    'SAKIT'
  );

  // Attendance status IZIN
  assert.strictEqual(
    resolveKeterangan({
      manualNote: null,
      leaveReason: null,
      attendanceStatus: 'IZIN',
      hasScanIn: false,
    }),
    'IZIN'
  );

  // Attendance status DINAS_LUAR: tidak perlu teks 'DINAS LUAR' di keterangan karena lokasi sudah di kolom Lokasi Update
  assert.strictEqual(
    resolveKeterangan({
      manualNote: null,
      leaveReason: null,
      attendanceStatus: 'DINAS_LUAR',
      hasScanIn: true,
    }),
    ''
  );
  assert.strictEqual(
    resolveKeterangan({
      manualNote: null,
      leaveReason: null,
      attendanceStatus: 'DINAS_LUAR',
      hasScanIn: false,
    }),
    'TDK ADA ABSEN'
  );

  // isDayOff / LIBUR
  assert.strictEqual(
    resolveKeterangan({
      manualNote: null,
      leaveReason: null,
      attendanceStatus: 'PRESENT',
      isDayOff: true,
      hasScanIn: false,
    }),
    'LIBUR'
  );

  // Absent fallback (ALPHA or no record)
  assert.strictEqual(
    resolveKeterangan({
      manualNote: null,
      leaveReason: null,
      attendanceStatus: 'ALPHA',
      hasScanIn: false,
    }),
    'TDK ADA ABSEN'
  );

  // Present with no note
  assert.strictEqual(
    resolveKeterangan({
      manualNote: null,
      leaveReason: null,
      attendanceStatus: 'PRESENT',
      hasScanIn: true,
    }),
    ''
  );
});

test('computeIsLate honors late tolerance minutes and grace deduction', () => {
  // 1. Scan tepat waktu 08:00
  assert.deepEqual(
    computeIsLate({ scanIn: '08:00', scheduleIn: '08:00', lateToleranceMinutes: 5 }),
    { isLate: false, lateMinutes: 0 }
  );

  // 2. Scan 08:01 (telat 1m, masih dalam batas toleransi 5m) -> TIDAK TERLAMBAT
  assert.deepEqual(
    computeIsLate({ scanIn: '08:01', scheduleIn: '08:00', lateToleranceMinutes: 5 }),
    { isLate: false, lateMinutes: 0 }
  );

  // 3. Scan 08:05 (tepat batas toleransi 5m) -> TIDAK TERLAMBAT
  assert.deepEqual(
    computeIsLate({ scanIn: '08:05', scheduleIn: '08:00', lateToleranceMinutes: 5 }),
    { isLate: false, lateMinutes: 0 }
  );

  // 4. Scan 08:06 (lewat batas toleransi 5m) -> TERLAMBAT 1 menit (08:06 - 08:05)
  assert.deepEqual(
    computeIsLate({ scanIn: '08:06', scheduleIn: '08:00', lateToleranceMinutes: 5 }),
    { isLate: true, lateMinutes: 1 }
  );

  // 5. Pre-calculated record dengan lateMinutes: 0 (meski scanIn 08:01)
  assert.deepEqual(
    computeIsLate({ scanIn: '08:01', scheduleIn: '08:00', recordedLateMinutes: 0, lateToleranceMinutes: 5 }),
    { isLate: false, lateMinutes: 0 }
  );

  // 6. Pre-calculated record dengan lateMinutes: 10
  assert.deepEqual(
    computeIsLate({ scanIn: '08:15', scheduleIn: '08:00', recordedLateMinutes: 10, lateToleranceMinutes: 5 }),
    { isLate: true, lateMinutes: 10 }
  );

  // 7. Tanpa scanIn
  assert.deepEqual(
    computeIsLate({ scanIn: null, scheduleIn: '08:00' }),
    { isLate: false, lateMinutes: 0 }
  );
});

test('roster sorting sorts employees by sortOrder ASC, placing subordinates under coordinators', () => {
  const sampleEmployees = [
    { employeeId: 2, employeeName: 'Sofyan', sortOrder: 2, isCoordinator: false },
    { employeeId: 10, employeeName: 'Reza Adityawarman', sortOrder: 10, isCoordinator: true },
    { employeeId: 1, employeeName: 'Sendy', sortOrder: 1, isCoordinator: true },
    { employeeId: 11, employeeName: 'Yuli Yuliansari', sortOrder: 11, isCoordinator: false },
    { employeeId: 3, employeeName: 'Aldio Rizky Mulyawan', sortOrder: 3, isCoordinator: false },
    { employeeId: 99, employeeName: 'Zulham (New)', sortOrder: 999999, isCoordinator: false },
    { employeeId: 98, employeeName: 'Ahmad (New)', sortOrder: 999999, isCoordinator: false },
  ];

  sampleEmployees.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.employeeName.localeCompare(b.employeeName);
  });

  // Verify order
  assert.strictEqual(sampleEmployees[0].employeeName, 'Sendy');
  assert.strictEqual(sampleEmployees[1].employeeName, 'Sofyan');
  assert.strictEqual(sampleEmployees[2].employeeName, 'Aldio Rizky Mulyawan');
  assert.strictEqual(sampleEmployees[3].employeeName, 'Reza Adityawarman');
  assert.strictEqual(sampleEmployees[4].employeeName, 'Yuli Yuliansari');
  // Unassigned employees sorted alphabetically at the end
  assert.strictEqual(sampleEmployees[5].employeeName, 'Ahmad (New)');
  assert.strictEqual(sampleEmployees[6].employeeName, 'Zulham (New)');
});

test('moving employee x from coordinator y to coordinator a correctly repositions employee above coordinator y', () => {
  // Before: Yuli is under Reza (sortOrder 11)
  const roster = [
    { employeeId: 1, employeeName: 'Sendy', sortOrder: 1, isCoordinator: true },
    { employeeId: 2, employeeName: 'Sofyan', sortOrder: 2, isCoordinator: false },
    { employeeId: 10, employeeName: 'Reza Adityawarman', sortOrder: 10, isCoordinator: true },
    { employeeId: 11, employeeName: 'Yuli Yuliansari', sortOrder: 11, isCoordinator: false },
  ];

  // Action: Move Yuli to Sendy's team at sortOrder 3
  const updatedRoster = roster.map(emp => {
    if (emp.employeeId === 11) {
      return { ...emp, sortOrder: 3 };
    }
    return emp;
  });

  updatedRoster.sort((a, b) => a.sortOrder - b.sortOrder);

  // Yuli is now at index 2 (above Reza at index 3)
  assert.strictEqual(updatedRoster[0].employeeName, 'Sendy');
  assert.strictEqual(updatedRoster[1].employeeName, 'Sofyan');
  assert.strictEqual(updatedRoster[2].employeeName, 'Yuli Yuliansari');
  assert.strictEqual(updatedRoster[3].employeeName, 'Reza Adityawarman');
});

test('resolveHierarchicalRosterOrder groups employees under their coordinator regardless of initial position', () => {
  const unorderedList = [
    { employeeId: 10, employeeName: 'Reza Adityawarman', sortOrder: 5, isCoordinator: true, coordinatorId: null },
    { employeeId: 1, employeeName: 'Sendy', sortOrder: 1, isCoordinator: true, coordinatorId: null },
    { employeeId: 15, employeeName: 'Dian', sortOrder: 15, isCoordinator: false, coordinatorId: 1 }, // Dian assigned to Sendy (ID 1)
    { employeeId: 11, employeeName: 'Aris Rahman', sortOrder: 12, isCoordinator: false, coordinatorId: 10 }, // Aris assigned to Reza (ID 10)
    { employeeId: 2, employeeName: 'Sofyan', sortOrder: 2, isCoordinator: false, coordinatorId: 1 }, // Sofyan assigned to Sendy (ID 1)
  ];

  const ordered = resolveHierarchicalRosterOrder(unorderedList);

  // Sendy and his subordinates MUST come first
  assert.strictEqual(ordered[0].employeeName, 'Sendy');
  assert.strictEqual(ordered[0].sortOrder, 1);
  assert.strictEqual(ordered[1].employeeName, 'Sofyan');
  assert.strictEqual(ordered[1].sortOrder, 2);
  assert.strictEqual(ordered[2].employeeName, 'Dian'); // Dian follows Sendy above Reza!
  assert.strictEqual(ordered[2].sortOrder, 3);

  // Reza and his subordinates come next
  assert.strictEqual(ordered[3].employeeName, 'Reza Adityawarman');
  assert.strictEqual(ordered[3].sortOrder, 4);
  assert.strictEqual(ordered[4].employeeName, 'Aris Rahman');
  assert.strictEqual(ordered[4].sortOrder, 5);
});

test('resolveHierarchicalRosterOrder places unassigned staff at the bottom, never between coordinators', () => {
  const listWithUnassigned = [
    { employeeId: 104, employeeName: 'ANISA PERMATASARI', sortOrder: 1, isCoordinator: true, coordinatorId: null },
    { employeeId: 98, employeeName: 'LOLITA AYU PERMATA DEWI', sortOrder: 2, isCoordinator: false, coordinatorId: 104 },
    { employeeId: 91, employeeName: 'ARIS RAHMAN', sortOrder: 3, isCoordinator: false, coordinatorId: null }, // Unassigned
    { employeeId: 94, employeeName: 'FRANS IVAN ATMADJA', sortOrder: 4, isCoordinator: false, coordinatorId: null }, // Unassigned
    { employeeId: 87, employeeName: 'GEMASIH', sortOrder: 5, isCoordinator: true, coordinatorId: null },
    { employeeId: 86, employeeName: 'ALDIO RIZKY MULYAWAN', sortOrder: 6, isCoordinator: false, coordinatorId: 87 },
  ];

  const ordered = resolveHierarchicalRosterOrder(listWithUnassigned);

  // Group 1: Anisa & Lolita
  assert.strictEqual(ordered[0].employeeName, 'ANISA PERMATASARI');
  assert.strictEqual(ordered[1].employeeName, 'LOLITA AYU PERMATA DEWI');

  // Group 2: Gemasih & Aldio (MUST come before unassigned Aris & Frans!)
  assert.strictEqual(ordered[2].employeeName, 'GEMASIH');
  assert.strictEqual(ordered[3].employeeName, 'ALDIO RIZKY MULYAWAN');

  // Unassigned at the end
  assert.strictEqual(ordered[4].employeeName, 'ARIS RAHMAN');
  assert.strictEqual(ordered[5].employeeName, 'FRANS IVAN ATMADJA');
});


