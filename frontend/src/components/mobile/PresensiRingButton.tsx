'use client';

import React, { useState, useEffect } from 'react';
import { ScanFace, MapPin, RotateCw, CheckCircle2 } from 'lucide-react';
import { useRealtimeLocation } from '@/hooks/useRealtimeLocation';

export type AttendanceRingState = 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'COMPLETED';

interface PresensiRingButtonProps {
  status: AttendanceRingState;
  onOpenFlow: () => void;
  officeName?: string;
  onResetDemo?: () => void;
  showResetDemo?: boolean;
  disabled?: boolean;
}

export default function PresensiRingButton({
  status = 'NOT_CHECKED_IN',
  onOpenFlow,
  onResetDemo,
  showResetDemo = false,
  disabled = false,
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
  const isButtonDisabled = disabled || isCompleted;

  let buttonLabel = 'Absen Masuk';
  let subLabel = 'Verifikasi Wajah';
  if (isCheckedIn) {
    buttonLabel = 'Absen Pulang';
    subLabel = 'Verifikasi Wajah';
  } else if (isCompleted) {
    buttonLabel = 'Selesai';
    subLabel = 'Presensi Lengkap';
  }

  return (
    <div className="flex flex-col items-center justify-center pt-3 pb-2 px-5 select-none">
      {/* 1. Hero Circular Face Scan Button with Ambient Halo */}
      <div className="relative flex items-center justify-center">
        {/* Subtle Outer Glow Halo */}
        <div className={`absolute w-[184px] h-[184px] rounded-full ${isCompleted ? 'bg-slate-300/10' : 'bg-emerald-500/15 animate-pulse'}`} />

        {/* Main Circular Button */}
        <button
          type="button"
          onClick={onOpenFlow}
          disabled={isButtonDisabled}
          aria-label={isCompleted ? 'Presensi hari ini telah lengkap' : buttonLabel + ' dengan verifikasi wajah'}
          className={`relative w-[156px] h-[156px] rounded-full border-4 border-white flex flex-col items-center justify-center gap-1.5 transition select-none ${
            isCompleted
              ? 'bg-slate-700 text-slate-100 shadow-xl shadow-slate-700/20 opacity-90 cursor-default pointer-events-none'
              : isButtonDisabled
              ? 'bg-[#059669] text-white shadow-xl shadow-emerald-700/20 opacity-50 cursor-not-allowed pointer-events-none'
              : 'bg-[#059669] text-white shadow-xl shadow-emerald-700/20 hover:bg-[#047857] active:scale-95 cursor-pointer'
          }`}
        >
          {/* Face Scan Biometric Icon / Completed Check Icon */}
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
            {isCompleted ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            ) : (
              <ScanFace className="w-6 h-6 text-white" />
            )}
          </div>
          <span className="text-base font-extrabold tracking-wide">
            {buttonLabel}
          </span>
          <span className={`text-[10px] font-semibold opacity-90 ${isCompleted ? 'text-emerald-300' : 'text-emerald-100'}`}>
            {subLabel}
          </span>
        </button>
      </div>

      {/* 2. Big Digital Clock Display */}
      <div className="text-center mt-3">
        <p className="text-3xl font-extrabold font-mono tracking-tight text-slate-900">
          {currentTime}
        </p>

        {/* 3. Realtime Accurate GPS Location */}
        <div className="mt-1.5 flex flex-col items-center gap-1">
          <div className="flex w-full items-start justify-center gap-2 text-[11px] font-semibold text-slate-700 px-3 py-2">
            <MapPin className={`w-3.5 h-3.5 ${location.loading ? 'animate-bounce text-amber-500' : 'text-[#059669]'}`} />
            <span className="min-w-0 flex-1 text-center leading-relaxed break-words">{location.displayText}</span>
            <button
              type="button"
              onClick={location.refetch}
              title="Perbarui sinyal lokasi"
              aria-label="Perbarui sinyal lokasi sekarang"
              className="p-0.5 text-slate-400 hover:text-slate-700 transition"
            >
              <RotateCw className={`w-3 h-3 ${location.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
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
