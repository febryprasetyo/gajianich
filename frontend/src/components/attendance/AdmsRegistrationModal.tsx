'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Cpu, ShieldCheck, PlusCircle, Server, Loader2 } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { apiFetch } from '@/lib/api';
import { useOrganizationScope } from '@/context/OrganizationScopeContext';
import {
  validateAdmsRegistration,
  validateNewAdmsDevice,
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
  const { availableGroups } = useOrganizationScope();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');

  // Form State: Existing Device Mode
  const [deviceId, setDeviceId] = useState('');
  const [serial, setSerial] = useState('');
  const [sourceCidr, setSourceCidr] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Form State: New Device Mode
  const [newName, setNewName] = useState('');
  const [newGroupId, setNewGroupId] = useState<number | null>(selectedGroupId);
  const [newIp, setNewIp] = useState('');
  const [newPort, setNewPort] = useState('4370');
  const [newSerial, setNewSerial] = useState('');
  const [newSourceCidr, setNewSourceCidr] = useState('');
  const [newEnabled, setNewEnabled] = useState(true);
  const [allowlistTouched, setAllowlistTouched] = useState(false);

  // Direct candidates fallback fetching
  const [fetchedCandidates, setFetchedCandidates] = useState<AdmsCandidateDevice[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active candidates list (from props or direct fetch)
  const activeCandidates = candidates.length > 0 ? candidates : fetchedCandidates;

  // Sync state when modal opens or editDevice changes
  useEffect(() => {
    if (!isOpen) return;

    if (editDevice) {
      setMode('existing');
      setDeviceId(String(editDevice.id));
      setSerial(editDevice.serialNumber || '');
      setSourceCidr(editDevice.allowedNetwork || (editDevice.ip ? `${editDevice.ip}/32` : ''));
      setEnabled(editDevice.admsEnabled);
    } else {
      setMode('existing');
      setDeviceId('');
      setSerial('');
      setSourceCidr('');
      setEnabled(true);

      setNewName('');
      setNewGroupId(selectedGroupId ?? availableGroups[0]?.id ?? null);
      setNewIp('');
      setNewPort('4370');
      setNewSerial('');
      setNewSourceCidr('');
      setNewEnabled(true);
      setAllowlistTouched(false);

      // Fetch candidates directly if candidates prop is empty
      if (candidates.length === 0) {
        setLoadingCandidates(true);
        apiFetch<{ success: boolean; data: AdmsCandidateDevice[] }>('/attendance/devices/adms/candidates')
          .then(res => {
            if (res.success && Array.isArray(res.data)) {
              setFetchedCandidates(res.data);
            }
          })
          .catch(() => {
            // Keep empty on error
          })
          .finally(() => {
            setLoadingCandidates(false);
          });
      }
    }
    setError(null);
  }, [editDevice, isOpen, candidates.length, selectedGroupId, availableGroups]);

  // When user selects a device from dropdown in existing mode, pre-fill its info
  const handleDeviceChange = (selectedId: string) => {
    setDeviceId(selectedId);
    setError(null);
    const found = activeCandidates.find(c => String(c.id) === selectedId);
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

  // When user types IP in new device mode, auto-fill sourceCidr if untouched
  const handleNewIpChange = (ipVal: string) => {
    setNewIp(ipVal);
    setError(null);
    if (!allowlistTouched) {
      const trimmed = ipVal.trim();
      setNewSourceCidr(trimmed ? `${trimmed}/32` : '');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (mode === 'existing') {
      const validation = validateAdmsRegistration(selectedGroupId, deviceId, serial, sourceCidr);
      if (validation) {
        setError(validation);
        return;
      }
    } else {
      const targetGroup = newGroupId ?? selectedGroupId;
      const validation = validateNewAdmsDevice(targetGroup, newName, newIp, newPort, newSerial, newSourceCidr);
      if (validation) {
        setError(validation);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      let payload: Record<string, unknown>;

      if (mode === 'existing') {
        payload = {
          deviceId: Number(deviceId),
          serial: serial.trim(),
          sourceCidr: sourceCidr.trim(),
          enabled,
        };
      } else {
        payload = {
          name: newName.trim(),
          groupId: newGroupId ?? selectedGroupId,
          ip: newIp.trim(),
          port: Number(newPort),
          serial: newSerial.trim(),
          sourceCidr: (newSourceCidr || `${newIp.trim()}/32`).trim(),
          enabled: newEnabled,
        };
      }

      const response = await apiFetch<{ success: boolean; message?: string }>(
        '/attendance/devices/adms/register',
        {
          method: 'POST',
          body: JSON.stringify(payload),
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

  const effectiveGroupId = mode === 'new' ? (newGroupId ?? selectedGroupId) : selectedGroupId;

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
            disabled={submitting || effectiveGroupId === null}
            className="min-h-10 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Menyimpan…' : editDevice ? 'Simpan Perubahan' : mode === 'new' ? 'Buat & Daftarkan ADMS' : 'Simpan & Daftarkan'}
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
            <p className="font-bold">Zero-Trust Allowlist Jaringan (Port 8081)</p>
            <p className="text-emerald-800">
              Hanya koneksi dari IP/subnet mesin yang terdaftar yang diizinkan mengirim presensi. Mesin yang didaftarkan ke ADMS memisahkan review log dari data raw payroll.
            </p>
          </div>
        </aside>

        {/* Tab Selection: Only visible when NOT editing */}
        {!editDevice && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('existing');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === 'existing'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Server className="h-4 w-4" />
              <span>Pilih Mesin Terdaftar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('new');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === 'new'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="h-4 w-4" />
              <span>Daftarkan Mesin Baru</span>
            </button>
          </div>
        )}

        <form id="adms-registration-form" onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'existing' ? (
            /* Mode 1: Existing Device Selection */
            <>
              <label className="block space-y-1 font-medium text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Pilih Mesin Absensi</span>
                  {loadingCandidates && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> Memuat mesin…
                    </span>
                  )}
                </div>
                <select
                  required
                  disabled={submitting || Boolean(editDevice) || loadingCandidates}
                  className={inputClass}
                  value={deviceId}
                  onChange={e => handleDeviceChange(e.target.value)}
                >
                  <option value="">-- Pilih Mesin Absensi --</option>
                  {activeCandidates.map(device => (
                    <option key={device.id} value={device.id}>
                      {device.name} · IP: {device.ip}
                      {device.groupName ? ` (${device.groupName})` : ''}
                      {device.admsRegistered ? ' [Terdaftar ADMS]' : ''}
                    </option>
                  ))}
                </select>
                <span className="block text-[11px] font-normal text-slate-500">
                  {activeCandidates.length === 0 && !loadingCandidates ? (
                    <span className="text-amber-600 font-medium">
                      Belum ada mesin absensi pada unit ini. Silakan gunakan tab <strong>"Daftarkan Mesin Baru"</strong> di atas.
                    </span>
                  ) : (
                    'Pilih mesin presensi yang sudah terdaftar untuk diaktifkan penerimaan data ADMS-nya.'
                  )}
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
                  Harus sesuai dengan nomor seri yang tertera pada stiker fisik atau menu info perangkat.
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
                  Gunakan format IP (/32) misal <code className="font-mono">192.168.10.224</code> atau subnet kantor misal <code className="font-mono">192.168.10.0/24</code>.
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
            </>
          ) : (
            /* Mode 2: New Device Registration */
            <>
              {/* Device Name */}
              <label className="block space-y-1 font-medium text-slate-700">
                <span>Nama Mesin Absensi Baru</span>
                <input
                  required
                  type="text"
                  placeholder="Contoh: Absensi Office Lantai 2"
                  disabled={submitting}
                  className={inputClass}
                  value={newName}
                  onChange={e => {
                    setNewName(e.target.value);
                    setError(null);
                  }}
                />
              </label>

              {/* Organization Group */}
              {availableGroups.length > 0 && (
                <label className="block space-y-1 font-medium text-slate-700">
                  <span>Kelompok Unit / Perusahaan</span>
                  <select
                    required
                    disabled={submitting}
                    className={inputClass}
                    value={newGroupId ?? ''}
                    onChange={e => {
                      setNewGroupId(Number(e.target.value) || null);
                      setError(null);
                    }}
                  >
                    {availableGroups.map(grp => (
                      <option key={grp.id} value={grp.id}>
                        {grp.name} ({grp.code})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* IP & Port Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block space-y-1 font-medium text-slate-700">
                    <span>Alamat IP Mesin (LAN)</span>
                    <input
                      required
                      type="text"
                      placeholder="Contoh: 192.168.10.250"
                      disabled={submitting}
                      className={inputClass}
                      value={newIp}
                      onChange={e => handleNewIpChange(e.target.value)}
                    />
                  </label>
                </div>
                <div>
                  <label className="block space-y-1 font-medium text-slate-700">
                    <span>Port Mesin</span>
                    <input
                      required
                      type="number"
                      placeholder="4370"
                      disabled={submitting}
                      className={inputClass}
                      value={newPort}
                      onChange={e => {
                        setNewPort(e.target.value);
                        setError(null);
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Serial Number */}
              <label className="block space-y-1 font-medium text-slate-700">
                <span>Nomor Seri Mesin (SN)</span>
                <input
                  required
                  type="text"
                  placeholder="Contoh: WAE4242900026"
                  disabled={submitting}
                  className={inputClass}
                  value={newSerial}
                  onChange={e => {
                    setNewSerial(e.target.value);
                    setError(null);
                  }}
                />
              </label>

              {/* Allowlist CIDR */}
              <label className="block space-y-1 font-medium text-slate-700">
                <span>Alamat IP / Subnet Allowlist ADMS</span>
                <input
                  required
                  type="text"
                  placeholder="Contoh: 192.168.10.250/32 atau 192.168.10.0/24"
                  disabled={submitting}
                  className={inputClass}
                  value={newSourceCidr}
                  onChange={e => {
                    setAllowlistTouched(true);
                    setNewSourceCidr(e.target.value);
                    setError(null);
                  }}
                />
                <span className="block text-[11px] font-normal text-slate-500">
                  Otomatis disamakan dengan IP mesin jika tidak diubah.
                </span>
              </label>

              {/* Enabled Checkbox */}
              <label className="flex items-center gap-2.5 pt-1 font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={submitting}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  checked={newEnabled}
                  onChange={e => setNewEnabled(e.target.checked)}
                />
                <span>Langsung aktifkan penerimaan presensi ADMS</span>
              </label>
            </>
          )}

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
