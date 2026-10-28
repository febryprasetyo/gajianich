import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { createAttendanceReportWorkbook } from "./excelExport.ts";

const dummyRows = [
  {
    employee: { id: 1, employeeCode: "EMP-001", fullName: "Budi Santoso", departmentId: 10, email: "budi@test.com", isActive: true },
    recordCount: 20,
    lateMinutes: 45,
    overtimeMinutes: 120,
    izinCount: 1,
    sakitCount: 2,
    cutiCount: 0,
    absentCount: 3,
  },
  {
    employee: { id: 2, employeeCode: "EMP-002", fullName: "Siti Rahma", departmentId: 20, email: "siti@test.com", isActive: true },
    recordCount: 22,
    lateMinutes: 0,
    overtimeMinutes: 60,
    izinCount: 0,
    sakitCount: 0,
    cutiCount: 3,
    absentCount: 0,
  },
];

const dummyFilter = {
  startDate: "2026-08-21",
  endDate: "2026-09-20",
};

test("creates Excel workbook with Rekap Absensi sheet (without payroll) and formatted data with Izin, Sakit, Cuti", () => {
  const wb = createAttendanceReportWorkbook(dummyRows, dummyFilter, {
    departmentLookup: id => (id === 10 ? "Finance" : "IT"),
  });

  // Sheet name MUST be "Rekap Absensi", not "Rekap Absensi Payroll"
  assert.ok(wb.SheetNames.includes("Rekap Absensi"));
  assert.ok(!wb.SheetNames.includes("Rekap Absensi Payroll"));
  const sheet = wb.Sheets["Rekap Absensi"];
  const rows = XLSX.utils.sheet_to_json(sheet);

  assert.equal(rows.length, 2);
  assert.equal(rows[0]["ID Karyawan"], "EMP-001");
  assert.equal(rows[0]["Nama Karyawan"], "Budi Santoso");
  assert.equal(rows[0]["Departemen"], "Finance");
  assert.equal(rows[0]["Periode Awal"], "2026-08-21");
  assert.equal(rows[0]["Periode Akhir"], "2026-09-20");
  assert.equal(rows[0]["Hari Hadir"], 20);
  assert.equal(rows[0]["Keterlambatan (Menit)"], 45);
  assert.equal(rows[0]["Lembur (Menit)"], 120);
  assert.equal(rows[0]["Izin"], 1);
  assert.equal(rows[0]["Sakit"], 2);
  assert.equal(rows[0]["Cuti"], 0);

  assert.equal(rows[1]["ID Karyawan"], "EMP-002");
  assert.equal(rows[1]["Nama Karyawan"], "Siti Rahma");
  assert.equal(rows[1]["Departemen"], "IT");
  assert.equal(rows[1]["Izin"], 0);
  assert.equal(rows[1]["Sakit"], 0);
  assert.equal(rows[1]["Cuti"], 3);
});

test("creates anonymous Excel workbook with Ringkasan Laporan sheet using Periode Awal and Periode Akhir", () => {
  const wb = createAttendanceReportWorkbook(dummyRows, dummyFilter, {
    anonymous: true,
  });

  assert.ok(wb.SheetNames.includes("Ringkasan Laporan"));
  const sheet = wb.Sheets["Ringkasan Laporan"];
  const rows = XLSX.utils.sheet_to_json(sheet);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]["Periode Awal"], "2026-08-21");
  assert.equal(rows[0]["Periode Akhir"], "2026-09-20");
  assert.equal(rows[0]["Total Karyawan"], 2);
  assert.equal(rows[0]["Total Kehadiran (Hari)"], 42);
  assert.equal(rows[0]["Total Keterlambatan (Menit)"], 45);
  assert.equal(rows[0]["Total Lembur (Menit)"], 180);
  assert.equal(rows[0]["Total Izin"], 1);
  assert.equal(rows[0]["Total Sakit"], 2);
  assert.equal(rows[0]["Total Cuti"], 3);
});

