'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Cpu, ShieldCheck, PlusCircle, Server, Loader2, Globe } from 'lucide-react';
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
  const [enabled, setEnabled] = useState(true);

  // Form State: New Device Mode
  const [newName, setNewName] = useState('');
  const [newGroupId, setNewGroupId] = useState<number | null>(selectedGroupId);
  const [newSerial, setNewSerial] = useState('');
  const [newEnabled, setNewEnabled] = useState(true);

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
      setEnabled(editDevice.admsEnabled);
    } else {
      setMode('existing');
      setDeviceId('');
      setSerial('');
      setEnabled(true);

      setNewName('');
      setNewGroupId(selectedGroupId ?? availableGroups[0]?.id ?? null);
      setNewSerial('');
      setNewEnabled(true);

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
      setEnabled(found.admsRegistered ? found.admsEnabled : true);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (mode === 'existing') {
      const validation = validateAdmsRegistration(selectedGroupId, deviceId, serial);
      if (validation) {
        setError(validation);
        return;
      }
    } else {
      const targetGroup = newGroupId ?? selectedGroupId;
      const validation = validateNewAdmsDevice(targetGroup, newName, newSerial);
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
          enabled,
        };
      } else {
        payload = {
          name: newName.trim(),
          groupId: newGroupId ?? selectedGroupId,
          serial: newSerial.trim(),
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
      title={editDevice ? 'Pengaturan Mesin ADMS' : 'Registrasi Mesin ADMS'}
      subtitle={
        editDevice
          ? `Perbarui nomor seri dan status penerimaan data untuk ${editDevice.name}`
          : 'Daftarkan perangkat presensi untuk penerimaan data otomatis via Nama Domain'
      }
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Globe className="h-3.5 w-3.5 text-emerald-600" />
            <span>Koneksi Cloud Domain (Port 8081)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              form="adms-registration-form"
              disabled={submitting}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan…</span>
                </>
              ) : editDevice ? (
                'Simpan Perubahan'
              ) : mode === 'new' ? (
                'Buat & Daftarkan ADMS'
              ) : (
                'Simpan & Daftarkan'
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Banner Petunjuk Domain */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900 flex items-start gap-2.5">
          <Globe className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed text-[11px]">
            <p className="font-semibold text-emerald-950">Koneksi Otomatis Berbasis Nama Domain</p>
            <p className="text-emerald-800">
              Mesin absensi akan mengirim log presensi secara otomatis via internet menggunakan nama domain server ADMS. Alamat IP tidak diperlukan lagi.
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs (Only when not in edit mode) */}
        {!editDevice && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 font-medium text-slate-600">
            <button
              type="button"
              onClick={() => {
                setMode('existing');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs transition-colors cursor-pointer ${
                mode === 'existing'
                  ? 'bg-white font-semibold text-emerald-800 shadow-2xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Daftarkan Mesin yang Ada</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('new');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs transition-colors cursor-pointer ${
                mode === 'new'
                  ? 'bg-white font-semibold text-emerald-800 shadow-2xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Daftarkan Mesin Baru</span>
            </button>
          </div>
        )}

        <form id="adms-registration-form" onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'existing' ? (
            /* Mode 1: Existing Device Registration */
            <>
              {/* Device Selector */}
              <label className="block space-y-1 font-medium text-slate-700">
                <span className="flex items-center justify-between">
                  <span>Pilih Mesin Absensi Terdaftar</span>
                  {loadingCandidates && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Memuat daftar…
                    </span>
                  )}
                </span>
                <select
                  required
                  disabled={submitting || Boolean(editDevice)}
                  className={inputClass}
                  value={deviceId}
                  onChange={e => handleDeviceChange(e.target.value)}
                >
                  <option value="">-- Pilih Mesin --</option>
                  {activeCandidates.map(device => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                      {device.serialNumber ? ` (${device.serialNumber})` : ''}
                      {device.groupName ? ` · [${device.groupName}]` : ''}
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
                <span className="block text-[11px] font-normal text-slate-500">
                  Nomor seri unik mesin yang akan mengirim data ke server ADMS.
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
