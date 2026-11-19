'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface AssetKpiCardProps {
  title: string;
  value: number | string;
  subtext?: string;
  icon: LucideIcon;
  variant: 'emerald' | 'teal' | 'amber' | 'rose' | 'slate';
  badge?: string;
}

const VARIANT_STYLES = {
  emerald: {
    bg: 'bg-emerald-50/60',
    border: 'border-emerald-200/80',
    iconBg: 'bg-emerald-100 text-emerald-700',
    accentText: 'text-emerald-700',
    badgeBg: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
  },
  teal: {
    bg: 'bg-teal-50/60',
    border: 'border-teal-200/80',
    iconBg: 'bg-teal-100 text-teal-700',
    accentText: 'text-teal-700',
    badgeBg: 'bg-teal-100/80 text-teal-800 border-teal-200',
  },
  amber: {
    bg: 'bg-amber-50/60',
    border: 'border-amber-200/80',
    iconBg: 'bg-amber-100 text-amber-700',
    accentText: 'text-amber-700',
    badgeBg: 'bg-amber-100/80 text-amber-800 border-amber-200',
  },
  rose: {
    bg: 'bg-rose-50/60',
    border: 'border-rose-200/80',
    iconBg: 'bg-rose-100 text-rose-700',
    accentText: 'text-rose-700',
    badgeBg: 'bg-rose-100/80 text-rose-800 border-rose-200',
  },
  slate: {
    bg: 'bg-slate-50/60',
    border: 'border-slate-200/80',
    iconBg: 'bg-slate-100 text-slate-700',
    accentText: 'text-slate-700',
    badgeBg: 'bg-slate-100/80 text-slate-800 border-slate-200',
  },
};

export default function AssetKpiCard({
  title,
  value,
  subtext,
  icon: Icon,
  variant,
  badge,
}: AssetKpiCardProps) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.slate;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white p-5 border ${styles.border} shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums">
            {value}
          </p>
        </div>

        <div className={`w-11 h-11 rounded-xl ${styles.iconBg} flex items-center justify-center shrink-0 shadow-2xs`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        {subtext ? (
          <span className="text-slate-500 font-medium truncate">{subtext}</span>
        ) : (
          <span className="text-slate-400 font-normal">Data operasional riil</span>
        )}

        {badge && (
          <span
            className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded-full border ${styles.badgeBg}`}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
