import { test } from "node:test";
import assert from "node:assert";
import {
  calculateAttendanceFromPunches,
  extractTimeHHmm,
  parseMinutesFromTime,
} from "./attendanceCalculationService";
import type { WorkShift, ShiftAssignment } from "../domain/attendanceTypes";

const MOCK_SHIFTS: WorkShift[] = [
  {
    id: 1,
    code: "OFFICE",
    name: "Office Reguler",
    scheduleIn: "08:00",
    scheduleOut: "17:00",
    workDays: 5,
    isDefault: true,
    isActive: true,
  },
  {
    id: 2,
    code: "PROD_6D",
    name: "Produksi 6 Hari",
    scheduleIn: "08:00",
    scheduleOut: "16:00",
    workDays: 6,
    isDefault: false,
    isActive: true,
  },
];

const MOCK_ASSIGNMENTS: ShiftAssignment[] = [
  {
    id: 1,
    employeeId: 101,
    shiftId: 1, // Office
  },
];

test("extractTimeHHmm formats timestamps properly", () => {
  assert.strictEqual(extractTimeHHmm("2026-10-27 07:55:12"), "07:55");
  assert.strictEqual(extractTimeHHmm("2026-10-27 17:02:45"), "17:02");
  assert.strictEqual(extractTimeHHmm("08:30"), "08:30");
});

test("calculateAttendanceFromPunches applies FIFO: First-In, Last-Out for multiple taps", () => {
  const punches = [
    { pin: "101", employeeId: 101, timestamp: "2026-10-27 07:50:00", workDate: "2026-10-27" },
    { pin: "101", employeeId: 101, timestamp: "2026-10-27 12:05:00", workDate: "2026-10-27" }, // lunch scan
    { pin: "101", employeeId: 101, timestamp: "2026-10-27 17:05:00", workDate: "2026-10-27" },
  ];

  const employeesMap = new Map();
  employeesMap.set(101, { id: 101, nik: "101", fullName: "Budi Santoso", departmentName: "IT", departmentId: 1 });

  const result = calculateAttendanceFromPunches(punches, employeesMap, MOCK_SHIFTS, MOCK_ASSIGNMENTS);

  assert.strictEqual(result.totalProcessed, 1);
  assert.strictEqual(result.totalUnassigned, 0);

  const record = result.processedRecords[0];
  assert.strictEqual(record.scanIn, "07:50");
  assert.strictEqual(record.scanOut, "17:05");
  assert.strictEqual(record.lateMinutes, 0);
  assert.strictEqual(record.statusLabel, "Hadir Tepat Waktu");
  assert.strictEqual(record.rawPunchesCount, 3);
});

test("calculateAttendanceFromPunches flags tardiness correctly", () => {
  const punches = [
    { pin: "101", employeeId: 101, timestamp: "2026-10-27 08:25:00", workDate: "2026-10-27" },
    { pin: "101", employeeId: 101, timestamp: "2026-10-27 17:00:00", workDate: "2026-10-27" },
  ];

  const employeesMap = new Map();
  employeesMap.set(101, { id: 101, nik: "101", fullName: "Budi Santoso", departmentName: "IT", departmentId: 1 });

  const result = calculateAttendanceFromPunches(punches, employeesMap, MOCK_SHIFTS, MOCK_ASSIGNMENTS);

  const record = result.processedRecords[0];
  assert.strictEqual(record.lateMinutes, 25);
  assert.strictEqual(record.statusLabel, "Terlambat");
  assert.strictEqual(record.attendanceStatus, "LATE");
});

test("calculateAttendanceFromPunches routes unassigned employees to unassignedShiftRecords", () => {
  const punches = [
    { pin: "999", employeeId: 999, timestamp: "2026-10-27 07:55:00", workDate: "2026-10-27" },
    { pin: "999", employeeId: 999, timestamp: "2026-10-27 17:01:00", workDate: "2026-10-27" },
  ];

  const employeesMap = new Map();
  employeesMap.set(999, { id: 999, nik: "999", fullName: "Karyawan Baru", departmentName: "Produksi", departmentId: 2 });

  // 999 has NO active assignment in MOCK_ASSIGNMENTS
  const result = calculateAttendanceFromPunches(punches, employeesMap, MOCK_SHIFTS, MOCK_ASSIGNMENTS);

  assert.strictEqual(result.totalProcessed, 0);
  assert.strictEqual(result.totalUnassigned, 1);

  const unassigned = result.unassignedShiftRecords[0];
  assert.strictEqual(unassigned.employeeCode, "999");
  assert.strictEqual(unassigned.employeeName, "Karyawan Baru");
  assert.strictEqual(unassigned.scanIn, "07:55");
  assert.strictEqual(unassigned.scanOut, "17:01");
});

test("calculateAttendanceFromPunches processes unassigned under default if requested", () => {
  const punches = [
    { pin: "999", employeeId: 999, timestamp: "2026-10-27 07:55:00", workDate: "2026-10-27" },
    { pin: "999", employeeId: 999, timestamp: "2026-10-27 17:01:00", workDate: "2026-10-27" },
  ];

  const employeesMap = new Map();
  employeesMap.set(999, { id: 999, nik: "999", fullName: "Karyawan Baru", departmentName: "Produksi", departmentId: 2 });

  const result = calculateAttendanceFromPunches(punches, employeesMap, MOCK_SHIFTS, MOCK_ASSIGNMENTS, {
    assignDefaultShiftIfUnassigned: true,
  });

  assert.strictEqual(result.totalProcessed, 1);
  assert.strictEqual(result.totalUnassigned, 0);
  assert.strictEqual(result.processedRecords[0].shiftCode, "OFFICE");
});
