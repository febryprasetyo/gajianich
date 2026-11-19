'use client';

import React from 'react';
import { Building2 } from 'lucide-react';

export interface DepartmentDistributionItem {
  departmentId: number | null;
  departmentName: string;
  count: number;
  percentage: number;
}

export interface AssetDepartmentBarProps {
  data: DepartmentDistributionItem[];
}

const BAR_COLORS = [
  'bg-emerald-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-emerald-600',
  'bg-teal-600',
  'bg-amber-600',
  'bg-slate-400',
];

export default function AssetDepartmentBar({ data }: AssetDepartmentBarProps) {
  const totalCount = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Distribusi Departemen & Unit Kerja
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Proporsi kepemilikan dan penugasan aset menurut divisi kerja
          </p>
        </div>

        <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
          {data.length} Divisi
        </span>
      </div>

      {data.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Building2 className="w-8 h-8 text-slate-300" />
          <p className="text-xs">Belum ada data penugasan departemen</p>
        </div>
      ) : (
        <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
          {data.map((item, index) => {
            const barColor = BAR_COLORS[index % BAR_COLORS.length];
            const isPool = !item.departmentId || item.departmentName.includes('Pool');

            return (
              <div key={item.departmentName + index} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`font-medium truncate max-w-[200px] sm:max-w-[260px] ${
                      isPool ? 'text-slate-500 italic' : 'text-slate-800'
                    }`}
                  >
                    {item.departmentName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-slate-700">
                      {item.count} <span className="text-[10px] font-normal text-slate-400">unit</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 w-11 text-right">
                      {item.percentage}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.max(item.percentage, 1)}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span>Akumulasi: {totalCount} unit</span>
        <span>Kalkulasi otomatis dari data aktif</span>
      </div>
    </div>
  );
}
