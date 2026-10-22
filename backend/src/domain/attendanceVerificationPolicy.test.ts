import { test } from "node:test";
import assert from "node:assert";
import {
  determineShiftCategory,
  evaluateAttendanceApproval,
} from "./attendanceVerificationPolicy";

test("determineShiftCategory identifies Office vs Production shifts", () => {
  assert.strictEqual(determineShiftCategory({ code: "OFFICE", name: "Office Reguler" }), "OFFICE");
  assert.strictEqual(determineShiftCategory({ code: "OFFICE_FLEXI", name: "Office Fleksibel" }), "OFFICE");
  assert.strictEqual(determineShiftCategory({ code: "PROD_6D", name: "Produksi 6 Hari" }), "PRODUCTION");
  assert.strictEqual(determineShiftCategory({ code: "SHIFT_1", name: "Produksi Shift 1" }), "PRODUCTION");
  // Fallback defaults to OFFICE
  assert.strictEqual(determineShiftCategory({ code: "UNKNOWN", name: "Staff Umum" }), "OFFICE");
});

test("evaluateAttendanceApproval for Office shift: IN is PENDING, OUT inside geofence is APPROVED", () => {
  // Office IN inside geofence -> PENDING
  const inRes = evaluateAttendanceApproval("OFFICE", "IN", true);
  assert.strictEqual(inRes.requiresVerification, true);
  assert.strictEqual(inRes.approvalStatus, "PENDING");
  assert.ok(inRes.approvalNote.includes("verifikasi"));

  // Office OUT inside geofence -> APPROVED (auto-approved for office)
  const outRes = evaluateAttendanceApproval("OFFICE", "OUT", true);
  assert.strictEqual(outRes.requiresVerification, false);
  assert.strictEqual(outRes.approvalStatus, "APPROVED");
  assert.ok(outRes.approvalNote.includes("Otomatis disetujui"));

  // Office OUT outside geofence -> PENDING (requires review because outside geofence)
  const outOutsideRes = evaluateAttendanceApproval("OFFICE", "OUT", false);
  assert.strictEqual(outOutsideRes.requiresVerification, true);
  assert.strictEqual(outOutsideRes.approvalStatus, "PENDING");
});

test("evaluateAttendanceApproval for Production shift: BOTH IN and OUT require HRD verification", () => {
  // Production IN -> PENDING
  const inRes = evaluateAttendanceApproval("PRODUCTION", "IN", true);
  assert.strictEqual(inRes.requiresVerification, true);
  assert.strictEqual(inRes.approvalStatus, "PENDING");

  // Production OUT inside geofence -> PENDING
  const outRes = evaluateAttendanceApproval("PRODUCTION", "OUT", true);
  assert.strictEqual(outRes.requiresVerification, true);
  assert.strictEqual(outRes.approvalStatus, "PENDING");
  assert.ok(outRes.approvalNote.includes("Produksi"));
});
