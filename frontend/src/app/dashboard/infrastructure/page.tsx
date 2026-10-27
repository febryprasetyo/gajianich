'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Clock, Loader2, RefreshCw, Server } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import AccurateServerCard from '@/components/infrastructure/AccurateServerCard';
import MonitoringToolbar from '@/components/infrastructure/MonitoringToolbar';
import AccurateLicenseTable from '@/components/infrastructure/AccurateLicenseTable';
import DatabasePanels from '@/components/infrastructure/DatabasePanels';
import type {
  AccurateLicenseLog,
  AccurateServerMonitoring,
  LicensesResponse,
  MonitoringResponse,
  SyncResponse,
} from '@/components/infrastructure/types';
import { errorMessage, formatDate } from '@/components/infrastructure/utils';

export default function InfrastructurePage() {
  const [licenses, setLicenses] = useState<AccurateLicenseLog[]>([]);
  const [servers, setServers] = useState<AccurateServerMonitoring[]>([]);
  const [activeTab, setActiveTab] = useState<'licenses' | 'database'>('licenses');
  const [selectedServerId, setSelectedServerId] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncingServer, setSyncingServer] = useState<number | 'all' | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [licenseResponse, monitoringResponse] = await Promise.all([
        api.get<LicensesResponse>('/infrastructure/accurate'),
        api.get<MonitoringResponse>('/infrastructure/accurate/database'),
      ]);
      setLicenses(licenseResponse.data ?? []);
      setLastSyncedAt(licenseResponse.lastSyncedAt ?? null);
      setServers(monitoringResponse.data ?? []);
    } catch (requestError: unknown) {
      setError(errorMessage(requestError, 'Gagal membaca data monitoring Accurate.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSync = async (serverId: number | 'all') => {
    setSyncingServer(serverId);
    setError(null);
    try {
      const response = await api.post<SyncResponse>(
        '/infrastructure/accurate/sync',
        serverId === 'all' ? {} : { serverId },
      );
      setLicenses(response.data ?? []);
      const latestSuccess = response.results
        .filter((result) => result.success && result.syncedAt)
        .map((result) => result.syncedAt as string)
        .sort()
        .at(-1);
      if (latestSuccess) setLastSyncedAt(latestSuccess);
      setToast({
        type: response.results.every((result) => result.success) ? 'success' : 'warning',
        text: response.results
          .map((result) =>
            result.success
              ? `${result.hostname}: ${result.licensesCount ?? 0} lisensi`
              : `${result.hostname}: ${result.error || 'gagal'}`,
          )
          .join(' • '),
      });
      await fetchData();
    } catch (requestError: unknown) {
      setToast({ type: 'warning', text: errorMessage(requestError, 'Sinkronisasi lisensi gagal.') });
    } finally {
      setSyncingServer(null);
      window.setTimeout(() => setToast(null), 7000);
    }
  };

  const filteredLicenses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return licenses.filter((license) => {
      if (selectedServerId !== 'all' && license.serverId !== selectedServerId) return false;
      if (!query) return true;
      return [license.licenseKey, license.host, license.ip, license.version, license.serverHostname].some(
        (value) => value?.toLowerCase().includes(query),
      );
    });
  }, [licenses, searchQuery, selectedServerId]);

  const visibleServers = useMemo(() => {
    return selectedServerId === 'all'
      ? servers
      : servers.filter((server) => server.id === selectedServerId);
  }, [servers, selectedServerId]);

  const activeLicenses = useMemo(() => {
    return licenses.filter(
      (license) =>
        license.status === 'ACTIVE' &&
        (selectedServerId === 'all' || license.serverId === selectedServerId),
    ).length;
  }, [licenses, selectedServerId]);

  const totalLicenses = useMemo(() => {
    return licenses.filter(
      (license) => selectedServerId === 'all' || license.serverId === selectedServerId,
    ).length;
  }, [licenses, selectedServerId]);

  const totalDatabases = useMemo(() => {
    return visibleServers.reduce((sum, server) => sum + (server.databases?.length ?? 0), 0);
  }, [visibleServers]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Toast notification */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 max-w-xl rounded-2xl border px-5 py-4 text-sm text-white shadow-xl ${
              toast.type === 'success' ? 'border-emerald-500 bg-emerald-600' : 'border-amber-500 bg-amber-600'
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Accurate Database & Server Monitoring
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Telemetry server, Firebird database, dan lisensi Accurate dari agent yang terdaftar otomatis.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-xs">
              <Clock className="mr-1.5 inline h-4 w-4 text-emerald-600" />
              Sync lisensi terakhir: <strong>{formatDate(lastSyncedAt)}</strong>
            </div>
              <button
                type="button"
                onClick={() => handleSync('all')}
                disabled={syncingServer !== null || servers.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${syncingServer === 'all' ? 'animate-spin' : ''}`} />
                Sync Semua Lisensi
              </button>
            </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Server Monitoring Cards Grid */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-12 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Membaca telemetry dari database…
            </div>
          ) : servers.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Server className="mx-auto h-10 w-10 text-slate-300" />
              <h2 className="mt-3 font-bold text-slate-800">Belum ada server Accurate terdaftar</h2>
              <p className="mt-1 text-sm text-slate-500">
                Jalankan accurate_agent.ps1 pada server pertama untuk mengirim heartbeat.
              </p>
            </div>
          ) : (
            servers.map((server) => (
              <AccurateServerCard
                key={server.id}
                server={server}
                isSyncing={syncingServer === server.id}
                onSync={() => handleSync(server.id)}
              />
            ))
          )}
        </section>

        {!loading && (
          <>
            <MonitoringToolbar
              servers={servers}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              selectedServerId={selectedServerId}
              onServerChange={setSelectedServerId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeLicenses={activeLicenses}
              totalLicenses={totalLicenses}
              databaseCount={totalDatabases}
            />

            {activeTab === 'licenses' ? (
              <AccurateLicenseTable licenses={filteredLicenses} />
            ) : (
              <DatabasePanels servers={visibleServers} />
            )}
          </>
        )}

        <footer className="flex items-center gap-2 text-xs text-slate-400">
          <Activity className="h-4 w-4" />
          Status online dihitung dari heartbeat agent tiga menit terakhir. Tidak ada data monitoring contoh
          yang ditampilkan.
        </footer>
      </div>
    </DashboardLayout>
  );
}
