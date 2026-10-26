'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import ModalShell from '@/components/ui/ModalShell';
import StatusBadge from '@/components/ui/StatusBadge';
import AttendanceMap from './AttendanceMap';
import AttendancePhoto from './AttendancePhoto';
import type { MobileAttendanceEvent } from '@/lib/attendance/mobileApi';

interface Log extends MobileAttendanceEvent {
  employeeName: string;
  employeeCode: string;
  workDate: string;
  shiftCode: string;
  verifiedById: number | null;
  verifiedAt: string | null;
}

interface FaceRequest {
  id: number;
  employeeName: string;
  employeeCode: string;
  photoUrl: string;
  oldPhotoUrl: string | null;
  status: string;
  note: string | null;
}

interface Shift {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  autoApproveIn: boolean;
  autoApproveOut: boolean;
}

const statuses: Record<string, string> = {
  PENDING: 'Menunggu review',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

const button = 'min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-50';

export default function MobileApprovalsPage() {
  const [tab, setTab] = useState<'logs' | 'photos' | 'settings'>('logs');
  const [logs, setLogs] = useState<Log[]>([]);
  const [photos, setPhotos] = useState<FaceRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [status, setStatus] = useState('PENDING');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ kind: 'logs' | 'photos'; id: number } | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [a, b, c] = await Promise.all([
        apiFetch<{ data: Log[] }>('/attendance/mobile/verifications'),
        apiFetch<{ data: FaceRequest[] }>('/attendance/mobile/face-requests'),
        apiFetch<{ data: Shift[] }>('/attendance/mobile/approval-settings'),
      ]);
      setLogs(a.data);
      setPhotos(b.data);
      setShifts(c.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pengajuan gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const log = selected?.kind === 'logs' ? logs.find(row => row.id === selected.id) : null;
  const photo = selected?.kind === 'photos' ? photos.find(row => row.id === selected.id) : null;
  const selectedStatus = log?.approvalStatus || photo?.status;

  async function decide(result: 'APPROVED' | 'REJECTED') {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(
        selected.kind === 'logs'
          ? '/attendance/mobile/verify'
          : `/attendance/mobile/face-requests/${selected.id}/review`,
        {
          method: 'POST',
          body: JSON.stringify({ logId: selected.id, status: result, note }),
        }
      );
      setSelected(null);
      setMessage('Keputusan berhasil disimpan.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Keputusan gagal disimpan.');
    } finally {
      setBusy(false);
    }
  }

  async function saveShift(shift: Shift) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/attendance/mobile/approval-settings/${shift.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          autoApproveIn: shift.autoApproveIn,
          autoApproveOut: shift.autoApproveOut,
        }),
      });
      setMessage(`Aturan ${shift.name} berhasil disimpan.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pengaturan gagal disimpan.');
    } finally {
      setBusy(false);
    }
  }

  const match = (name: string, code: string, state: string) =>
    (!status || status === state) &&
    `${name} ${code}`.toLowerCase().includes(query.toLowerCase());

  const visibleLogs = logs.filter(row => match(row.employeeName, row.employeeCode, row.approvalStatus));
  const visiblePhotos = photos.filter(row => match(row.employeeName, row.employeeCode, row.status));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Approval Presensi & Foto
          </h1>
          <p className="mt-2 text-xs text-slate-600">
            Periksa presensi wajah, pengajuan koreksi, dan perubahan foto karyawan.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading || busy}
          className={button}
        >
          Muat ulang
        </button>
      </header>

      <nav aria-label="Bagian approval" className="flex flex-wrap gap-2">
        {(
          [
            ['logs', 'Presensi'],
            ['photos', 'Perubahan foto'],
            ['settings', 'Persetujuan otomatis'],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            onClick={() => {
              setTab(value);
              setMessage('');
            }}
            aria-pressed={tab === value}
            className={
              tab === value
                ? 'min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white'
                : button
            }
          >
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}
      {message && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {loading ? (
        <p role="status" className="p-6 text-sm text-slate-600">
          Memuat pengajuan...
        </p>
      ) : tab === 'settings' ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Persetujuan otomatis per shift</h2>
          <p className="text-xs leading-relaxed text-slate-600">
            Aktif: langsung disetujui setelah verifikasi wajah. Nonaktif: wajib diperiksa HRD. Shift baru secara
            default nonaktif. Karyawan tanpa penugasan shift selalu wajib diperiksa HRD.
          </p>
          {!shifts.length && (
            <p className="text-sm text-slate-600">
              Belum ada shift. Buat shift melalui menu Jam Kerja & Shift.
            </p>
          )}
          {shifts.map(shift => (
            <div
              key={shift.id}
              className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4"
            >
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">{shift.name}</h3>
                <p className="text-xs text-slate-600">
                  {shift.code}
                  {!shift.isActive ? ' · Nonaktif' : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {(['autoApproveIn', 'autoApproveOut'] as const).map(key => (
                  <label key={key} className="flex min-h-11 items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={shift[key]}
                      disabled={busy}
                      onChange={e =>
                        setShifts(all =>
                          all.map(item => (item.id === shift.id ? { ...item, [key]: e.target.checked } : item))
                        )
                      }
                      className="h-5 w-5 accent-emerald-700"
                    />
                    {key === 'autoApproveIn' ? 'Masuk otomatis' : 'Pulang otomatis'}
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => saveShift(shift)}
                  disabled={busy}
                  className={button}
                >
                  Simpan aturan {shift.code}
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <label className="space-y-1 text-xs font-semibold text-slate-700">
              Status
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="block min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-xs"
              >
                <option value="">Semua status</option>
                {Object.entries(statuses).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-700">
              Cari karyawan
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Nama atau NIK"
                className="block min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-xs"
              />
            </label>
          </div>

          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
            {(tab === 'logs' ? visibleLogs : visiblePhotos).map(row => {
              const state = 'approvalStatus' in row ? row.approvalStatus : row.status;
              return (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{row.employeeName}</p>
                      {'eventType' in row && row.notes?.includes('[DIRECT_OUT]') && (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                          Langsung Pulang (Tanpa Masuk)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      {row.employeeCode}
                      {'eventType' in row
                        ? ` · ${row.eventType === 'IN' ? 'Masuk' : 'Pulang'} · ${row.workDate} ${row.scanTime} ${row.timeZoneLabel} · ${row.shiftCode}`
                        : ' · Perubahan foto'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge variant={state === 'APPROVED' ? 'success' : state === 'REJECTED' ? 'danger' : 'warning'}>
                      {statuses[state]}
                    </StatusBadge>
                    <button
                      type="button"
                      className={button}
                      onClick={() => {
                        setSelected({ kind: tab as 'logs' | 'photos', id: row.id });
                        setNote('');
                        setError('');
                      }}
                    >
                      Lihat detail
                    </button>
                  </div>
                </div>
              );
            })}
            {!(tab === 'logs' ? visibleLogs : visiblePhotos).length && (
              <p className="p-8 text-center text-sm text-slate-600">
                Tidak ada pengajuan untuk filter ini.
              </p>
            )}
          </div>
          <p className="text-xs text-slate-600">
            Seluruh pengajuan menunggu review dan 500 keputusan terbaru.
          </p>
        </>
      )}

      {selected && (
        <ModalShell
          isOpen={Boolean(selected)}
          onClose={() => setSelected(null)}
          title={log ? 'Review presensi' : 'Review perubahan foto'}
          isLoading={busy}
          footer={
            selectedStatus === 'PENDING' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => decide('REJECTED')}
                  disabled={busy || !note.trim()}
                  className="min-h-11 rounded-xl border border-rose-300 bg-rose-50 px-4 text-xs font-bold text-rose-800 disabled:opacity-50"
                >
                  Tolak
                </button>
                <button
                  type="button"
                  onClick={() => decide('APPROVED')}
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white disabled:opacity-50"
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
          <div className="space-y-4 text-sm text-slate-700">
            {error && <p role="alert" className="text-rose-800">{error}</p>}
            <p className="font-bold">{log?.employeeName || photo?.employeeName}</p>
            {log && (
              <>
                {log.notes?.includes('[DIRECT_OUT]') && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>⚠️</span> Presensi Langsung Pulang (Tanpa Absen Masuk)
                    </p>
                    <p className="mt-1 leading-relaxed">
                      Karyawan tidak melakukan absen masuk pada shift ini. Jika disetujui, kehadiran akan dicatat dengan jam masuk kosong.
                    </p>
                    {log.notes && (
                      <p className="mt-1.5 font-medium italic text-amber-800">
                        Keterangan karyawan: &ldquo;{log.notes.replace('[DIRECT_OUT]', '').trim()}&rdquo;
                      </p>
                    )}
                  </div>
                )}
                <p>
                  {log.eventType === 'IN' ? 'Masuk' : 'Pulang'} · {log.scanDate || log.workDate} {log.scanTime} {log.timeZoneLabel}
                </p>
                <p>{log.address || 'Alamat belum tersedia. Titik GPS ditampilkan pada peta.'}</p>
                <AttendanceMap latitude={log.latitude} longitude={log.longitude} />
                <AttendancePhoto url={log.photoUrl} alt="Foto saat scan presensi" />
                <div className="space-y-2">
                  <h3 className="text-xs font-bold">Riwayat pengajuan</h3>
                  {log.reviewHistory?.map((item, index) => (
                    <p key={index} className="text-xs leading-relaxed">
                      {statuses[item.status] || item.status} · {new Date(item.at).toLocaleString('id-ID')} · Pengguna #{item.actorId}
                      <br />
                      {item.note}
                    </p>
                  ))}
                </div>
                {log.verifiedAt && (
                  <p className="text-xs">
                    Keputusan terakhir oleh pengguna #{log.verifiedById}, {new Date(log.verifiedAt).toLocaleString('id-ID')}.
                  </p>
                )}
              </>
            )}
            {photo && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-bold">Foto sebelumnya</p>
                    {photo.oldPhotoUrl ? (
                      <img
                        src={photo.oldPhotoUrl}
                        alt="Foto profil sebelumnya"
                        className="max-h-60 w-full rounded-xl object-contain"
                      />
                    ) : (
                      <p className="text-xs">Tidak tersedia</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold">Foto pengajuan</p>
                    <img
                      src={photo.photoUrl}
                      alt="Foto baru yang diajukan"
                      className="max-h-60 w-full rounded-xl object-contain"
                    />
                  </div>
                </div>
                {photo.note && <p>{photo.note}</p>}
              </>
            )}
            {selectedStatus === 'PENDING' && (
              <label className="block space-y-2 text-xs font-bold">
                Catatan pemeriksaan (wajib untuk penolakan)
                <textarea
                  maxLength={2000}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900"
                />
              </label>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
}
