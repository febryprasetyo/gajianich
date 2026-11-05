'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ModalShell from '@/components/ui/ModalShell';
import TablePagination from '@/components/ui/TablePagination';
import ServerSparkline from '@/components/servers/ServerSparkline';
import TerminalLogModal from '@/components/servers/TerminalLogModal';
import { useServerMonitoringStream } from '@/hooks/useServerMonitoringStream';
import { api } from '@/lib/api';
import {
  ServerNodeItem,
  ServiceCategory,
  UnifiedServerServiceItem,
} from '@/types/serverMonitoring';
import {
  Activity,
  ArrowLeft,
  ArrowUpDown,
  Box,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Database,
  FilterX,
  HardDrive,
  KeyRound,
  Layers,
  MemoryStick,
  Network,
  Radio,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

function formatUptimeDaysHours(seconds: number): string {
  const sec = Math.max(0, Number(seconds) || 0);
  if (sec === 0) return 'Menunggu Agent';
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
  const mins = Math.floor((sec % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatBytesToGb(bytes: number, decimals = 1): string {
  const gb = (Number(bytes) || 0) / 1024 ** 3;
  return decimals === 0 ? `${Math.round(gb)}` : gb.toFixed(decimals);
}

const PORT_TEXT_COLORS = [
  'text-emerald-700',
  'text-blue-700',
  'text-purple-700',
  'text-rose-700',
  'text-amber-700',
  'text-cyan-700',
];

const PLACEHOLDER_NODE: ServerNodeItem = {
  id: 0,
  serverCode: 'fastpec-MINI-S',
  hostname: 'fastpec-MINI-S',
  name: 'Memuat Telemetri Server...',
  ipAddress: '192.168.10.212',
  os: 'Menunggu Telemetri Agent...',
  specs: 'Menunggu Telemetri Agent...',
  status: 'Online',
  healthStatus: 'Online',
  serverType: 'Physical',
  provider: 'On-Premise Baremetal',
  location: 'Local Datacenter',
  environment: 'Production',
  roleBadge: 'ON-PREMISE HOST',
  connectionMode: 'WS PUSH',
  cpuModel: 'Menunggu Telemetri Agent...',
  cpuCores: 0,
  daemonCore: 'Systemd',
  avgPingMs: 0,
  agentVersion: 'v2.5-LinuxKernel',
  uptimeSeconds: 0,
  cpuUsagePct: 0,
  cpuIoWaitPct: 0,
  cpuStealPct: 0,
  loadAvg: [0, 0, 0],
  contextSwitchesPerSec: 0,
  interruptsPerSec: 0,
  zombieProcesses: 0,
  totalProcesses: 0,
  ramUsedBytes: 0,
  ramTotalBytes: 0,
  ramUsagePct: 0,
  ramBuffersBytes: 0,
  swapUsedPct: 0,
  diskUsedBytes: 0,
  diskTotalBytes: 0,
  diskUsagePct: 0,
  diskReadBytesPerSec: 0,
  diskWriteBytesPerSec: 0,
  diskIops: 0,
  diskMountType: 'ext4 / root',
  inodeUsed: 0,
  inodeTotal: 1,
  inodeUsagePct: 0,
  smartStatus: 'PASSED',
  netRxBytesPerSec: 0,
  netTxBytesPerSec: 0,
  netDropPackets: 0,
  netRetransPct: 0,
  tcpEstablished: 0,
  tcpTimeWait: 0,
  tcpSynRecv: 0,
  fdAllocated: 0,
  fdMax: 65535,
  sslDaysRemaining: 89,
  ufwStatus: 'UFW Active',
  fail2banBannedIps: 0,
  failedSshCount: 0,
  openPorts: [],
  unifiedServices: [],
  spark: {
    cpu: [0],
    ram: [0],
    disk: [0],
    net: [0],
  },
};

export default function ServerDetailInspectionPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = String(params?.id || 'fastpec-MINI-S');

  const [node, setNode] = useState<ServerNodeItem>(PLACEHOLDER_NODE);
  const [nodesList, setNodesList] = useState<
    Array<{ id: number; serverCode: string; name: string; ipAddress: string; status: string }>
  >([]);

  const [activeCategory, setActiveCategory] = useState<'all' | ServiceCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [restartingServiceId, setRestartingServiceId] = useState<string | null>(null);

  // Per-Machine API Key modal state
  const [rotatedKeyModal, setRotatedKeyModal] = useState<{
    isOpen: boolean;
    agentApiKey: string;
    agentKeyPrefix: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'key' | 'cmd' | null>(null);

  // Terminal Log Modal state
  const [logModal, setLogModal] = useState<{
    isOpen: boolean;
    serviceName?: string;
  }>({
    isOpen: false,
  });

  // Toast feedback state
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);

  const showToast = useCallback((title: string, message: string) => {
    setToast({ title, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchNodeDetail = useCallback(async () => {
    try {
      const res = await api.get<{
        data: ServerNodeItem;
        nodesList?: Array<{ id: number; serverCode: string; name: string; ipAddress: string; status: string }>;
      }>(`/infrastructure/servers/${encodeURIComponent(rawId)}`);

      if (res?.data) {
        setNode(res.data);
        if (Array.isArray(res.nodesList)) {
          setNodesList(res.nodesList);
        }
      }
    } catch {
      // If numeric ID from old URL isn't found, fetch first active server from /infrastructure/servers
      try {
        const listRes = await api.get<{ data: ServerNodeItem[] }>('/infrastructure/servers');
        if (Array.isArray(listRes?.data) && listRes.data.length > 0) {
          setNode(listRes.data[0]);
          setNodesList(
            listRes.data.map((n) => ({
              id: n.id,
              serverCode: n.serverCode,
              name: n.name,
              ipAddress: n.ipAddress,
              status: n.status,
            })),
          );
        }
      } catch {
        // Keep current state
      }
    }
  }, [rawId]);

  useEffect(() => {
    void fetchNodeDetail();
  }, [fetchNodeDetail]);

  const { countdown } = useServerMonitoringStream({
    onPulseOrTelemetry: fetchNodeDetail,
    intervalSeconds: 5,
  });

  const handleRotateAgentKey = async () => {
    try {
      const res = await api.post<{
        success: boolean;
        agentApiKey: string;
        agentKeyPrefix: string;
        data?: ServerNodeItem;
      }>(`/infrastructure/servers/${encodeURIComponent(String(node.id || node.serverCode))}/rotate-key`, {});

      if (res?.agentApiKey) {
        if (res.data) setNode(res.data);
        setRotatedKeyModal({
          isOpen: true,
          agentApiKey: res.agentApiKey,
          agentKeyPrefix: res.agentKeyPrefix,
        });
        showToast('API Key Mesin Diperbarui', `Kunci otentikasi baru untuk ${node.serverCode} telah di-generate.`);
      }
    } catch (err: any) {
      showToast('Gagal Merotasi Key', err?.message || 'Tidak dapat merotasi API key.');
    }
  };

  const handleCopyText = async (text: string, field: 'key' | 'cmd') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleRestartService = async (svc: UnifiedServerServiceItem) => {
    setRestartingServiceId(svc.id);
    showToast('Dispatching Signal', `Mengirim sinyal restart (${svc.category.toUpperCase()}) ke ${svc.name}...`);

    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        services?: UnifiedServerServiceItem[];
      }>(`/infrastructure/servers/${encodeURIComponent(String(node.id || node.serverCode))}/actions`, {
        actionType: 'restart',
        targetId: svc.id,
        targetName: svc.name,
        category: svc.category,
      });

      setTimeout(() => {
        setRestartingServiceId(null);
        if (Array.isArray(res?.services)) {
          setNode((prev) => ({
            ...prev,
            unifiedServices: res.services!,
          }));
        }
        showToast('Perintah Terkirim ke Agent', res?.message || `${svc.name} dijadwalkan restart pada agent.`);
      }, 700);
    } catch (err: any) {
      setRestartingServiceId(null);
      showToast('Gagal Mengirim Perintah', err?.message || 'Tidak dapat mengirim perintah restart.');
    }
  };

  const services = useMemo(() => node.unifiedServices || [], [node.unifiedServices]);

  const categoryCounts = useMemo(() => {
    return {
      all: services.length,
      pm2: services.filter((s) => s.category === 'pm2').length,
      docker: services.filter((s) => s.category === 'docker').length,
      database: services.filter((s) => s.category === 'database').length,
      systemd: services.filter((s) => s.category === 'systemd' || s.category === 'native').length,
    };
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesCat =
        activeCategory === 'all' ||
        s.category === activeCategory ||
        (activeCategory === 'systemd' && s.category === 'native');
      if (!matchesCat) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const hit =
          s.name.toLowerCase().includes(q) ||
          s.sub.toLowerCase().includes(q) ||
          s.port.toLowerCase().includes(q) ||
          String(s.pid).toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [services, activeCategory, searchQuery]);

  const paginatedServices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, page]);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, searchQuery, node.serverCode]);

  const ramUsedGb = formatBytesToGb(node.ramUsedBytes, 1);
  const ramTotalGb = formatBytesToGb(node.ramTotalBytes, 1);
  const ramBuffersGb = formatBytesToGb(node.ramBuffersBytes, 1);
  const diskUsedGb = formatBytesToGb(node.diskUsedBytes, 1);
  const diskTotalGb = formatBytesToGb(node.diskTotalBytes, 0);
  const diskReadMb = (node.diskReadBytesPerSec / 1024 ** 2).toFixed(2);
  const diskWriteMb = (node.diskWriteBytesPerSec / 1024 ** 2).toFixed(2);
  const netInMbps = ((node.netRxBytesPerSec * 8) / 1024 ** 2).toFixed(2);
  const netOutMbps = ((node.netTxBytesPerSec * 8) / 1024 ** 2).toFixed(2);
  const fdPct = ((node.fdAllocated / Math.max(1, node.fdMax)) * 100).toFixed(1);
  const inodeUsedM = (node.inodeUsed / 1_000_000).toFixed(2);
  const inodeTotalM = (node.inodeTotal / 1_000_000).toFixed(2);

  const renderCategoryBadge = (cat: ServiceCategory) => {
    if (cat === 'pm2') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
          PM2 / Node
        </span>
      );
    }
    if (cat === 'docker') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-blue-50 text-blue-700 border border-blue-200">
          Docker
        </span>
      );
    }
    if (cat === 'database') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-purple-50 text-purple-700 border border-purple-200">
          Database
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-amber-50 text-amber-800 border border-amber-200">
        Systemd
      </span>
    );
  };

  const renderHealthPill = (status: UnifiedServerServiceItem['status'], label: string) => {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {label}
        </span>
      );
    }
    if (status === 'warning') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {label}
        </span>
      );
    }
    if (status === 'critical') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        {label}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Navigation & Node Switcher Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/dashboard/servers"
              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Fleet Overview</span>
            </Link>

            {/* Quick Node Switcher Pills */}
            {nodesList.length > 0 && (
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
                {nodesList.map((n) => {
                  const isCurrent =
                    n.id === node.id || n.serverCode.toLowerCase() === node.serverCode.toLowerCase();
                  return (
                    <button
                      key={n.id || n.serverCode}
                      type="button"
                      onClick={() => router.push(`/dashboard/servers/${encodeURIComponent(String(n.id || n.serverCode))}`)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isCurrent ? 'bg-white' : 'bg-emerald-500'
                        }`}
                      />
                      <span>{n.serverCode}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-medium text-slate-700">Live Stream: {countdown}s</span>
            </div>

            <button
              type="button"
              onClick={() => void handleRotateAgentKey()}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              <span>API Key Mesin</span>
            </button>

            <button
              type="button"
              onClick={() => setLogModal({ isOpen: true, serviceName: undefined })}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Kernel Stream Log</span>
            </button>
          </div>
        </div>

        {/* Page Header Banner Card */}
        <div className="bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
                <Server className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
                {node.serverCode}
              </h1>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {node.roleBadge || 'ON-PREMISE HOST'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {node.ipAddress} &bull; {node.os} &bull; {node.cpuModel} ({node.cpuCores} vCPU) &bull; Uptime:{' '}
              {formatUptimeDaysHours(node.uptimeSeconds)}
            </p>
          </div>

          {/* Quick Hardware Counters */}
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-right">
              <span className="text-[11px] text-slate-400 font-normal uppercase block">Agent Key</span>
              <span className="font-bold text-emerald-700">{node.agentKeyPrefix || 'Per-Machine Key'}</span>
            </div>
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-right">
              <span className="text-[11px] text-slate-400 font-normal uppercase block">Daemon Core</span>
              <span className="font-bold text-slate-900">{node.daemonCore || 'Systemd'}</span>
            </div>
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-right">
              <span className="text-[11px] text-slate-400 font-normal uppercase block">Avg Ping</span>
              <span className="font-bold text-emerald-600">{node.avgPingMs} ms</span>
            </div>
          </div>
        </div>

        {/* KPI Summary Strip with Live Sparklines (Expanded 6 Enterprise Cards) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Card 1: CPU Utilization */}
          <div className="bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                  CPU Utilization
                </span>
                <span className="p-1 rounded-lg bg-emerald-50 text-emerald-700">
                  <Cpu className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-slate-900 font-mono">
                  {node.cpuUsagePct}%
                </span>
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                  {node.cpuCores} vCPU
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-mono">
                IOWait: {node.cpuIoWaitPct}% &bull; Steal: {node.cpuStealPct}%
              </div>
            </div>
            <div className="mt-2">
              <ServerSparkline
                data={node.spark?.cpu?.length ? node.spark.cpu : [node.cpuUsagePct]}
                tone={node.cpuUsagePct >= 80 ? 'rose' : 'emerald'}
                height={36}
                min={0}
                max={100}
              />
            </div>
          </div>

          {/* Card 2: RAM Allocation */}
          <div className="bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                  RAM Allocation
                </span>
                <span className="p-1 rounded-lg bg-blue-50 text-blue-700">
                  <MemoryStick className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-slate-900 font-mono">
                  {node.ramUsagePct}%
                </span>
                <span className="text-[11px] font-bold text-slate-700 font-mono">
                  {ramUsedGb} / {ramTotalGb} GB
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-mono">
                Buffers/Cache: {ramBuffersGb}G &bull; Swap: {node.swapUsedPct}%
              </div>
            </div>
            <div className="mt-2">
              <ServerSparkline
                data={node.spark?.ram?.length ? node.spark.ram : [node.ramUsagePct]}
                tone="blue"
                height={36}
                min={0}
                max={100}
              />
            </div>
          </div>

          {/* Card 3: Disk I/O */}
          <div className="bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                  Disk Block I/O
                </span>
                <span className="p-1 rounded-lg bg-purple-50 text-purple-700">
                  <HardDrive className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <div>
                  <span className="text-[10px] text-slate-400">R: </span>
                  <span className="text-xs font-bold text-slate-900">{diskReadMb} MB/s</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">W: </span>
                  <span className="text-xs font-bold text-slate-900">{diskWriteMb} MB/s</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-mono">
                IOPS: <span className="text-slate-700 font-bold">{node.diskIops}</span> &bull; {node.diskMountType}
              </div>
            </div>
            <div className="mt-2">
              <ServerSparkline
                data={node.spark?.disk?.length ? node.spark.disk : [0]}
                tone="purple"
                height={36}
              />
            </div>
          </div>

          {/* Card 4: Net Bandwidth */}
          <div className="bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                  Net Bandwidth
                </span>
                <span className="p-1 rounded-lg bg-emerald-50 text-emerald-700">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-xs font-bold text-emerald-700">&darr; {netInMbps} Mbps</span>
                <span className="text-xs font-bold text-blue-700">&uarr; {netOutMbps} Mbps</span>
              </div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-mono">
                Drop: {node.netDropPackets.toLocaleString()} pkts &bull; Retrans: {node.netRetransPct}%
              </div>
            </div>
            <div className="mt-2">
              <ServerSparkline
                data={node.spark?.net?.length ? node.spark.net : [0]}
                tone="teal"
                height={36}
              />
            </div>
          </div>

          {/* Card 5: TCP & Descriptors */}
          <div className="bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                  TCP & Descriptors
                </span>
                <span className="p-1 rounded-lg bg-cyan-50 text-cyan-700">
                  <Network className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-2xl font-extrabold text-slate-900">{node.tcpEstablished}</span>
                <span className="text-[10px] font-semibold bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded border border-cyan-200 font-mono">
                  ESTABLISHED
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-mono">
                FD: {node.fdAllocated.toLocaleString()} / {node.fdMax.toLocaleString()} ({fdPct}%)
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>
                TIME_WAIT: <b className="text-slate-800">{node.tcpTimeWait}</b>
              </span>
              <span>
                SYN_RECV: <b className="text-emerald-600">{node.tcpSynRecv}</b>
              </span>
            </div>
          </div>

          {/* Card 6: SecOps & SSL */}
          <div className="bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                  SecOps & Shield
                </span>
                <span className="p-1 rounded-lg bg-amber-50 text-amber-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-2xl font-extrabold text-emerald-700">{node.sslDaysRemaining}d</span>
                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                  VALID
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-mono">
                Key: {node.agentKeyPrefix || 'Isolated Key'}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>
                Firewall: <b className="text-emerald-600">{node.ufwStatus || 'Active'}</b>
              </span>
              <span>
                SSH Fail: <b className="text-rose-600">{node.failedSshCount}</b>
              </span>
            </div>
          </div>
        </section>

        {/* Enterprise System Kernel & Deep Health Telemetry Panel (3 Columns) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Panel 1: Load Averages & Context Switches */}
          <div className="bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                Load Averages & Context Switches
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                Linux Scheduler
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 my-3 text-center">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-mono uppercase block">1 Min</span>
                <span className="text-base font-bold font-mono text-slate-900">
                  {node.loadAvg?.[0] ?? 0}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-mono uppercase block">5 Min</span>
                <span className="text-base font-bold font-mono text-slate-900">
                  {node.loadAvg?.[1] ?? 0}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-mono uppercase block">15 Min</span>
                <span className="text-base font-bold font-mono text-slate-900">
                  {node.loadAvg?.[2] ?? 0}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-[11px] font-mono text-slate-600 pt-2 border-t border-slate-100">
              <div className="flex justify-between">
                <span>Context Switches:</span>
                <span className="font-bold text-slate-900">
                  {node.contextSwitchesPerSec.toLocaleString()} /sec
                </span>
              </div>
              <div className="flex justify-between">
                <span>Interrupts (IRQ):</span>
                <span className="font-bold text-slate-900">
                  {node.interruptsPerSec.toLocaleString()} /sec
                </span>
              </div>
              <div className="flex justify-between">
                <span>Processes (Zombie / Total):</span>
                <span className="font-bold text-slate-900">
                  <span className="text-emerald-600">{node.zombieProcesses} zombie</span> /{' '}
                  {node.totalProcesses} total
                </span>
              </div>
            </div>
          </div>

          {/* Panel 2: Storage Capacity & Inode Saturation */}
          <div className="bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-purple-600" />
                Storage Capacity & Inode Saturation
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                {node.diskMountType || 'ext4 / root'}
              </span>
            </div>

            <div className="space-y-3 my-3">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-500 font-medium">Root Volume ({node.diskMountType})</span>
                  <span className="font-bold text-slate-900">
                    {diskUsedGb} GB / {diskTotalGb} GB ({node.diskUsagePct}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, node.diskUsagePct)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-500 font-medium">
                    Inode Saturation (Total {inodeTotalM}M)
                  </span>
                  <span className="font-bold text-slate-900">
                    {inodeUsedM}M / {inodeTotalM}M ({node.inodeUsagePct}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, node.inodeUsagePct)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-100">
              <span>
                Read: <b className="text-slate-800">{diskReadMb} MB/s</b>
              </span>
              <span>
                Write: <b className="text-slate-800">{diskWriteMb} MB/s</b>
              </span>
              <span>
                SMART: <b className="text-emerald-600">{node.smartStatus || 'PASSED'}</b>
              </span>
            </div>
          </div>

          {/* Panel 3: Active Listening Sockets & Ports */}
          <div className="bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-600" />
                Active Listening Sockets & Ports
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {(node.openPorts || []).length} Listening
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 my-2 text-[11px] font-mono max-h-[132px] overflow-y-auto pr-1">
              {(node.openPorts || []).map((p, idx) => (
                <div
                  key={`${p.port}-${idx}`}
                  className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-1"
                >
                  <span className="text-slate-600 shrink-0">{p.port}</span>
                  <span className={`text-[10px] font-bold truncate ${PORT_TEXT_COLORS[idx % PORT_TEXT_COLORS.length]}`}>
                    {p.name}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-100">
              <span>
                Binding: <b className="text-slate-800">0.0.0.0 / ::</b>
              </span>
              <span>
                Source: <b className="text-emerald-600">ss -tlnp</b>
              </span>
            </div>
          </div>
        </section>

        {/* Service Management Control Deck (Tabs & Search Bar) */}
        <div className="bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeCategory === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Services ({categoryCounts.all})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('pm2')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeCategory === 'pm2'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Terminal className={`w-3.5 h-3.5 ${activeCategory === 'pm2' ? 'text-white' : 'text-emerald-600'}`} />
                <span>PM2 / Node.js ({categoryCounts.pm2})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('docker')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeCategory === 'docker'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Box className={`w-3.5 h-3.5 ${activeCategory === 'docker' ? 'text-white' : 'text-blue-600'}`} />
                <span>Docker ({categoryCounts.docker})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('database')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeCategory === 'database'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Database
                  className={`w-3.5 h-3.5 ${activeCategory === 'database' ? 'text-white' : 'text-purple-600'}`}
                />
                <span>Databases ({categoryCounts.database})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('systemd')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  activeCategory === 'systemd'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Cpu className={`w-3.5 h-3.5 ${activeCategory === 'systemd' ? 'text-white' : 'text-amber-600'}`} />
                <span>Systemd Native ({categoryCounts.systemd})</span>
              </button>
            </div>

            {/* Search Field */}
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search service, port, PID..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              {(searchQuery || activeCategory !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('all');
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition font-medium cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Master Process & Service Inspection Table (9 Columns) */}
        <div className="bg-white border border-slate-200 shadow-xs sm:shadow-sm rounded-2xl overflow-hidden">
          {paginatedServices.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                <FilterX className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">Tidak ada layanan atau daemon yang cocok</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Coba bersihkan kata kunci pencarian atau pindah ke tab kategori lainnya.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 select-none text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4">Service & Subsystem</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Health Status</th>
                      <th className="py-3 px-3">PID / ID</th>
                      <th className="py-3 px-3">CPU Load</th>
                      <th className="py-3 px-3">Memory RSS</th>
                      <th className="py-3 px-3">Uptime / Restarts</th>
                      <th className="py-3 px-3">Ports / Target</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedServices.map((svc) => {
                      const isRestarting = restartingServiceId === svc.id;
                      return (
                        <tr
                          key={svc.id}
                          className="hover:bg-slate-50/80 transition-colors group"
                        >
                          {/* 1. Service & Subsystem */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  svc.status === 'active'
                                    ? 'bg-emerald-500'
                                    : svc.status === 'warning'
                                      ? 'bg-amber-500'
                                      : svc.status === 'critical'
                                        ? 'bg-rose-500'
                                        : 'bg-slate-400'
                                }`}
                              />
                              <div>
                                <span className="text-xs font-bold text-slate-900 block font-mono">
                                  {svc.name}
                                </span>
                                <span className="text-[11px] text-slate-500 font-normal block">
                                  {svc.sub}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. Category */}
                          <td className="py-3 px-3">{renderCategoryBadge(svc.category)}</td>

                          {/* 3. Health Status */}
                          <td className="py-3 px-3">
                            {renderHealthPill(svc.status, svc.statusLabel)}
                          </td>

                          {/* 4. PID / ID */}
                          <td className="py-3 px-3 text-xs font-bold text-slate-900 font-mono">
                            {svc.pid}
                          </td>

                          {/* 5. CPU Load */}
                          <td className="py-3 px-3 font-mono">
                            <div className="flex items-center gap-2">
                              <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-emerald-600 h-full rounded-full"
                                  style={{ width: `${Math.min(100, svc.cpu * 4)}%` }}
                                />
                              </div>
                              <span
                                className={`text-xs font-bold ${
                                  svc.cpu > 10 ? 'text-amber-700' : 'text-slate-900'
                                }`}
                              >
                                {svc.cpu}%
                              </span>
                            </div>
                          </td>

                          {/* 6. Memory RSS */}
                          <td className="py-3 px-3 text-xs font-bold text-slate-900 font-mono">
                            {svc.ram}
                          </td>

                          {/* 7. Uptime / Restarts */}
                          <td className="py-3 px-3 font-mono">
                            <span className="text-xs font-medium text-slate-700 block">
                              {svc.uptime}
                            </span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              {svc.restarts} restarts
                            </span>
                          </td>

                          {/* 8. Ports / Target */}
                          <td className="py-3 px-3 font-mono">
                            <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-700 inline-block font-medium">
                              {svc.port}
                            </span>
                          </td>

                          {/* 9. Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleRestartService(svc)}
                                disabled={isRestarting}
                                title={`Restart ${svc.name}`}
                                aria-label={`Restart ${svc.name}`}
                                className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                              >
                                <RotateCcw
                                  className={`w-3.5 h-3.5 ${
                                    isRestarting ? 'animate-spin text-amber-600' : ''
                                  }`}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setLogModal({
                                    isOpen: true,
                                    serviceName: svc.name,
                                  })
                                }
                                title={`Lihat Live Logs ${svc.name}`}
                                aria-label={`Lihat Live Logs ${svc.name}`}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-semibold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                <Terminal className="w-3 h-3 text-emerald-600" />
                                <span>Logs</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <TablePagination
                page={page}
                limit={pageSize}
                total={filteredServices.length}
                onPageChange={setPage}
              />
            </>
          )}
        </div>

        {/* Per-Machine API Key Modal */}
        <ModalShell
          isOpen={Boolean(rotatedKeyModal?.isOpen)}
          onClose={() => setRotatedKeyModal(null)}
          title="API Key Agent Khusus Mesin"
          subtitle={`Kredensial otentikasi telemetri untuk mesin ${node.serverCode}.`}
        >
          {rotatedKeyModal && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                API Key baru telah dibuat khusus untuk mesin <strong>{node.serverCode}</strong>. Kunci lama untuk mesin ini otomatis dinonaktifkan.
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-600 mb-1">
                  Per-Server Agent API Key
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono break-all">
                    {rotatedKeyModal.agentApiKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handleCopyText(rotatedKeyModal.agentApiKey, 'key')}
                    className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedField === 'key' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'key' ? 'Tersalin' : 'Salin Key'}</span>
                  </button>
                </div>
              </div>
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRotatedKeyModal(null)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </ModalShell>

        {/* Realtime Terminal Log Modal */}
        <TerminalLogModal
          isOpen={logModal.isOpen}
          onClose={() => setLogModal({ isOpen: false })}
          serverIdOrHost={node.id || node.serverCode}
          hostname={node.serverCode}
          serviceName={logModal.serviceName}
        />

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-lg flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-slate-900 truncate">{toast.title}</h5>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{toast.message}</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
