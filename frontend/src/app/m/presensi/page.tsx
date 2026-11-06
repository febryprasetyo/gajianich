'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, Clock, XCircle, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/ui/PageHeader';
import KpiGrid from '@/components/ui/KpiGrid';
import FilterToolbar from '@/components/ui/FilterToolbar';
import TablePagination from '@/components/ui/TablePagination';
import DayDetailSheet, { type DayDetailData } from '@/components/mobile/DayDetailSheet';
import { ApprovalBadge } from '@/components/mobile/AttendanceReview';
import { useMobileRevalidation } from '@/hooks/useMobileEnvironment';
import { filterMobileHistory, type ReviewFilter } from '@/lib/attendance/mobilePresentation';
import { fetchMobileHistory, type MobileHistoryItem, type MobileHistoryData } from '@/lib/attendance/mobileApi';

export default function MobilePresensiPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [records, setRecords] = useState<MobileHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'CURRENT' | 'PREVIOUS'>('CURRENT');
  const [month, setMonth] = useState('');
  const [periodOptions, setPeriodOptions] = useState<NonNullable<MobileHistoryData['periodOptions']>>([]);
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [filter, setFilter] = useState<ReviewFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<DayDetailData | null>(null);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    const id = ++requestId.current;
    setLoading(true); setError('');
    try {
      const data = await fetchMobileHistory(period);
      if (id === requestId.current) { setRecords([...data.records].sort((a, b) => b.workDate.localeCompare(a.workDate))); setMonth(data.monthName); setPeriodOptions(data.periodOptions || []); setRange({ startDate: data.startDate, endDate: data.endDate }); }
    } catch (err) {
      if (id !== requestId.current) return;
      const message = err instanceof Error ? err.message : 'Riwayat gagal dimuat.';
      if (/401|Unauthorized|token missing/i.test(message)) { logout(); return; }
      if (/Password change required|change-password/i.test(message)) { router.replace('/change-password'); return; }
      setError(message);
    } finally { if (id === requestId.current) setLoading(false); }
  }, [period, router, logout]);
  useEffect(() => { void load(); return () => { requestId.current++; }; }, [load]);
  useMobileRevalidation(load);
  const filtered = filterMobileHistory(records, filter, search);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 10)));
  const items = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const selectedRange = periodOptions.find(option => option.value === period) || range;
  const formatDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  function open(row: MobileHistoryItem) {
    setDetail({ id: String(row.id), dayName: row.dayShort, dateStr: `${row.dateStr} (${row.workDate})`, schedule: row.schedule, status: row.status, statusText: row.statusText, checkIn: row.clockIn, checkOut: row.clockOut, duration: row.workHours, note: row.approvalNote, serverRef: row.serverRef, employeeName: row.employeeName, approvalStatus: row.approvalStatus, approvalNote: row.approvalNote, mapUrl: row.mapUrl, googleMapsUrl: row.googleMapsUrl, address: row.address, photoUrl: row.photoUrl, events: row.events });
  }
  return <main className="flex-1 space-y-5 bg-slate-50 px-5 pb-6 pt-6">
    <PageHeader title="Riwayat presensi" subtitle="Catatan mesin kantor dan presensi luar kantor." icon={CalendarCheck} />
    <div className="space-y-2">
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-emerald-700">
        <CalendarCheck size={20} /><span className="sr-only">Periode presensi</span>
        <select value={period} onChange={e => { setPeriod(e.target.value as 'CURRENT' | 'PREVIOUS'); setPage(1); setFilter('ALL'); setSearch(''); setRecords([]); setMonth(''); setRange({}); }} className="min-h-11 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-emerald-600">
          {(['CURRENT', 'PREVIOUS'] as const).map(value => <option key={value} value={value}>{periodOptions.find(option => option.value === value)?.label ? `Periode ${periodOptions.find(option => option.value === value)!.label}` : value === period && month ? `Periode ${month}` : value === 'CURRENT' ? 'Periode berjalan' : 'Periode sebelumnya'}</option>)}
        </select>
      </label>
      {selectedRange.startDate && selectedRange.endDate && <p className="px-1 text-xs text-slate-500">{formatDate(selectedRange.startDate)} – {formatDate(selectedRange.endDate)}</p>}
    </div>
    <KpiGrid<ReviewFilter> className="grid-cols-3! sm:grid-cols-3! lg:grid-cols-3! mb-0! gap-2 [&_button]:min-w-0 [&_button]:p-3 [&_button>div:last-child]:flex-wrap [&_button>div:last-child]:gap-1" activeFilter={filter} onSelectFilter={id => { setFilter(id); setPage(1); }} items={[
      { id: 'ALL', title: 'Semua', value: records.length, icon: CalendarCheck, iconColor: 'text-emerald-600' },
      { id: 'PENDING', title: 'Menunggu', value: records.filter(r => r.approvalStatus === 'PENDING').length, icon: Clock, iconColor: 'text-amber-600' },
      { id: 'REJECTED', title: 'Ditolak', value: records.filter(r => r.approvalStatus === 'REJECTED').length, icon: XCircle, iconColor: 'text-rose-600' },
    ]} />
    <FilterToolbar className="mb-0!" search={search} onSearchChange={value => { setSearch(value); setPage(1); }} searchPlaceholder="Cari tanggal atau catatan…" hasActiveFilters={filter !== 'ALL' || Boolean(search)} onResetFilters={() => { setFilter('ALL'); setSearch(''); setPage(1); }} />
    <section aria-label="Catatan presensi" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {loading ? <p role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />Memuat riwayat…</p> : error ? <p role="alert" className="p-5 text-sm text-rose-700">{error}</p> : items.length === 0 ? <div className="space-y-2 p-6 text-center"><p className="text-sm font-semibold text-slate-700">Tidak ada catatan yang cocok</p><p className="text-xs text-slate-500">Ubah filter atau pilih periode lain.</p></div> : <ul className="divide-y divide-slate-100">{items.map(row => <li key={row.id}><button type="button" onClick={() => open(row)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-600">
        <span className="flex w-11 shrink-0 flex-col items-center rounded-xl bg-slate-50 py-2"><strong className="text-lg font-extrabold text-slate-900">{row.workDate.slice(-2)}</strong><span className="text-[10px] font-bold uppercase text-slate-500">{row.dayShort}</span></span>
        <span className="min-w-0 flex-1 space-y-2"><span className="flex flex-wrap items-baseline justify-between gap-1"><strong className="text-sm tabular-nums text-slate-900">{row.isAbsent ? 'Tidak absen' : `${row.clockIn} → ${row.clockOut}`}</strong><span className="text-xs text-slate-500">{row.workHours}</span></span><span className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-500">{row.statusText}</span>{!row.isAbsent && <ApprovalBadge status={row.approvalStatus} recorded />}</span><span className="sr-only">{row.dateStr}</span></span><ChevronRight size={16} className="shrink-0 text-slate-400" />
      </button></li>)}</ul>}
      {!loading && !error && <TablePagination compact className="flex-col! items-start! gap-3 [&>div:last-child]:w-full [&>div:last-child]:justify-between" page={currentPage} limit={10} total={filtered.length} onPageChange={setPage} itemName="catatan" />}
    </section>
    <p className="text-xs leading-relaxed text-slate-500">Ketuk catatan untuk melihat foto, peta lokasi, serta pemeriksaan dan klarifikasi HRD.</p>
    <DayDetailSheet isOpen={Boolean(detail)} data={detail} onClose={() => setDetail(null)} onUpdated={() => { setDetail(null); void load(); }} />
  </main>;
}
