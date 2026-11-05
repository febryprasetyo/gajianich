import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export type ServiceCategory = 'pm2' | 'docker' | 'database' | 'systemd' | 'native';
export type ServiceHealthStatus = 'active' | 'warning' | 'critical' | 'neutral';

export interface UnifiedServerServiceItem {
  id: string;
  name: string;
  category: ServiceCategory;
  sub: string;
  status: ServiceHealthStatus;
  statusLabel: string;
  pid: string | number;
  cpu: number;
  ram: string;
  uptime: string;
  restarts: number;
  port: string;
}

export interface ServerOpenPortItem {
  port: string;
  name: string;
  protocol?: string;
}

export interface ServerSparkHistory {
  cpu: number[];
  ram: number[];
  disk: number[];
  net: number[];
}

export interface NormalizedServerTelemetry {
  hostname: string;
  name: string;
  ipAddress: string;
  macAddress: string | null;
  os: string;
  specs: string;
  serverType: 'VPS' | 'Physical' | 'Cloud';
  provider: string;
  location: string;
  environment: string;
  roleBadge: string;
  connectionMode: string;
  cpuModel: string;
  cpuCores: number;
  daemonCore: string;
  avgPingMs: number;
  uptimeSeconds: number;
  agentVersion: string;

  cpuUsagePct: number;
  cpuIoWaitPct: number;
  cpuStealPct: number;
  loadAvg: [number, number, number];
  contextSwitchesPerSec: number;
  interruptsPerSec: number;
  zombieProcesses: number;
  totalProcesses: number;

  ramUsedBytes: number;
  ramTotalBytes: number;
  ramUsagePct: number;
  ramBuffersBytes: number;
  swapUsedPct: number;

  diskUsedBytes: number;
  diskTotalBytes: number;
  diskUsagePct: number;
  diskReadBytesPerSec: number;
  diskWriteBytesPerSec: number;
  diskIops: number;
  diskMountType: string;
  inodeUsed: number;
  inodeTotal: number;
  inodeUsagePct: number;
  smartStatus: string;

  netRxBytesPerSec: number;
  netTxBytesPerSec: number;
  netDropPackets: number;
  netRetransPct: number;
  tcpEstablished: number;
  tcpTimeWait: number;
  tcpSynRecv: number;
  fdAllocated: number;
  fdMax: number;

  sslDaysRemaining: number;
  ufwStatus: string;
  fail2banBannedIps: number;
  failedSshCount: number;

  openPorts: ServerOpenPortItem[];
  unifiedServices: UnifiedServerServiceItem[];
  logs?: Array<{ time?: string; lvl?: 'INFO' | 'WARN' | 'ERROR'; msg: string; service?: string }>;
  commandResults: Array<{
    commandId: number;
    status: 'SUCCESS' | 'FAILED';
    outputText?: string;
    serviceName?: string;
  }>;
}

export function hashServerAgentApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

export function generateServerAgentApiKey(hostname = 'node'): {
  rawKey: string;
  keyHash: string;
  keyPrefix: string;
} {
  const cleanHost =
    hostname
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10) || 'node';
  const tokenSecret = randomBytes(20).toString('hex');
  const rawKey = `gjn_srv_${cleanHost}_${tokenSecret}`;
  const keyHash = hashServerAgentApiKey(rawKey);
  const keyPrefix = `${rawKey.slice(0, 18)}...`;
  return { rawKey, keyHash, keyPrefix };
}

