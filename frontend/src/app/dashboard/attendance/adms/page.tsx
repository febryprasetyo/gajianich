'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Server, Cpu, Wifi, ListFilter, Download, AlertTriangle, UserRoundSearch, Plus, Settings2, Power } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import KpiGrid from '@/components/ui/KpiGrid';
import FilterToolbar from '@/components/ui/FilterToolbar';
import TableShell from '@/components/ui/TableShell';
import TablePagination from '@/components/ui/TablePagination';
import StatusBadge from '@/components/ui/StatusBadge';
import ModalShell from '@/components/ui/ModalShell';
import RowActionButton from '@/components/ui/RowActionButton';
import AdmsRegistrationModal from '@/components/attendance/AdmsRegistrationModal';
import { useOrganizationScope } from '@/context/OrganizationScopeContext';
import { useAuth } from '@/context/AuthContext';
import { canAccessRoute } from '@/lib/access/routes';
import { apiFetch } from '@/lib/api';
import {
  admsReadCommandStatus, buildAdmsReviewQuery, filterMonitorDevices, formatAdmsLocalTimestamp, startMonitorPolling,
  validateAdmsHistoryRequest, validateAdmsReviewRange, withMonitorDeadline, type AdmsMonitorData, type AdmsReadCommandsData, type AdmsReviewLogsData, type DeviceFilter,
  type AdmsCandidateDevice,
} from '@/lib/attendance/admsMonitor';

const selectClass = 'min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const tableClass = 'w-full text-left text-xs [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-slate-600 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top';
const paginationClass = 'flex-wrap gap-3 rounded-xl [&>div:last-child]:flex-wrap';
const dateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
const numberFormatter = new Intl.NumberFormat('id-ID');
const formatTime = (value: string | null) => value ? dateFormatter.format(new Date(value)) : 'Belum ada';
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
        const result = await withMonitorDeadline(requestSignal => apiFetch<{ success: boolean; data: T }>(endpoint, { signal: requestSignal, cache: 'no-store' }), signal);
        if (!result.success || !result.data) throw new Error('Respons ADMS tidak tersedia.');
        if (!signal.aborted) setSnapshot({ key: requestKey, data: result.data, error: null });
      } catch {
        if (!signal.aborted) setSnapshot(previous => ({ key: requestKey, data: previous?.key === requestKey ? previous.data : null, error: 'Data ADMS belum dapat diperbarui. Sistem akan mencoba kembali otomatis.' }));
      }
    });
  }, [endpoint, enabled, requestKey, scopeLoading, scopeError]);
  const error = scopeError || current?.error;
  return { data: current?.data ?? null, error, loading: enabled && !current && !error };
}

