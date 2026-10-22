'use client';

import React, { useState, useEffect } from 'react';
import { Signal, Wifi, BatteryFull, WifiOff } from 'lucide-react';
import BottomNavigation from '@/components/mobile/BottomNavigation';

export default function MobileAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [timeStr, setTimeStr] = useState('08:34');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setTimeStr(`${hh}:${mm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-start sm:justify-center min-h-dvh bg-[#F0F3F2] sm:py-6 text-[#0F172A]">
      {/* Mobile Shell Device Container */}
      <div
        id="interactivePhoneWrapper"
        className="w-full sm:w-[412px] sm:h-[860px] min-h-dvh sm:min-h-0 bg-[#F8FAFC] sm:rounded-[46px] sm:border-[8px] sm:border-white shadow-2xl relative flex flex-col overflow-hidden"
      >
        {/* Device Status Bar (Desktop Mockup Header) */}
        <div className="hidden sm:flex items-center justify-between px-7 pt-2.5 pb-1 bg-[#059669] text-white text-xs font-bold select-none z-20">
          <span className="font-mono">{timeStr}</span>
          <div className="w-24 h-4 bg-black/25 rounded-full"></div>
          <div className="flex items-center gap-1.5">
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <BatteryFull className="w-4 h-4" />
          </div>
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 z-30 shadow-sm animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>Mode Offline: Presensi wajib terhubung ke jaringan internet.</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOnline(true)}
              className="px-2.5 py-1 rounded-lg bg-white text-rose-700 font-extrabold shrink-0 hover:bg-slate-100 transition"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Scroll Container */}
        <div
          id="phoneScrollContainer"
          className="flex-1 overflow-y-auto no-scrollbar pb-24 flex flex-col relative"
        >
          {children}
        </div>

        {/* Fixed Bottom Navigation */}
        <BottomNavigation />
      </div>
    </div>
  );
}
