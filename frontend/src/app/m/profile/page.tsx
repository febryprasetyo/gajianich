'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  ScanFace,
  CheckCircle2,
  Camera,
  SlidersHorizontal,
  History,
  Server,
  LogOut,
} from 'lucide-react';
import LogoutSheet from '@/components/mobile/LogoutSheet';

export default function MobileProfilePage() {
  const router = useRouter();
  const [isFaceEnrolled, setIsFaceEnrolled] = useState(true);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const toggleFaceEnrollment = () => {
    setIsFaceEnrolled(!isFaceEnrolled);
    showToast(!isFaceEnrolled ? 'Status Wajah: Terdaftar & Aktif' : 'Simulasi: Wajah Belum Terdaftar');
  };

  const handleEnrollNow = () => {
    setIsFaceEnrolled(true);
    showToast('Wajah berhasil diperbarui dan disinkronkan.');
  };

  const handleConfirmLogout = () => {
    setIsLogoutOpen(false);
    // Redirect to login or home
    router.push('/login');
  };

  return (
    <main className="flex-1 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-14 inset-x-4 z-50 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Curved Emerald Header */}
      <div className="bg-[#059669] rounded-b-[28px] px-4 pt-4 pb-5 text-white shadow-sm">
        <div className="flex items-center justify-between gap-2 relative z-10">
          <Link
            href="/m/beranda"
            aria-label="Kembali ke Beranda"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center transition"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-lg font-extrabold tracking-tight">Profil Karyawan</h1>
          <div className="w-11"></div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-3.5">
        {/* Identitas Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col items-center text-center pb-4 border-b border-slate-200">
            <div className="relative">
              <span className="w-20 h-20 rounded-full bg-[#d1fae5] border border-[#a7f3d0] flex items-center justify-center text-2xl font-extrabold text-[#065f46]">
                FP
              </span>
              <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#059669] text-white border-2 border-white flex items-center justify-center shadow-sm">
                <BadgeCheck className="w-3.5 h-3.5" />
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 mt-3">Febry Prasetyo, S.T.</h2>
            <p className="text-xs font-semibold text-slate-600">Project & Commissioning Engineer</p>
          </div>

          <div className="divide-y divide-slate-100 text-xs pt-2">
            <div className="py-2.5 flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500 shrink-0">NIK Karyawan</span>
              <span className="font-mono font-extrabold text-slate-900 text-right">CMC-2024-089</span>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500 shrink-0">Departemen</span>
              <span className="font-bold text-slate-900 text-right">Engineering — MedGas & WWTP</span>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500 shrink-0">Jabatan</span>
              <span className="font-bold text-slate-900 text-right">Project & Commissioning Engineer</span>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500 shrink-0">Email Akun</span>
              <span className="font-bold text-slate-900 text-right break-all">
                febry.p@cahayamascemerlang.co.id
              </span>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500 shrink-0">Telepon</span>
              <span className="font-mono font-bold text-slate-900 text-right">+62 812-8840-2910</span>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500 shrink-0">Lokasi Kerja</span>
              <span className="font-bold text-slate-900 text-right">
                Kawasan Industri Pulo Gadung, Jakarta Timur
              </span>
            </div>
          </div>
        </div>

        {/* Status Biometrik Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-[#059669] flex items-center justify-center shrink-0">
                <ScanFace className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-900">Status Pendaftaran Wajah</h3>
                <p className="text-[11px] text-slate-500">Verifikasi 1:1 & Keaktifan Wajah</p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold ${
                isFaceEnrolled
                  ? 'bg-emerald-50 border-emerald-200 text-[#059669]'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isFaceEnrolled ? 'Terdaftar' : 'Belum Terdaftar'}</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span>ID Wajah Sistem:</span>
              <span className="font-mono font-bold text-slate-900">BIO-CMC-089-V3</span>
            </div>
            <div className="flex justify-between">
              <span>Proteksi Keaktifan:</span>
              <span className="font-bold text-[#059669]">Aktif (Anti-Spoofing)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleEnrollNow}
              className="min-h-[46px] px-3 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
            >
              <Camera className="w-4 h-4" />
              <span>Perbarui Wajah</span>
            </button>
            <button
              type="button"
              onClick={toggleFaceEnrollment}
              className="min-h-[46px] px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Ubah Status Demo</span>
            </button>
          </div>
        </div>

        {/* Navigation & Logout Links */}
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
          <Link
            href="/m/presensi"
            className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-[#059669]" />
              <div>
                <p className="text-xs font-bold text-slate-900">Riwayat Kehadiran Pribadi</p>
                <p className="text-[11px] text-slate-500">Lihat catatan masuk, pulang, dan jam lembur</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </Link>

          <div className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-[#059669]" />
              <div>
                <p className="text-xs font-bold text-slate-900">Akses PWA Mandiri</p>
                <p className="text-[11px] text-slate-500">Aplikasi Web Progresif (Tanpa APK)</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-[#059669] border border-emerald-200 text-[10px] font-bold">
              Standalone
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsLogoutOpen(true)}
            className="w-full min-h-[54px] px-4 py-3.5 flex items-center justify-between text-left bg-rose-50/60 hover:bg-rose-100/70 text-rose-700 transition"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-rose-600" />
              <span className="text-xs font-extrabold">Keluar akun</span>
            </div>
            <ChevronRight className="w-4 h-4 text-rose-500" />
          </button>
        </div>
      </div>

      {/* Logout Confirmation Sheet */}
      <LogoutSheet
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleConfirmLogout}
      />
    </main>
  );
}
