'use client';

import React from 'react';
import { LogIn, LogOut, Clock4 } from 'lucide-react';

interface AttendanceMetricsCardsProps {
  checkInTime: string;
  checkInSub?: string;
  checkOutTime: string;
  checkOutSub?: string;
  totalHours: string;
  totalSub?: string;
}

export default function AttendanceMetricsCards({
  checkInTime = '--:--',
  checkInSub = 'Jadwal 08:00',
  checkOutTime = '--:--',
  checkOutSub = 'Jadwal 17:00',
  totalHours = '00:00',
  totalSub = 'Hari ini',
}: AttendanceMetricsCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {/* Jam Masuk */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-[#059669] flex items-center justify-center shrink-0">
            <LogIn className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-600 leading-tight">Jam Masuk</span>
        </div>
        <div className="mt-2">
          <p className="text-base font-extrabold font-mono text-slate-900">{checkInTime}</p>
          <span className="text-[11px] font-semibold text-slate-500 block truncate">{checkInSub}</span>
        </div>
      </div>

      {/* Jam Pulang */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-[#059669] flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-600 leading-tight">Jam Pulang</span>
        </div>
        <div className="mt-2">
          <p className="text-base font-extrabold font-mono text-slate-900">{checkOutTime}</p>
          <span className="text-[11px] font-semibold text-slate-500 block truncate">{checkOutSub}</span>
        </div>
      </div>

      {/* Total Jam */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-[#059669] flex items-center justify-center shrink-0">
            <Clock4 className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-600 leading-tight">Total Jam</span>
        </div>
        <div className="mt-2">
          <p className="text-base font-extrabold font-mono text-slate-900">{totalHours}</p>
          <span className="text-[11px] font-semibold text-slate-500 block truncate">{totalSub}</span>
        </div>
      </div>
    </div>
  );
}
