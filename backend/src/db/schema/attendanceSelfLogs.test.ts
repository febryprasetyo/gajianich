import { test } from "node:test";
import assert from "node:assert";
import { attendanceSelfLogs } from "./attendanceSelfLogs";
import { attendanceFaceProfiles } from "./attendanceFaceProfiles";

test("attendanceSelfLogs schema defines required columns for mobile attendance, location, and HRD review", () => {
  assert.ok(attendanceSelfLogs.id, "id column must exist");
  assert.ok(attendanceSelfLogs.employeeId, "employeeId column must exist");
  assert.ok(attendanceSelfLogs.userId, "userId column must exist");
  assert.ok(attendanceSelfLogs.eventType, "eventType column must exist");
  assert.ok(attendanceSelfLogs.workDate, "workDate column must exist");
  assert.ok(attendanceSelfLogs.scanTime, "scanTime column must exist");
  assert.ok(attendanceSelfLogs.shiftCode, "shiftCode column must exist");
  assert.ok(attendanceSelfLogs.shiftCategory, "shiftCategory column must exist");
  assert.ok(attendanceSelfLogs.latitude, "latitude column must exist");
  assert.ok(attendanceSelfLogs.longitude, "longitude column must exist");
  assert.ok(attendanceSelfLogs.accuracy, "accuracy column must exist");
  assert.ok(attendanceSelfLogs.address, "address column must exist");
  assert.ok(attendanceSelfLogs.mapUrl, "mapUrl column must exist");
  assert.ok(attendanceSelfLogs.googleMapsUrl, "googleMapsUrl column must exist");
  assert.ok(attendanceSelfLogs.isWithinGeofence, "isWithinGeofence column must exist");
  assert.ok(attendanceSelfLogs.distanceMeters, "distanceMeters column must exist");
  assert.ok(attendanceSelfLogs.photoUrl, "photoUrl column must exist");
  assert.ok(attendanceSelfLogs.photoPurgedAt, "photoPurgedAt column must exist");
  assert.ok(attendanceSelfLogs.txHash, "txHash column must exist");
  assert.ok(attendanceSelfLogs.deviceInfo, "deviceInfo column must exist");
  assert.ok(attendanceSelfLogs.notes, "notes column must exist");
  assert.ok(attendanceSelfLogs.requiresVerification, "requiresVerification column must exist");
  assert.ok(attendanceSelfLogs.approvalStatus, "approvalStatus column must exist");
  assert.ok(attendanceSelfLogs.approvalNote, "approvalNote column must exist");
  assert.ok(attendanceSelfLogs.verifiedById, "verifiedById column must exist");
  assert.ok(attendanceSelfLogs.verifiedAt, "verifiedAt column must exist");
  assert.ok(attendanceSelfLogs.createdAt, "createdAt column must exist");
});

test("attendanceFaceProfiles schema defines biometric enrollment columns", () => {
  assert.ok(attendanceFaceProfiles.id, "id column must exist");
  assert.ok(attendanceFaceProfiles.employeeId, "employeeId column must exist");
  assert.ok(attendanceFaceProfiles.isEnrolled, "isEnrolled column must exist");
  assert.ok(attendanceFaceProfiles.faceDescriptorHash, "faceDescriptorHash column must exist");
  assert.ok(attendanceFaceProfiles.samplePhotoUrl, "samplePhotoUrl column must exist");
  assert.ok(attendanceFaceProfiles.enrolledAt, "enrolledAt column must exist");
  assert.ok(attendanceFaceProfiles.updatedAt, "updatedAt column must exist");
});
