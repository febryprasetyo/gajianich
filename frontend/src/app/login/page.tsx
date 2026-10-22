'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, User } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/gajianichBrand';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post<{
        message: string;
        token: string;
        mustChangePassword?: boolean;
        user: {
          id: number;
          username: string;
          email: string;
          fullName?: string;
          roleId?: number;
          roleName: string;
          employeeId?: number | null;
          permissions?: string[];
          mustChangePassword?: boolean;
        };
      }>('/auth/login', { username: username.trim(), password });

      if (res && res.token && res.user) {
        const formattedUser: User = {
          id: res.user.id,
          username: res.user.username || username.trim(),
          email: res.user.email,
          fullName: res.user.fullName || res.user.username || username.trim(),
          roleId: res.user.roleId,
          roleName: res.user.roleName,
          employeeId: res.user.employeeId ?? null,
          permissions: res.user.permissions || [],
          mustChangePassword: Boolean(res.mustChangePassword ?? res.user.mustChangePassword),
        };

        login(res.token, formattedUser);

        if (res.mustChangePassword || res.user.mustChangePassword) {
          router.push('/change-password');
        } else {
          const roleName = (res.user.roleName || "").toLowerCase().trim();
          const isEmployee = roleName === "employee" || roleName === "karyawan";

          if (isEmployee) {
            router.push('/m/beranda');
          } else if (roleName.includes("hr") && !roleName.includes("it")) {
            router.push('/attendance');
          } else {
            router.push('/dashboard');
          }
        }
      } else {
        throw new Error('Invalid response payload from server');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] p-4 relative overflow-hidden font-sans text-slate-900">

      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Image src="/branding/gajianich-cat.png" alt="Maskot kucing kopi GAJIANICH" width={112} height={112} priority className="w-28 h-28 object-contain mx-auto mb-3" />
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center justify-center gap-2">
            <span>{BRAND_NAME}</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {BRAND_TAGLINE}
          </p>
        </div>

        {/* Crisp White Card */}
        <div className="glass-panel glass-panel-hover rounded-3xl p-8 shadow-2xl relative overflow-hidden bg-white/90 border border-slate-200">
          {/* Top border accent line */}
          <div className="absolute top-0 inset-x-0 h-1 bg-emerald-600" />

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Masuk dulu, yuk</h2>
              <p className="text-xs text-slate-500 mt-0.5">Biar urusan kantor tetap jalan.</p>
            </div>
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-600" />
              siap kerja
            </span>
          </div>

          {/* Error Alert Display */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1">
                <p className="font-bold text-red-800">Authentication Error</p>
                <p className="text-xs text-red-600/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-mono font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Primary sign-in action */}
            <button
              type="submit"
              disabled={loading}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold font-sans rounded-xl shadow-lg shadow-emerald-600/20 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Lagi masukin kamu...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke GAJIANICH</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Security Badge */}
        <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-500 mt-6 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"></span>
          <span>End-to-End Encrypted • Enterprise Identity Management</span>
        </div>
      </div>
    </main>
  );
}
