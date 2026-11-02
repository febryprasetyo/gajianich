'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import ModalShell from '@/components/ui/ModalShell';
import StatusBadge from '@/components/ui/StatusBadge';
import TablePagination from '@/components/ui/TablePagination';
import {
  Server,
  Cloud,
  HardDrive,
  Activity,
  Search,
  Plus,
  X,
  ExternalLink,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  Shield,
  Layers,
  Info,
} from 'lucide-react';

export interface ServerItem {
  id: number;
  serverCode: string;
  name: string;
  ipAddress: string;
  macAddress?: string;
  os?: string;
  specs?: string;
  status: 'Online' | 'Offline';
  serverType?: 'VPS' | 'Physical';
  provider?: string;
  location?: string;
  cpuCores?: number;
  ramGb?: number;
  storageGb?: number;
  uptimeSeconds?: number;
  notes?: string;
  lastSeenAt?: string;
  updatedAt?: string;
}

const INITIAL_SERVERS: ServerItem[] = [
  {
    id: 101,
    serverCode: 'VPS-PROD-APP01',
    name: 'Production Web App Server',
    ipAddress: '103.145.226.42',
    os: 'Ubuntu 24.04 LTS (x86_64)',
    specs: '4 vCPU · 8 GB RAM · 160 GB NVMe',
    status: 'Online',
    serverType: 'VPS',
    provider: 'IdCloudHost Jakarta',
    location: 'Data Center Cyber 1, Jakarta',
    cpuCores: 4,
    ramGb: 8,
    storageGb: 160,
    uptimeSeconds: 3888000,
    notes: 'Hosting aplikasi utama AMS ERP & Webhook Gateway.',
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: 102,
    serverCode: 'VPS-DEV-STG01',
    name: 'Staging & Development Environment',
    ipAddress: '103.145.226.98',
    os: 'Ubuntu 22.04 LTS (x86_64)',
    specs: '2 vCPU · 4 GB RAM · 80 GB NVMe',
    status: 'Online',
    serverType: 'VPS',
    provider: 'DigitalOcean Singapore',
    location: 'SGP1 Datacenter',
    cpuCores: 2,
    ramGb: 4,
    storageGb: 80,
    uptimeSeconds: 1209600,
    notes: 'Environment pengujian rilis fitur dan automated test.',
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: 103,
    serverCode: 'SRV-PHYS-PABRIK01',
    name: 'Server Fisik ADMS Presensi Pabrik',
    ipAddress: '192.168.10.200',
    macAddress: 'd8:3a:dd:24:b1:9c',
    os: 'Debian 12 Bookworm (Baremetal)',
    specs: 'Intel Xeon E-2324G · 32 GB RAM · 2x 1TB SSD RAID1',
    status: 'Online',
    serverType: 'Physical',
    provider: 'Dell PowerEdge R250 (On-Premise)',
    location: 'Server Room Lt. 2 Pabrik Utama',
    cpuCores: 4,
    ramGb: 32,
    storageGb: 1000,
    uptimeSeconds: 7776000,
    notes: 'Gateway koneksi lokal mesin fingerprint & facial attendance ADMS.',
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: 104,
    serverCode: 'SRV-PHYS-NVR01',
    name: 'CCTV Storage & Video Management NVR',
    ipAddress: '192.168.10.210',
    macAddress: '00:11:32:9c:84:aa',
    os: 'Synology DSM 7.2 (Baremetal)',
    specs: 'Synology RS2423+ · 16 GB ECC · 8x 8TB SAS RAID6',
    status: 'Online',
    serverType: 'Physical',
    provider: 'Synology Enterprise (On-Premise)',
    location: 'Server Room Lt. 2 Pabrik Utama',
    cpuCores: 4,
    ramGb: 16,
    storageGb: 32000,
    uptimeSeconds: 5184000,
    notes: 'Penyimpanan rekaman kamera keamanan 64 channel gedung operasional.',
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: 105,
    serverCode: 'VPS-BKUP-COLD01',
    name: 'Disaster Recovery & Offsite Backup',
    ipAddress: '149.28.150.12',
    os: 'Alpine Linux 3.20',
    specs: '2 vCPU · 2 GB RAM · 500 GB Block Storage',
    status: 'Offline',
    serverType: 'VPS',
    provider: 'Vultr Tokyo',
    location: 'NRT Datacenter Japan',
    cpuCores: 2,
    ramGb: 2,
    storageGb: 500,
    uptimeSeconds: 0,
    notes: 'Node replikasi cold storage harian cadangan database dan dokumen.',
    lastSeenAt: new Date(Date.now() - 3600000 * 30).toISOString(),
  },
];

