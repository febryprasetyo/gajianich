'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarCheck, User } from 'lucide-react';

interface BottomNavigationProps {
  onTabChange?: (tab: 'beranda' | 'presensi' | 'profil') => void;
  activeTabOverride?: 'beranda' | 'presensi' | 'profil';
}

export default function BottomNavigation({ onTabChange, activeTabOverride }: BottomNavigationProps) {
  const pathname = usePathname();

  const getActiveTab = (): 'beranda' | 'presensi' | 'profil' => {
    if (activeTabOverride) return activeTabOverride;
    if (pathname.includes('/m/presensi')) return 'presensi';
    if (pathname.includes('/m/profile') || pathname.includes('/m/profil')) return 'profil';
    return 'beranda';
  };

  const activeTab = getActiveTab();

  const handleNav = (tab: 'beranda' | 'presensi' | 'profil') => {
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  return (
    <nav
      aria-label="Navigasi Bawah 3 Menu"
      className="absolute bottom-0 inset-x-0 px-4 pt-2 pb-4 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/95 to-transparent z-30"
    >
      <div className="bg-[#059669] rounded-2xl p-1.5 shadow-lg border border-emerald-700 grid grid-cols-3 gap-1.5">
        <Link
          href="/m/beranda"
          onClick={() => handleNav('beranda')}
          aria-current={activeTab === 'beranda' ? 'page' : undefined}
          className={`min-h-[48px] px-3 py-2 rounded-xl flex items-center justify-center gap-2 font-extrabold text-sm transition ${
            activeTab === 'beranda'
              ? 'bg-white text-[#059669] shadow-sm'
              : 'text-white hover:bg-white/10 font-bold'
          }`}
        >
          <Home className="w-5 h-5 shrink-0" />
          <span>Beranda</span>
        </Link>

        <Link
          href="/m/presensi"
          onClick={() => handleNav('presensi')}
          aria-current={activeTab === 'presensi' ? 'page' : undefined}
          className={`min-h-[48px] px-3 py-2 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition relative ${
            activeTab === 'presensi'
              ? 'bg-white text-[#059669] shadow-sm font-extrabold'
              : 'text-white hover:bg-white/10'
          }`}
        >
          <CalendarCheck className="w-5 h-5 shrink-0" />
          <span>Presensi</span>
          <span className="w-2 h-2 rounded-full bg-rose-400 border border-[#059669]" title="Data live"></span>
        </Link>

        <Link
          href="/m/profile"
          onClick={() => handleNav('profil')}
          aria-current={activeTab === 'profil' ? 'page' : undefined}
          className={`min-h-[48px] px-3 py-2 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition ${
            activeTab === 'profil'
              ? 'bg-white text-[#059669] shadow-sm font-extrabold'
              : 'text-white hover:bg-white/10'
          }`}
        >
          <User className="w-5 h-5 shrink-0" />
          <span>Profil</span>
        </Link>
      </div>
    </nav>
  );
}
