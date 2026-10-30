'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Cpu, ShieldCheck } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { apiFetch } from '@/lib/api';
import {
  validateAdmsRegistration,
  type AdmsCandidateDevice,
} from '@/lib/attendance/admsMonitor';

interface AdmsRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  candidates: AdmsCandidateDevice[];
  editDevice?: AdmsCandidateDevice | null;
  selectedGroupId: number | null;
}

const inputClass =
  'min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60';

export default function AdmsRegistrationModal({
  isOpen,
  onClose,
  onSuccess,
  candidates,
  editDevice = null,
  selectedGroupId,
}: AdmsRegistrationModalProps) {
  const [deviceId, setDeviceId] = useState('');
  const [serial, setSerial] = useState('');
  const [sourceCidr, setSourceCidr] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when opening or changing editDevice
  useEffect(() => {
    if (editDevice) {
      setDeviceId(String(editDevice.id));
      setSerial(editDevice.serialNumber || '');
      setSourceCidr(editDevice.allowedNetwork || (editDevice.ip ? `${editDevice.ip}/32` : ''));
      setEnabled(editDevice.admsEnabled);
    } else {
      setDeviceId('');
      setSerial('');
      setSourceCidr('');
      setEnabled(true);
    }
    setError(null);
  }, [editDevice, isOpen]);

  // When user selects a device from dropdown in new mode, pre-fill its info
  const handleDeviceChange = (selectedId: string) => {
    setDeviceId(selectedId);
    setError(null);
    const found = candidates.find(c => String(c.id) === selectedId);
    if (found) {
      if (found.serialNumber) setSerial(found.serialNumber);
      if (found.allowedNetwork) {
        setSourceCidr(found.allowedNetwork);
      } else if (found.ip) {
        setSourceCidr(`${found.ip}/32`);
      }
      setEnabled(found.admsRegistered ? found.admsEnabled : true);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const validation = validateAdmsRegistration(selectedGroupId, deviceId, serial, sourceCidr);
    if (validation) {
      setError(validation);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<{ success: boolean; message?: string }>(
        '/attendance/devices/adms/register',
        {
          method: 'POST',
          body: JSON.stringify({
            deviceId: Number(deviceId),
            serial: serial.trim(),
            sourceCidr: sourceCidr.trim(),
            enabled,
          }),
        }
      );

      if (!response.success) {
        throw new Error(response.message || 'Gagal menyimpan konfigurasi ADMS.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat mendaftarkan mesin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isLoading={submitting}
      title={editDevice ? 'Edit Allowlist Mesin ADMS' : 'Registrasi Mesin ADMS'}
      subtitle={
        editDevice
          ? `Perbarui IP allowlist untuk mesin ${editDevice.name}`
          : 'Daftarkan perangkat dan atur allowlist jaringan untuk penerimaan data ADMS'
      }
      icon={<Cpu className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
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
            form="adms-registration-form"
            disabled={submitting || selectedGroupId === null}
            className="min-h-10 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Menyimpan…' : editDevice ? 'Simpan Perubahan' : 'Simpan & Daftarkan'}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <aside
          aria-label="Informasi Keamanan ADMS"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-emerald-950"
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-bold">Zero-Trust Allowlist Jaringan</p>
            <p className="text-emerald-800">
              Hanya koneksi dari IP socket yang terdaftar di bawah yang diizinkan mengirim data ke port 8081. Mesin yang didaftarkan ke ADMS akan otomatis diproteksi dari penarikan kabel Ethernet manual.
            </p>
          </div>
        </aside>

        <form id="adms-registration-form" onSubmit={handleSubmit} className="space-y-3.5">
          {/* Device Selection */}
          <label className="block space-y-1 font-medium text-slate-700">
            <span>Pilih Mesin Absensi</span>
            <select
              required
              disabled={submitting || Boolean(editDevice)}
              className={inputClass}
              value={deviceId}
              onChange={e => handleDeviceChange(e.target.value)}
            >
              <option value="">-- Pilih Mesin Absensi --</option>
              {candidates.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name} · IP: {device.ip} ({device.connectionType})
                  {device.admsRegistered ? ' [Terdaftar ADMS]' : ''}
                </option>
              ))}
            </select>
            <span className="block text-[11px] font-normal text-slate-500">
              Menampilkan mesin yang terdaftar pada unit/cabang perusahaan yang sedang Anda pilih di menu atas.
            </span>
          </label>

          {/* Serial Number */}
          <label className="block space-y-1 font-medium text-slate-700">
            <span>Nomor Seri Mesin (Serial Number / SN)</span>
            <input
              required
              type="text"
              placeholder="Contoh: WAE4242900026 atau GSY1254900014"
              disabled={submitting}
              className={inputClass}
              value={serial}
              onChange={e => {
                setSerial(e.target.value);
                setError(null);
              }}
            />
            <span className="block text-[11px] font-normal text-slate-500">
              Harus sesuai dengan nomor seri yang tertera pada stiker fisik atau menu informasi perangkat.
            </span>
          </label>

          {/* Allowed Network (CIDR) */}
          <label className="block space-y-1 font-medium text-slate-700">
            <span>Alamat IP / Subnet Mesin (Allowlist)</span>
            <input
              required
              type="text"
              placeholder="Contoh: 192.168.10.224 atau 192.168.10.0/24"
              disabled={submitting}
              className={inputClass}
              value={sourceCidr}
              onChange={e => {
                setSourceCidr(e.target.value);
                setError(null);
              }}
            />
            <span className="block text-[11px] font-normal text-slate-500">
              Gunakan satu IP (misal: <code className="font-mono">192.168.10.224</code> dinormalisasi ke /32) atau satu blok subnet kantor (misal: <code className="font-mono">192.168.10.0/24</code>).
            </span>
          </label>

          {/* Enabled Status */}
          <label className="flex items-center gap-2.5 pt-1 font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              disabled={submitting}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
            />
            <span>Aktifkan penerimaan data ADMS untuk mesin ini</span>
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

