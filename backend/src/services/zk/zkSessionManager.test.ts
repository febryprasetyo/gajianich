import { test } from "node:test";
import assert from "node:assert";
import { AttendanceDeviceSessionManager, ZkClient } from "./zkSessionManager";

test("AttendanceDeviceSessionManager maintains singleton instance", () => {
  const instance1 = AttendanceDeviceSessionManager.getInstance();
  const instance2 = AttendanceDeviceSessionManager.getInstance();
  assert.strictEqual(instance1, instance2);
});

test("AttendanceDeviceSessionManager reports disconnected for unknown device", () => {
  const manager = AttendanceDeviceSessionManager.getInstance();
  const info = manager.getSessionInfo(9999);
  assert.strictEqual(info.status, "DISCONNECTED");
  assert.strictEqual(manager.getIdleSecondsLeft(9999), null);
});

test("AttendanceDeviceSessionManager manages connection and idle countdown", async () => {
  const manager = AttendanceDeviceSessionManager.getInstance();
  manager.setIdleTimeoutMs(60 * 1000); // 60s for testing

  const mockClient = {
    connect: async () => {},
    authenticate: async () => {},
    readIdentity: async () => ({ firmware: "Ver 6.60", serialNumber: "TEST1234", deviceName: "X900", platform: "ZAM180" }),
    fetchAttendanceLogs: async () => [],
    disconnect: async () => {},
  } as unknown as ZkClient;

  const session = await manager.connect({ id: 1, ip: "127.0.0.1", port: 4370, commKey: 0 }, mockClient);
  assert.strictEqual(session.status, "CONNECTED");
  assert.ok(session.connectedAt);

  const secondsLeft = manager.getIdleSecondsLeft(1);
  assert.ok(secondsLeft !== null && secondsLeft <= 60 && secondsLeft >= 58);

  // Touch activity resets timer
  manager.touchActivity(1);
  const refreshedSeconds = manager.getIdleSecondsLeft(1);
  assert.ok(refreshedSeconds !== null && refreshedSeconds >= 58);

  // Disconnect cleanly
  await manager.disconnect(1);
  const disconnectedInfo = manager.getSessionInfo(1);
  assert.strictEqual(disconnectedInfo.status, "DISCONNECTED");
  assert.strictEqual(manager.getIdleSecondsLeft(1), null);
});
