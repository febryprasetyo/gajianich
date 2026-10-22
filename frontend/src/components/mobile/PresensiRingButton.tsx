'use client';

import React, { useState, useEffect } from 'react';
import { ScanFace, MapPin, RotateCw, CheckCircle2 } from 'lucide-react';
import { useRealtimeLocation } from '@/hooks/useRealtimeLocation';

export type AttendanceRingState = 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'COMPLETED';

interface PresensiRingButtonProps {
  officeName?: string;
  status: AttendanceRingState;
  onOpenFlow: () => void;
  onResetDemo?: () => void;
  showResetDemo?: boolean;
}

export default function PresensiRingButton({
  status = 'NOT_CHECKED_IN',
  onOpenFlow,
  onResetDemo,
  showResetDemo = false,
}: PresensiRingButtonProps) {
  const [currentTime, setCurrentTime] = useState('08.25');
  const location = useRealtimeLocation();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hh}.${mm}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  const isCheckedIn = status === 'CHECKED_IN';
  const isCompleted = status === 'COMPLETED';

  let buttonLabel = 'Clock In';
  if (isCheckedIn) buttonLabel = 'Clock Out';
  if (isCompleted) buttonLabel = 'Selesai';

  return (
    <div className="flex flex-col items-center justify-center pt-3 pb-2 px-5 select-none">
      {/* 1. Hero Circular Face Scan Button with Ambient Halo */}
      <div className="relative flex items-center justify-center">
        {/* Subtle Outer Glow Halo */}
        <div className="absolute w-[184px] h-[184px] rounded-full bg-emerald-500/15 animate-pulse" />

        {/* Main Circular Button */}
        <button
          type="button"
          onClick={onOpenFlow}
          aria-label={buttonLabel + ' dengan Verifikasi Wajah Biometrik'}
          className="relative w-[156px] h-[156px] rounded-full bg-[#059669] hover:bg-[#047857] text-white shadow-xl shadow-emerald-700/20 border-4 border-white flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer select-none"
        >
          {/* Face Scan Biometric Icon */}
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
            <ScanFace className="w-6 h-6 text-white" />
          </div>
          <span className="text-base font-extrabold tracking-wide">
            {buttonLabel}
          </span>
          <span className="text-[10px] font-semibold text-emerald-100 opacity-90">
            Scan Wajah
          </span>
        </button>
      </div>

      {/* 2. Big Digital Clock Display */}
      <div className="text-center mt-3">
        <p className="text-3xl font-extrabold font-mono tracking-tight text-slate-900">
          {currentTime}
        </p>

        {/* 3. Realtime Accurate GPS Location for Dinas Luar */}
        <div className="mt-1 flex flex-col items-center gap-0.5">
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100/90 border border-slate-200/80 px-2.5 py-0.5 rounded-full">
            <MapPin className={`w-3.5 h-3.5 ${location.loading ? 'animate-bounce text-amber-500' : 'text-[#059669]'}`} />
            <span className="max-w-[260px] truncate">{location.displayText}</span>
            <button
              type="button"
              onClick={location.refetch}
              title="Refresh sinyal GPS"
              aria-label="Refresh sinyal GPS akurat"
              className="p-0.5 text-slate-400 hover:text-slate-700 transition"
            >
              <RotateCw className={`w-3 h-3 ${location.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <p className="text-[10px] text-slate-500 font-medium">
            Presensi dinas luar mencatat koordinat GPS akurat dari HP
          </p>
        </div>
      </div>

      {/* Simulation Reset Action */}
      {showResetDemo && onResetDemo && (
        <button
          type="button"
          onClick={onResetDemo}
          className="text-xs text-[#059669] font-bold underline mt-2 hover:text-[#047857]"
        >
          Ulangi simulasi hari ini
        </button>
      )}
    </div>
  );
}
