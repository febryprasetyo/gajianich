'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getDefaultRedirectForUser } from '@/lib/access/routes';
import { Loader2 } from 'lucide-react';

export default function DashboardIndexPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const redirectUrl = getDefaultRedirectForUser(user);
    router.replace(redirectUrl);
    if (typeof window !== 'undefined') {
      window.location.replace(redirectUrl);
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center font-sans text-slate-600">
      <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-xl">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
        <span className="text-sm font-medium text-slate-800">Mengarahkan ke modul Anda...</span>
      </div>
    </div>
  );
}