export default function AdmsMonitorPage() {
  const { user } = useAuth();
  const { selectedGroupId, revision } = useOrganizationScope();
  const canManage = Boolean(user?.permissions?.includes('attendance.manage') || user?.roleName?.toLowerCase().includes('admin'));
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<AdmsCandidateDevice | null>(null);
  const [regFeedback, setRegFeedback] = useState<string | null>(null);
  const { data: candidatesData } = useAdmsPolling<AdmsCandidateDevice[]>('/attendance/devices/adms/candidates', canManage);
  const candidates = candidatesData ?? [];

  const handleToggleDevice = async (device: { id: number; enabled: boolean; name: string }) => {
    try {
      const res = await apiFetch<{ success: boolean; message?: string }>(`/attendance/devices/adms/${device.id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !device.enabled }),
      });
      if (res.success) {
        setRegFeedback(res.message || `Status penerimaan ADMS mesin ${device.name} berhasil diperbarui.`);
      }
    } catch (err: any) {
      setRegFeedback(err?.message || 'Gagal mengubah status penerimaan ADMS mesin.');
    }
  };

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDevice, setHistoryDevice] = useState('');
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');
  const [historySubmitting, setHistorySubmitting] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyFeedback, setHistoryFeedback] = useState<string | null>(null);
  const historyRequest = useRef<AbortController | null>(null);
  useEffect(() => () => historyRequest.current?.abort(), [revision]);
  const [tab, setTab] = useState<'logs' | 'receipts'>('logs');
  const [activeKpi, setActiveKpi] = useState<string | null>('all');
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [source, setSource] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>('all');
  const [page, setPage] = useState(1);
  const [reviewDevice, setReviewDevice] = useState('');
  const [pin, setPin] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reviewPage, setReviewPage] = useState(1);
  const query = new URLSearchParams({ search, outcome, source, page: String(page), limit: '20' }).toString();
  const { data, error, loading } = useAdmsPolling<AdmsMonitorData>(`/attendance/devices/adms/monitor?${query}`);
  const reviewQuery = buildAdmsReviewQuery({ deviceId: reviewDevice, pin, startDate, endDate, page: reviewPage });
  const rangeError = validateAdmsReviewRange(startDate, endDate);
  const review = useAdmsPolling<AdmsReviewLogsData>(`/attendance/devices/adms/review-logs?${reviewQuery}`, tab === 'logs' && !rangeError);
  const commands = useAdmsPolling<AdmsReadCommandsData>('/attendance/devices/adms/read-commands', tab === 'logs');
  const resetFilters = () => { setActiveKpi(null); setSearch(''); setDeviceFilter('all'); };
  const resetReviewFilters = () => { setActiveKpi(null); setReviewDevice(''); setPin(''); setStartDate(''); setEndDate(''); setReviewPage(1); };
  const resetReceiptFilters = () => { setActiveKpi(null); setOutcome(''); setSource(''); setPage(1); };
  const devices = filterMonitorDevices(data?.devices ?? [], deviceFilter);
  const summary = data?.summary;
  const metric = (value: number | undefined) => value === undefined ? '—' : numberFormatter.format(value);
  const chooseKpi = (id: string) => {
    resetFilters(); resetReceiptFilters();
    if (id === 'online' || id === 'unmapped') setDeviceFilter(id);
    if (id === 'rejected') { setTab('receipts'); setOutcome('REJECTED'); }
    if (id === 'inserted' || id === 'all') { setTab('logs'); resetReviewFilters(); }
    setActiveKpi(id);
  };

  const submitHistory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (historySubmitting || historyRequest.current) return;
    const validation = validateAdmsHistoryRequest(selectedGroupId, historyDevice, historyStart, historyEnd);
    if (validation) { setHistoryError(validation); return; }
    const controller = new AbortController();
    historyRequest.current = controller;
    setHistorySubmitting(true); setHistoryError(null); setHistoryFeedback(null);
    try {
      const result = await withMonitorDeadline(signal => apiFetch<{ success: boolean; data: { id: string; status: 'PENDING'; createdAt: string; expiresAt: string; message: string } }>(`/attendance/devices/adms/${historyDevice}/history`, {
        method: 'POST', signal, body: JSON.stringify({ startDate: historyStart, endDate: historyEnd }),
      }), controller.signal);
      if (!result.success || !result.data) throw new Error('Permintaan belum dapat dikonfirmasi.');
      if (!controller.signal.aborted) {
        setHistoryFeedback(`${result.data.message} Permintaan ${result.data.id}. Penerimaan perintah oleh mesin tidak menjamin semua log akan terkirim.`);
        setHistoryOpen(false);
      }
    } catch (error) {
      if (!controller.signal.aborted) setHistoryError(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'Permintaan belum dapat dikonfirmasi. Periksa status permintaan sebelum mencoba kembali.');
    } finally {
      if (!controller.signal.aborted) setHistorySubmitting(false);
      if (historyRequest.current === controller) historyRequest.current = null;
    }
  };

  return (
    <div onChangeCapture={() => setActiveKpi(null)} className="space-y-6 min-w-0 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-emerald-600">
      <PageHeader
        title="Review ADMS"
        subtitle="Tinjau koneksi dan salinan log mesin ADMS. Tampilan diperbarui otomatis setiap 5 detik setelah permintaan selesai."
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
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Registrasi Mesin ADMS
              </button>
            )}
            {canAccessRoute('/dashboard/attendance/raw-logs', user) && (
              <Link
                href="/dashboard/attendance/raw-logs"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600"
              >
                <ListFilter className="h-4 w-4" aria-hidden="true" />
                Data presensi utama
              </Link>
            )}
          </div>
        }
      />

      {regFeedback && (
        <div role="status" className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
          <p className="font-medium">{regFeedback}</p>
          <button
            type="button"
            onClick={() => setRegFeedback(null)}
            className="text-emerald-700 hover:text-emerald-900 font-semibold"
          >
            Tutup
          </button>
        </div>
      )}

      <aside aria-label="Pemisahan data review ADMS" className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
        <p className="font-bold">Data ADMS hanya untuk review</p>
        <p>Data ADMS disimpan terpisah dari data presensi utama. Tidak ada sinkronisasi atau perhitungan presensi otomatis dari halaman ini. Penarikan data melalui TCP dikelola secara independen.</p>
      </aside>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs">
        <div className="space-y-2">
          <StatusBadge icon={dot} variant={error ? 'warning' : !data ? 'slate' : data.server.ready ? 'success' : 'danger'}>
            {error ? 'Status belum terverifikasi' : !data ? 'Memeriksa server' : data.server.ready ? 'Server review siap menerima data' : 'Server review belum siap'}
          </StatusBadge>
          <p className="text-slate-600">{data?.server.message || 'Status server diperiksa melalui layanan ADMS.'}</p>
        </div>
        <p className="text-slate-600">Pemeriksaan terakhir: <span className="font-medium text-slate-800">{data ? formatTime(data.server.checkedAt) : '—'}</span></p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">{error}{data ? ' Ringkasan dan koneksi di bawah menampilkan data terakhir; status dapat berubah.' : ' Status server belum dapat dipastikan.'}</p>}

      <KpiGrid className="[&>button]:min-w-0 [&>button>div>div]:min-w-0 [&_.truncate]:whitespace-normal [&_.truncate]:overflow-visible [&_.truncate]:break-words" loading={loading} activeFilter={activeKpi} onSelectFilter={chooseKpi} items={[
        { id: 'all', title: 'Mesin terdaftar', value: metric(summary?.devices), icon: Cpu, helper: 'Tampilkan semua data review' },
        { id: 'online', title: 'Koneksi ADMS', value: metric(summary?.online), icon: Wifi, iconColor: 'text-emerald-700', bgColor: 'bg-emerald-50', helper: 'Filter mesin ADMS online' },
        { id: 'inserted', title: 'Log review', value: metric(summary?.inserted), icon: Download, helper: 'Tersimpan terpisah · lihat log' },
        { id: 'rejected', title: 'Batch ditolak', value: metric(summary?.rejected), icon: AlertTriangle, iconColor: 'text-rose-700', bgColor: 'bg-rose-50', helper: 'Lihat riwayat pengiriman ditolak' },
        { id: 'unmapped', title: 'Belum dipetakan', value: metric(summary?.unmapped), icon: UserRoundSearch, iconColor: 'text-amber-700', bgColor: 'bg-amber-50', helper: 'Log review · filter mesin' },
      ]} />
      <FilterToolbar search={search} searchPlaceholder="Cari nama mesin atau nomor seri…" onSearchChange={value => { setSearch(value); setPage(1); }} hasActiveFilters={Boolean(search || deviceFilter !== 'all')} onResetFilters={resetFilters} dropdownFilters={
        <select aria-label="Filter koneksi mesin ADMS" className={selectClass} value={deviceFilter} onChange={event => setDeviceFilter(event.target.value as DeviceFilter)}>
          <option value="all">Semua mesin</option><option value="online">ADMS online</option><option value="unmapped">Ada log review belum dipetakan</option>
        </select>
      } />

      <section className="min-w-0 space-y-3" aria-labelledby="adms-devices-title">
        <h2 id="adms-devices-title" className="text-sm font-bold text-slate-900">Koneksi mesin ADMS <span className="font-normal text-slate-600">({devices.length})</span></h2>
        <TableShell loading={loading} error={!data && error ? error : null} isEmpty={!devices.length} emptyTitle="Tidak ada mesin yang cocok" emptyDescription="Mesin dalam kelompok aktif akan muncul di sini. Ubah filter untuk melihat mesin lainnya.">
          <table className={`${tableClass} min-w-[850px]`}><thead className="bg-slate-50"><tr><th scope="col">Mesin / Nomor seri</th><th scope="col">Koneksi ADMS</th><th scope="col">Penggunaan data</th><th scope="col">Terakhir terhubung</th><th scope="col">Data ADMS terakhir</th><th scope="col">Log review</th><th scope="col">Belum dipetakan</th><th scope="col">Batch ditolak</th>{canManage && <th scope="col" className="text-right">Aksi</th>}</tr></thead>
            <tbody className="divide-y divide-slate-100">{devices.map(device => <tr key={device.id} className="hover:bg-slate-50/70">
              <td><p className="font-semibold text-slate-900">{device.name}</p><p className="mt-1 font-mono text-slate-600">{device.serial || 'Tanpa nomor seri'}</p></td>
              <td><StatusBadge icon={dot} variant={!device.enabled ? 'slate' : device.online ? 'success' : 'warning'}>{!device.enabled ? 'Dinonaktifkan' : device.online ? 'Online' : 'Offline'}</StatusBadge></td>
              <td><StatusBadge icon={dot} variant="slate">Review saja</StatusBadge><p className="mt-1 text-slate-600">TCP independen</p></td>
              <td className="whitespace-nowrap text-slate-600">{formatTime(device.lastSeenAt)}</td><td className="whitespace-nowrap text-slate-600">{formatTime(device.lastSyncAt)}</td>
              <td className="tabular-nums">{metric(device.totalLogs)}</td><td className="tabular-nums">{metric(device.unmappedLogs)}</td><td className="tabular-nums">{metric(device.rejectedBatches)}</td>
              {canManage && (
                <td className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <RowActionButton
                      icon={Settings2}
                      label="Edit Allowlist"
                      title="Ubah nomor seri atau IP allowlist ADMS"
                      variant="default"
                      onClick={() => {
                        const match = candidates.find(c => c.id === device.id) || {
                          id: device.id,
                          name: device.name,
                          serialNumber: device.serial,
                          ip: '',
                          port: 4370,
                          connectionType: 'ADMS' as const,
                          isEnabled: true,
                          admsRegistered: true,
                          admsEnabled: device.enabled,
                          allowedNetwork: null,
                          lastSeenAt: device.lastSeenAt,
                          lastDataAt: device.lastSyncAt,
                        };
                        setEditingCandidate(match);
                        setRegModalOpen(true);
                      }}
                    />
                    <RowActionButton
                      icon={Power}
                      label={device.enabled ? 'Nonaktifkan ADMS' : 'Aktifkan ADMS'}
                      title={device.enabled ? 'Nonaktifkan penerimaan ADMS' : 'Aktifkan penerimaan ADMS'}
                      variant={device.enabled ? 'amber' : 'emerald'}
                      onClick={() => void handleToggleDevice(device)}
                    />
                  </div>
                </td>
              )}
            </tr>)}</tbody></table>
        </TableShell>
        <p className="text-xs text-slate-600">Status ADMS mengikuti aktivitas yang diterima server review. Status ini tidak menunjukkan koneksi atau jadwal penarikan TCP.</p>
      </section>

      <div role="tablist" aria-label="Data review ADMS" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {([{ id: 'logs', label: 'Log ADMS' }, { id: 'receipts', label: 'Riwayat pengiriman' }] as const).map(item => <button key={item.id} type="button" role="tab" id={`adms-tab-${item.id}`} aria-controls={`adms-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onKeyDown={event => {
          const next = event.key === 'Home' ? 'logs' : event.key === 'End' ? 'receipts' : event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? tab === 'logs' ? 'receipts' : 'logs' : null;
          if (!next) return;
          event.preventDefault(); setTab(next); setActiveKpi(null); document.getElementById(`adms-tab-${next}`)?.focus();
        }} onClick={() => { setTab(item.id); setActiveKpi(null); }} className={`min-h-10 rounded-xl border px-4 py-2 text-xs font-semibold ${tab === item.id ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{item.label}</button>)}
      </div>
      {tab === 'logs' ? <section id="adms-panel-logs" role="tabpanel" aria-labelledby="adms-tab-logs" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-bold text-slate-900">Log ADMS untuk review</h2><p className="mt-1 text-xs text-slate-600">Hanya baca · waktu mengikuti jam lokal mesin</p></div>
          <button type="button" disabled={selectedGroupId === null} onClick={() => { setHistoryError(null); setHistoryOpen(true); }} aria-describedby={selectedGroupId === null ? 'adms-history-group-hint' : undefined} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" aria-hidden="true" />Minta log historis</button>
        </div>
        {selectedGroupId === null && <p id="adms-history-group-hint" className="text-xs text-amber-800">Pilih satu kelompok organisasi terlebih dahulu untuk meminta log historis.</p>}
        {historyFeedback && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">{historyFeedback}</p>}
        <FilterToolbar hasActiveFilters={Boolean(reviewDevice || pin || startDate || endDate)} onResetFilters={resetReviewFilters} dropdownFilters={<>
          <label className="space-y-1 text-xs text-slate-600"><span>Mesin</span><select className={selectClass} value={reviewDevice} onChange={event => { setReviewDevice(event.target.value); setReviewPage(1); }}><option value="">Semua mesin ADMS</option>{data?.devices.map(device => <option key={device.id} value={device.id}>{device.name} · {device.serial}</option>)}{reviewDevice && !data?.devices.some(device => String(device.id) === reviewDevice) && <option value={reviewDevice}>Mesin #{reviewDevice}</option>}</select></label>
          <label className="space-y-1 text-xs text-slate-600"><span>PIN mesin</span><input className={selectClass} type="text" inputMode="numeric" value={pin} placeholder="Cari PIN" onChange={event => { setPin(event.target.value); setReviewPage(1); }} /></label>
          <label className="space-y-1 text-xs text-slate-600"><span>Tanggal mulai</span><input className={selectClass} type="date" value={startDate} max={endDate || undefined} onChange={event => { setStartDate(event.target.value); setReviewPage(1); }} /></label>
          <label className="space-y-1 text-xs text-slate-600"><span>Tanggal akhir</span><input className={selectClass} type="date" value={endDate} min={startDate || undefined} onChange={event => { setEndDate(event.target.value); setReviewPage(1); }} /></label>
        </>} />
        {review.error && review.data && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">{review.error} Tabel menampilkan log terakhir yang berhasil dimuat.</p>}
        <TableShell loading={review.loading} error={rangeError || (!review.data && review.error ? review.error : null)} isEmpty={!review.data?.logs.length} emptyTitle="Belum ada log ADMS untuk review" emptyDescription="Log baru dari ADMS akan muncul di sini tanpa dimasukkan ke presensi utama. Sesuaikan mesin, PIN, atau tanggal untuk mencari data.">
          <table className={`${tableClass} min-w-[800px]`}><thead className="bg-slate-50"><tr><th scope="col">Mesin / Nomor seri</th><th scope="col">PIN / Karyawan</th><th scope="col">Waktu mesin (lokal)</th><th scope="col">Mode verifikasi</th><th scope="col">Status scan</th><th scope="col">Sumber</th></tr></thead><tbody className="divide-y divide-slate-100">{review.data?.logs.map(log => <tr key={log.id} className="hover:bg-slate-50/70">
            <td><p className="font-semibold text-slate-900">{log.deviceName}</p><p className="mt-1 font-mono text-slate-600">{log.serial}</p></td>
            <td><p className="font-mono font-semibold text-slate-900">{log.pin}</p><p className="mt-1 text-slate-600">{log.employeeName || 'Belum dipetakan'}</p></td>
            <td className="whitespace-nowrap text-slate-700">{formatAdmsLocalTimestamp(log.timestamp)}</td><td className="font-mono text-slate-700">{log.verifyMode || '—'}</td><td className="font-mono text-slate-700">{log.inOutState || '—'}</td><td className="text-slate-700">{log.source}</td>
          </tr>)}</tbody></table>
        </TableShell>
        {review.data && !rangeError && <TablePagination {...review.data.pagination} onPageChange={setReviewPage} itemName="log review" className={paginationClass} />}
        <section className="space-y-3 pt-3" aria-labelledby="adms-commands-title">
          <h3 id="adms-commands-title" className="text-sm font-bold text-slate-900">Status permintaan historis</h3>
          <p className="text-xs text-slate-600">Maksimal 50 permintaan terbaru. Perintah hanya membaca log dan bergantung pada dukungan firmware. Status diterima mesin bukan konfirmasi kelengkapan log.</p>
          {commands.error && commands.data && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{commands.error} Status di bawah adalah data terakhir.</p>}
          <TableShell loading={commands.loading} error={!commands.data && commands.error ? commands.error : null} isEmpty={!commands.data?.commands.length} emptyTitle="Belum ada permintaan historis" emptyDescription="Permintaan hanya dikirim setelah Anda memilih mesin, tanggal, dan menekan tombol Kirim permintaan.">
            <table className={`${tableClass} min-w-[760px]`}><thead className="bg-slate-50"><tr><th scope="col">Mesin / Nomor seri</th><th scope="col">Rentang waktu mesin</th><th scope="col">Status permintaan</th><th scope="col">Dibuat / Kedaluwarsa</th><th scope="col">Kode balasan</th></tr></thead><tbody className="divide-y divide-slate-100">{commands.data?.commands.map(command => {
              const status = admsReadCommandStatus(command.status);
              return <tr key={command.id} className="hover:bg-slate-50/70"><td><p className="font-semibold text-slate-900">{command.deviceName}</p><p className="mt-1 font-mono text-slate-600">{command.serial}</p></td><td className="whitespace-nowrap text-slate-700"><p>{formatAdmsLocalTimestamp(command.startAt)}</p><p className="mt-1">s.d. {formatAdmsLocalTimestamp(command.endAt)}</p></td><td><StatusBadge icon={dot} variant={status.variant}>{status.label}</StatusBadge>{command.status === 'ACKNOWLEDGED' && <p className="mt-1 max-w-48 text-slate-600">Kelengkapan log belum dikonfirmasi.</p>}</td><td className="whitespace-nowrap text-slate-600"><p>{formatTime(command.createdAt)}</p><p className="mt-1">s.d. {formatTime(command.expiresAt)}</p></td><td className="font-mono text-slate-700">{command.returnCode ?? '—'}</td></tr>;
            })}</tbody></table>
          </TableShell>
        </section>
      </section> : <section id="adms-panel-receipts" role="tabpanel" aria-labelledby="adms-tab-receipts" className="min-w-0 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Riwayat pengiriman batch</h2>
        <p className="text-xs text-slate-600">Tujuan penyimpanan menunjukkan apakah batch masuk ke penyimpanan review atau tercatat sebelum pemisahan data.</p>
        <FilterToolbar hasActiveFilters={Boolean(outcome || source)} onResetFilters={resetReceiptFilters} dropdownFilters={<>
          <select aria-label="Status penerimaan batch" className={selectClass} value={outcome} onChange={event => { setOutcome(event.target.value); setPage(1); }}><option value="">Semua hasil batch</option><option value="ACCEPTED">Diterima</option><option value="REJECTED">Ditolak</option><option value="ARCHIVED">Diarsipkan</option></select>
          <select aria-label="Sumber penerimaan data" className={selectClass} value={source} onChange={event => { setSource(event.target.value); setPage(1); }}><option value="">Semua sumber</option><option value="ADMS">ADMS</option><option value="MANUAL_IMPORT">Impor manual</option></select>
        </>} />
        <TableShell loading={loading} error={!data && error ? error : null} isEmpty={!data?.receipts.length} emptyTitle="Belum ada pengiriman yang cocok" emptyDescription="Batch ADMS akan tercatat otomatis. Coba sesuaikan pencarian dan filter.">
          <table className={`${tableClass} min-w-[950px]`}><thead className="bg-slate-50"><tr><th scope="col">Waktu penerimaan</th><th scope="col">Mesin / Nomor seri</th><th scope="col">Sumber / Tabel</th><th scope="col">Tujuan penyimpanan</th><th scope="col">Hasil</th><th scope="col">Diterima</th><th scope="col">Tersimpan</th><th scope="col">Belum dipetakan</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{data?.receipts.map(receipt => <tr key={receipt.id} className="hover:bg-slate-50/70">
              <td className="whitespace-nowrap text-slate-600">{formatTime(receipt.receivedAt)}</td><td><p className="font-semibold text-slate-900">{receipt.deviceName}</p><p className="mt-1 font-mono text-slate-600">{receipt.serial || 'Tanpa nomor seri'}</p></td>
              <td><p className="text-slate-700">{receipt.source === 'MANUAL_IMPORT' ? 'Impor manual' : receipt.source}</p><p className="mt-1 font-mono text-slate-600">{receipt.tableName}</p></td>
              <td><StatusBadge icon={dot} variant={receipt.storageTarget === 'MAIN_LEGACY' ? 'warning' : receipt.storageTarget === 'REVIEW' ? 'slate' : 'warning'}>{receipt.storageTarget === 'MAIN_LEGACY' ? 'Utama · legacy' : receipt.storageTarget === 'REVIEW' ? 'Review ADMS' : 'Tujuan belum diketahui'}</StatusBadge>{receipt.storageTarget === 'MAIN_LEGACY' && <p className="mt-1 max-w-48 text-amber-800">Batch lama, sebelum pemisahan data review.</p>}</td>
              <td><StatusBadge icon={dot} variant={receipt.outcome === 'ACCEPTED' ? 'success' : receipt.outcome === 'REJECTED' ? 'danger' : 'slate'}>{receipt.outcome === 'ACCEPTED' ? 'Diterima' : receipt.outcome === 'REJECTED' ? 'Ditolak' : receipt.outcome === 'ARCHIVED' ? 'Diarsipkan' : receipt.outcome}</StatusBadge>{receipt.errorMessage && <p className="mt-1 max-w-64 break-words text-rose-700">{receipt.errorMessage}</p>}</td>
              <td className="tabular-nums">{metric(receipt.totalReceived)}</td><td className="tabular-nums">{metric(receipt.totalInserted)}</td><td className="tabular-nums">{metric(receipt.totalUnmapped)}</td>
            </tr>)}</tbody></table>
        </TableShell>
        {data && <TablePagination {...data.pagination} onPageChange={setPage} itemName="batch" className={paginationClass} />}
      </section>}
      <ModalShell isOpen={historyOpen} onClose={() => setHistoryOpen(false)} isLoading={historySubmitting} title="Minta log historis ADMS" subtitle="Permintaan baca log dari satu mesin · maksimal 31 hari" icon={<Download className="h-5 w-5" aria-hidden="true" />} footer={<><button type="button" disabled={historySubmitting} onClick={() => setHistoryOpen(false)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Batal</button><button type="submit" form="adms-history-form" disabled={historySubmitting || selectedGroupId === null} className="min-h-10 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{historySubmitting ? 'Mengirim…' : 'Kirim permintaan'}</button></>}>
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">Perintah ini hanya meminta salinan log untuk review. Dukungan bergantung pada firmware mesin; sebagian mesin tidak mendukungnya. Tidak ada jaminan seluruh log tersedia atau terkirim. Data tidak disinkronkan atau dihitung ke presensi utama.</p>
        <form id="adms-history-form" onSubmit={submitHistory} className="space-y-4">
          <label className="block space-y-1 text-xs font-medium text-slate-700"><span>Mesin ADMS</span><select required disabled={historySubmitting} className={selectClass} value={historyDevice} onChange={event => { setHistoryDevice(event.target.value); setHistoryError(null); }}><option value="">Pilih mesin berdasarkan nomor seri</option>{data?.devices.filter(device => device.serial).map(device => <option key={device.id} value={device.id}>{device.name} · {device.serial}</option>)}{historyDevice && !data?.devices.some(device => String(device.id) === historyDevice) && <option value={historyDevice}>Mesin #{historyDevice}</option>}</select></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block space-y-1 text-xs font-medium text-slate-700"><span>Tanggal mulai (waktu mesin)</span><input required disabled={historySubmitting} className={selectClass} type="date" value={historyStart} max={historyEnd || undefined} onChange={event => { setHistoryStart(event.target.value); setHistoryError(null); }} /></label><label className="block space-y-1 text-xs font-medium text-slate-700"><span>Tanggal akhir (waktu mesin)</span><input required disabled={historySubmitting} className={selectClass} type="date" value={historyEnd} min={historyStart || undefined} onChange={event => { setHistoryEnd(event.target.value); setHistoryError(null); }} /></label></div>
          <p className="text-xs text-slate-600">Rentang maksimal 31 hari, termasuk tanggal mulai dan akhir. Permintaan yang masih menunggu mesin tidak perlu dikirim ulang.</p>
          {historyError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{historyError}</p>}
        </form>
      </ModalShell>

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
    </div>
  );
}
