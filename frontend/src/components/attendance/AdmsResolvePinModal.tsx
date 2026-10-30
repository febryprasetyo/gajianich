'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { UserCheck, ShieldAlert, Loader2 } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { apiFetch } from '@/lib/api';

interface EmployeeOption {
  id: number;
  fullName: string;
  employeeCode: string;
  departmentName?: string;
}

interface AdmsResolvePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  pin: string;
  selectedGroupId: number | null;
}

const inputClass =
  'min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60';

export default function AdmsResolvePinModal({
  isOpen,
  onClose,
  onSuccess,
  pin,
  selectedGroupId,
}: AdmsResolvePinModalProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [processLogs, setProcessLogs] = useState(true);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || selectedGroupId === null) return;
    setLoadingEmployees(true);
    setError(null);
    setEmployeeId('');

    apiFetch<{ success: boolean; data: any[] }>('/employees?limit=200')
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          const mapped = res.data.map((e: any) => ({
            id: Number(e.id),
            fullName: e.fullName || e.name || 'Karyawan',
            employeeCode: e.employeeNumber || e.employeeCode || e.nik || String(e.id),
            departmentName: e.departmentName || e.department?.name || '',
          }));
          setEmployees(mapped);
        }
      })
      .catch(() => {
        setError('Gagal memuat daftar karyawan untuk pemetaan.');
      })
      .finally(() => {
        setLoadingEmployees(false);
      });
  }, [isOpen, selectedGroupId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !employeeId) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<{ success: boolean; message?: string }>(
        '/attendance/devices/adms/resolve-unmapped',
        {
          method: 'POST',
          body: JSON.stringify({
            pin: pin.trim(),
            employeeId: Number(employeeId),
            processLogs,
          }),
        }
      );

      if (!response.success) {
        throw new Error(response.message || 'Gagal memetakan PIN ke karyawan.');
      }

      onSuccess(response.message || `PIN ${pin} berhasil dipetakan ke karyawan dan diproses ke presensi.`);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memetakan PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isLoading={submitting}
      title="Petakan PIN ke Karyawan"
      subtitle={`Hubungkan PIN ${pin} pada mesin ADMS dengan data karyawan di GAJIANICH`}
      icon={<UserCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
      footer={
        <>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            form="adms-resolve-pin-form"
            disabled={submitting || !employeeId || loadingEmployees}
            className="min-h-10 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Memproses…' : 'Simpan & Proses ke Presensi'}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <aside
          aria-label="Informasi Pemetaan PIN"
          className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950"
        >
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-bold">Pemulihan Log Absensi (Action Manual HR)</p>
            <p>
              Log untuk PIN ini sebelumnya ditahan karena belum terhubung ke nama karyawan. Setelah dipetakan, riwayat scan akan otomatis bersih dan terhitung di Daftar Absensi Karyawan.
            </p>
          </div>
        </aside>

        <form id="adms-resolve-pin-form" onSubmit={handleSubmit} className="space-y-3.5">
          {/* PIN Info */}
          <label className="block space-y-1 font-medium text-slate-700">
            <span>Nomor PIN Mesin Absensi</span>
            <input
              type="text"
              readOnly
              disabled
              value={pin}
              className={`${inputClass} font-mono font-bold bg-slate-100 text-slate-900 cursor-not-allowed`}
            />
          </label>

          {/* Select Employee */}
          <label className="block space-y-1 font-medium text-slate-700">
            <div className="flex items-center justify-between">
              <span>Pilih Karyawan Tujuan</span>
              {loadingEmployees && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Memuat karyawan…
                </span>
              )}
            </div>
            <select
              required
              disabled={submitting || loadingEmployees}
              className={inputClass}
              value={employeeId}
              onChange={e => {
                setEmployeeId(e.target.value);
                setError(null);
              }}
            >
              <option value="">-- Pilih Nama Karyawan --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeCode}) {emp.departmentName ? `· ${emp.departmentName}` : ''}
                </option>
              ))}
            </select>
            <span className="block text-[11px] font-normal text-slate-500">
              Pilih karyawan yang memiliki PIN ini pada mesin fisik absensi.
            </span>
          </label>

          {/* Process Checkbox */}
          <label className="flex items-center gap-2.5 pt-1 font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              disabled={submitting}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={processLogs}
              onChange={e => setProcessLogs(e.target.checked)}
            />
            <span>Langsung proses riwayat log PIN ini ke Daftar Absensi Utama (FIFO)</span>
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {error}
            </p>
          )}
        </form>
      </div>
    </ModalShell>
  );
}

