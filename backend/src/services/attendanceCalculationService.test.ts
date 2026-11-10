import { test } from "node:test";
import assert from "node:assert";
import {
  calculateAttendanceFromPunches,
  extractTimeHHmm,
  parseMinutesFromTime,
  mergeAttendanceScans,
} from "./attendanceCalculationService";
import type { WorkShift, ShiftAssignment, WorkHoursTemplate } from "../domain/attendanceTypes";

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
  // Toleransi 5m: 08:25 adalah 25 menit setelah jadwal 08:00, dikurangi toleransi 5m -> terlambat 20 menit
  assert.strictEqual(record.lateMinutes, 20);
  assert.strictEqual(record.statusLabel, "Terlambat");
  assert.strictEqual(record.attendanceStatus, "LATE");
});

test("calculateAttendanceFromPunches respects late tolerance for 08:01 and 08:05 (on-time) and 08:06 (late 1m)", () => {
  const employeesMap = new Map();
  employeesMap.set(101, { id: 101, nik: "101", fullName: "Budi Santoso", departmentName: "IT", departmentId: 1 });

  // 1. Scan 08:01 (telat 1m, masih dalam batas toleransi 5m) -> on time
  const punches0801 = [
    { pin: "101", employeeId: 101, timestamp: "2026-10-27 08:01:00", workDate: "2026-10-27" },
    { pin: "101", employeeId: 101, timestamp: "2026-10-27 17:00:00", workDate: "2026-10-27" },
  ];
  const res0801 = calculateAttendanceFromPunches(punches0801, employeesMap, MOCK_SHIFTS, MOCK_ASSIGNMENTS);
  assert.strictEqual(res0801.processedRecords[0].lateMinutes, 0);
  assert.strictEqual(res0801.processedRecords[0].statusLabel, "Hadir Tepat Waktu");
  assert.strictEqual(res0801.processedRecords[0].attendanceStatus, "PRESENT");

  // 2. Scan 08:05 (tepat batas toleransi 5m) -> on time
  const punches0805 = [
    { pin: "101", employeeId: 101, timestamp: "2026-10-27 08:05:00", workDate: "2026-10-27" },
    { pin: "101", employeeId: 101, timestamp: "2026-10-27 17:00:00", workDate: "2026-10-27" },
  ];
  const res0805 = calculateAttendanceFromPunches(punches0805, employeesMap, MOCK_SHIFTS, MOCK_ASSIGNMENTS);
  assert.strictEqual(res0805.processedRecords[0].lateMinutes, 0);
  assert.strictEqual(res0805.processedRecords[0].statusLabel, "Hadir Tepat Waktu");
  assert.strictEqual(res0805.processedRecords[0].attendanceStatus, "PRESENT");

  // 3. Scan 08:06 (lewat 1 menit dari batas toleransi 5m) -> terlambat 1 menit
  const punches0806 = [
    { pin: "101", employeeId: 101, timestamp: "2026-10-27 08:06:00", workDate: "2026-10-27" },
    { pin: "101", employeeId: 101, timestamp: "2026-10-27 17:00:00", workDate: "2026-10-27" },
  ];
  const res0806 = calculateAttendanceFromPunches(punches0806, employeesMap, MOCK_SHIFTS, MOCK_ASSIGNMENTS);
  assert.strictEqual(res0806.processedRecords[0].lateMinutes, 1);
  assert.strictEqual(res0806.processedRecords[0].statusLabel, "Terlambat");
  assert.strictEqual(res0806.processedRecords[0].attendanceStatus, "LATE");
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

test("mergeAttendanceScans connects mobile IN and machine OUT seamlessly", () => {
  // Scenario: Employee clocked in on mobile at 08:00, then punched out on physical machine at 17:05
  const previousMobileRecord = {
    scanIn: "08:00",
    scanOut: null,
    scheduleIn: "08:00",
    scheduleOut: "17:00",
    attendanceStatus: "PRESENT",
  };
  const machineCalculation = {
    scanIn: "17:05", // Single machine punch in the afternoon
    scanOut: null,
    scheduleIn: "08:00",
    scheduleOut: "17:00",
    attendanceStatus: "PRESENT",
  };

  const merged = mergeAttendanceScans(previousMobileRecord, machineCalculation);

  assert.strictEqual(merged.scanIn, "08:00");
  assert.strictEqual(merged.scanOut, "17:05");
  assert.strictEqual(merged.lateMinutes, 0);
  assert.strictEqual(merged.earlyMinutes, 0);
  assert.strictEqual(merged.attendanceStatus, "PRESENT");
});

test("mergeAttendanceScans preserves mobile OUT when machine calculation processes morning IN", () => {
  // Scenario: Machine IN 07:55, Mobile OUT 17:15
  const previousMobileRecord = {
    scanIn: null,
    scanOut: "17:15",
    scheduleIn: "08:00",
    scheduleOut: "17:00",
    attendanceStatus: "PRESENT",
  };
  const machineCalculation = {
    scanIn: "07:55",
    scanOut: null,
    scheduleIn: "08:00",
    scheduleOut: "17:00",
    attendanceStatus: "PRESENT",
  };

  const merged = mergeAttendanceScans(previousMobileRecord, machineCalculation);

  assert.strictEqual(merged.scanIn, "07:55");
  assert.strictEqual(merged.scanOut, "17:15");
  assert.strictEqual(merged.lateMinutes, 0);
  assert.strictEqual(merged.earlyMinutes, 0);
});

test("mergeAttendanceScans correctly computes late minutes from mobile IN with machine OUT", () => {
  // Scenario: Mobile IN 08:25 (tardy 25 mins), Machine OUT 17:00
  const previousMobileRecord = {
    scanIn: "08:25",
    scanOut: null,
    scheduleIn: "08:00",
    scheduleOut: "17:00",
  };
  const machineCalculation = {
    scanIn: "17:00",
    scanOut: null,
    scheduleIn: "08:00",
    scheduleOut: "17:00",
  };

  const merged = mergeAttendanceScans(previousMobileRecord, machineCalculation);

  assert.strictEqual(merged.scanIn, "08:25");
  assert.strictEqual(merged.scanOut, "17:00");
  assert.strictEqual(merged.lateMinutes, 25);
  assert.strictEqual(merged.earlyMinutes, 0);

  // With tolerance 5m: 08:25 - 08:05 = 20m
  const mergedWithTol = mergeAttendanceScans(previousMobileRecord, machineCalculation, { lateToleranceMinutes: 5 });
  assert.strictEqual(mergedWithTol.lateMinutes, 20);
});

test("mergeAttendanceScans preserves machine scans when no previous mobile record exists", () => {
  const machineCalculation = {
    scanIn: "07:50",
    scanOut: "17:10",
    scheduleIn: "08:00",
    scheduleOut: "17:00",
    attendanceStatus: "PRESENT",
  };

  const merged = mergeAttendanceScans(null, machineCalculation);

  assert.strictEqual(merged.scanIn, "07:50");
  assert.strictEqual(merged.scanOut, "17:10");
  assert.strictEqual(merged.lateMinutes, 0);
  assert.strictEqual(merged.earlyMinutes, 0);
});

test("calculateAttendanceFromPunches correctly allocates single evening punch to scanOut (no false tardiness)", () => {
  const officeWorkHours: WorkHoursTemplate = {
    id: 10,
    name: "Office Reguler",
    scheduleIn: "08:00",
    scheduleOut: "17:00",
    scanInStart: "06:00",
    scanInEnd: "10:00",
    scanOutStart: "15:00",
    scanOutEnd: "23:59",
    lateToleranceMinutes: 5,
    earlyLeaveToleranceMinutes: 5,
    requireCheckIn: true,
    requireCheckOut: true,
    isActive: true,
  };

  const shiftWithWorkHours: WorkShift = {
    id: 1,
    code: "OFFICE",
    name: "Office Reguler (Default)",
    mondayWorkHoursId: 10,
    tuesdayWorkHoursId: 10,
    wednesdayWorkHoursId: 10,
    thursdayWorkHoursId: 10,
    fridayWorkHoursId: 10,
    isDefault: true,
    isActive: true,
  };

  const workHoursMap = new Map<number, WorkHoursTemplate>([[10, officeWorkHours]]);

  // 2026-03-05 is a Thursday
  const punches = [
    { pin: "3085", employeeId: 177, timestamp: "2026-03-05 17:02:15", workDate: "2026-03-05" },
  ];

  const employeesMap = new Map();
  employeesMap.set(177, { id: 177, nik: "3085", fullName: "Ilham Ekayana", departmentName: "Umum", departmentId: 1 });

  const result = calculateAttendanceFromPunches(
    punches,
    employeesMap,
    [shiftWithWorkHours],
    [],
    { assignDefaultShiftIfUnassigned: true, workHoursMap }
  );

  assert.strictEqual(result.totalProcessed, 1);
  const rec = result.processedRecords[0];
  assert.strictEqual(rec.scanIn, null, "scanIn should be null because punch was made during checkout window");
  assert.strictEqual(rec.scanOut, "17:02", "scanOut should be 17:02");
  assert.strictEqual(rec.lateMinutes, 0, "lateMinutes must be 0, not 537m!");
  assert.strictEqual(rec.earlyMinutes, 0, "earlyMinutes is 0 since 17:02 >= 17:00");
  assert.strictEqual(rec.statusLabel, "Tidak Scan Masuk");
});

test("calculateAttendanceFromPunches allocates punch with inOutState='Pulang' to scanOut even without template", () => {
  const punches = [
    { pin: "3086", employeeId: 222, timestamp: "2026-03-05 17:04:00", workDate: "2026-03-05", inOutState: "Pulang" },
  ];

  const employeesMap = new Map();
  employeesMap.set(222, { id: 222, nik: "3086", fullName: "Vincent Galih Danindra", departmentName: "Umum", departmentId: 1 });

  const result = calculateAttendanceFromPunches(
    punches,
    employeesMap,
    MOCK_SHIFTS,
    MOCK_ASSIGNMENTS,
    { assignDefaultShiftIfUnassigned: true }
  );

  assert.strictEqual(result.totalProcessed, 1);
  const rec = result.processedRecords[0];
  assert.strictEqual(rec.scanIn, null);
  assert.strictEqual(rec.scanOut, "17:04");
  assert.strictEqual(rec.lateMinutes, 0);
  assert.strictEqual(rec.statusLabel, "Tidak Scan Masuk");
});

test("calculateAttendanceFromPunches allocates afternoon punches to scanOut via schedule midpoint fallback", () => {
  // Legacy shift without workHoursMap (08:00 - 17:00, midpoint is 12:30)
  const punches = [
    { pin: "3050", employeeId: 181, timestamp: "2026-03-05 17:05:00", workDate: "2026-03-05" },
  ];

  const employeesMap = new Map();
  employeesMap.set(181, { id: 181, nik: "3050", fullName: "Julianto Syahputra", departmentName: "Umum", departmentId: 1 });

  const result = calculateAttendanceFromPunches(
    punches,
    employeesMap,
    MOCK_SHIFTS,
    MOCK_ASSIGNMENTS,
    { assignDefaultShiftIfUnassigned: true }
  );

  const rec = result.processedRecords[0];
  assert.strictEqual(rec.scanIn, null);
  assert.strictEqual(rec.scanOut, "17:05");
  assert.strictEqual(rec.lateMinutes, 0);
  assert.strictEqual(rec.statusLabel, "Tidak Scan Masuk");
});

test("calculateAttendanceFromPunches handles multiple evening punches cleanly (taking last for scanOut)", () => {
  const punches = [
    { pin: "3102", employeeId: 208, timestamp: "2026-03-05 17:01:00", workDate: "2026-03-05" },
    { pin: "3102", employeeId: 208, timestamp: "2026-03-05 17:09:00", workDate: "2026-03-05" },
  ];

  const employeesMap = new Map();
  employeesMap.set(208, { id: 208, nik: "3102", fullName: "Amir Al Katiri", departmentName: "Umum", departmentId: 1 });

  const result = calculateAttendanceFromPunches(
    punches,
    employeesMap,
    MOCK_SHIFTS,
    MOCK_ASSIGNMENTS,
    { assignDefaultShiftIfUnassigned: true }
  );

  const rec = result.processedRecords[0];
  assert.strictEqual(rec.scanIn, null);
  assert.strictEqual(rec.scanOut, "17:09");
  assert.strictEqual(rec.lateMinutes, 0);
  assert.strictEqual(rec.statusLabel, "Tidak Scan Masuk");
});
