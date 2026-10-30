'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { getDefaultRedirectForUser } from '@/lib/access/routes';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  LogOut,
  ArrowRight,
} from 'lucide-react';

export default function ChangePasswordPage() {
  const { user, isLoading, login, logout } = useAuth();
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If not authenticated, redirect to login. If already changed, redirect to main workspace.
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/login');
        if (typeof window !== 'undefined') {
          window.location.replace('/login');
        }
      } else if (!user.mustChangePassword) {
        const roleName = (user.roleName || "").toLowerCase().trim();
        const isEmployee = roleName === "employee" || roleName === "karyawan";
        const target = isEmployee
          ? '/m/beranda'
          : (roleName.includes("hr") && !roleName.includes("it")
              ? "/dashboard/attendance/overview"
              : getDefaultRedirectForUser(user));
        router.replace(target);
        if (typeof window !== 'undefined') {
          window.location.replace(target);
        }
      }
    }
  }, [user, isLoading, router]);

  // Password rules validation: 8 or more characters with mix of letters, numbers & symbols
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
  const isMatched = newPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid = hasMinLength && hasLetter && hasNumber && hasSymbol && isMatched;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setError('Pastikan password baru memenuhi seluruh kriteria keamanan dan cocok.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await api.post<{
        message: string;
        token: string;
        mustChangePassword: boolean;
        user: any;
      }>('/auth/change-password', {
        newPassword,
        confirmPassword,
      });

      if (res && res.token && res.user) {
        const updatedUser = {
          id: res.user.id,
          username: res.user.username || user?.username || '',
          email: res.user.email || user?.email || '',
          fullName: res.user.fullName || user?.fullName || '',
          roleId: res.user.roleId ?? user?.roleId,
          roleName: res.user.roleName || user?.roleName || '',
          permissions: res.user.permissions || user?.permissions || [],
          mustChangePassword: false,
        };

        login(res.token, updatedUser);

        const roleName = (updatedUser.roleName || "").toLowerCase().trim();
        const isEmployee = roleName === "employee" || roleName === "karyawan";
        const target = isEmployee
          ? '/m/beranda'
          : (roleName.includes("hr") && !roleName.includes("it")
              ? "/dashboard/attendance/overview"
              : getDefaultRedirectForUser(updatedUser));

        router.replace(target);
        if (typeof window !== 'undefined') {
          window.location.replace(target);
        }
      } else {
        throw new Error('Respon server tidak valid');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal mengubah password. Silakan coba lagi.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 p-4 relative overflow-hidden font-sans select-none text-slate-900">
      {/* Radiant Glow Mesh */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="w-full max-w-lg z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-emerald-600 text-white mb-3 shadow-xl shadow-amber-500/20">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Buat Password Baru
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Akun Anda <span className="font-semibold text-slate-700">({user?.username || 'pengguna'})</span> sedang menggunakan password temporary. Harap buat password baru Anda sebelum melanjutkan ke sistem.
          </p>
        </div>

        <div className="rounded-3xl p-7 shadow-2xl relative overflow-hidden bg-white/95 border border-slate-200">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-emerald-500 to-emerald-600" />

          {/* Security Notice */}
          <div className="mb-5 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">Password Temporary 1x Pakai:</span> Setelah password baru dibuat, password temporary Anda akan langsung hangus dan tidak dapat digunakan lagi.
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-bold">Gagal Menyimpan Password</p>
                <p className="text-[11px] mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password Baru
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter (huruf, angka & simbol)..."
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Konfirmasi Password Baru
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru..."
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Checklist Password Criteria */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-600 mb-1">
                Kriteria Keamanan Password (Wajib):
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span>Minimal 8 karakter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLetter ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${hasLetter ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span>Memiliki huruf (A-Z, a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${hasNumber ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span>Memiliki angka (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasSymbol ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${hasSymbol ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <span>Memiliki simbol (!@#$%^&*)</span>
                </div>
              </div>
              <div className={`pt-1 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px] ${isMatched ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 ${isMatched ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Kedua password cocok</span>
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Menyimpan Password Baru...</span>
                </>
              ) : (
                <>
                  <span>Simpan Password & Masuk ke Dashboard</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </form>

          {/* Logout Action */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center">
            <button
              type="button"
              onClick={logout}
              className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Batal & Keluar ke Halaman Login</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
