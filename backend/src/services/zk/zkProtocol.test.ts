import { test } from "node:test";
import assert from "node:assert";
import {
  decodeZkTime,
  encodeZkTime,
  checksum,
  mapVerifyMode,
  mapInOutState,
  parse40ByteAttendanceRecord,
  parseAttendanceRecordsBuffer,
} from "./zkProtocol";

test("decodeZkTime and encodeZkTime correctly roundtrip timestamp", () => {
  const original = "2026-10-27 08:30:15";
  const encoded = encodeZkTime(original);
  const decoded = decodeZkTime(encoded);
  assert.strictEqual(decoded, original);

  const evening = "2026-10-27 17:05:42";
  const encEvening = encodeZkTime(evening);
  const decEvening = decodeZkTime(encEvening);
  assert.strictEqual(decEvening, evening);
});

test("mapVerifyMode maps raw codes to legible strings", () => {
  assert.strictEqual(mapVerifyMode(1), "Fingerprint");
  assert.strictEqual(mapVerifyMode(15), "Face");
  assert.strictEqual(mapVerifyMode(20), "Face");
  assert.strictEqual(mapVerifyMode(0), "Password");
  assert.strictEqual(mapVerifyMode(2), "Card");
});

test("mapInOutState maps punch states to Masuk, Pulang, or Scan Antara", () => {
  assert.strictEqual(mapInOutState(0), "Masuk");
  assert.strictEqual(mapInOutState(4), "Masuk");
  assert.strictEqual(mapInOutState(1), "Pulang");
  assert.strictEqual(mapInOutState(5), "Pulang");
  assert.strictEqual(mapInOutState(2), "Scan Antara");
});

test("parse40ByteAttendanceRecord extracts PIN, verifyMode, inOutState, and timestamp", () => {
  const buf = Buffer.alloc(40);
  buf.write("50181", 0, "ascii"); // PIN
  buf[24] = 0; // State: Masuk
  buf[25] = 15; // Verify: Face
  const encodedTime = encodeZkTime("2026-10-27 07:58:20");
  buf.writeUInt32LE(encodedTime, 26);

  const punch = parse40ByteAttendanceRecord(buf);
  assert.ok(punch);
  assert.strictEqual(punch.pin, "50181");
  assert.strictEqual(punch.inOutState, "Masuk");
  assert.strictEqual(punch.verifyMode, "Face");
  assert.strictEqual(punch.timestamp, "2026-10-27 07:58:20");
  assert.strictEqual(punch.workDate, "2026-10-27");
});

test("parseAttendanceRecordsBuffer extracts multiple records from a batch", () => {
  const buf = Buffer.alloc(80);

  // Record 1
  buf.write("101", 0, "ascii");
  buf[24] = 0;
  buf[25] = 1;
  buf.writeUInt32LE(encodeZkTime("2026-10-27 08:00:00"), 26);

  // Record 2
  buf.write("102", 40, "ascii");
  buf[40 + 24] = 1;
  buf[40 + 25] = 2;
  buf.writeUInt32LE(encodeZkTime("2026-10-27 17:02:10"), 40 + 26);

  const punches = parseAttendanceRecordsBuffer(buf);
  assert.strictEqual(punches.length, 2);
  assert.strictEqual(punches[0].pin, "101");
  assert.strictEqual(punches[0].inOutState, "Masuk");
  assert.strictEqual(punches[1].pin, "102");
  assert.strictEqual(punches[1].inOutState, "Pulang");
});
