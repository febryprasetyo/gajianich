'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import ModalShell from '@/components/ui/ModalShell';
import StatusBadge from '@/components/ui/StatusBadge';
import TablePagination from '@/components/ui/TablePagination';
import AttendanceMap from './AttendanceMap';
import AttendancePhoto from './AttendancePhoto';
import type { MobileAttendanceEvent } from '@/lib/attendance/mobileApi';
import { CalendarCheck, CheckCircle2, AlertCircle, Search, Loader2 } from 'lucide-react';

interface Log extends MobileAttendanceEvent {
  employeeName: string;
  employeeCode: string;
  workDate: string;
  shiftCode: string;
  verifiedById: number | null;
  verifiedAt: string | null;
}

const statuses: Record<string, string> = {
  PENDING: 'Menunggu review',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

const button = 'min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer';

export default function MobileApprovalsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Log | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    setPage(1);
  }, [status, query]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const logsRes = await apiFetch<{ data: Log[] }>('/attendance/mobile/verifications');
      setLogs(logsRes.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar pengajuan absensi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const decide = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selected) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await apiFetch('/attendance/mobile/verify', {
        method: 'POST',
        body: JSON.stringify({
          logId: selected.id,
          status: decision,
          note: note.trim() || undefined,
        }),
      });
      setMessage(`Presensi ${selected.employeeName} berhasil ${decision === 'APPROVED' ? 'disetujui' : 'ditolak'}.`);
      setSelected(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Keputusan gagal disimpan.');
    } finally {
      setBusy(false);
    }
  };

  const visibleLogs = logs.filter(row => {
    if (status && row.approvalStatus !== status) return false;
    if (query) {
      const q = query.toLowerCase();
      return row.employeeName.toLowerCase().includes(q) || row.employeeCode.toLowerCase().includes(q);
    }
    return true;
  });

  const paginatedLogs = visibleLogs.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Review Absensi
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Verifikasi antrean log absensi mandiri karyawan yang memerlukan peninjauan manual HRD.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs font-semibold text-slate-700">
          <span>Status Persetujuan</span>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="block min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">Semua status</option>
            {Object.entries(statuses).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-700 flex-1 min-w-[200px]">
          <span>Cari Karyawan</span>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari berdasarkan nama atau NIK..."
              className="block w-full min-h-11 rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          <span>Memuat antrean persetujuan presensi...</span>
        </div>
      ) : visibleLogs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-xs">
          Tidak ada pengajuan presensi yang sesuai dengan filter.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {paginatedLogs.map(row => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-50/50 transition-colors">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{row.employeeName}</p>
                    {row.notes?.includes('[DIRECT_OUT]') && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        Langsung Pulang (Tanpa Masuk)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono font-medium">{row.employeeCode}</span> · {row.eventType === 'IN' ? 'Masuk' : 'Pulang'} · {row.workDate} {row.scanTime} {row.timeZoneLabel} · {row.shiftCode}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge variant={row.approvalStatus === 'APPROVED' ? 'success' : row.approvalStatus === 'REJECTED' ? 'danger' : 'warning'}>
                    {statuses[row.approvalStatus] || row.approvalStatus}
                  </StatusBadge>
                  <button
                    type="button"
                    className={button}
                    onClick={() => {
                      setSelected(row);
                      setNote('');
                      setError('');
                    }}
                  >
                    Lihat Detail
                  </button>
                </div>
              </div>
            ))}
          </div>
          <TablePagination
            page={page}
            limit={limit}
            total={visibleLogs.length}
            onPageChange={setPage}
            itemName="pengajuan presensi"
          />
        </div>
      )}

      {selected && (
        <ModalShell
          isOpen={Boolean(selected)}
          onClose={() => setSelected(null)}
          title="Review Presensi Karyawan"
          isLoading={busy}
          footer={
            selected.approvalStatus === 'PENDING' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => decide('REJECTED')}
                  disabled={busy || !note.trim()}
                  className="min-h-11 rounded-xl border border-rose-300 bg-rose-50 px-4 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Tolak
                </button>
                <button
                  type="button"
                  onClick={() => decide('APPROVED')}
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {busy ? 'Menyimpan...' : 'Setujui'}
                </button>
              </div>
            ) : (
              <button type="button" className={button} onClick={() => setSelected(null)}>
                Tutup
              </button>
            )
          }
        >
          <div className="space-y-4 text-xs text-slate-700">
            {error && <p role="alert" className="text-rose-800 font-medium">{error}</p>}
            <div>
              <p className="text-sm font-bold text-slate-900">{selected.employeeName}</p>
              <p className="text-slate-500">
                {selected.eventType === 'IN' ? 'Presensi Masuk' : 'Presensi Pulang'} · {selected.scanDate || selected.workDate} {selected.scanTime} {selected.timeZoneLabel} · Shift: {selected.shiftCode}
              </p>
            </div>

            {selected.notes?.includes('[DIRECT_OUT]') && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-bold flex items-center gap-1.5">
                  <span>⚠️</span> Presensi Langsung Pulang (Tanpa Absen Masuk)
                </p>
                <p className="mt-1 leading-relaxed">
                  Karyawan tidak melakukan absen masuk pada shift ini. Jika disetujui, kehadiran akan dicatat dengan jam masuk kosong.
                </p>
                {selected.notes && (
                  <p className="mt-1.5 font-medium italic text-amber-800">
                    Keterangan karyawan: &ldquo;{selected.notes.replace('[DIRECT_OUT]', '').trim()}&rdquo;
                  </p>
                )}
              </div>
            )}

            <p className="text-slate-600">{selected.address || 'Alamat belum tersedia. Titik GPS ditampilkan pada peta.'}</p>
            <AttendanceMap latitude={selected.latitude} longitude={selected.longitude} />
            <AttendancePhoto url={selected.photoUrl} alt="Foto saat scan presensi" />

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900">Riwayat Pengajuan</h3>
              {selected.reviewHistory?.length ? (
                selected.reviewHistory.map((item, index) => (
                  <p key={index} className="text-xs leading-relaxed text-slate-600">
                    {statuses[item.status] || item.status} · {new Date(item.at).toLocaleString('id-ID')} · Pengguna #{item.actorId}
                    <br />
                    {item.note}
                  </p>
                ))
              ) : (
                <p className="text-xs text-slate-400">Belum ada riwayat peninjauan.</p>
              )}
            </div>

            {selected.verifiedAt && (
              <p className="text-xs text-slate-500">
                Keputusan terakhir oleh pengguna #{selected.verifiedById}, {new Date(selected.verifiedAt).toLocaleString('id-ID')}.
              </p>
            )}

            {selected.approvalStatus === 'PENDING' && (
              <label className="block space-y-1.5 pt-2">
                <span className="font-semibold text-slate-900">Catatan Pemeriksaan (Wajib jika menolak)</span>
                <textarea
                  maxLength={2000}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Berikan alasan atau catatan verifikasi..."
                  rows={3}
                  className="block w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </label>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
}
