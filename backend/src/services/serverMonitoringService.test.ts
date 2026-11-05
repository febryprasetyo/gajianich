import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeServerTelemetryPayload,
  appendSparkHistory,
  evaluateNodeHealth,
  computeFleetSummary,
  validateRemoteActionInput,
  serverTelemetryHub,
} from './serverMonitoringService';

test('normalizeServerTelemetryPayload parses host vitals, kernel stats, open ports, and unified services', () => {
  const rawPayload = {
    hostname: 'srv-local-onprem',
    name: 'Local On-Premise Worker',
    ipAddress: '192.168.1.100',
    os: 'Ubuntu 24.04 LTS',
    serverType: 'Physical',
    roleBadge: 'ACTIVE PROD WORKER',
    connectionMode: 'WS PUSH',
    cpuModel: 'AMD Ryzen 7 5700X (8C/16T)',
    cpuCores: 16,
    uptimeSeconds: 3680000,
    cpu: {
      usagePct: 28.4,
      ioWaitPct: 0.4,
      stealPct: 0.0,
      loadAvg: [0.82, 0.95, 0.9],
      contextSwitchesPerSec: 12450,
      interruptsPerSec: 8940,
      zombieProcesses: 0,
      totalProcesses: 184,
    },
    memory: {
      usedBytes: 14.2 * 1024 ** 3,
      totalBytes: 32 * 1024 ** 3,
      usagePct: 44.3,
      buffersBytes: 8 * 1024 ** 3,
      swapUsedPct: 0,
    },
    storage: {
      usedBytes: 210 * 1024 ** 3,
      totalBytes: 500 * 1024 ** 3,
      usagePct: 42.0,
      readBytesPerSec: 4.2 * 1024 ** 2,
      writeBytesPerSec: 18.9 * 1024 ** 2,
      iops: 182,
      mountType: 'ext4 / root',
      inodeUsed: 1200000,
      inodeTotal: 6500000,
      inodeUsagePct: 18.4,
      smartStatus: 'PASSED',
    },
    network: {
      rxBytesPerSec: 4.2 * 1024 ** 2,
      txBytesPerSec: 12.8 * 1024 ** 2,
      dropPackets: 0,
      retransPct: 0.02,
      tcpEstablished: 142,
      tcpTimeWait: 12,
      tcpSynRecv: 2,
      fdAllocated: 2410,
      fdMax: 65535,
    },
    secops: {
      sslDaysRemaining: 74,
      ufwStatus: 'UFW Active',
      fail2banBannedIps: 14,
      failedSshCount: 0,
    },
    openPorts: [
      { port: ':2222/tcp', name: 'sshd' },
      { port: ':5432/tcp', name: 'postgres' },
    ],
    services: [
      {
        id: 'pm2-api-0',
        name: 'gajianich-api-0',
        category: 'pm2',
        sub: 'cluster instance #0 • Express API',
        status: 'active',
        statusLabel: 'Running (Online)',
        pid: 3108,
        cpu: 4.8,
        ram: '198.5 MB',
        uptime: '14d 06h',
        restarts: 1,
        port: '0.0.0.0:5000',
      },
      {
        id: 'dk-redis',
        name: 'redis-cache',
        category: 'docker',
        sub: 'redis:7.2-alpine',
        status: 'active',
        statusLabel: 'Running (Healthy)',
        pid: '51ad4019be',
        cpu: 1.2,
        ram: '88.5 MB',
        uptime: 'Up 42 days',
        restarts: 0,
        port: '127.0.0.1:6379->6379/tcp',
      },
    ],
  };

  const normalized = normalizeServerTelemetryPayload(rawPayload);
  assert.equal(normalized.hostname, 'srv-local-onprem');
  assert.equal(normalized.ipAddress, '192.168.1.100');
  assert.equal(normalized.cpuCores, 16);
  assert.equal(normalized.cpuUsagePct, 28.4);
  assert.deepEqual(normalized.loadAvg, [0.82, 0.95, 0.9]);
  assert.equal(normalized.tcpEstablished, 142);
  assert.equal(normalized.fail2banBannedIps, 14);
  assert.equal(normalized.openPorts.length, 2);
  assert.equal(normalized.unifiedServices.length, 2);
  assert.equal(normalized.unifiedServices[0].category, 'pm2');
  assert.equal(normalized.unifiedServices[1].category, 'docker');
});

