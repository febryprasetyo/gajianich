'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import BottomNavigation from '@/components/mobile/BottomNavigation';
import StatusBadge from '@/components/ui/StatusBadge';
import ModalShell from '@/components/ui/ModalShell';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Search,
  Loader2,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  User,
  Info,
} from 'lucide-react';

interface VerificationLog {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  departmentName?: string;
  eventType: 'IN' | 'OUT';
  scanTime: string;
  workDate: string;
  occurredAt: string;
  scheduleIn?: string | null;
  scheduleOut?: string | null;
  shiftCode?: string | null;
  latitude: string;
  longitude: string;
  address?: string | null;
  isWithinGeofence: boolean;
  distanceMeters?: number | null;
  notes?: string | null;
  photoUrl: string | null;
  mapUrl?: string | null;
  googleMapsUrl?: string | null;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvalNote?: string | null;
}

export default function MobileVerifikasiPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedLog, setSelectedLog] = useState<VerificationLog | null>(null);

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<VerificationLog | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectError, setRejectError] = useState('');

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ data: VerificationLog[] }>('/attendance/mobile/verifications');
      setLogs(res.data || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memuat daftar verifikasi.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleApprove = async (log: VerificationLog) => {
    if (busyId) return;
    try {
      setBusyId(log.id);
      await apiFetch('/attendance/mobile/verify', {
        method: 'POST',
        body: JSON.stringify({
          logId: log.id,
          status: 'APPROVED',
          note: 'Disetujui melalui portal mobile HRD.',
        }),
      });
      showToast(`Presensi ${log.employeeName} disetujui.`);
      if (selectedLog?.id === log.id) setSelectedLog(null);
      void loadLogs();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal menyetujui presensi.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget || busyId) return;
    if (!rejectNote.trim()) {
      setRejectError('Alasan penolakan wajib diisi.');
      return;
    }
    try {
      setBusyId(rejectTarget.id);
      await apiFetch('/attendance/mobile/verify', {
        method: 'POST',
        body: JSON.stringify({
          logId: rejectTarget.id,
          status: 'REJECTED',
          note: rejectNote.trim(),
        }),
      });
      showToast(`Presensi ${rejectTarget.employeeName} ditolak.`, 'error');
      setRejectTarget(null);
      setRejectNote('');
      setRejectError('');
      if (selectedLog?.id === rejectTarget.id) setSelectedLog(null);
      void loadLogs();
    } catch (err: unknown) {
      setRejectError(err instanceof Error ? err.message : 'Gagal menolak presensi.');
    } finally {
      setBusyId(null);
    }
  };

  const filteredLogs = logs.filter((item) => {
    if (filter === 'PENDING' && item.approvalStatus !== 'PENDING') return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const matchName = item.employeeName.toLowerCase().includes(q);
      const matchCode = item.employeeCode.toLowerCase().includes(q);
      const matchDept = (item.departmentName || '').toLowerCase().includes(q);
      const matchNotes = (item.notes || '').toLowerCase().includes(q);
      return matchName || matchCode || matchDept || matchNotes;
    }
    return true;
  });

  const pendingTotal = logs.filter((l) => l.approvalStatus === 'PENDING').length;

  return (
    <div className="flex h-full flex-col bg-[#F8FAFC]">
      {/* Header Mobile Portal HR */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 pt-3 pb-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 leading-tight">Verifikasi Presensi</h1>
              <p className="text-[11px] text-slate-500">Portal persetujuan mobile HRD</p>
            </div>
          </div>
          {pendingTotal > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
              {pendingTotal} Pending
            </span>
          )}
        </div>

        {/* Search & Tabs Filter */}
        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, NIK, atau catatan..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilter('PENDING')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                filter === 'PENDING'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Menunggu Review ({pendingTotal})
            </button>
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                filter === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Riwayat ({logs.length})
            </button>
          </div>
        </div>
      </header>

      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`mx-4 mt-2 rounded-xl p-2.5 text-xs font-semibold text-white shadow-md animate-in slide-in-from-top-2 ${
            toastMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Main List Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Memuat data verifikasi...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2 opacity-80" />
            <p className="text-xs font-bold text-slate-700">Tidak ada pengajuan</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {filter === 'PENDING'
                ? 'Semua presensi karyawan sudah diverifikasi.'
                : 'Tidak ada data presensi yang sesuai pencarian.'}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isFieldDuty = log.notes?.startsWith('[DINAS_LUAR]');
            const isSelf = user?.employeeId === log.employeeId; // Cegah self-review
            const isBusy = busyId === log.id;

            return (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs transition hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {log.photoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={log.photoUrl}
                        alt={log.employeeName}
                        className="h-11 w-11 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 shrink-0">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-xs font-extrabold text-slate-900 leading-tight">
                        {log.employeeName}
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        {log.employeeCode} {log.departmentName ? `• ${log.departmentName}` : ''}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                      log.eventType === 'IN'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    SCAN {log.eventType}
                  </span>
                </div>

                {/* Scan Info & Location Pill */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1 font-mono font-medium">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {log.scanTime} ({log.workDate})
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ${
                      log.isWithinGeofence
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    <MapPin className="h-3 w-3 shrink-0" />
                    {log.isWithinGeofence
                      ? 'Dalam Kantor'
                      : `Luar Kantor ${log.distanceMeters ? `(${(log.distanceMeters / 1000).toFixed(1)} km)` : ''}`}
                  </span>
                  {isFieldDuty && (
                    <span className="rounded-md bg-purple-50 px-1.5 py-0.5 font-bold text-purple-700 border border-purple-200 text-[10px]">
                      Dinas Luar
                    </span>
                  )}
                </div>

                {/* Notes if any */}
                {log.notes && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 border border-slate-100">
                    <span className="font-semibold text-slate-700">Keterangan:</span>{' '}
                    {log.notes.replace(/^\[DINAS_LUAR\]\s*/, '')}
                  </div>
                )}

                {/* Status or Action Buttons */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLog(log)}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    Detail Bukti <ChevronRight className="h-3.5 w-3.5" />
                  </button>

                  {log.approvalStatus === 'PENDING' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setRejectTarget(log);
                          setRejectNote('');
                          setRejectError('');
                        }}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                      >
                        Tolak
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleApprove(log)}
                        className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Setujui
                      </button>
                    </div>
                  ) : (
                    <StatusBadge
                      variant={log.approvalStatus === 'APPROVED' ? 'success' : 'danger'}
                      icon={<span className="block h-1.5 w-1.5 rounded-full bg-current" />}
                    >
                      {log.approvalStatus === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                    </StatusBadge>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Detail Bukti Modal */}
      {selectedLog && (
        <ModalShell
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Detail Presensi - ${selectedLog.employeeName}`}
          maxWidthClass="max-w-md"
        >
          <div className="space-y-4 text-xs">
            {selectedLog.photoUrl && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedLog.photoUrl}
                  alt={selectedLog.employeeName}
                  className="mx-auto max-h-56 w-auto object-contain"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Tipe Event</span>
                <p className="font-bold text-slate-800">Scan {selectedLog.eventType}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Waktu Tercatat</span>
                <p className="font-bold text-slate-800">{selectedLog.scanTime} WIB</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Jarak Kantor</span>
                <p className="font-bold text-slate-800">
                  {selectedLog.distanceMeters ? `${selectedLog.distanceMeters} meter` : '-'}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Shift</span>
                <p className="font-bold text-slate-800">{selectedLog.shiftCode || 'Default'}</p>
              </div>
            </div>

            {selectedLog.address && (
              <div className="rounded-xl border border-slate-200 p-2.5">
                <span className="flex items-center gap-1 font-semibold text-slate-700 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" /> Alamat GPS
                </span>
                <p className="text-slate-600 leading-relaxed">{selectedLog.address}</p>
                {selectedLog.googleMapsUrl && (
                  <a
                    href={selectedLog.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 font-bold text-emerald-600 hover:underline"
                  >
                    Buka Google Maps <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {selectedLog.approvalStatus === 'PENDING' && (
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setRejectTarget(selectedLog);
                    setRejectNote('');
                    setRejectError('');
                  }}
                  className="flex-1 rounded-xl border border-rose-300 bg-rose-50 py-2.5 font-bold text-rose-700 hover:bg-rose-100"
                >
                  Tolak
                </button>
                <button
                  type="button"
                  disabled={busyId === selectedLog.id}
                  onClick={() => handleApprove(selectedLog)}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-700"
                >
                  Setujui Presensi
                </button>
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {/* Reject Note Dialog */}
      {rejectTarget && (
        <ModalShell
          isOpen={Boolean(rejectTarget)}
          onClose={() => setRejectTarget(null)}
          title="Tolak Pengajuan Presensi"
          maxWidthClass="max-w-sm"
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Berikan alasan penolakan presensi untuk{' '}
              <strong className="text-slate-900">{rejectTarget.employeeName}</strong>:
            </p>

            <textarea
              value={rejectNote}
              onChange={(e) => {
                setRejectNote(e.target.value);
                setRejectError('');
              }}
              rows={3}
              placeholder="Contoh: Lokasi tidak sesuai surat tugas, foto buram..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-rose-500 focus:outline-hidden"
            />

            {rejectError && <p className="text-[11px] font-semibold text-rose-600">{rejectError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="rounded-xl border border-slate-300 px-3.5 py-2 font-bold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busyId === rejectTarget.id}
                onClick={handleRejectSubmit}
                className="rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700"
              >
                Konfirmasi Penolakan
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
