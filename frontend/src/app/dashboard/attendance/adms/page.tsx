'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Server,
  Cpu,
  Wifi,
  Download,
  AlertTriangle,
  UserRoundSearch,
  Plus,
  Network,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import KpiGrid from '@/components/ui/KpiGrid';
import StatusBadge from '@/components/ui/StatusBadge';
import AdmsRegistrationModal from '@/components/attendance/AdmsRegistrationModal';
import AdmsResolvePinModal from '@/components/attendance/AdmsResolvePinModal';
import AdmsHistoryModal from '@/components/attendance/adms/AdmsHistoryModal';
import AdmsDevicesSection from '@/components/attendance/adms/AdmsDevicesSection';
import AdmsLogsReviewSection from '@/components/attendance/adms/AdmsLogsReviewSection';
import AdmsReceiptsSection from '@/components/attendance/adms/AdmsReceiptsSection';
import { useOrganizationScope } from '@/context/OrganizationScopeContext';
import { useAuth } from '@/context/AuthContext';
import { canAccessRoute } from '@/lib/access/routes';
import { apiFetch } from '@/lib/api';
import {
  buildAdmsReviewQuery,
  filterMonitorDevices,
  startMonitorPolling,
  validateAdmsReviewRange,
  withMonitorDeadline,
  type AdmsMonitorData,
  type AdmsReadCommandsData,
  type AdmsReviewLogsData,
  type DeviceFilter,
  type AdmsCandidateDevice,
} from '@/lib/attendance/admsMonitor';
import { useEffect } from 'react';

const dateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
const numberFormatter = new Intl.NumberFormat('id-ID');
const formatTime = (value: string | null) => (value ? dateFormatter.format(new Date(value)) : 'Belum ada');
const dot = <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />;

function useAdmsPolling<T>(endpoint: string, enabled = true) {
  const { revision, isLoading: scopeLoading, error: scopeError } = useOrganizationScope();
  const [snapshot, setSnapshot] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  const requestKey = `${revision}:${endpoint}`;
  const current = snapshot?.key === requestKey ? snapshot : null;

  useEffect(() => {
    if (!enabled || scopeLoading || scopeError) return;
    return startMonitorPolling(async signal => {
      try {
        const result = await withMonitorDeadline(
          requestSignal =>
            apiFetch<{ success: boolean; data: T }>(endpoint, { signal: requestSignal, cache: 'no-store' }),
          signal
        );
        if (!result.success || !result.data) throw new Error('Respons ADMS tidak tersedia.');
        if (!signal.aborted) setSnapshot({ key: requestKey, data: result.data, error: null });
      } catch {
        if (!signal.aborted)
          setSnapshot(previous => ({
            key: requestKey,
            data: previous?.key === requestKey ? previous.data : null,
            error: 'Data ADMS belum dapat diperbarui. Sistem akan mencoba kembali otomatis.',
          }));
      }
    });
  }, [endpoint, enabled, requestKey, scopeLoading, scopeError]);

  const error = scopeError || current?.error;
  return { data: current?.data ?? null, error, loading: enabled && !current && !error };
}

