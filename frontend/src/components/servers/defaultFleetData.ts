import { FleetSummaryRollup, ServerNodeItem } from '@/types/serverMonitoring';

export const DEFAULT_FLEET_NODES: ServerNodeItem[] = [];

export const DEFAULT_FLEET_SUMMARY: FleetSummaryRollup = {
  totalNodes: 0,
  onlineNodes: 0,
  warningNodes: 0,
  offlineNodes: 0,
  uptimePct: 0,
  totalVcpu: 0,
  fleetRamUsedGb: 0,
  fleetRamTotalGb: 0,
  fleetRamPct: 0,
  activeServicesTotal: 0,
  normalServicesCount: 0,
  warningServicesCount: 0,
  totalBannedIps: 0,
  minSslDays: 0,
};
