'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarCheck, UserRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

interface Props {
  onTabChange?: (tab: 'beranda' | 'presensi' | 'verifikasi' | 'profil') => void;
  activeTabOverride?: 'beranda' | 'presensi' | 'verifikasi' | 'profil';
}

export default function BottomNavigation({ onTabChange, activeTabOverride }: Props) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);

  const canVerify = Boolean(
    user?.permissions?.includes('*') ||
    user?.permissions?.includes('attendance.mobile.verify') ||
    user?.permissions?.includes('attendance.manage') ||
    ['superadmin', 'admin', 'hrd', 'hr_attendance'].includes((user?.roleName || '').toLowerCase().replace(/[\s_-]+/g, ''))
  );

  const fetchBadge = useCallback(async () => {
    if (!canVerify) return;
    try {
      const res = await apiFetch<{ success: boolean; data: { totalPending: number } }>('/attendance/mobile/badge-count');
      if (res.data && typeof res.data.totalPending === 'number') {
        setPendingCount(res.data.totalPending);
      }
    } catch {
      // Polling background fail-soft
    }
  }, [canVerify]);

  useEffect(() => {
    if (!canVerify) return;
    void fetchBadge();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void fetchBadge();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [canVerify, fetchBadge]);

  const active =
    activeTabOverride ||
    (pathname.includes('/m/verifikasi')
      ? 'verifikasi'
      : pathname.includes('/m/presensi')
      ? 'presensi'
      : pathname.includes('/m/profil')
      ? 'profil'
      : 'beranda');

  const navItems = [
    { tab: 'beranda' as const, label: 'Beranda', href: '/m/beranda', Icon: Home },
    { tab: 'presensi' as const, label: canVerify ? 'Presensi Saya' : 'Presensi', href: '/m/presensi', Icon: CalendarCheck },
    ...(canVerify
      ? [
          {
            tab: 'verifikasi' as const,
            label: 'Verifikasi',
            href: '/m/verifikasi',
            Icon: ShieldCheck,
            badge: pendingCount,
          },
        ]
      : []),
    { tab: 'profil' as const, label: 'Profil', href: '/m/profile', Icon: UserRound },
  ];

  return (
    <nav aria-label="Navigasi utama" className="shrink-0 border-t border-slate-200 bg-white px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className={`grid gap-1.5 ${canVerify ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {navItems.map(({ tab, label, href, Icon, badge }) => (
          <Link
            key={tab}
            href={href}
            onClick={() => onTabChange?.(tab)}
            aria-current={active === tab ? 'page' : undefined}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] sm:text-xs transition focus-visible:outline-2 focus-visible:outline-emerald-600 ${
              active === tab ? 'bg-emerald-50 font-bold text-emerald-700' : 'font-medium text-slate-500 hover:bg-slate-50'
            }`}
          >
            <div className="relative">
              <Icon size={20} />
              {badge != null && badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white shadow-xs">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
            <span className="truncate max-w-[70px]">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
