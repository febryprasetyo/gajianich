'use client';

import React from 'react';
import { ScanFace, MapPin } from 'lucide-react';

export type AttendanceRingState = 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'COMPLETED';

interface PresensiRingButtonProps {
  status: AttendanceRingState;
  onOpenFlow: () => void;
  officeName?: string;
  onResetDemo?: () => void;
  showResetDemo?: boolean;
}

export default function PresensiRingButton({
  status = 'NOT_CHECKED_IN',
  onOpenFlow,
  officeName = 'PT Cahaya Mas Cemerlang',
  onResetDemo,
  showResetDemo = false,
}: PresensiRingButtonProps) {
  let title = 'Absen Masuk';
  let subtitle = 'Buka Kamera Wajah';
  let middleBorderColor = '#A7F3D0';
  let btnBg = 'bg-[#059669] hover:bg-[#047857]';

  if (status === 'CHECKED_IN') {
    title = 'Absen Pulang';
    subtitle = 'Buka Kamera Wajah';
    middleBorderColor = '#FECDD3';
    btnBg = 'bg-[#059669] hover:bg-[#047857]';
  } else if (status === 'COMPLETED') {
    title = 'Sudah Tercatat';
    subtitle = 'Lihat Bukti Server';
    middleBorderColor = '#CBD5E1';
    btnBg = 'bg-slate-800 hover:bg-slate-900';
  }

  return (
    <div className="flex flex-col items-center justify-center px-5 py-4">
      {/* Outer Ring */}
      <div className="w-[160px] h-[160px] border border-[#a7f3d0] rounded-full p-1.5 flex items-center justify-center bg-[#ecfdf5] transition-all">
        {/* Middle Ring */}
        <div
          className="w-full h-full p-1.5 flex items-center justify-center border rounded-full bg-white transition-colors"
          style={{ borderColor: middleBorderColor }}
        >
          {/* Core Button */}
          <button
            type="button"
            onClick={onOpenFlow}
            aria-label={'Tombol ' + title + ' dengan Kamera Wajah'}
            className={'w-full h-full rounded-full ' + btnBg + ' text-white shadow-sm flex flex-col justify-center items-center gap-0.5 transition-all active:scale-[0.98] select-none'}
          >
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center mb-1">
              <ScanFace className="w-6 h-6 text-white" />
            </div>
            <span className="text-base font-extrabold tracking-tight leading-tight">
              {title}
            </span>
            <span className="text-[10px] font-semibold text-emerald-100">
              {subtitle}
            </span>
          </button>
        </div>
      </div>

      {/* Location Caption */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-700 mt-3 font-medium">
        <MapPin className="w-3.5 h-3.5 text-[#059669]" />
        <span>{officeName}</span>
      </div>

      {/* Guide Note */}
      <p className="text-[10px] text-center text-slate-500 mt-1">
        Posisikan wajah dengan jelas untuk melakukan presensi.
      </p>

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
