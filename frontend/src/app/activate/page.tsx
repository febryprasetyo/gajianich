'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getDefaultRedirectForUser } from '@/lib/access/routes';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

interface ActivationInfo {
  valid: boolean;
  username: string;
  fullName: string;
  employeeCode?: string;
  error?: string;
}

function ActivateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const token = searchParams.get('token') || '';

  const [loadingInfo, setLoadingInfo] = useState(true);
  const [activationInfo, setActivationInfo] = useState<ActivationInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validate activation token on mount
  useEffect(() => {
    if (!token) {
      setLoadingInfo(false);
      setInfoError('Tautan aktivasi tidak memiliki token. Silakan periksa kembali tautan di pesan WhatsApp Anda.');
      return;
    }

    const fetchInfo = async () => {
      try {
        setLoadingInfo(true);
        setInfoError(null);
        const res = await api.get<ActivationInfo>(`/auth/activate-info?token=${encodeURIComponent(token)}`);
        if (res && res.valid) {
          setActivationInfo(res);
        } else {
          setInfoError(res?.error || 'Tautan aktivasi tidak valid atau telah kedaluwarsa.');
        }
      } catch (err: any) {
        setInfoError(err?.message || 'Tautan aktivasi tidak valid atau telah kedaluwarsa.');
      } finally {
        setLoadingInfo(false);
      }
    };

    fetchInfo();
  }, [token]);

  // Validation rules (8+ chars, letter, number, symbol)
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isMatched = password.length > 0 && password === confirmPassword;

  const isFormValid = hasMinLength && hasLetter && hasNumber && hasSymbol && isMatched;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setSubmitError('Pastikan password memenuhi seluruh kriteria keamanan dan cocok.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const res = await api.post<{
        message: string;
        token: string;
        user: any;
      }>('/auth/activate', {
        token,
        password,
        confirmPassword,
      });

      if (res && res.token && res.user) {
        setSuccess(true);
        // Automatically authenticate user session
        authLogin(res.token, res.user);

        // Immediate redirect to workspace
        const roleName = (res.user.roleName || res.user.role || '').toLowerCase().trim();
        const isEmployee = roleName === 'employee' || roleName === 'karyawan';
        const target = isEmployee
          ? '/m/beranda'
          : getDefaultRedirectForUser(res.user);

        setTimeout(() => {
          router.replace(target);
          if (typeof window !== 'undefined') {
            window.location.replace(target);
          }
        }, 1200);
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Gagal mengaktifkan akun. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-emerald-500/20">
            G
          </div>
          <span className="text-2xl font-black text-white tracking-wider">GAJIANICH</span>
        </div>
        <p className="text-center text-xs text-emerald-400 font-medium">
          Portal Kehadiran & Layanan Karyawan
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-5 sm:px-8 shadow-2xl rounded-3xl border border-slate-100">
          {loadingInfo ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-medium">Memvalidasi tautan aktivasi Anda...</p>
            </div>
          ) : infoError ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Tautan Tidak Valid</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{infoError}</p>
              </div>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                >
                  Buka Halaman Login
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="text-center space-y-3 py-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center animate-in zoom-in">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Akun Berhasil Aktif!</h3>
              <p className="text-xs text-slate-600">
                Password Anda telah disimpan. Mengarahkan Anda ke aplikasi...
              </p>
              <div className="flex justify-center pt-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Welcome Badge */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-emerald-800 font-medium">Selamat Datang,</p>
                  <p className="text-sm font-extrabold text-slate-900 truncate">
                    {activationInfo?.fullName}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Username: <span className="font-bold text-emerald-700 font-mono">{activationInfo?.username}</span>
                  </p>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">Buat Password Baru</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tentukan password Anda untuk langsung mengaktifkan akun dan masuk ke aplikasi.
                </p>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 8 karakter unik..."
                      required
                      className="w-full px-3.5 py-2.5 pr-10 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Konfirmasi Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang password baru..."
                      required
                      className="w-full px-3.5 py-2.5 pr-10 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Checklist */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Ketentuan Password
                  </p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                    <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span>Min. 8 karakter</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasLetter ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 ${hasLetter ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span>Memuat huruf</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 ${hasNumber ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span>Memuat angka</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasSymbol ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 ${hasSymbol ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span>Memuat simbol (!@#)</span>
                    </div>
                  </div>
                  {password.length > 0 && (
                    <div className={`text-[11px] pt-1 border-t border-slate-200/60 flex items-center gap-1.5 ${isMatched ? 'text-emerald-700 font-semibold' : 'text-red-500'}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isMatched ? 'text-emerald-600' : 'text-red-400'}`} />
                      <span>{isMatched ? 'Password cocok' : 'Password belum cocok'}</span>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!isFormValid || submitting}
                  className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengaktifkan Akun...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Aktifkan Akun & Masuk</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <ActivateContent />
    </Suspense>
  );
}
