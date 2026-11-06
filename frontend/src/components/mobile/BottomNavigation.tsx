'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarCheck, UserRound } from 'lucide-react';
interface Props {
  onTabChange?: (tab: 'beranda' | 'presensi' | 'profil') => void;
  activeTabOverride?: 'beranda' | 'presensi' | 'profil';
}
export default function BottomNavigation({ onTabChange, activeTabOverride }: Props) {
  const pathname = usePathname();
  const active = activeTabOverride || (pathname.includes('/m/presensi') ? 'presensi' : pathname.includes('/m/profil') ? 'profil' : 'beranda');
  return <nav aria-label="Navigasi utama" className="shrink-0 border-t border-slate-200 bg-white px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
    <div className="grid grid-cols-3 gap-2">{([
      { tab: 'beranda', label: 'Beranda', href: '/m/beranda', Icon: Home },
      { tab: 'presensi', label: 'Presensi', href: '/m/presensi', Icon: CalendarCheck },
      { tab: 'profil', label: 'Profil', href: '/m/profile', Icon: UserRound },
    ] as const).map(({ tab, label, href, Icon }) => <Link key={tab} href={href} onClick={() => onTabChange?.(tab)} aria-current={active === tab ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs transition focus-visible:outline-2 focus-visible:outline-emerald-600 ${active === tab ? 'bg-emerald-50 font-bold text-emerald-700' : 'font-medium text-slate-500 hover:bg-slate-50'}`}><Icon size={21} /><span>{label}</span></Link>)}</div>
  </nav>;
}
