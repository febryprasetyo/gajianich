import { test } from "node:test";
import assert from "node:assert";
import {
  attendanceDevices,
  attendanceDeviceSyncLogs,
  attendanceDeviceRawLogs,
} from "./attendanceDevices";

test("attendanceDevices schema defines required columns for Solution X900 physical machines", () => {
  assert.ok(attendanceDevices.id, "id column must exist");
  assert.ok(attendanceDevices.code, "code column must exist");
  assert.ok(attendanceDevices.name, "name column must exist");
  assert.ok(attendanceDevices.ip, "ip column must exist");
  assert.ok(attendanceDevices.port, "port column must exist");
  assert.ok(attendanceDevices.commKey, "commKey column must exist");
  assert.ok(attendanceDevices.deviceNumber, "deviceNumber column must exist");
  assert.ok(attendanceDevices.serialNumber, "serialNumber column must exist");
  assert.ok(attendanceDevices.model, "model column must exist");
  assert.ok(attendanceDevices.platform, "platform column must exist");
  assert.ok(attendanceDevices.firmware, "firmware column must exist");
  assert.ok(attendanceDevices.location, "location column must exist");
  assert.ok(attendanceDevices.connectionType, "connectionType column must exist");
  assert.ok(attendanceDevices.status, "status column must exist");
  assert.ok(attendanceDevices.isEnabled, "isEnabled column must exist");
  assert.ok(attendanceDevices.timeoutMs, "timeoutMs column must exist");
  assert.ok(attendanceDevices.totalLogs, "totalLogs column must exist");
  assert.ok(attendanceDevices.lastSyncAt, "lastSyncAt column must exist");
  assert.ok(attendanceDevices.lastConnectedAt, "lastConnectedAt column must exist");
  assert.ok(attendanceDevices.lastError, "lastError column must exist");
  assert.ok(attendanceDevices.createdAt, "createdAt column must exist");
  assert.ok(attendanceDevices.updatedAt, "updatedAt column must exist");
});

test("attendanceDeviceSyncLogs schema defines synchronization metadata columns", () => {
  assert.ok(attendanceDeviceSyncLogs.id, "id column must exist");
  assert.ok(attendanceDeviceSyncLogs.deviceId, "deviceId column must exist");
  assert.ok(attendanceDeviceSyncLogs.syncType, "syncType column must exist");
  assert.ok(attendanceDeviceSyncLogs.startDate, "startDate column must exist");
  assert.ok(attendanceDeviceSyncLogs.endDate, "endDate column must exist");
  assert.ok(attendanceDeviceSyncLogs.status, "status column must exist");
  assert.ok(attendanceDeviceSyncLogs.totalFetched, "totalFetched column must");
  assert.ok(attendanceDeviceSyncLogs.totalParsed, "totalParsed column must");
  assert.ok(attendanceDeviceSyncLogs.totalProcessed, "totalProcessed column must");
  assert.ok(attendanceDeviceSyncLogs.errorMessage, "errorMessage column must exist");
  assert.ok(attendanceDeviceSyncLogs.createdById, "createdById column must exist");
  assert.ok(attendanceDeviceSyncLogs.startedAt, "startedAt column must exist");
  assert.ok(attendanceDeviceSyncLogs.completedAt, "completedAt column must exist");
});

test("attendanceDeviceRawLogs schema defines exact physical machine punch logs for audit", () => {
  assert.ok(attendanceDeviceRawLogs.id, "id column must exist");
  assert.ok(attendanceDeviceRawLogs.syncLogId, "syncLogId column must exist");
  assert.ok(attendanceDeviceRawLogs.deviceId, "deviceId column must exist");
  assert.ok(attendanceDeviceRawLogs.pin, "pin column must exist");
  assert.ok(attendanceDeviceRawLogs.employeeId, "employeeId column must exist");
  assert.ok(attendanceDeviceRawLogs.timestamp, "timestamp column must exist");
  assert.ok(attendanceDeviceRawLogs.workDate, "workDate column must exist");
  assert.ok(attendanceDeviceRawLogs.verifyMode, "verifyMode column must exist");
  assert.ok(attendanceDeviceRawLogs.inOutState, "inOutState column must exist");
  assert.ok(attendanceDeviceRawLogs.rawPayload, "rawPayload column must exist");
  assert.ok(attendanceDeviceRawLogs.createdAt, "createdAt column must exist");
});