test('appendSparkHistory maintains a bounded rolling window of 12 points per metric', () => {
  let history = appendSparkHistory(undefined, { cpu: 20, ram: 40, disk: 10, net: 15 });
  assert.equal(history.cpu.length, 7); // Pre-pads initial history to 7 points for immediate chart rendering
  assert.equal(history.cpu[history.cpu.length - 1], 20);

  for (let i = 1; i <= 10; i++) {
    history = appendSparkHistory(history, { cpu: 20 + i, ram: 40 + i, disk: 10 + i, net: 15 + i });
  }
  assert.equal(history.cpu.length, 12);
  assert.equal(history.cpu[history.cpu.length - 1], 30);
});

test('evaluateNodeHealth classifies Online, Warning, and Offline states accurately', () => {
  const now = new Date('2026-11-05T14:00:00Z');
  const recent = new Date('2026-11-05T13:59:50Z');
  const stale = new Date('2026-11-05T13:50:00Z');

  assert.equal(
    evaluateNodeHealth({ lastSeenAt: recent, cpuUsagePct: 35, ramUsagePct: 50, diskUsagePct: 40 }, now),
    'Online',
  );
  assert.equal(
    evaluateNodeHealth({ lastSeenAt: recent, cpuUsagePct: 88, ramUsagePct: 50, diskUsagePct: 40 }, now),
    'Warning',
  );
  assert.equal(
    evaluateNodeHealth({ lastSeenAt: stale, cpuUsagePct: 20, ramUsagePct: 30, diskUsagePct: 20 }, now),
    'Offline',
  );
});

test('computeFleetSummary aggregates node counts, vCPUs, memory, services, and secops metrics', () => {
  const summary = computeFleetSummary([
    {
      status: 'Online',
      cpuCores: 16,
      ramUsedBytes: 16 * 1024 ** 3,
      ramTotalBytes: 32 * 1024 ** 3,
      fail2banBannedIps: 18,
      sslDaysRemaining: 68,
      unifiedServices: [
        { status: 'active' },
        { status: 'active' },
      ],
    },
    {
      status: 'Warning',
      cpuCores: 8,
      ramUsedBytes: 12 * 1024 ** 3,
      ramTotalBytes: 16 * 1024 ** 3,
      fail2banBannedIps: 23,
      sslDaysRemaining: 74,
      unifiedServices: [
        { status: 'active' },
        { status: 'warning' },
      ],
    },
  ] as any);

  assert.equal(summary.totalNodes, 2);
  assert.equal(summary.onlineNodes, 2);
  assert.equal(summary.totalVcpu, 24);
  assert.equal(summary.activeServicesTotal, 4);
  assert.equal(summary.normalServicesCount, 3);
  assert.equal(summary.warningServicesCount, 1);
  assert.equal(summary.totalBannedIps, 41);
  assert.equal(summary.minSslDays, 68);
});

test('validateRemoteActionInput rejects shell injection characters and enforces allowed action types', () => {
  const valid = validateRemoteActionInput({
    actionType: 'restart',
    targetId: 'pm2-api-0',
    targetName: 'gajianich-api-0',
    category: 'pm2',
  });
  assert.equal(valid.actionType, 'restart');
  assert.equal(valid.targetId, 'pm2-api-0');

  assert.throws(
    () =>
      validateRemoteActionInput({
        actionType: 'restart',
        targetId: 'gajianich-api; rm -rf /',
        targetName: 'bad',
        category: 'pm2',
      }),
    /Invalid targetId/,
  );

  assert.throws(
    () =>
      validateRemoteActionInput({
        actionType: 'exec_shell' as any,
        targetId: 'pm2-api-0',
        targetName: 'gajianich-api-0',
        category: 'pm2',
      }),
    /Unsupported actionType/,
  );
});

test('serverTelemetryHub broadcasts events to subscribed listeners and cleans up on unsubscribe', () => {
  const received: any[] = [];
  const unsubscribe = serverTelemetryHub.subscribe((event) => {
    received.push(event);
  });

  serverTelemetryHub.broadcast({ type: 'telemetry', serverId: 1, hostname: 'srv-local-onprem' });
  assert.equal(received.length, 1);
  assert.equal(received[0].hostname, 'srv-local-onprem');

  unsubscribe();
  serverTelemetryHub.broadcast({ type: 'telemetry', serverId: 2, hostname: 'vps-sgp-01' });
  assert.equal(received.length, 1);
});