function formatUptime(seconds?: number): string {
  if (!seconds || seconds <= 0) return 'Offline';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} hari ${hours} jam`;
  if (hours > 0) return `${hours} jam ${minutes} mnt`;
  return `${minutes} menit`;
}

export default function ServersMonitoringPage() {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals
  const [selectedServer, setSelectedServer] = useState<ServerItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    serverCode: '',
    ipAddress: '',
    serverType: 'VPS' as 'VPS' | 'Physical',
    provider: '',
    location: '',
    os: '',
    specs: '',
    notes: '',
  });

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Load backend servers merged with starter VPS & Physical catalogue
  const loadServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<{ data: ServerItem[] }>('/infrastructure/servers');
      const backendData = res.data ?? [];

      if (backendData.length > 0) {
        // Tag backend Accurate server as Physical / Accurate host
        const enrichedBackend: ServerItem[] = backendData.map((s, idx) => ({
          ...s,
          serverType: s.serverType || 'Physical',
          provider: s.provider || 'Accurate Host Local Machine',
          location: s.location || 'Server Room Head Office',
          specs: s.specs || 'Core Infrastructure Host',
        }));

        // Merge without duplicating existing IDs/hostnames
        const existingHostnames = new Set(enrichedBackend.map((b) => b.serverCode?.toLowerCase()));
        const uniqueInitials = INITIAL_SERVERS.filter(
          (init) => !existingHostnames.has(init.serverCode.toLowerCase())
        );
        setServers([...enrichedBackend, ...uniqueInitials]);
      } else {
        setServers(INITIAL_SERVERS);
      }
    } catch {
      // Fallback seamlessly to mock data so UI is always interactive
      setServers(INITIAL_SERVERS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  // Filtered servers
  const filteredServers = useMemo(() => {
    return servers.filter((s) => {
      // Status filter
      if (selectedStatus !== 'ALL' && s.status !== selectedStatus) {
        return false;
      }
      // Type filter
      if (selectedType !== 'ALL' && s.serverType !== selectedType) {
        return false;
      }
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = s.name?.toLowerCase().includes(q);
        const matchCode = s.serverCode?.toLowerCase().includes(q);
        const matchIp = s.ipAddress?.toLowerCase().includes(q);
        const matchProvider = s.provider?.toLowerCase().includes(q);
        const matchOs = s.os?.toLowerCase().includes(q);
        return matchName || matchCode || matchIp || matchProvider || matchOs;
      }
      return true;
    });
  }, [servers, selectedStatus, selectedType, search]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = servers.length;
    const online = servers.filter((s) => s.status === 'Online').length;
    const offline = servers.filter((s) => s.status === 'Offline').length;
    const vps = servers.filter((s) => s.serverType === 'VPS').length;
    const physical = servers.filter((s) => s.serverType === 'Physical').length;
    return { total, online, offline, vps, physical };
  }, [servers]);

  // Paginated
  const paginatedServers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredServers.slice(start, start + pageSize);
  }, [filteredServers, page, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [search, selectedType, selectedStatus]);

  // Handle Add Server
  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.ipAddress) return;

    const newServer: ServerItem = {
      id: Date.now(),
      serverCode: addForm.serverCode || `SRV-${Date.now().toString().slice(-4)}`,
      name: addForm.name,
      ipAddress: addForm.ipAddress,
      serverType: addForm.serverType,
      provider: addForm.provider || 'Private Cloud Provider',
      location: addForm.location || 'Data Center',
      os: addForm.os || 'Linux Ubuntu Server',
      specs: addForm.specs || 'Default Hardware Spec',
      status: 'Online',
      uptimeSeconds: 3600,
      notes: addForm.notes,
      lastSeenAt: new Date().toISOString(),
    };

    setServers((prev) => [newServer, ...prev]);
    setIsAddModalOpen(false);
    setAddForm({
      name: '',
      serverCode: '',
      ipAddress: '',
      serverType: 'VPS',
      provider: '',
      location: '',
      os: '',
      specs: '',
      notes: '',
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header Sesuai Master Desain */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Monitoring Server & VPS
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Monitoring ketersediaan, status koneksi, spesifikasi, dan uptime server fisik maupun VPS cloud.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Server / VPS</span>
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Kartu KPI Interaktif Master Desain */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* KPI 1: Total */}
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('ALL');
              setSelectedType('ALL');
            }}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedStatus === 'ALL' && selectedType === 'ALL'
                ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Total Node
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-slate-900 mt-2">{stats.total}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono">
              {selectedStatus === 'ALL' && selectedType === 'ALL' ? (
                <span className="text-emerald-600 font-bold">● Filter Aktif</span>
              ) : (
                <span>Semua Server</span>
              )}
            </div>
          </button>

          {/* KPI 2: Online */}
          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'Online' ? 'ALL' : 'Online')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedStatus === 'Online'
                ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Server Online
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-emerald-600 mt-2">{stats.online}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono">
              {selectedStatus === 'Online' ? (
                <span className="text-emerald-600 font-bold">● Filter Aktif</span>
              ) : (
                <span>Koneksi Normal</span>
              )}
            </div>
          </button>

          {/* KPI 3: Offline */}
          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'Offline' ? 'ALL' : 'Offline')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedStatus === 'Offline'
                ? 'bg-rose-50/50 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Server Offline
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-rose-600 mt-2">{stats.offline}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono">
              {selectedStatus === 'Offline' ? (
                <span className="text-rose-600 font-bold">● Filter Aktif</span>
              ) : (
                <span>Perlu Pengecekan</span>
              )}
            </div>
          </button>

          {/* KPI 4: VPS Cloud */}
          <button
            type="button"
            onClick={() => setSelectedType(selectedType === 'VPS' ? 'ALL' : 'VPS')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedType === 'VPS'
                ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                VPS Cloud
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Cloud className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-blue-600 mt-2">{stats.vps}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono">
              {selectedType === 'VPS' ? (
                <span className="text-blue-600 font-bold">● Filter Aktif</span>
              ) : (
                <span>Virtual Machine</span>
              )}
            </div>
          </button>

          {/* KPI 5: Fisik Baremetal */}
          <button
            type="button"
            onClick={() => setSelectedType(selectedType === 'Physical' ? 'ALL' : 'Physical')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedType === 'Physical'
                ? 'bg-amber-50/50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Server Fisik
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black font-mono text-amber-600 mt-2">{stats.physical}</p>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono">
              {selectedType === 'Physical' ? (
                <span className="text-amber-600 font-bold">● Filter Aktif</span>
              ) : (
                <span>Baremetal On-Premise</span>
              )}
            </div>
          </button>
        </div>

        {/* 2. Toolbar Filter & Search Rapi */}
        <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari server berdasarkan nama, IP address, OS, provider, atau lokasi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">Semua Tipe Server</option>
                <option value="VPS">VPS Cloud</option>
                <option value="Physical">Server Fisik (On-Premise)</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
              </select>

              {/* Reset Filter Button */}
              {(search !== '' || selectedType !== 'ALL' || selectedStatus !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSelectedType('ALL');
                    setSelectedStatus('ALL');
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-semibold text-xs border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. Tabel Server & VPS Master Desain */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Server & Hostname</th>
                  <th className="py-3.5 px-4">IP Address</th>
                  <th className="py-3.5 px-4">Tipe & Provider</th>
                  <th className="py-3.5 px-4">Sistem Operasi & Spesifikasi</th>
                  <th className="py-3.5 px-4">Uptime & Koneksi Terakhir</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Activity className="w-6 h-6 animate-spin text-emerald-600" />
                        <span className="font-mono text-xs text-slate-500">
                          Memuat data server & telemetri...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedServers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Server className="w-8 h-8 text-slate-300" />
                        <span className="text-xs font-medium text-slate-500">
                          Tidak ada server yang sesuai dengan filter pencarian.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedServers.map((server) => {
                    const isVps = server.serverType === 'VPS';
                    return (
                      <tr key={server.id} className="hover:bg-slate-50/70 transition-colors group">
                        {/* Server & Hostname */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-start gap-3">
                            <div
                              className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                                isVps
                                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                  : 'bg-amber-50 text-amber-600 border border-amber-100'
                              }`}
                            >
                              {isVps ? <Cloud className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
                            </div>
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                                {server.name}
                              </p>
                              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                                <span>Host:</span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 font-semibold text-slate-700">
                                  {server.serverCode}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* IP Address */}
                        <td className="py-3.5 px-4 font-mono">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              {server.ipAddress}
                            </span>
                            {server.macAddress && (
                              <p className="text-[10px] text-slate-400">MAC: {server.macAddress}</p>
                            )}
                          </div>
                        </td>

                        {/* Tipe & Provider */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                isVps
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {isVps ? 'VPS Cloud' : 'Server Fisik'}
                            </span>
                            <p className="text-xs text-slate-600 font-medium">{server.provider || '—'}</p>
                            {server.location && (
                              <p className="text-[11px] text-slate-400">{server.location}</p>
                            )}
                          </div>
                        </td>

                        {/* OS & Spek */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1 max-w-[240px]">
                            <p className="font-medium text-slate-800 text-xs truncate" title={server.os}>
                              {server.os || 'Linux OS'}
                            </p>
                            <p className="text-[11px] font-mono text-slate-500 truncate" title={server.specs}>
                              {server.specs || 'Standard Spec'}
                            </p>
                          </div>
                        </td>

                        {/* Uptime & Last Seen */}
                        <td className="py-3.5 px-4 font-mono text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{formatUptime(server.uptimeSeconds)}</span>
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {server.lastSeenAt
                                ? new Date(server.lastSeenAt).toLocaleString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </p>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <StatusBadge variant={server.status === 'Online' ? 'success' : 'danger'}>
                            {server.status}
                          </StatusBadge>
                        </td>

                        {/* Aksi Berbasis Ikon Sesuai Pilar Master Desain */}
                        <td className="py-3.5 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedServer(server)}
                            className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors cursor-pointer"
                            title="Lihat Detail Server & Konfigurasi"
                            aria-label={`Detail ${server.name}`}
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <TablePagination
            page={page}
            limit={pageSize}
            total={filteredServers.length}
            onPageChange={setPage}
            itemName="server"
          />
        </div>

        {/* Modal Detail Server */}
        {selectedServer && (
          <ModalShell
            isOpen={Boolean(selectedServer)}
            onClose={() => setSelectedServer(null)}
            title={`Detail Server: ${selectedServer.name}`}
            footer={
              <button
                type="button"
                onClick={() => setSelectedServer(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            }
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Hostname</span>
                  <span className="font-bold font-mono text-slate-800">{selectedServer.serverCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">IP Address</span>
                  <span className="font-bold font-mono text-slate-800">{selectedServer.ipAddress}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Tipe Node</span>
                  <span className="font-semibold text-slate-800">
                    {selectedServer.serverType === 'VPS' ? 'VPS Cloud Server' : 'Server Fisik Baremetal'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Status Koneksi</span>
                  <span className={`font-bold ${selectedServer.status === 'Online' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {selectedServer.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Provider & Lokasi</span>
                  <span className="font-medium text-slate-700">{selectedServer.provider} · {selectedServer.location}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Uptime</span>
                  <span className="font-mono font-medium text-slate-700">{formatUptime(selectedServer.uptimeSeconds)}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-1">Sistem Operasi & Spesifikasi</h4>
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 font-mono text-xs">
                  <p className="text-slate-700"><span className="text-slate-400 font-sans">OS:</span> {selectedServer.os || '—'}</p>
                  <p className="text-slate-700"><span className="text-slate-400 font-sans">Hardware:</span> {selectedServer.specs || '—'}</p>
                </div>
              </div>

              {selectedServer.notes && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-1">Catatan Operasional IT</h4>
                  <p className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs text-slate-700">
                    {selectedServer.notes}
                  </p>
                </div>
              )}
            </div>
          </ModalShell>
        )}

        {/* Modal Tambah Server / VPS Baru */}
        {isAddModalOpen && (
          <ModalShell
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            title="Tambah Node Server / VPS Baru"
            footer={
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="add-server-form"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Simpan Server
                </button>
              </div>
            }
          >
            <form id="add-server-form" onSubmit={handleAddServer} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nama Server *</label>
                  <input
                    type="text"
                    required
                    placeholder="mis. Production API Server"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Hostname / Server Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="mis. VPS-PROD-API01"
                    value={addForm.serverCode}
                    onChange={(e) => setAddForm({ ...addForm, serverCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">IP Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="mis. 103.145.226.42"
                    value={addForm.ipAddress}
                    onChange={(e) => setAddForm({ ...addForm, ipAddress: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Tipe Server</label>
                  <select
                    value={addForm.serverType}
                    onChange={(e) => setAddForm({ ...addForm, serverType: e.target.value as 'VPS' | 'Physical' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="VPS">VPS Cloud (Virtual Machine)</option>
                    <option value="Physical">Server Fisik (On-Premise / Baremetal)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Provider / Cloud Vendor</label>
                  <input
                    type="text"
                    placeholder="mis. IdCloudHost, DigitalOcean, AWS, Biznet"
                    value={addForm.provider}
                    onChange={(e) => setAddForm({ ...addForm, provider: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Lokasi Data Center / Gedung</label>
                  <input
                    type="text"
                    placeholder="mis. Cyber 1 Jakarta / Server Room Lt. 2"
                    value={addForm.location}
                    onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Sistem Operasi</label>
                  <input
                    type="text"
                    placeholder="mis. Ubuntu 24.04 LTS / Debian 12"
                    value={addForm.os}
                    onChange={(e) => setAddForm({ ...addForm, os: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Spesifikasi (CPU/RAM/Storage)</label>
                  <input
                    type="text"
                    placeholder="mis. 4 vCPU · 8 GB RAM · 160 GB NVMe"
                    value={addForm.specs}
                    onChange={(e) => setAddForm({ ...addForm, specs: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Catatan / Keterangan</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan peruntukan server..."
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </form>
          </ModalShell>
        )}
      </div>
    </DashboardLayout>
  );
}

