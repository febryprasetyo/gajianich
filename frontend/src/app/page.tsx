'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getDefaultRedirectForUser } from '@/lib/access/routes';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [showManualLink, setShowManualLink] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowManualLink(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      let target = '/login';
      if (user) {
        if (user.mustChangePassword) {
          target = '/change-password';
        } else {
          const roleName = (user.roleName || "").toLowerCase().trim();
          const isEmployee = roleName === "employee" || roleName === "karyawan";
          target = isEmployee ? '/m/beranda' : getDefaultRedirectForUser(user);
        }
      }
      router.replace(target);

      // Fallback redirect if client-side router transition hangs on tunnel
      const fallback = setTimeout(() => {
        if (typeof window !== 'undefined' && window.location.pathname === '/') {
          window.location.replace(target);
        }
      }, 1000);

      return () => clearTimeout(fallback);
    }
  }, [user, isLoading, router]);

  const targetUrl = user
    ? (user.mustChangePassword
        ? '/change-password'
        : (((user.roleName || "").toLowerCase().trim() === "employee" || (user.roleName || "").toLowerCase().trim() === "karyawan")
            ? '/m/beranda'
            : getDefaultRedirectForUser(user)))
    : '/login';

  return (
    <main className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="flex flex-col items-center gap-4 bg-white/90 p-8 rounded-3xl border border-slate-200 shadow-2xl backdrop-blur-xl max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <Image src="/branding/gajianich-cat-favicon.png" alt="" width={48} height={48} className="w-12 h-12 object-contain" />
        </div>
        <div className="flex items-center gap-2 text-slate-600 font-mono text-xs font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Lagi siapin GAJIANICH...</span>
        </div>
        {showManualLink && (
          <div className="pt-2 text-xs">
            <Link
              href={targetUrl}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 active:scale-95 transition-all"
            >
              Lanjutkan ke {user ? 'Dashboard' : 'Login'} &rarr;
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
