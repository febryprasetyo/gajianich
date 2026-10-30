'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import ModalShell from '@/components/ui/ModalShell';
import StatusBadge from '@/components/ui/StatusBadge';
import TablePagination from '@/components/ui/TablePagination';
import { ScanFace, CheckCircle2, XCircle, Search, AlertCircle, Loader2, Clock, ShieldCheck, X } from 'lucide-react';

interface FaceRequest {
  id: number;
  groupId?: number | null;
  employeeName: string;
  employeeCode: string;
  photoUrl: string;
  oldPhotoUrl: string | null;
  status: string;
  note: string | null;
  createdAt?: string;
}

const statuses: Record<string, string> = {
  PENDING: 'Menunggu review',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

const button = 'px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-all cursor-pointer disabled:opacity-50';

export default function FaceApprovalsPage() {
  const [photos, setPhotos] = useState<FaceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<FaceRequest | null>(null);
  const [note, setNote] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
      const res = await apiFetch<{ data: FaceRequest[] }>('/attendance/mobile/face-requests');
      setPhotos(res.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat permohonan foto wajah.');
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
      await apiFetch(`/attendance/mobile/face-requests/${selected.id}/review`, {
        method: 'POST',
        headers: selected.groupId ? { 'X-Organization-Group-Id': String(selected.groupId) } : undefined,
        body: JSON.stringify({ groupId: selected.groupId, status: decision, note: note.trim() }),
      });
      setMessage(`Permohonan foto wajah ${selected.employeeName} berhasil ${decision === 'APPROVED' ? 'disetujui' : 'ditolak'}.`);
      setSelected(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Keputusan gagal disimpan.');
    } finally {
      setBusy(false);
    }
  };

  const visiblePhotos = photos.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return p.employeeName?.toLowerCase().includes(q) || p.employeeCode?.toLowerCase().includes(q);
    }
    return true;
  });

  const paginatedPhotos = visiblePhotos.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
              <ScanFace className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Validasi Foto Wajah
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Verifikasi antrean permohonan pembaruan foto profil biometrik wajah karyawan.
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

      {/* 1. Kartu KPI Interaktif Baku Master Desain */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === ''
              ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Semua Permohonan</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <ScanFace className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{photos.length}</span>
            {statusFilter === '' && (
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-1.5 py-0.5 rounded">
                Aktif
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'PENDING' ? '' : 'PENDING')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'bg-amber-50/50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800">Menunggu Validasi</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-900 tracking-tight">
              {photos.filter(p => p.status === 'PENDING').length}
            </span>
            {statusFilter === 'PENDING' && (
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider bg-amber-200/80 px-1.5 py-0.5 rounded">
                Aktif
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? '' : 'APPROVED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800">Foto Disetujui</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-900 tracking-tight">
              {photos.filter(p => p.status === 'APPROVED').length}
            </span>
            {statusFilter === 'APPROVED' && (
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-1.5 py-0.5 rounded">
                Aktif
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'REJECTED' ? '' : 'REJECTED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'REJECTED'
              ? 'bg-rose-50/50 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800">Foto Ditolak</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-rose-900 tracking-tight">
              {photos.filter(p => p.status === 'REJECTED').length}
            </span>
            {statusFilter === 'REJECTED' && (
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider bg-rose-200 px-1.5 py-0.5 rounded">
                Aktif
              </span>
            )}
          </div>
        </button>
      </div>

      {/* 2. Toolbar Filter & Search Rapi Baku (Persis Model Ticketing) */}
      <div className="glass-panel p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari permohonan foto berdasarkan nama karyawan atau NIK..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">Semua Status</option>
              {Object.entries(statuses).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>

            {/* Reset Filter Button */}
            {(statusFilter !== '' || query !== '') && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('');
                  setQuery('');
                }}
                className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-semibold text-xs border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          <span>Memuat permohonan foto wajah...</span>
        </div>
      ) : visiblePhotos.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-xs">
          Tidak ada permohonan foto wajah yang sesuai dengan filter.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {paginatedPhotos.map(row => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    <img
                      src={row.photoUrl}
                      alt={row.employeeName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900">{row.employeeName}</p>
                    <p className="text-xs text-slate-500">
                      NIK: <span className="font-mono font-medium">{row.employeeCode}</span>
                      {row.note && ` · "${row.note}"`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge variant={row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning'}>
                    {statuses[row.status] || row.status}
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
                    Tinjau Foto
                  </button>
                </div>
              </div>
            ))}
          </div>
          <TablePagination
            page={page}
            limit={limit}
            total={visiblePhotos.length}
            onPageChange={setPage}
            itemName="permohonan foto"
          />
        </div>
      )}

      {selected && (
        <ModalShell
          isOpen={Boolean(selected)}
          onClose={() => setSelected(null)}
          title="Verifikasi Pembaruan Foto Wajah"
          isLoading={busy}
          footer={
            selected.status === 'PENDING' ? (
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
                  {busy ? 'Menyimpan...' : 'Setujui Foto Baru'}
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
              <p className="text-slate-500">NIK: <span className="font-mono">{selected.employeeCode}</span></p>
              {selected.note && (
                <p className="mt-1 text-slate-600 italic">Keterangan: &ldquo;{selected.note}&rdquo;</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="mb-2 text-xs font-bold text-slate-700">Foto Profil Sebelumnya</p>
                {selected.oldPhotoUrl ? (
                  <img
                    src={selected.oldPhotoUrl}
                    alt="Foto profil sebelumnya"
                    className="max-h-56 mx-auto rounded-lg object-contain shadow-2xs"
                  />
                ) : (
                  <div className="h-40 flex items-center justify-center text-slate-400">
                    Tidak ada foto lama (Pendaftaran Pertama)
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                <p className="mb-2 text-xs font-bold text-emerald-900">Foto Baru yang Diajukan</p>
                <img
                  src={selected.photoUrl}
                  alt="Foto baru yang diajukan"
                  className="max-h-56 mx-auto rounded-lg object-contain shadow-2xs border border-emerald-300"
                />
              </div>
            </div>

            {selected.status === 'PENDING' && (
              <label className="block space-y-1.5 pt-2">
                <span className="font-semibold text-slate-900">Catatan Pemeriksaan (Wajib jika menolak)</span>
                <textarea
                  maxLength={2000}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Berikan alasan jika menolak pembaruan foto..."
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
