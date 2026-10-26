'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Sliders, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface Shift {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  autoApproveIn: boolean;
  autoApproveOut: boolean;
}

export default function ShiftApprovalSettingsCard() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ data: Shift[] }>('/attendance/mobile/approval-settings');
      setShifts(res.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat aturan shift.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchShifts();
  }, [fetchShifts]);

  const saveShift = async (shift: Shift) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/attendance/mobile/approval-settings/${shift.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          autoApproveIn: shift.autoApproveIn,
          autoApproveOut: shift.autoApproveOut,
        }),
      });
      setNotice(`Aturan shift ${shift.code} berhasil disimpan.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan aturan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs transition-all">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
          <Sliders className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-900">Persetujuan Otomatis Presensi Shift</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Atur apakah presensi mobile pada shift tertentu otomatis disetujui setelah verifikasi biometrik wajah atau wajib ditinjau manual oleh HRD.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 p-3 text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div role="status" className="mb-4 flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 justify-center text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Memuat aturan shift...</span>
        </div>
      ) : shifts.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">
          Belum ada shift terdaftar di sistem.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {shifts.map(shift => (
            <div
              key={shift.id}
              className="py-3.5 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900">{shift.name}</h3>
                <p className="text-[11px] text-slate-500">
                  Kode: <span className="font-mono font-medium">{shift.code}</span>
                  {!shift.isActive && ' · (Nonaktif)'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shift.autoApproveIn}
                    disabled={busy}
                    onChange={e =>
                      setShifts(prev =>
                        prev.map(item => (item.id === shift.id ? { ...item, autoApproveIn: e.target.checked } : item))
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Masuk otomatis</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shift.autoApproveOut}
                    disabled={busy}
                    onChange={e =>
                      setShifts(prev =>
                        prev.map(item => (item.id === shift.id ? { ...item, autoApproveOut: e.target.checked } : item))
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Pulang otomatis</span>
                </label>

                <button
                  type="button"
                  onClick={() => saveShift(shift)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
