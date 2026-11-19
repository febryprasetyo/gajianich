'use client';

import React from 'react';
import { Users, CalendarDays, Clock, CheckCircle2 } from 'lucide-react';
import { formatIndoDays } from '@/lib/leaves/masterLeaveUtils';

interface AnnualLeaveStatsCardsProps {
  totalEmployees: number;
  averageRemainingDays: number;
  totalUsedDays: number;
  totalAllocatedQuota: number;
  isLoading?: boolean;
}

export default function AnnualLeaveStatsCards({
  totalEmployees,
  averageRemainingDays,
  totalUsedDays,
  totalAllocatedQuota,
  isLoading = false,
}: AnnualLeaveStatsCardsProps) {
  const cards = [
    {
      label: 'Karyawan Aktif',
      value: isLoading ? '...' : `${totalEmployees}`,
      icon: <Users className="w-5 h-5" />,
      tone: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    },
    {
      label: 'Rata-rata Sisa Cuti',
      value: isLoading ? '...' : formatIndoDays(averageRemainingDays),
      icon: <Clock className="w-5 h-5" />,
      tone: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    },
    {
      label: 'Total Terpakai',
      value: isLoading ? '...' : formatIndoDays(totalUsedDays),
      icon: <CalendarDays className="w-5 h-5" />,
      tone: 'bg-amber-50 border-amber-100 text-amber-600',
    },
    {
      label: 'Total Hak Bersih',
      value: isLoading ? '...' : formatIndoDays(totalAllocatedQuota),
      icon: <CheckCircle2 className="w-5 h-5" />,
      tone: 'bg-teal-50 border-teal-100 text-teal-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((s) => (
        <div
          key={s.label}
          className="p-4 rounded-2xl flex items-center gap-4 bg-white border border-slate-200 shadow-sm"
        >
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${s.tone}`}>
            {s.icon}
          </div>
          <div>
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">{s.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 font-mono tabular-nums">{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
