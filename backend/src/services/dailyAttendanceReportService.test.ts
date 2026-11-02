import { test } from 'node:test';
import assert from 'node:assert';
import {
  formatDateHeader,
  formatTimeOnly,
  determineAttendanceSource,
  resolveKeterangan,
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

  // Attendance status DINAS_LUAR
  assert.strictEqual(
    resolveKeterangan({
      manualNote: null,
      leaveReason: null,
      attendanceStatus: 'DINAS_LUAR',
      hasScanIn: false,
    }),
    'DINAS LUAR'
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

