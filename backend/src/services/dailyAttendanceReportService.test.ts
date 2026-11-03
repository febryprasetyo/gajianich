import { test } from 'node:test';
import assert from 'node:assert';
import {
  formatDateHeader,
  formatTimeOnly,
  determineAttendanceSource,
  resolveKeterangan,
  computeIsLate,
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

