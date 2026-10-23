'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { type MobileAttendanceEvent } from '@/lib/attendance/mobileApi';
import AttendanceMap from '@/components/attendance/AttendanceMap';
import AttendancePhoto from '@/components/attendance/AttendancePhoto';

export default function AttendanceEventDetails({
  events,
  onUpdated,
  onBusyChange,
}: {
  events: MobileAttendanceEvent[];
  onUpdated?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<number[]>([]);

  async function correct(id: number) {
    if (busy !== null) return;
    setBusy(id);
    onBusyChange?.(true);
    setError('');
    try {
      await apiFetch('/attendance/mobile/corrections', {
        method: 'POST',
        body: JSON.stringify({ logId: id, note: notes[id] || '' }),
      });
      setSent((values) => [...values, id]);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Koreksi gagal dikirim.');
    } finally {
      setBusy(null);
      onBusyChange?.(false);
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-slate-900">Lokasi Absensi & Peta Verifikasi</h4>
      {error && (
        <p role="alert" className="text-sm text-rose-800">
          {error}
        </p>
      )}
      {events.map((event) => (
        <section key={event.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
          <h4 className="text-sm font-bold text-slate-900">
            {event.eventType === 'IN' ? 'Presensi masuk' : 'Presensi pulang'} · {event.scanTime} {event.timeZoneLabel}
          </h4>
          <p className="text-xs text-slate-700">
            {sent.includes(event.id)
              ? 'Koreksi menunggu pemeriksaan HRD.'
              : event.approvalStatus === 'PENDING'
              ? 'Menunggu review HRD'
              : event.approvalStatus === 'REJECTED'
              ? 'Ditolak'
              : 'Disetujui'}
          </p>
          <p className="text-xs text-slate-700">{event.approvalNote}</p>
          <p className="text-xs text-slate-700">
            {event.address || 'Alamat belum tersedia. Titik presensi ditampilkan pada peta.'}
          </p>
          <AttendanceMap
            latitude={event.latitude}
            longitude={event.longitude}
            label={`Peta presensi ${event.eventType === 'IN' ? 'masuk' : 'pulang'}`}
          />
          <AttendancePhoto url={event.photoUrl} alt="Foto saat presensi" />
          {event.reviewHistory
            ?.filter((item) => item.status === 'CORRECTION' || item.status === 'REJECTED')
            .map((item, index) => (
              <p key={index} className="text-xs text-slate-700">
                {item.status === 'CORRECTION' ? 'Koreksi' : 'Penolakan'}: {item.note}
              </p>
            ))}
          {event.approvalStatus === 'REJECTED' && !sent.includes(event.id) && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void correct(event.id);
              }}
            >
              <label htmlFor={`correction-${event.id}`} className="block text-xs font-bold text-slate-700">
                Keterangan koreksi
              </label>
              <textarea
                id={`correction-${event.id}`}
                required
                maxLength={2000}
                value={notes[event.id] || ''}
                onChange={(e) =>
                  setNotes((values) => ({ ...values, [event.id]: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900"
              />
              <p className="text-xs text-slate-600">Waktu dan lokasi absensi asli tetap digunakan.</p>
              <button
                type="submit"
                disabled={busy !== null || !notes[event.id]?.trim()}
                className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {busy === event.id ? 'Mengirim...' : 'Kirim koreksi'}
              </button>
            </form>
          )}
        </section>
      ))}
    </div>
  );
}