export default function AdmsMonitorPage() {
  const { user } = useAuth();
  const { selectedGroupId, revision } = useOrganizationScope();
  const normalizedRole = (user?.roleName || '').toLowerCase().replace(/_/g, '');
  const canManage = normalizedRole === 'superadmin' || normalizedRole === 'itadmin';

  // Navigation tab: 'devices' | 'logs' | 'receipts'
  const [activeTab, setActiveTab] = useState<'devices' | 'logs' | 'receipts'>('logs');

  // Modals state
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<AdmsCandidateDevice | null>(null);
  const [regFeedback, setRegFeedback] = useState<string | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedUnmappedPin, setSelectedUnmappedPin] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  // Candidates for registration
  const { data: candidatesData } = useAdmsPolling<AdmsCandidateDevice[]>(
    '/attendance/devices/adms/candidates',
    canManage
  );
  const candidates = candidatesData ?? [];

  // Devices tab filters
  const [activeKpi, setActiveKpi] = useState<string | null>('all');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>('all');

  // Receipts tab filters
  const [receiptOutcome, setReceiptOutcome] = useState('');
  const [receiptSource, setReceiptSource] = useState('');
  const [receiptPage, setReceiptPage] = useState(1);

  // Logs tab filters & state
  const [reviewDevice, setReviewDevice] = useState('');
  const [reviewPin, setReviewPin] = useState('');
  const [reviewStartDate, setReviewStartDate] = useState('');
  const [reviewEndDate, setReviewEndDate] = useState('');
  const [reviewUnmappedOnly, setReviewUnmappedOnly] = useState('');
  const [reviewPage, setReviewPage] = useState(1);
  const [syncingAttendance, setSyncingAttendance] = useState(false);

  // Queries
  const monitorQuery = new URLSearchParams({
    search: deviceSearch,
    outcome: receiptOutcome,
    source: receiptSource,
    page: String(receiptPage),
    limit: '20',
  }).toString();

  const { data, error, loading } = useAdmsPolling<AdmsMonitorData>(
    `/attendance/devices/adms/monitor?${monitorQuery}`
  );

  const reviewQuery = buildAdmsReviewQuery({
    deviceId: reviewDevice,
    pin: reviewPin,
    startDate: reviewStartDate,
    endDate: reviewEndDate,
    unmapped: reviewUnmappedOnly ? reviewUnmappedOnly === 'true' : undefined,
    page: reviewPage,
  });

  const rangeError = validateAdmsReviewRange(reviewStartDate, reviewEndDate);
  const review = useAdmsPolling<AdmsReviewLogsData>(
    `/attendance/devices/adms/review-logs?${reviewQuery}`,
    activeTab === 'logs' && !rangeError
  );
  const commands = useAdmsPolling<AdmsReadCommandsData>(
    '/attendance/devices/adms/read-commands',
    activeTab === 'logs'
  );

  // Filter Reset Handlers
  const resetDeviceFilters = () => {
    setActiveKpi(null);
    setDeviceSearch('');
    setDeviceFilter('all');
  };

  const resetReviewFilters = () => {
    setActiveKpi(null);
    setReviewDevice('');
    setReviewPin('');
    setReviewStartDate('');
    setReviewEndDate('');
    setReviewUnmappedOnly('');
    setReviewPage(1);
  };

  const resetReceiptFilters = () => {
    setActiveKpi(null);
    setReceiptOutcome('');
    setReceiptSource('');
    setReceiptPage(1);
  };

  // Device Toggle
  const handleToggleDevice = async (device: { id: number; enabled: boolean; name: string }) => {
    try {
      const res = await apiFetch<{ success: boolean; message?: string }>(
        `/attendance/devices/adms/${device.id}/toggle`,
        {
          method: 'PATCH',
          body: JSON.stringify({ enabled: !device.enabled }),
        }
      );
      if (res.success) {
        setRegFeedback(res.message || `Status penerimaan ADMS mesin ${device.name} berhasil diperbarui.`);
      }
    } catch (err: any) {
      setRegFeedback(err?.message || 'Gagal mengubah status penerimaan ADMS mesin.');
    }
  };

  // Sync to Attendance
  const handleSyncToAttendance = async () => {
    if (syncingAttendance || selectedGroupId === null) return;
    setSyncingAttendance(true);
    try {
      const res = await apiFetch<{ success: boolean; message?: string }>(
        '/attendance/devices/adms/sync-to-attendance',
        {
          method: 'POST',
          body: JSON.stringify({
            startDate: reviewStartDate || null,
            endDate: reviewEndDate || null,
            deviceId: reviewDevice ? Number(reviewDevice) : null,
            pin: reviewPin || null,
          }),
        }
      );
      if (res.success) {
        setRegFeedback(res.message || 'Log ADMS berhasil disinkronkan ke daftar absensi.');
      }
    } catch (err: any) {
      setRegFeedback(err?.message || 'Gagal menyinkronkan log ADMS ke absensi.');
    } finally {
      setSyncingAttendance(false);
    }
  };

  const devices = filterMonitorDevices(data?.devices ?? [], deviceFilter);
  const summary = data?.summary;
  const metric = (value: number | undefined) => (value === undefined ? '—' : numberFormatter.format(value));

  // Interactive KPI Cards Selection
  const chooseKpi = (id: string) => {
    if (id === 'all' || id === 'online') {
      resetDeviceFilters();
      setActiveTab('devices');
      setDeviceFilter(id === 'online' ? 'online' : 'all');
    } else if (id === 'inserted') {
      resetReviewFilters();
      setActiveTab('logs');
    } else if (id === 'unmapped') {
      resetReviewFilters();
      setActiveTab('logs');
      setReviewUnmappedOnly('true');
    } else if (id === 'rejected') {
      resetReceiptFilters();
      setActiveTab('receipts');
      setReceiptOutcome('REJECTED');
    }
    setActiveKpi(id);
  };

  return (
    <div
      onChangeCapture={() => setActiveKpi(null)}
      className="space-y-6 min-w-0 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-emerald-600"
    >
      <PageHeader
        title="Review & Monitor ADMS"
        subtitle="Pantau koneksi mesin cloud, verifikasi log presensi real-time, dan sinkronkan data ke absensi karyawan."
        icon={Server}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setEditingCandidate(null);
                  setRegModalOpen(true);
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600 cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Registrasi Mesin ADMS
              </button>
            )}
            {canAccessRoute('/dashboard/attendance/devices', user) && (
              <Link
                href="/dashboard/attendance/devices"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 cursor-pointer"
                title="Beralih ke pengelolaan mesin presensi jaringan lokal (Ethernet / TCP)"
              >
                <Network className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Mesin Presensi (Ethernet / TCP)
              </Link>
            )}
          </div>
        }
      />

      {regFeedback && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 animate-in fade-in duration-200"
        >
          <p className="font-medium">{regFeedback}</p>
          <button
            type="button"
            onClick={() => setRegFeedback(null)}
            className="text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Status Server ADMS */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs shadow-xs">
        <div className="space-y-1">
          <StatusBadge
            icon={dot}
            variant={error ? 'warning' : !data ? 'slate' : data.server.ready ? 'success' : 'danger'}
          >
            {error
              ? 'Status belum terverifikasi'
              : !data
              ? 'Memeriksa server…'
              : data.server.ready
              ? 'Server ADMS aktif & siap menerima data'
              : 'Server ADMS belum siap'}
          </StatusBadge>
          <p className="text-slate-500">{data?.server.message || 'Layanan ADMS mendengarkan pada port 8081.'}</p>
        </div>
        <p className="text-slate-500">
          Pemeriksaan terakhir:{' '}
          <span className="font-medium text-slate-800">{data ? formatTime(data.server.checkedAt) : '—'}</span>
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          {error}
        </p>
      )}

      {/* KPI Cards Interaktif */}
      <KpiGrid
        loading={loading}
        activeFilter={activeKpi}
        onSelectFilter={chooseKpi}
        items={[
          {
            id: 'all',
            title: 'Mesin Terdaftar',
            value: metric(summary?.devices),
            icon: Cpu,
            helper: 'Semua mesin ADMS',
          },
          {
            id: 'online',
            title: 'Koneksi Online',
            value: metric(summary?.online),
            icon: Wifi,
            iconColor: 'text-emerald-700',
            bgColor: 'bg-emerald-50',
            helper: 'Mesin aktif terhubung',
          },
          {
            id: 'inserted',
            title: 'Log ADMS',
            value: metric(summary?.inserted),
            icon: Download,
            helper: 'Total catatan log diterima',
          },
          {
            id: 'unmapped',
            title: 'Belum Dipetakan',
            value: metric(summary?.unmapped),
            icon: UserRoundSearch,
            iconColor: 'text-amber-700',
            bgColor: 'bg-amber-50',
            helper: 'PIN belum dikenal · klik untuk filter',
          },
          {
            id: 'rejected',
            title: 'Batch Ditolak',
            value: metric(summary?.rejected),
            icon: AlertTriangle,
            iconColor: 'text-rose-700',
            bgColor: 'bg-rose-50',
            helper: 'Pengiriman tidak valid / ditolak',
          },
        ]}
      />

      {/* Tab Navigasi Alur Kerja ADMS */}
      <div role="tablist" aria-label="Alur Kerja ADMS" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(
          [
            { id: 'logs', label: '1. Log Presensi Real-Time & Sinkronisasi' },
            { id: 'devices', label: '2. Koneksi & Pengaturan Mesin ADMS' },
            { id: 'receipts', label: '3. Riwayat Transmisi Batch ADMS' },
          ] as const
        ).map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`adms-tab-${item.id}`}
            aria-controls={`adms-panel-${item.id}`}
            aria-selected={activeTab === item.id}
            onClick={() => {
              setActiveTab(item.id);
              setActiveKpi(null);
            }}
            className={`min-h-10 rounded-xl border px-4 py-2 text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === item.id
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Panel 1: Log Presensi ADMS & Sinkronisasi */}
      {activeTab === 'logs' && (
        <div id="adms-panel-logs" role="tabpanel" aria-labelledby="adms-tab-logs">
          <AdmsLogsReviewSection
            review={review}
            commands={commands}
            devices={data?.devices ?? []}
            reviewDevice={reviewDevice}
            onReviewDeviceChange={setReviewDevice}
            pin={reviewPin}
            onPinChange={setReviewPin}
            startDate={reviewStartDate}
            onStartDateChange={setReviewStartDate}
            endDate={reviewEndDate}
            onEndDateChange={setReviewEndDate}
            reviewUnmappedOnly={reviewUnmappedOnly}
            onReviewUnmappedOnlyChange={setReviewUnmappedOnly}
            reviewPage={reviewPage}
            onReviewPageChange={setReviewPage}
            onResetReviewFilters={resetReviewFilters}
            rangeError={rangeError}
            selectedGroupId={selectedGroupId}
            syncingAttendance={syncingAttendance}
            onSyncToAttendance={handleSyncToAttendance}
            onOpenHistoryModal={() => setHistoryOpen(true)}
            onOpenResolvePinModal={pinVal => {
              setSelectedUnmappedPin(pinVal);
              setResolveModalOpen(true);
            }}
          />
        </div>
      )}

      {/* Panel 2: Koneksi & Pengaturan Mesin ADMS */}
      {activeTab === 'devices' && (
        <div id="adms-panel-devices" role="tabpanel" aria-labelledby="adms-tab-devices">
          <AdmsDevicesSection
            devices={devices}
            loading={loading}
            error={!data && error ? error : null}
            search={deviceSearch}
            onSearchChange={val => {
              setDeviceSearch(val);
              setDeviceFilter('all');
            }}
            deviceFilter={deviceFilter}
            onDeviceFilterChange={setDeviceFilter}
            onResetFilters={resetDeviceFilters}
            canManage={canManage}
            onEditDevice={candidate => {
              setEditingCandidate(candidate);
              setRegModalOpen(true);
            }}
            onToggleDevice={handleToggleDevice}
          />
        </div>
      )}

      {/* Panel 3: Riwayat Transmisi Batch ADMS */}
      {activeTab === 'receipts' && (
        <div id="adms-panel-receipts" role="tabpanel" aria-labelledby="adms-tab-receipts">
          <AdmsReceiptsSection
            data={data}
            loading={loading}
            error={!data && error ? error : null}
            outcome={receiptOutcome}
            onOutcomeChange={val => {
              setReceiptOutcome(val);
              setReceiptPage(1);
            }}
            source={receiptSource}
            onSourceChange={val => {
              setReceiptSource(val);
              setReceiptPage(1);
            }}
            page={receiptPage}
            onPageChange={setReceiptPage}
            onResetFilters={resetReceiptFilters}
          />
        </div>
      )}

      {/* Modals */}
      <AdmsRegistrationModal
        isOpen={regModalOpen}
        onClose={() => setRegModalOpen(false)}
        onSuccess={() => {
          setRegFeedback('Konfigurasi mesin ADMS dan allowlist berhasil disimpan.');
        }}
        candidates={candidates}
        editDevice={editingCandidate}
        selectedGroupId={selectedGroupId}
      />

      <AdmsResolvePinModal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        onSuccess={msg => {
          setRegFeedback(msg);
        }}
        pin={selectedUnmappedPin}
        selectedGroupId={selectedGroupId}
      />

      <AdmsHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSuccess={feedback => {
          setRegFeedback(feedback);
        }}
        devices={data?.devices ?? []}
        selectedGroupId={selectedGroupId}
        revision={revision}
      />
    </div>
  );
}
