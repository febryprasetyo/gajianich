'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ModalShell from '@/components/ui/ModalShell';
import ServerSparkline from '@/components/servers/ServerSparkline';
import TerminalLogModal from '@/components/servers/TerminalLogModal';
import { DEFAULT_FLEET_SUMMARY } from '@/components/servers/defaultFleetData';
import { useServerMonitoringStream } from '@/hooks/useServerMonitoringStream';
import { api } from '@/lib/api';
import {
  FleetSummaryRollup,
  ServerNodeItem,
  UnifiedServerServiceItem,
} from '@/types/serverMonitoring';
import {
  Activity,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  ExternalLink,
  KeyRound,
  Layers,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';

function formatUptimeDaysHours(seconds: number): string {
  const sec = Math.max(0, Number(seconds) || 0);
  if (sec === 0) return 'Menunggu Agent';
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${Math.max(1, mins)}m`;
}

function formatBytesToGb(bytes: number, decimals = 1): string {
  const gb = (Number(bytes) || 0) / 1024 ** 3;
  return decimals === 0 ? `${Math.round(gb)}` : gb.toFixed(decimals);
}

function formatInodes(used: number, total: number): string {
  const u = (Number(used) || 0) / 1_000_000;
  const t = (Number(total) || 1) / 1_000_000;
  return `${u.toFixed(2)}M / ${t.toFixed(2)}M Inodes`;
}

export default function ServerOverviewPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<ServerNodeItem[]>([]);
  const [fleetSummary, setFleetSummary] = useState<FleetSummaryRollup>(DEFAULT_FLEET_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'healthy' | 'warning' | 'secops'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fleetServiceSearch, setFleetServiceSearch] = useState('');

  // Terminal Log Modal state
  const [logModalTarget, setLogModalTarget] = useState<{
    isOpen: boolean;
    serverIdOrHost: string | number;
    hostname: string;
    serviceName?: string;
  }>({
    isOpen: false,
    serverIdOrHost: 'fastpec-MINI-S',
    hostname: 'fastpec-MINI-S',
  });

  // Add / Register Node Modal state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [newNodeForm, setNewNodeForm] = useState({
    hostname: '',
    name: '',
    ipAddress: '',
    serverType: 'Physical',
    roleBadge: 'ON-PREMISE HOST',
  });
  const [isSubmittingNode, setIsSubmittingNode] = useState(false);

  // Generated Per-Machine API Key Modal / View state
  const [generatedKeyInfo, setGeneratedKeyInfo] = useState<{
    hostname: string;
    ipAddress: string;
    agentApiKey: string;
    agentKeyPrefix: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'key' | 'cmd' | null>(null);

  // Toast feedback state
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);

  const showToast = useCallback((title: string, message: string) => {
    setToast({ title, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchServers = useCallback(async () => {
    try {
      const res = await api.get<{
        data: ServerNodeItem[];
        fleetSummary?: FleetSummaryRollup;
      }>('/infrastructure/servers');

      if (Array.isArray(res?.data)) {
        setNodes(res.data);
        if (res.fleetSummary) {
          setFleetSummary(res.fleetSummary);
        }
      }
    } catch {
      // Keep current state on transient network glitch
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchServers();
  }, [fetchServers]);

  const { countdown } = useServerMonitoringStream({
    onPulseOrTelemetry: fetchServers,
    intervalSeconds: 5,
  });

  const handlePingHost = async (node: ServerNodeItem) => {
    try {
      const res = await api.post<{ message: string; rttMs: number }>(
        `/infrastructure/servers/${encodeURIComponent(String(node.id || node.serverCode))}/actions`,
        {
          actionType: 'ping',
          targetId: node.serverCode,
          targetName: node.serverCode,
          category: 'systemd',
        },
      );
      showToast(
        `Ping Reply: ${node.serverCode}`,
        res?.message || `RTT avg ${node.avgPingMs} ms • 0% packet loss`,
      );
    } catch (err: any) {
      showToast(
        `Ping Gagal: ${node.serverCode}`,
        err?.message || 'Tidak dapat menghubungi agent pada host ini.',
      );
    }
  };

  const handleRotateServerKey = async (node: ServerNodeItem) => {
    try {
      const res = await api.post<{
        success: boolean;
        hostname: string;
        agentApiKey: string;
        agentKeyPrefix: string;
      }>(`/infrastructure/servers/${encodeURIComponent(String(node.id || node.serverCode))}/rotate-key`, {});

      if (res?.agentApiKey) {
        setGeneratedKeyInfo({
          hostname: node.serverCode,
          ipAddress: node.ipAddress,
          agentApiKey: res.agentApiKey,
          agentKeyPrefix: res.agentKeyPrefix,
        });
        setIsRegisterModalOpen(true);
        await fetchServers();
        showToast(
          'API Key Mesin Dibuat',
          `API Key unik baru untuk ${node.serverCode} siap disalin.`,
        );
      }
    } catch (err: any) {
      showToast('Gagal Membuat API Key', err?.message || 'Tidak dapat merotasi API key mesin.');
    }
  };

  const handleCopyText = async (text: string, field: 'key' | 'cmd') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleRegisterNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeForm.hostname.trim() || !newNodeForm.ipAddress.trim()) return;
    setIsSubmittingNode(true);
    try {
      const cleanHostname = newNodeForm.hostname.trim();
      const cleanIp = newNodeForm.ipAddress.trim();
      const res = await api.post<{
        success: boolean;
        data: ServerNodeItem;
        agentApiKey: string;
        agentKeyPrefix: string;
      }>('/infrastructure/servers', {
        hostname: cleanHostname,
        name: newNodeForm.name.trim() || cleanHostname,
        ipAddress: cleanIp,
        serverType: newNodeForm.serverType,
        roleBadge: newNodeForm.roleBadge,
      });

      setNewNodeForm({
        hostname: '',
        name: '',
        ipAddress: '',
        serverType: 'Physical',
        roleBadge: 'ON-PREMISE HOST',
      });
      await fetchServers();

      if (res?.agentApiKey) {
        setGeneratedKeyInfo({
          hostname: cleanHostname,
          ipAddress: cleanIp,
          agentApiKey: res.agentApiKey,
          agentKeyPrefix: res.agentKeyPrefix,
        });
      } else {
        setIsRegisterModalOpen(false);
      }
      showToast(
        'Server Terdaftar',
        `Node ${cleanHostname} ditambahkan dengan API Key unik khusus mesin.`,
      );
    } catch (err: any) {
      showToast('Gagal Menyimpan', err?.message || 'Periksa kembali data server.');
    } finally {
      setIsSubmittingNode(false);
    }
  };

  const handleOpenFreshRegisterModal = () => {
    setGeneratedKeyInfo(null);
    setIsRegisterModalOpen(true);
  };

  const handleCloseRegisterModal = () => {
    setIsRegisterModalOpen(false);
    setGeneratedKeyInfo(null);
  };

  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (activeKpiFilter === 'healthy' && node.healthStatus !== 'Online') return false;
      if (activeKpiFilter === 'warning' && node.healthStatus !== 'Warning' && node.cpuUsagePct < 70) return false;
      if (activeKpiFilter === 'secops' && node.fail2banBannedIps <= 0 && !node.ufwStatus) return false;

      if (typeFilter && node.serverType !== typeFilter) return false;
      if (statusFilter && node.healthStatus !== statusFilter && node.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchHost = node.serverCode.toLowerCase().includes(q) || node.name.toLowerCase().includes(q);
        const matchIp = node.ipAddress.toLowerCase().includes(q);
        const matchOs = (node.os || '').toLowerCase().includes(q) || (node.cpuModel || '').toLowerCase().includes(q);
        const matchService = (node.unifiedServices || []).some(
          (s) => s.name.toLowerCase().includes(q) || s.port.toLowerCase().includes(q),
        );
        if (!matchHost && !matchIp && !matchOs && !matchService) return false;
      }
      return true;
    });
  }, [nodes, activeKpiFilter, typeFilter, statusFilter, searchQuery]);

  // Flatten all services across all nodes for "Key Core Services Across Fleet"
  const allFleetServices = useMemo(() => {
    const items: Array<UnifiedServerServiceItem & { nodeId: number; nodeHostname: string }> = [];
    for (const node of nodes) {
      for (const svc of node.unifiedServices || []) {
        items.push({
          ...svc,
          nodeId: node.id,
          nodeHostname: node.serverCode,
        });
      }
    }
    if (!fleetServiceSearch.trim()) return items.slice(0, 12);
    const q = fleetServiceSearch.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.nodeHostname.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.port.toLowerCase().includes(q) ||
        item.sub.toLowerCase().includes(q),
    );
  }, [nodes, fleetServiceSearch]);

  const hasActiveFilters = Boolean(searchQuery || typeFilter || statusFilter || activeKpiFilter !== 'all');

  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('');
    setStatusFilter('');
    setActiveKpiFilter('all');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Pillar 1: Page Header with Emerald Box Icon + Title + Subtitle + Clear Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Server<span className="text-emerald-600">360</span> — Monitoring Server & Layanan
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide font-mono">
                Realtime Telemetry
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pemantauan performa hardware, aplikasi PM2/Node.js, container Docker, database, dan layanan systemd secara realtime.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-medium text-slate-700">Telemetry Stream: Live</span>
              <span className="text-[11px] text-slate-400 font-mono ml-1">{countdown}s</span>
            </div>

            <button
              type="button"
              onClick={handleOpenFreshRegisterModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrasi Server</span>
            </button>
          </div>
        </div>

        {/* Pillar 3: Interactive Cluster Fleet Summary KPI Rollup */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Monitored Nodes */}
          <button
            type="button"
            onClick={() => setActiveKpiFilter('all')}
            aria-pressed={activeKpiFilter === 'all'}
            className={`text-left rounded-2xl p-4 shadow-xs transition-all cursor-pointer flex flex-col justify-between ${
              activeKpiFilter === 'all'
                ? 'bg-emerald-50/50 border-2 border-emerald-500 ring-2 ring-emerald-500/20'
                : 'bg-white border border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2 w-full">
              <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-600">
                Monitored Nodes
              </span>
              <Server className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
                {fleetSummary.onlineNodes}{' '}
                <span className="text-xs font-normal text-slate-400">/ {fleetSummary.totalNodes}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {fleetSummary.uptimePct}% Up
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between w-full">
              <span>Realtime Host Agent</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-medium text-slate-600">{fleetSummary.totalVcpu} vCPU Total</span>
                {activeKpiFilter === 'all' && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md">
                    Aktif
                  </span>
                )}
              </div>
            </div>
          </button>

          {/* KPI 2: Fleet Memory */}
          <button
            type="button"
            onClick={() => setActiveKpiFilter(activeKpiFilter === 'healthy' ? 'all' : 'healthy')}
            aria-pressed={activeKpiFilter === 'healthy'}
            className={`text-left rounded-2xl p-4 shadow-xs transition-all cursor-pointer flex flex-col justify-between ${
              activeKpiFilter === 'healthy'
                ? 'bg-emerald-50/50 border-2 border-emerald-500 ring-2 ring-emerald-500/20'
                : 'bg-white border border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2 w-full">
              <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-600">
                Fleet Memory
              </span>
              <Cpu className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
                {fleetSummary.fleetRamUsedGb}{' '}
                <span className="text-xs font-normal text-slate-400">/ {fleetSummary.fleetRamTotalGb} GB</span>
              </span>
              <span className="text-xs font-bold text-emerald-600 font-mono">{fleetSummary.fleetRamPct}%</span>
            </div>
            <div className="mt-2 w-full">
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, fleetSummary.fleetRamPct)}%` }}
                />
              </div>
              {activeKpiFilter === 'healthy' && (
                <div className="flex justify-end mt-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md">
                    Aktif
                  </span>
                </div>
              )}
            </div>
          </button>

          {/* KPI 3: Active Services */}
          <button
            type="button"
            onClick={() => setActiveKpiFilter(activeKpiFilter === 'warning' ? 'all' : 'warning')}
            aria-pressed={activeKpiFilter === 'warning'}
            className={`text-left rounded-2xl p-4 shadow-xs transition-all cursor-pointer flex flex-col justify-between ${
              activeKpiFilter === 'warning'
                ? 'bg-emerald-50/50 border-2 border-emerald-500 ring-2 ring-emerald-500/20'
                : 'bg-white border border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2 w-full">
              <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-600">
                Active Services
              </span>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
                {fleetSummary.activeServicesTotal}
              </span>
              <span className="text-[11px] font-medium text-slate-500">processes & containers</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between w-full">
              <span className="text-emerald-700 font-medium">{fleetSummary.normalServicesCount} Normal</span>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-700 font-medium">{fleetSummary.warningServicesCount} Warning</span>
                {activeKpiFilter === 'warning' && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md">
                    Aktif
                  </span>
                )}
              </div>
            </div>
          </button>

          {/* KPI 4: SecOps & Shield */}
          <button
            type="button"
            onClick={() => setActiveKpiFilter(activeKpiFilter === 'secops' ? 'all' : 'secops')}
            aria-pressed={activeKpiFilter === 'secops'}
            className={`text-left rounded-2xl p-4 shadow-xs transition-all cursor-pointer flex flex-col justify-between ${
              activeKpiFilter === 'secops'
                ? 'bg-emerald-50/50 border-2 border-emerald-500 ring-2 ring-emerald-500/20'
                : 'bg-white border border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2 w-full">
              <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-600">
                SecOps & Per-Host Key
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
                {nodes.filter((n) => n.hasCustomAgentKey || n.agentKeyPrefix).length || nodes.length}
              </span>
              <span className="text-xs font-medium text-slate-500">Isolated Keys</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between w-full">
              <span>Per-Machine Auth Active</span>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-600 font-semibold">SSL {fleetSummary.minSslDays} Days</span>
                {activeKpiFilter === 'secops' && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md">
                    Aktif
                  </span>
                )}
              </div>
            </div>
          </button>
        </section>

        {/* Pillar 4: Search & Filter Toolbar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari hostname (misal: fastpec-MINI-S), IP address, OS, atau nama service..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter Tipe Server"
                className="bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Semua Tipe Node</option>
                <option value="Physical">On-Premise Physical</option>
                <option value="VPS">Public Cloud VPS</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter Status Kesehatan"
                className="bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Semua Status</option>
                <option value="Online">Online (Normal)</option>
                <option value="Warning">Warning (High Load)</option>
                <option value="Offline">Offline</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-rose-600 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-rose-200 transition-all font-medium cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section: Side-by-Side Server Node Cards */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
              Infrastructure Nodes ({filteredNodes.length} Servers)
            </h2>
            <span className="text-xs text-slate-400">Klik kartu server untuk membuka inspeksi sistem & layanan</span>
          </div>

          {filteredNodes.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs">
              <Server className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">
                {isLoading ? 'Memuat telemetri server...' : 'Belum ada node server yang sesuai filter'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Klik tombol <strong>Registrasi Server</strong> di kanan atas untuk menambahkan mesin baru dengan API Key unik.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {filteredNodes.map((node) => {
                const isHighCpu = node.cpuUsagePct >= 80;
                const ramUsedGb = formatBytesToGb(node.ramUsedBytes, 1);
                const ramTotalGb = formatBytesToGb(node.ramTotalBytes, 1);
                const diskUsedGb = formatBytesToGb(node.diskUsedBytes, 1);
                const diskTotalGb = formatBytesToGb(node.diskTotalBytes, 0);

                return (
                  <div
                    key={node.id || node.serverCode}
                    onClick={() => router.push(`/dashboard/servers/${encodeURIComponent(String(node.id || node.serverCode))}`)}
                    className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all cursor-pointer group ${
                      isHighCpu
                        ? 'border-rose-400 ring-2 ring-rose-500/10'
                        : 'border-slate-200 hover:border-emerald-400 hover:shadow-sm'
                    }`}
                  >
                    <div>
                      {/* Header Node */}
                      <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                node.status === 'Offline'
                                  ? 'bg-rose-500'
                                  : isHighCpu
                                    ? 'bg-amber-500 animate-pulse'
                                    : 'bg-emerald-500'
                              }`}
                            />
                            <h3 className="text-sm font-extrabold text-slate-900 font-mono group-hover:text-emerald-700 transition-colors">
                              {node.serverCode}
                            </h3>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {node.cpuModel && node.cpuModel !== 'Menunggu Telemetri Agent...'
                              ? `${node.cpuModel} (${node.cpuCores} vCPU) • ${node.os}`
                              : node.os}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                          {node.connectionMode || 'WS PUSH'}
                        </span>
                      </div>

                      {/* Connectivity & Per-Host API Key Metadata */}
                      <div className="grid grid-cols-2 gap-2 my-3 text-[11px] font-mono">
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-slate-400 block text-[10px]">
                            {node.serverType === 'Physical' ? 'HOST IP' : 'PUBLIC IP'}
                          </span>
                          <span className="font-bold text-slate-800">{node.ipAddress}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-slate-400 block text-[10px]">UPTIME</span>
                          <span className="font-bold text-slate-800">
                            {formatUptimeDaysHours(node.uptimeSeconds)}
                          </span>
                        </div>
                      </div>

                      {/* Mini Sparkline CPU / RAM / Storage */}
                      <div className="space-y-3 py-2">
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[11px] font-semibold text-slate-600 font-mono">CPU LOAD</span>
                            <span
                              className={`font-mono font-bold ${
                                isHighCpu ? 'text-rose-600' : 'text-slate-900'
                              }`}
                            >
                              {node.cpuUsagePct}%
                            </span>
                          </div>
                          <ServerSparkline
                            data={node.spark?.cpu?.length ? node.spark.cpu : [node.cpuUsagePct]}
                            tone={isHighCpu ? 'rose' : 'emerald'}
                            height={36}
                            min={0}
                            max={100}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[11px] font-semibold text-slate-600 font-mono">
                              RAM ({ramTotalGb} GB)
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              {ramUsedGb} GB ({node.ramUsagePct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`${
                                node.ramUsagePct > 85 ? 'bg-rose-500' : 'bg-emerald-500'
                              } h-full rounded-full transition-all duration-300`}
                              style={{ width: `${Math.min(100, node.ramUsagePct)}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[11px] font-semibold text-slate-600 font-mono">
                              STORAGE ({node.diskMountType || 'ext4 / root'})
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              {diskUsedGb}G / {diskTotalGb}G ({node.diskUsagePct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`${
                                node.diskUsagePct > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                              } h-full rounded-full transition-all duration-300`}
                              style={{ width: `${Math.min(100, node.diskUsagePct)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Active Workloads Badges */}
                      <div className="pt-3 border-t border-slate-100">
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block mb-1.5">
                          Active Workloads ({node.unifiedServices?.length || 0})
                        </span>
                        <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                          {(node.unifiedServices || []).slice(0, 5).map((svc) => (
                            <span
                              key={svc.id}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                            >
                              {svc.name}
                            </span>
                          ))}
                          {(node.unifiedServices?.length || 0) > 5 && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
                              +{(node.unifiedServices?.length || 0) - 5} lagi
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div
                      className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-slate-400">
                        Load Avg:{' '}
                        <strong className="text-slate-700 font-mono">
                          {node.loadAvg?.[0] ?? 0}, {node.loadAvg?.[1] ?? 0}, {node.loadAvg?.[2] ?? 0}
                        </strong>
                      </span>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => void handleRotateServerKey(node)}
                          title={`Generate / Rotate API Key Mesin ${node.serverCode}`}
                          aria-label={`API Key Mesin ${node.serverCode}`}
                          className="text-slate-500 hover:text-emerald-700 font-semibold font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>API Key</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setLogModalTarget({
                              isOpen: true,
                              serverIdOrHost: node.id || node.serverCode,
                              hostname: node.serverCode,
                            })
                          }
                          className="text-emerald-700 hover:text-emerald-800 font-semibold font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          <span>Stream Log</span>
                        </button>

                        <Link
                          href={`/dashboard/servers/${encodeURIComponent(String(node.id || node.serverCode))}`}
                          className="text-slate-600 hover:text-emerald-700 font-semibold font-mono flex items-center gap-1"
                          title="Buka Detail Monitoring Server"
                          aria-label={`Buka Detail ${node.serverCode}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section: Cross-Server Kernel & Deep Health Matrix */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
                Cross-Server Kernel & Deep Health Matrix
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Perbandingan parameter kernel, socket saturation, storage inode allocation, dan kunci otentikasi per-mesin
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">Status: Realtime Synced</span>
            </div>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                  <th className="py-2.5 px-3">Host Node</th>
                  <th className="py-2.5 px-3">Load (1m / 5m / 15m)</th>
                  <th className="py-2.5 px-3">Inodes Usage</th>
                  <th className="py-2.5 px-3">TCP / Sockets</th>
                  <th className="py-2.5 px-3">Context Switches</th>
                  <th className="py-2.5 px-3">Agent API Key</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {filteredNodes.map((node) => (
                  <tr key={`matrix-${node.serverCode}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            node.status === 'Offline' ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                        />
                        <div>
                          <Link
                            href={`/dashboard/servers/${encodeURIComponent(String(node.id || node.serverCode))}`}
                            className="font-bold text-slate-900 hover:text-emerald-700"
                          >
                            {node.serverCode}
                          </Link>
                          <span className="block text-[10px] text-slate-400 font-sans">
                            {node.ipAddress} • {node.cpuModel} ({node.cpuCores} vCPU)
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {node.loadAvg?.[0] ?? 0} / {node.loadAvg?.[1] ?? 0} / {node.loadAvg?.[2] ?? 0}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-slate-800 font-bold">{node.inodeUsagePct}%</span>
                      <span className="text-[10px] text-slate-400 block font-sans">
                        {formatInodes(node.inodeUsed, node.inodeTotal)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-slate-800 font-bold">{node.tcpEstablished.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 block font-sans">
                        {node.tcpTimeWait} TIME_WAIT
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {node.contextSwitchesPerSec.toLocaleString()} /s
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <KeyRound className="w-3 h-3" />
                        {node.agentKeyPrefix || 'Per-Host Key'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handlePingHost(node)}
                          title={`Ping Agent ${node.serverCode}`}
                          aria-label={`Ping Agent ${node.serverCode}`}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                        >
                          Ping Agent
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRotateServerKey(node)}
                          title={`Generate / Rotate API Key Unik ${node.serverCode}`}
                          aria-label={`Generate API Key ${node.serverCode}`}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          href={`/dashboard/servers/${encodeURIComponent(String(node.id || node.serverCode))}`}
                          title={`Inspeksi Detail ${node.serverCode}`}
                          aria-label={`Inspeksi Detail ${node.serverCode}`}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section: Key Core Services Across Fleet */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
                Key Core Services Across Fleet ({allFleetServices.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pemantauan cepat proses krusial (PM2/Node.js, Docker, Database, Systemd) yang sedang berjalan secara realtime
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fleetServiceSearch}
                  onChange={(e) => setFleetServiceSearch(e.target.value)}
                  placeholder="Filter process, node, or port..."
                  className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono w-64"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {allFleetServices.map((svc) => (
              <div
                key={`${svc.nodeHostname}-${svc.id}`}
                onClick={() => router.push(`/dashboard/servers/${encodeURIComponent(String(svc.nodeId || svc.nodeHostname))}`)}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono flex items-center gap-1 uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {svc.category === 'docker'
                      ? 'UP (DOCKER)'
                      : svc.category === 'pm2'
                        ? 'RUNNING (NODE/PM2)'
                        : svc.category === 'database'
                          ? 'ACTIVE (DB)'
                          : 'ACTIVE (SYSTEMD)'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Node: {svc.nodeHostname}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 font-mono">{svc.name}</h4>
                    <p className="text-[11px] text-slate-400 font-mono truncate max-w-[220px]">{svc.sub}</p>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <span className="text-slate-800 font-bold block">{svc.ram}</span>
                    <span className="text-[10px] text-slate-400">CPU {svc.cpu}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Modal Registrasi Server */}
        <ModalShell
          isOpen={isRegisterModalOpen}
          onClose={handleCloseRegisterModal}
          title="Registrasi Server"
          subtitle="Tambahkan node server fisik atau Cloud VPS."
        >
          {generatedKeyInfo ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <span>API Key Unik Mesin Berhasil Dibuat ({generatedKeyInfo.hostname})</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Setiap mesin menggunakan API Key unik tersendiri untuk keamanan tingkat lanjut. Simpan kunci ini karena hanya ditampilkan penuh satu kali.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-600 mb-1">
                  Per-Server Agent API Key ({generatedKeyInfo.hostname})
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono break-all border border-slate-800">
                    {generatedKeyInfo.agentApiKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handleCopyText(generatedKeyInfo.agentApiKey, 'key')}
                    className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedField === 'key' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Key</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Perintah Menjalankan Agent (Docker) di Server Target:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyText(
                        `git clone https://github.com/febryprasetyo/gajianich-server-agent.git && cd gajianich-server-agent && AGENT_HOSTNAME="${generatedKeyInfo.hostname}" AGENT_API_KEY="${generatedKeyInfo.agentApiKey}" docker compose up -d --build`,
                        'cmd',
                      )
                    }
                    className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'cmd' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedField === 'cmd' ? 'Tersalin' : 'Salin Perintah'}</span>
                  </button>
                </div>
                <code className="block bg-slate-900 text-emerald-400 p-2.5 rounded-lg text-[10px] overflow-x-auto">
                  {`git clone https://github.com/febryprasetyo/gajianich-server-agent.git && cd gajianich-server-agent && AGENT_HOSTNAME="${generatedKeyInfo.hostname}" AGENT_API_KEY="${generatedKeyInfo.agentApiKey}" docker compose up -d --build`}
                </code>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseRegisterModal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegisterNodeSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-600 mb-1">
                    Hostname / Kode Node *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="misal: fastpec-MINI-S"
                    value={newNodeForm.hostname}
                    onChange={(e) => setNewNodeForm({ ...newNodeForm, hostname: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-600 mb-1">
                    IP Address *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="misal: 192.168.10.212"
                    value={newNodeForm.ipAddress}
                    onChange={(e) => setNewNodeForm({ ...newNodeForm, ipAddress: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-600 mb-1">
                    Nama / Deskripsi Peran
                  </label>
                  <input
                    type="text"
                    placeholder="misal: Local Host Server"
                    value={newNodeForm.name}
                    onChange={(e) => setNewNodeForm({ ...newNodeForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-600 mb-1">
                    Tipe Infrastruktur
                  </label>
                  <select
                    value={newNodeForm.serverType}
                    onChange={(e) => setNewNodeForm({ ...newNodeForm, serverType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="Physical">Local On-Premise Physical</option>
                    <option value="VPS">Public Cloud VPS</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-[11px] text-slate-700 space-y-1">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Deteksi Spesifikasi Otomatis dari Telemetri & Per-Server API Key:</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Sistem Operasi, Model CPU, Jumlah vCPU, Kapasitas RAM, dan Disk</strong> diambil secara otomatis dari telemetri agent. Saat disimpan, sistem akan men-generate <strong>API Key unik khusus mesin ini</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseRegisterModal}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNode}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isSubmittingNode ? 'Menyimpan...' : 'Simpan & Generate API Key'}</span>
                </button>
              </div>
            </form>
          )}
        </ModalShell>

        {/* Live Terminal Log Modal */}
        <TerminalLogModal
          isOpen={logModalTarget.isOpen}
          onClose={() => setLogModalTarget((prev) => ({ ...prev, isOpen: false }))}
          serverIdOrHost={logModalTarget.serverIdOrHost}
          hostname={logModalTarget.hostname}
          serviceName={logModalTarget.serviceName}
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