test("includes Rincian Harian sheet when dailyRecords are provided", () => {
  const dailyRecords = [
    {
      id: 101,
      employeeId: 1,
      workDate: "2026-08-21",
      shift: "Regular",
      scheduleIn: "08:00",
      scheduleOut: "17:00",
      scanIn: "08:15",
      scanOut: "18:00",
      lateMinutes: 15,
      earlyMinutes: 0,
      overtimeMinutes: 60,
      attendanceStatus: "PRESENT",
      isDayOff: false,
    },
  ];

  const wb = createAttendanceReportWorkbook(dummyRows.slice(0, 1), dummyFilter, {
    dailyRecords,
  });

  assert.ok(wb.SheetNames.includes("Rekap Absensi"));
  assert.ok(wb.SheetNames.includes("Rincian Harian"));

  const dailySheet = wb.Sheets["Rincian Harian"];
  const dailyRows = XLSX.utils.sheet_to_json(dailySheet);
  assert.equal(dailyRows.length, 1);
  assert.equal(dailyRows[0]["Tanggal"], "2026-08-21");
  assert.equal(dailyRows[0]["Scan Masuk"], "08:15");
  assert.equal(dailyRows[0]["Terlambat (Menit)"], 15);
  assert.equal(dailyRows[0]["Lembur (Menit)"], 60);
});

test('daily export labels dayoff and keeps scans without lateness penalties', () => {
  const wb = createAttendanceReportWorkbook(dummyRows, dummyFilter, { dailyRecords: [{ workDate: '2026-09-21', attendanceStatus: 'PRESENT', isDayOff: true, scanIn: '09:00', scanOut: '16:00', lateMinutes: 60, earlyMinutes: 60, overtimeMinutes: 30 }] });
  const [row] = XLSX.utils.sheet_to_json(wb.Sheets['Rincian Harian']);
  assert.equal(row.Status, 'DAYOFF');
  assert.equal(row['Scan Masuk'], '09:00');
  assert.equal(row['Terlambat (Menit)'], 0);
  assert.equal(row['Pulang Cepat (Menit)'], 0);
  assert.equal(row['Lembur (Menit)'], 30);
});

test('personal export uses calendar rows even when there are no raw attendance records', () => {
  const calendarRows = [
    {
      date: '2026-09-21',
      dayName: 'Senin',
      shiftName: 'Office',
      scheduleIn: '08:00',
      scheduleOut: '17:00',
      isDayOff: false,
      record: null,
    },
    {
      date: '2026-09-22',
      dayName: 'Selasa',
      shiftName: 'dayoff',
      scheduleIn: '00:00',
      scheduleOut: '00:00',
      isDayOff: true,
      record: null,
    },
  ];

  const wb = createAttendanceReportWorkbook(dummyRows.slice(0, 1), dummyFilter, { calendarRows });
  assert.ok(wb.SheetNames.includes('Rincian Harian'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Rincian Harian']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]['Tanggal'], '2026-09-21');
  assert.equal(rows[0]['Status'], 'BELUM ADA CATATAN');
  assert.equal(rows[1]['Status'], 'DAYOFF');
});

test('daily export labels dinas luar in Indonesian', () => {
  const wb = createAttendanceReportWorkbook(dummyRows, dummyFilter, { dailyRecords: [{
    workDate: '2026-09-22', attendanceStatus: 'DINAS_LUAR', isDayOff: false,
    scheduleIn: '08:00', scheduleOut: '17:00', scanIn: '08:00', scanOut: '17:00',
    lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0,
  }] });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Rincian Harian']);
  assert.equal(rows[0].Status, 'DINAS LUAR');
});


test('exports numeric Tidak Hadir per employee, including zero and anonymous total', () => {
  const normal = createAttendanceReportWorkbook(dummyRows, dummyFilter);
  const rows = XLSX.utils.sheet_to_json(normal.Sheets['Rekap Absensi']);
  assert.equal(rows[0]['Tidak Hadir'], 3);
  assert.equal(rows[1]['Tidak Hadir'], 0);
  const anonymous = createAttendanceReportWorkbook(dummyRows, dummyFilter, { anonymous: true });
  const summary = XLSX.utils.sheet_to_json(anonymous.Sheets['Ringkasan Laporan']);
  assert.equal(summary[0]['Total Tidak Hadir'], 3);
});


test('daily export marks only recorded Alpha, not missing calendar days or dayoff', () => {
  const base = { employeeId: 1, workDate: '2026-09-22', attendanceStatus: 'ALPHA', isDayOff: false };
  const wb = createAttendanceReportWorkbook(dummyRows.slice(0, 1), dummyFilter, { calendarRows: [
    { date: '2026-09-22', isDayOff: false, record: base },
    { date: '2026-09-23', isDayOff: false, record: null },
    { date: '2026-09-26', isDayOff: true, record: { ...base, workDate: '2026-09-26', isDayOff: true } },
  ] });
  const daily = XLSX.utils.sheet_to_json(wb.Sheets['Rincian Harian']);
  assert.deepEqual(daily.map(row => row['Tidak Hadir']), [1, 0, 0]);
});
