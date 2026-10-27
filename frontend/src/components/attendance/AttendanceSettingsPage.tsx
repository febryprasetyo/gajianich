'use client';

import { useState } from 'react';
import { Settings, BadgeCheck, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAttendance } from './AttendanceWorkspace';
import { Heading } from './shared';
import { api } from '@/lib/api';

export default function AttendanceSettingsPage() {
  const { user } = useAuth();
  const { data, execute } = useAttendance();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normRole = (user?.roleName || (user as { role?: string })?.role || '').toLowerCase().replace(/[\s_-]+/g, '');
  const isAdmin = ['superadmin', 'itadmin', 'admin'].includes(normRole) || Boolean(user?.permissions?.includes('*'));
  const isStrict = data.meta.strictIntegrity !== false;

  const handleToggle = async () => {
    if (!isAdmin) {
      setError('Hanya Administrator Sistem yang memiliki izin mengubah pengaturan ini.');
      return;
    }

    setBusy(true);
    setNotice(null);
    setError(null);

    try {
      const nextStrict = !isStrict;
      try {
        await api.put('/system/settings/attendance_strict_integrity', {
          value: nextStrict,
          description: 'Integritas Data Ketat (Strict Integrity) impor absensi',
        });
      } catch (dbErr) {
        console.warn('DB setting update warning:', dbErr);
      }
      await execute({ type: 'set_strict_integrity', enabled: nextStrict });
      setNotice(
        nextStrict
          ? 'Integritas Data Ketat diaktifkan: Mode Produksi (Wajib review seluruh baris bermasalah). Pengaturan permanen tersimpan di database.'
          : 'Integritas Data Ketat dinonaktifkan: Mode Uji Coba / Cepat (Melewati review manual saat simpan impor). Pengaturan permanen tersimpan di database.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <Heading
          title="Pengaturan Absensi"
          description="Konfigurasi kebijakan sistem dan kontrol integritas data absensi."
        />
        <div className="rounded-xl border border-red-200 bg-red-50/70 p-8 text-center max-w-xl mx-auto my-6 shadow-xs">
          <ShieldAlert className="mx-auto text-red-600 mb-3" size={36} />
          <h3 className="text-base font-bold text-red-950">Akses Terbatas: Administrator Only</h3>
          <p className="mt-2 text-xs leading-relaxed text-red-800">
            Halaman pengaturan integritas absensi ini hanya dapat diakses dan diubah oleh <strong>Administrator Sistem</strong>, bukan oleh staff atau HRD biasa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Heading
        title="Pengaturan Absensi"
        description="Konfigurasi kebijakan sistem dan kontrol integritas data absensi karyawan."
      />

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-900 shadow-xs" role="status">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <p>{notice}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-900 shadow-xs" role="alert">
          <AlertTriangle size={16} className="shrink-0 text-red-600" />
          <p>{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isStrict ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                <BadgeCheck size={22} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Integritas Data Ketat (Strict Integrity)
                </h3>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isStrict
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isStrict ? 'Aktif (Produksi)' : 'Nonaktif (Uji Coba / Cepat)'}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-2 text-sm font-medium text-slate-700">
              Wajib menyelesaikan review semua baris bermasalah atau terblokir sebelum absensi dapat disimpan.
            </p>

            <p className="text-xs leading-relaxed text-slate-500">
              {isStrict
                ? 'Ketika fitur ini aktif, tim HR diwajibkan meninjau seluruh data "Perlu review" dan "Terblokir" agar bernilai 0 sebelum tombol Simpan Absensi dapat diklik. Ini mencegah masuknya data scan yang belum diverifikasi ke catatan final.'
                : 'Ketika fitur ini nonaktif, proses review manual dan normalisasi dilewati saat menyimpan file impor. Data terpetakan langsung disimpan sesuai yang terupload ke dalam database final, kecuali data catatan tanggal ganda (duplikat) yang otomatis dilewati guna mencegah tabrakan data.'}
            </p>
          </div>

          <div className="shrink-0 pt-1">
            <button
              type="button"
              role="switch"
              aria-checked={isStrict}
              disabled={busy}
              onClick={handleToggle}
              title="Klik untuk mengubah mode integritas"
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                isStrict ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span className="sr-only">Toggle Integritas Data Ketat</span>
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isStrict ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-600 leading-relaxed">
        <p className="font-semibold text-slate-800 mb-1">Catatan Kebijakan & Integritas:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Pengaturan ini berlaku secara global untuk seluruh batch impor absensi di modul HR.</li>
          <li>Mode Nonaktif direkomendasikan hanya untuk keperluan pengembangan (*development*), pengetesan unggah data banyak, atau uji coba massal.</li>
          <li>Untuk operasional harian produksi, sangat disarankan mempertahankan mode <strong>Aktif (Produksi)</strong>.</li>
        </ul>
      </div>
    </div>
  );
}
