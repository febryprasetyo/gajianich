'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import ModalShell from '@/components/ui/ModalShell';
import StatusBadge from '@/components/ui/StatusBadge';
import { ScanFace, CheckCircle2, XCircle, Search, AlertCircle, Loader2 } from 'lucide-react';

interface FaceRequest {
  id: number;
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

const button = 'min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer';

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
        body: JSON.stringify({ status: decision, note: note.trim() }),
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

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-slate-900">
          <ScanFace className="w-5 h-5 text-emerald-600" />
          <h1 className="text-lg font-bold">Persetujuan Foto Wajah</h1>
        </div>
        <p className="text-xs text-slate-500">
          Verifikasi antrean permohonan pembaruan foto profil biometrik wajah karyawan.
        </p>
      </header>

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
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
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
          <span>Memuat permohonan foto wajah...</span>
        </div>
      ) : visiblePhotos.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-xs">
          Tidak ada permohonan foto wajah yang sesuai dengan filter.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-xs">
          {visiblePhotos.map(row => (
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
