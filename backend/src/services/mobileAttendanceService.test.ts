import { test } from "node:test";
import assert from "node:assert";
import {
  formatDurationMinutes,
  calculateLateMinutes,
  getWibDateAndTimeString,
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
