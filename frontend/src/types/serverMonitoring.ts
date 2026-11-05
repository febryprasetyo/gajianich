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

export interface ServerNodeItem {
  id: number;
  serverCode: string;
  hostname: string;
  name: string;
  ipAddress: string;
  macAddress?: string | null;
  os: string;
  specs: string;
  status: 'Online' | 'Offline';
  healthStatus: 'Online' | 'Warning' | 'Offline';
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
  agentVersion: string;
  uptimeSeconds: number;
  notes?: string | null;

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
  spark: ServerSparkHistory;
  lastSeenAt?: string;
  updatedAt?: string;
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

export interface TerminalLogEntry {
  time: string;
  lvl: 'INFO' | 'WARN' | 'ERROR';
  msg: string;
}
