import { test } from "node:test";
import assert from "node:assert";
import {
  formatDurationMinutes,
  calculateLateMinutes,
  getWibDateAndTimeString,
  resolveFirstInLastOutLogs,
  validateClockAllowed,
} from "./mobileAttendanceService";

test("getWibDateAndTimeString formats current date as YYYY-MM-DD and HH:mm in WIB", () => {
  const { workDate, scanTime } = getWibDateAndTimeString();
  assert.match(workDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(scanTime, /^\d{2}:\d{2}$/);
});

test("calculateLateMinutes correctly computes late minutes against shift schedule", () => {
  // Scheduled 08:00, scanned 08:25 -> 25 minutes late
  const late = calculateLateMinutes("08:25", "08:00");
  assert.strictEqual(late, 25);

  // Scheduled 08:00, scanned 07:55 -> 0 minutes late
  const onTime = calculateLateMinutes("07:55", "08:00");
  assert.strictEqual(onTime, 0);

  // Scheduled 08:00, scanned 08:00 -> 0 minutes late
  const exact = calculateLateMinutes("08:00", "08:00");
  assert.strictEqual(exact, 0);
});

test("formatDurationMinutes formats total minutes into clean hours and minutes", () => {
  assert.strictEqual(formatDurationMinutes(255), "04h 15m");
  assert.strictEqual(formatDurationMinutes(480), "08h 00m");
  assert.strictEqual(formatDurationMinutes(0), "00h 00m");
  assert.strictEqual(formatDurationMinutes(-10), "--:--");
});

test("resolveFirstInLastOutLogs resolves First In (earliest IN) and Last Out (latest OUT)", () => {
  // Kasus nyata 50181: IN 10:14, OUT 17:05, IN 17:06 (duplikat)
  const logs1 = [
    { id: 1, eventType: "IN", scanTime: "10:14", occurredAt: new Date("2026-10-26T03:14:00Z"), approvalStatus: "APPROVED" },
    { id: 2, eventType: "OUT", scanTime: "17:05", occurredAt: new Date("2026-10-26T10:05:00Z"), approvalStatus: "APPROVED" },
    { id: 3, eventType: "IN", scanTime: "17:06", occurredAt: new Date("2026-10-26T10:06:00Z"), approvalStatus: "APPROVED" },
  ];
  const res1 = resolveFirstInLastOutLogs(logs1);
  assert.strictEqual(res1.inLog?.scanTime, "10:14");
  assert.strictEqual(res1.outLog?.scanTime, "17:05");

  // Kasus double check-in dan double check-out
  const logs2 = [
    { id: 10, eventType: "IN", scanTime: "07:30", occurredAt: new Date("2026-10-26T00:30:00Z"), approvalStatus: "APPROVED" },
    { id: 11, eventType: "IN", scanTime: "07:31", occurredAt: new Date("2026-10-26T00:31:00Z"), approvalStatus: "APPROVED" },
    { id: 12, eventType: "OUT", scanTime: "17:00", occurredAt: new Date("2026-10-26T10:00:00Z"), approvalStatus: "APPROVED" },
    { id: 13, eventType: "OUT", scanTime: "17:05", occurredAt: new Date("2026-10-26T10:05:00Z"), approvalStatus: "APPROVED" },
  ];
  const res2 = resolveFirstInLastOutLogs(logs2);
  assert.strictEqual(res2.inLog?.scanTime, "07:30");
  assert.strictEqual(res2.outLog?.scanTime, "17:05");
});

test("validateClockAllowed blocks new IN scan when todays shift is already completed (has IN and OUT)", () => {
  const todayLogs = [
    { eventType: "IN", workDate: "2026-10-27" },
    { eventType: "OUT", workDate: "2026-10-27" },
  ];

  assert.throws(
    () => validateClockAllowed("IN", "2026-10-27", todayLogs),
    /Presensi hari ini sudah lengkap/
  );

  assert.doesNotThrow(() => validateClockAllowed("IN", "2026-10-28", todayLogs));
});

test("MIN_CHECKOUT_INTERVAL_MINUTES is 30 minutes", () => {
  const { MIN_CHECKOUT_INTERVAL_MINUTES } = require("./mobileAttendanceService");
  assert.strictEqual(MIN_CHECKOUT_INTERVAL_MINUTES, 30);
});

test("validateClockAllowed blocks OUT scan within 30 minutes of Clock In", () => {
  const { validateClockAllowed } = require("./mobileAttendanceService");

  const recentInLogs = [
    { eventType: "IN", workDate: "2026-10-27", occurredAt: new Date(Date.now() - 5 * 60 * 1000) }, // 5 mins ago
  ];

  // Trying to clock OUT within 5 minutes must throw
  assert.throws(
    () => validateClockAllowed("OUT", "2026-10-27", recentInLogs, new Date()),
    /minimal 30 menit setelah absen masuk/
  );

  // Trying to clock OUT after 31 minutes is allowed
  const pastInLogs = [
    { eventType: "IN", workDate: "2026-10-27", occurredAt: new Date(Date.now() - 35 * 60 * 1000) }, // 35 mins ago
  ];
  assert.doesNotThrow(() => validateClockAllowed("OUT", "2026-10-27", pastInLogs, new Date()));
});

test("validateClockAllowed permits subsequent OUT scans (Last Out update) after shift is completed", () => {
  const { validateClockAllowed } = require("./mobileAttendanceService");

  const completedShiftLogs = [
    { eventType: "IN", workDate: "2026-10-27", occurredAt: new Date("2026-10-27T08:00:00Z") },
    { eventType: "OUT", workDate: "2026-10-27", occurredAt: new Date("2026-10-27T17:00:00Z") },
  ];

  // OUT scan at 17:30 to update Last Out is allowed
  assert.doesNotThrow(() => validateClockAllowed("OUT", "2026-10-27", completedShiftLogs, new Date("2026-10-27T17:30:00Z")));

  // But another IN scan on completed day is still blocked
  assert.throws(
    () => validateClockAllowed("IN", "2026-10-27", completedShiftLogs, new Date("2026-10-27T17:30:00Z")),
    /Presensi hari ini sudah lengkap/
  );
});