export function verifyServerAgentApiKey(
  providedRawKey: string | undefined | null,
  expectedHash: string | undefined | null,
): boolean {
  if (!providedRawKey || !expectedHash) return false;
  const computedHash = hashServerAgentApiKey(providedRawKey.trim());
  const a = Buffer.from(computedHash, 'utf8');
  const b = Buffer.from(expectedHash.trim(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function toFiniteNumber(val: unknown, fallback = 0): number {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

function toCleanString(val: unknown, fallback = ''): string {
  return typeof val === 'string' && val.trim() !== '' ? val.trim() : fallback;
}

const VALID_CATEGORIES = new Set<ServiceCategory>(['pm2', 'docker', 'database', 'systemd', 'native']);
const VALID_STATUSES = new Set<ServiceHealthStatus>(['active', 'warning', 'critical', 'neutral']);

export function normalizeServerTelemetryPayload(payload: any): NormalizedServerTelemetry {
  const hostname = toCleanString(payload?.hostname ?? payload?.serverCode, '');
  if (!hostname) {
    throw new Error('hostname is required');
  }
  const ipAddress = toCleanString(payload?.ipAddress, '127.0.0.1');

  const cpu = payload?.cpu ?? {};
  const memory = payload?.memory ?? {};
  const storage = payload?.storage ?? payload?.disk ?? {};
  const network = payload?.network ?? {};
  const secops = payload?.secops ?? payload?.security ?? {};

  const rawLoad = Array.isArray(cpu.loadAvg)
    ? cpu.loadAvg
    : Array.isArray(payload?.loadAvg)
      ? payload.loadAvg
      : [0, 0, 0];
  const loadAvg: [number, number, number] = [
    Number(toFiniteNumber(rawLoad[0], 0).toFixed(2)),
    Number(toFiniteNumber(rawLoad[1], 0).toFixed(2)),
    Number(toFiniteNumber(rawLoad[2], 0).toFixed(2)),
  ];

  const cpuCores = Math.max(1, Math.round(toFiniteNumber(payload?.cpuCores ?? cpu.cores, 1)));
  const ramTotalBytes = Math.max(0, Math.round(toFiniteNumber(memory.totalBytes ?? payload?.ramTotalBytes, 0)));
  const ramUsedBytes = Math.max(0, Math.round(toFiniteNumber(memory.usedBytes ?? payload?.ramUsedBytes, 0)));
  const ramUsagePct = Number(
    toFiniteNumber(
      memory.usagePct ?? payload?.ramUsagePct,
      ramTotalBytes > 0 ? (ramUsedBytes / ramTotalBytes) * 100 : 0,
    ).toFixed(1),
  );

  const diskTotalBytes = Math.max(0, Math.round(toFiniteNumber(storage.totalBytes ?? payload?.diskTotalBytes, 0)));
  const diskUsedBytes = Math.max(0, Math.round(toFiniteNumber(storage.usedBytes ?? payload?.diskUsedBytes, 0)));
  const diskUsagePct = Number(
    toFiniteNumber(
      storage.usagePct ?? payload?.diskUsagePct,
      diskTotalBytes > 0 ? (diskUsedBytes / diskTotalBytes) * 100 : 0,
    ).toFixed(1),
  );

  const openPortsInput = Array.isArray(payload?.openPorts) ? payload.openPorts : [];
  const openPorts: ServerOpenPortItem[] = openPortsInput.slice(0, 32).map((item: any) => {
    if (typeof item === 'string') {
      const m = item.trim().match(/^(:?\d+\/(?:tcp|udp))\s*(?:\(([^)]+)\))?/i);
      if (m) {
        return {
          port: m[1],
          name: m[2]?.trim() || 'service',
          protocol: m[1].toLowerCase().endsWith('/udp') ? 'udp' : 'tcp',
        };
      }
      return { port: item.trim(), name: 'service', protocol: 'tcp' };
    }
    return {
      port: toCleanString(item?.port, ':80/tcp'),
      name: toCleanString(item?.name, 'service'),
      protocol: toCleanString(item?.protocol, 'tcp'),
    };
  });

  const servicesInput = Array.isArray(payload?.services)
    ? payload.services
    : Array.isArray(payload?.unifiedServices)
      ? payload.unifiedServices
      : [];

  const unifiedServices: UnifiedServerServiceItem[] = servicesInput.slice(0, 120).map((item: any, idx: number) => {
    const rawCat = toCleanString(item?.category, 'systemd').toLowerCase() as ServiceCategory;
    const category: ServiceCategory = VALID_CATEGORIES.has(rawCat) ? rawCat : 'systemd';
    const rawStatus = toCleanString(item?.status, 'active').toLowerCase() as ServiceHealthStatus;
    const status: ServiceHealthStatus = VALID_STATUSES.has(rawStatus) ? rawStatus : 'active';

    return {
      id: toCleanString(item?.id, `${category}-${idx + 1}`),
      name: toCleanString(item?.name, `service-${idx + 1}`),
      category,
      sub: toCleanString(item?.sub, `${category.toUpperCase()} service`),
      status,
      statusLabel: toCleanString(item?.statusLabel, status === 'active' ? 'Running (Online)' : status),
      pid: typeof item?.pid === 'number' ? item.pid : toCleanString(String(item?.pid ?? '-'), '-'),
      cpu: Number(toFiniteNumber(item?.cpu, 0).toFixed(1)),
      ram: toCleanString(item?.ram, '0 MB'),
      uptime: toCleanString(item?.uptime, '0m'),
      restarts: Math.max(0, Math.round(toFiniteNumber(item?.restarts, 0))),
      port: toCleanString(item?.port, 'internal'),
    };
  });

  const commandResultsInput = Array.isArray(payload?.commandResults) ? payload.commandResults : [];
  const commandResults = commandResultsInput
    .filter((item: any) => Number.isInteger(Number(item?.commandId)))
    .map((item: any) => ({
      commandId: Number(item.commandId),
      status: (item?.status === 'FAILED' ? 'FAILED' : 'SUCCESS') as 'SUCCESS' | 'FAILED',
      outputText: typeof item?.outputText === 'string' ? item.outputText.slice(0, 12000) : undefined,
      serviceName: typeof item?.serviceName === 'string' ? item.serviceName : undefined,
    }));

  const logsInput = Array.isArray(payload?.logs) ? payload.logs : [];
  const logs = logsInput.slice(0, 60).map((l: any) => ({
    time: typeof l?.time === 'string' ? l.time : undefined,
    lvl: (l?.lvl === 'WARN' || l?.lvl === 'ERROR' ? l.lvl : 'INFO') as 'INFO' | 'WARN' | 'ERROR',
    msg: toCleanString(l?.msg, ''),
    service: typeof l?.service === 'string' ? l.service : undefined,
  })).filter((l: any) => l.msg !== '');

  const ramGb = ramTotalBytes > 0 ? Math.max(1, Math.round(ramTotalBytes / 1024 ** 3)) : 0;
  const diskGb = diskTotalBytes > 0 ? Math.max(1, Math.round(diskTotalBytes / 1024 ** 3)) : 0;
  const cpuModelStr = toCleanString(payload?.cpuModel, 'Menunggu Telemetri...');
  const osStr = toCleanString(payload?.os, 'Menunggu Telemetri...');
  const defaultSpecs =
    ramGb > 0 && diskGb > 0
      ? `${cpuModelStr} (${cpuCores} vCPU) • ${ramGb} GB RAM • ${diskGb} GB Disk`
      : 'Menunggu laporan telemetri dari agent...';

  return {
    hostname,
    name: toCleanString(payload?.name, hostname),
    ipAddress,
    macAddress: payload?.macAddress ? toCleanString(payload.macAddress) : null,
    os: osStr,
    specs: toCleanString(payload?.specs, defaultSpecs),
    serverType: payload?.serverType === 'Physical' ? 'Physical' : payload?.serverType === 'Cloud' ? 'Cloud' : 'VPS',
    provider: toCleanString(payload?.provider, payload?.serverType === 'Physical' ? 'Local On-Premise' : 'Cloud VPS'),
    location: toCleanString(payload?.location, payload?.serverType === 'Physical' ? 'LAN Local Network' : 'Cloud Datacenter'),
    environment: toCleanString(payload?.environment, 'Production'),
    roleBadge: toCleanString(payload?.roleBadge, 'ACTIVE PROD WORKER'),
    connectionMode: toCleanString(payload?.connectionMode, 'WS PUSH'),
    cpuModel: cpuModelStr,
    cpuCores,
    daemonCore: toCleanString(payload?.daemonCore, 'Systemd'),
    avgPingMs: Number(toFiniteNumber(payload?.avgPingMs, 0.8).toFixed(1)),
    uptimeSeconds: Math.max(0, Math.round(toFiniteNumber(payload?.uptimeSeconds, 0))),
    agentVersion: toCleanString(payload?.agentVersion, 'v2.4-TLS'),

    cpuUsagePct: Number(toFiniteNumber(cpu.usagePct ?? payload?.cpuUsagePct, 0).toFixed(1)),
    cpuIoWaitPct: Number(toFiniteNumber(cpu.ioWaitPct ?? payload?.cpuIoWaitPct, 0).toFixed(1)),
    cpuStealPct: Number(toFiniteNumber(cpu.stealPct ?? payload?.cpuStealPct, 0).toFixed(1)),
    loadAvg,
    contextSwitchesPerSec: Math.min(2_147_483_647, Math.max(0, Math.round(toFiniteNumber(cpu.contextSwitchesPerSec ?? payload?.contextSwitchesPerSec, 0)))),
    interruptsPerSec: Math.min(2_147_483_647, Math.max(0, Math.round(toFiniteNumber(cpu.interruptsPerSec ?? payload?.interruptsPerSec, 0)))),
    zombieProcesses: Math.min(2_147_483_647, Math.max(0, Math.round(toFiniteNumber(cpu.zombieProcesses ?? payload?.zombieProcesses, 0)))),
    totalProcesses: Math.min(2_147_483_647, Math.max(0, Math.round(toFiniteNumber(cpu.totalProcesses ?? payload?.totalProcesses, 0)))),

    ramUsedBytes,
    ramTotalBytes,
    ramUsagePct,
    ramBuffersBytes: Math.max(0, Math.round(toFiniteNumber(memory.buffersBytes ?? payload?.ramBuffersBytes, 0))),
    swapUsedPct: Number(toFiniteNumber(memory.swapUsedPct ?? payload?.swapUsedPct, 0).toFixed(1)),

    diskUsedBytes,
    diskTotalBytes,
    diskUsagePct,
    diskReadBytesPerSec: Math.max(0, Math.round(toFiniteNumber(storage.readBytesPerSec ?? payload?.diskReadBytesPerSec, 0))),
    diskWriteBytesPerSec: Math.max(0, Math.round(toFiniteNumber(storage.writeBytesPerSec ?? payload?.diskWriteBytesPerSec, 0))),
    diskIops: Math.min(2_147_483_647, Math.max(0, Math.round(toFiniteNumber(storage.iops ?? payload?.diskIops, 0)))),
    diskMountType: toCleanString(storage.mountType ?? payload?.diskMountType, 'ext4 / root'),
    inodeUsed: Math.max(0, Math.round(toFiniteNumber(storage.inodeUsed ?? payload?.inodeUsed, 0))),
    inodeTotal: Math.max(1, Math.round(toFiniteNumber(storage.inodeTotal ?? payload?.inodeTotal, 1))),
    inodeUsagePct: Number(toFiniteNumber(storage.inodeUsagePct ?? payload?.inodeUsagePct, 0).toFixed(1)),
    smartStatus: toCleanString(storage.smartStatus ?? payload?.smartStatus, 'PASSED'),

    netRxBytesPerSec: Math.max(0, Math.round(toFiniteNumber(network.rxBytesPerSec ?? payload?.netRxBytesPerSec, 0))),
    netTxBytesPerSec: Math.max(0, Math.round(toFiniteNumber(network.txBytesPerSec ?? payload?.netTxBytesPerSec, 0))),
    netDropPackets: Math.min(2_147_483_647, Math.max(0, Math.round(toFiniteNumber(network.dropPackets ?? payload?.netDropPackets, 0)))),
    netRetransPct: Number(toFiniteNumber(network.retransPct ?? payload?.netRetransPct, 0).toFixed(2)),
    tcpEstablished: Math.min(2_147_483_647, Math.max(0, Math.round(toFiniteNumber(network.tcpEstablished ?? payload?.tcpEstablished, 0)))),
    tcpTimeWait: Math.min(2_147_483_647, Math.max(0, Math.round(toFiniteNumber(network.tcpTimeWait ?? payload?.tcpTimeWait, 0)))),
    tcpSynRecv: Math.min(2_147_483_647, Math.max(0, Math.round(toFiniteNumber(network.tcpSynRecv ?? payload?.tcpSynRecv, 0)))),
    fdAllocated: Math.min(2_147_483_647, Math.max(0, Math.round(toFiniteNumber(network.fdAllocated ?? payload?.fdAllocated, 0)))),
    fdMax: Math.min(1_048_576, Math.max(1024, Math.round(toFiniteNumber(network.fdMax ?? payload?.fdMax, 65535)))),

    sslDaysRemaining: Math.max(0, Math.round(toFiniteNumber(secops.sslDaysRemaining ?? payload?.sslDaysRemaining, 90))),
    ufwStatus: toCleanString(secops.ufwStatus ?? payload?.ufwStatus, 'UFW Active'),
    fail2banBannedIps: Math.max(0, Math.round(toFiniteNumber(secops.fail2banBannedIps ?? payload?.fail2banBannedIps, 0))),
    failedSshCount: Math.max(0, Math.round(toFiniteNumber(secops.failedSshCount ?? payload?.failedSshCount, 0))),

    openPorts,
    unifiedServices,
    logs,
    commandResults,
  };
}

export function appendSparkHistory(
  existing: Record<string, number[]> | undefined | null,
  point: { cpu: number; ram: number; disk: number; net: number },
  maxPoints = 12,
): ServerSparkHistory {
  const pushMetric = (arr: unknown, val: number): number[] => {
    const cleanVal = Number(toFiniteNumber(val, 0).toFixed(1));
    const list = Array.isArray(arr)
      ? arr.map((item) => Number(toFiniteNumber(item, 0).toFixed(1)))
      : [];
    if (list.length === 0) {
      return [cleanVal, cleanVal, cleanVal, cleanVal, cleanVal, cleanVal, cleanVal];
    }
    const next = [...list, cleanVal];
    return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
  };

  return {
    cpu: pushMetric(existing?.cpu, point.cpu),
    ram: pushMetric(existing?.ram, point.ram),
    disk: pushMetric(existing?.disk, point.disk),
    net: pushMetric(existing?.net, point.net),
  };
}

export function evaluateNodeHealth(
  node: {
    lastSeenAt?: Date | string | null;
    cpuUsagePct?: number | string | null;
    ramUsagePct?: number | string | null;
    diskUsagePct?: number | string | null;
    unifiedServices?: UnifiedServerServiceItem[];
  },
  now = new Date(),
  staleThresholdSeconds = 60,
): 'Online' | 'Warning' | 'Offline' {
  if (!node.lastSeenAt) return 'Offline';
  const seen = node.lastSeenAt instanceof Date ? node.lastSeenAt : new Date(node.lastSeenAt);
  if (Number.isNaN(seen.getTime()) || now.getTime() - seen.getTime() > staleThresholdSeconds * 1000) {
    return 'Offline';
  }

  const cpu = toFiniteNumber(node.cpuUsagePct, 0);
  const ram = toFiniteNumber(node.ramUsagePct, 0);
  const disk = toFiniteNumber(node.diskUsagePct, 0);
  const hasDegradedService =
    Array.isArray(node.unifiedServices) &&
    node.unifiedServices.some((s) => s.status === 'warning' || s.status === 'critical');

  if (cpu >= 85 || ram >= 88 || disk >= 90 || hasDegradedService) {
    return 'Warning';
  }
  return 'Online';
}

export interface FleetSummaryRollup {
  totalNodes: number;
  onlineNodes: number;
  warningNodes: number;
  offlineNodes: number;
  uptimePct: number;
  totalVcpu: number;
  fleetRamUsedGb: number;
  fleetRamTotalGb: number;
  fleetRamPct: number;
  activeServicesTotal: number;
  normalServicesCount: number;
  warningServicesCount: number;
  totalBannedIps: number;
  minSslDays: number;
}

export function computeFleetSummary(nodes: Array<Record<string, any>>): FleetSummaryRollup {
  const totalNodes = nodes.length;
  let onlineNodes = 0;
  let warningNodes = 0;
  let offlineNodes = 0;
  let totalVcpu = 0;
  let ramUsedBytes = 0;
  let ramTotalBytes = 0;
  let activeServicesTotal = 0;
  let normalServicesCount = 0;
  let warningServicesCount = 0;
  let totalBannedIps = 0;
  let minSslDays = nodes.length > 0 ? 999 : 0;

  for (const node of nodes) {
    if (node.status === 'Offline' || node.healthStatus === 'Offline') {
      offlineNodes += 1;
    } else if (node.status === 'Warning' || node.healthStatus === 'Warning') {
      onlineNodes += 1;
      warningNodes += 1;
    } else {
      onlineNodes += 1;
    }

    totalVcpu += Math.max(0, toFiniteNumber(node.cpuCores, 0));
    ramUsedBytes += Math.max(0, toFiniteNumber(node.ramUsedBytes, 0));
    ramTotalBytes += Math.max(0, toFiniteNumber(node.ramTotalBytes, 0));
    totalBannedIps += Math.max(0, toFiniteNumber(node.fail2banBannedIps, 0));

    const sslDays = toFiniteNumber(node.sslDaysRemaining, 0);
    if (sslDays > 0 && sslDays < minSslDays) {
      minSslDays = sslDays;
    }

    const services = Array.isArray(node.unifiedServices) ? node.unifiedServices : [];
    activeServicesTotal += services.length;
    for (const svc of services) {
      if (svc?.status === 'warning' || svc?.status === 'critical') {
        warningServicesCount += 1;
      } else {
        normalServicesCount += 1;
      }
    }
  }

  if (minSslDays === 999) minSslDays = 0;
  const fleetRamUsedGb = Number((ramUsedBytes / 1024 ** 3).toFixed(1));
  const fleetRamTotalGb = Number((ramTotalBytes / 1024 ** 3).toFixed(1));
  const fleetRamPct = Number(
    (ramTotalBytes > 0 ? (ramUsedBytes / ramTotalBytes) * 100 : 0).toFixed(1),
  );
  const uptimePct = totalNodes > 0 ? Math.round((onlineNodes / totalNodes) * 100) : 0;

  return {
    totalNodes,
    onlineNodes,
    warningNodes,
    offlineNodes,
    uptimePct,
    totalVcpu,
    fleetRamUsedGb,
    fleetRamTotalGb,
    fleetRamPct,
    activeServicesTotal,
    normalServicesCount,
    warningServicesCount,
    totalBannedIps,
    minSslDays,
  };
}

const SAFE_TARGET_ID_REGEX = /^[a-zA-Z0-9_.:@-]{1,128}$/;
const ALLOWED_ACTION_TYPES = new Set(['restart', 'reload', 'logs', 'ping']);

export interface ValidatedRemoteAction {
  actionType: 'restart' | 'reload' | 'logs' | 'ping';
  targetId: string;
  targetName: string;
  category: ServiceCategory;
}

export function validateRemoteActionInput(input: any): ValidatedRemoteAction {
  const actionType = toCleanString(input?.actionType, '') as ValidatedRemoteAction['actionType'];
  if (!ALLOWED_ACTION_TYPES.has(actionType)) {
    throw new Error('Unsupported actionType. Allowed: restart, reload, logs, ping');
  }

  const targetId = toCleanString(input?.targetId, '');
  if (!SAFE_TARGET_ID_REGEX.test(targetId)) {
    throw new Error('Invalid targetId format');
  }

  const targetName = toCleanString(input?.targetName, targetId).slice(0, 128);
  const rawCat = toCleanString(input?.category, 'systemd').toLowerCase() as ServiceCategory;
  const category: ServiceCategory = VALID_CATEGORIES.has(rawCat) ? rawCat : 'systemd';

  return {
    actionType,
    targetId,
    targetName,
    category,
  };
}

export interface ServerTelemetryStreamEvent {
  type: 'telemetry' | 'action' | 'heartbeat';
  serverId?: number;
  hostname?: string;
  timestamp?: string;
  payload?: unknown;
}

type StreamListener = (event: ServerTelemetryStreamEvent) => void;

class ServerTelemetryHub {
  private listeners = new Set<StreamListener>();
  private serviceLogs = new Map<string, Array<{ time: string; lvl: 'INFO' | 'WARN' | 'ERROR'; msg: string }>>();

  subscribe(listener: StreamListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  broadcast(event: ServerTelemetryStreamEvent): void {
    const enriched: ServerTelemetryStreamEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };
    for (const listener of this.listeners) {
      try {
        listener(enriched);
      } catch {
        // Ignore broken listener pipe
      }
    }
  }

  appendLog(key: string, lvl: 'INFO' | 'WARN' | 'ERROR', msg: string, timeOverride?: string): void {
    const time = timeOverride || new Date().toTimeString().split(' ')[0];
    const current = this.serviceLogs.get(key) ?? [];
    // Prevent duplicate consecutive message at exact same second
    const last = current[current.length - 1];
    if (last && last.time === time && last.msg === msg) return;
    const next = [...current, { time, lvl, msg }];
    this.serviceLogs.set(key, next.length > 120 ? next.slice(next.length - 120) : next);
  }

  getLogs(hostname: string, serviceName?: string): Array<{ time: string; lvl: 'INFO' | 'WARN' | 'ERROR'; msg: string }> {
    const key = serviceName ? `${hostname}:${serviceName}` : hostname;
    const existing = this.serviceLogs.get(key);
    if (existing && existing.length > 0) {
      return existing;
    }
    const hostFallback = this.serviceLogs.get(hostname);
    if (hostFallback && hostFallback.length > 0) {
      return hostFallback;
    }
    return [];
  }
}

export const serverTelemetryHub = new ServerTelemetryHub();
