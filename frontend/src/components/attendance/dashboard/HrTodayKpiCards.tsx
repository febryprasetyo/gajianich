'use client';

import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Timer,
  Hourglass,
  CalendarDays,
  FileQuestion,
  ArrowRight,
} from 'lucide-react';
import type { OverviewMetrics } from '@/lib/attendance/overviewMetrics';

interface HrTodayKpiCardsProps {
  metrics: OverviewMetrics;
  targetDate?: string;
}

export default function HrTodayKpiCards({
  metrics,
  targetDate,
}: HrTodayKpiCardsProps) {
  const formatMinutes = (mins: number) => {
    if (mins <= 0) return '0 menit';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}j ${m}m` : `${m}m`;
  };

  const cards = [
    {
      key: 'all',
      condition: 'all',
      label: 'Karyawan Aktif',
      count: metrics.totalActiveEmployees,
      badge: 'Headcount',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
      description: 'Total tenaga kerja aktif',
      icon: Users,
      iconColor: 'text-slate-700 bg-slate-100',
    },
    {
      key: 'present',
      condition: 'ontime',
      label: 'Total Kehadiran',
      count: metrics.presentCount,
      badge: `${metrics.presentRate}%`,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      description: `${metrics.presentCount} dari ${metrics.totalActiveEmployees} hadir`,
      icon: CheckCircle2,
      iconColor: 'text-emerald-700 bg-emerald-100',
      progressRate: metrics.presentRate,
    },
    {
      key: 'ontime',
      condition: 'ontime',
      label: 'Tepat Waktu',
      count: metrics.onTimeCount,
      badge: 'Disiplin',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: `${metrics.onTimeCount} datang sesuai jam kerja`,
      icon: Timer,
      iconColor: 'text-emerald-600 bg-emerald-50',
    },
    {
      key: 'late',
      condition: 'late',
      label: 'Terlambat Datang',
      count: metrics.lateCount,
      badge: metrics.totalLateMinutes > 0 ? formatMinutes(metrics.totalLateMinutes) : 'Nol Keterlambatan',
      badgeColor: metrics.lateCount > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100',
      description: metrics.lateCount > 0 ? `Total durasi ${formatMinutes(metrics.totalLateMinutes)}` : 'Semua hadir tepat waktu ✨',
      icon: Clock,
      iconColor: metrics.lateCount > 0 ? 'text-amber-700 bg-amber-100' : 'text-emerald-600 bg-emerald-50',
    },
    {
      key: 'early',
      condition: 'early',
      label: 'Pulang Lebih Awal',
      count: metrics.earlyCount,
      badge: metrics.totalEarlyMinutes > 0 ? formatMinutes(metrics.totalEarlyMinutes) : 'Normal',
      badgeColor: metrics.earlyCount > 0 ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200',
      description: metrics.earlyCount > 0 ? `Total ${formatMinutes(metrics.totalEarlyMinutes)} lebih cepat` : 'Tidak ada kepulangan dini',
      icon: Hourglass,
      iconColor: metrics.earlyCount > 0 ? 'text-orange-700 bg-orange-100' : 'text-slate-600 bg-slate-100',
    },
    {
      key: 'overtime',
      condition: 'all',
      label: 'Lembur Kerja',
      count: metrics.overtimeCount,
      badge: metrics.totalOvertimeMinutes > 0 ? formatMinutes(metrics.totalOvertimeMinutes) : '0 Jam',
      badgeColor: metrics.overtimeCount > 0 ? 'bg-teal-100 text-teal-800 border-teal-200' : 'bg-slate-100 text-slate-600 border-slate-200',
      description: metrics.overtimeCount > 0 ? `Total ${formatMinutes(metrics.totalOvertimeMinutes)} lembur` : 'Belum ada lembur tercatat',
      icon: Timer,
      iconColor: metrics.overtimeCount > 0 ? 'text-teal-700 bg-teal-100' : 'text-slate-600 bg-slate-100',
    },
    {
      key: 'leave',
      condition: 'leave',
      label: 'Cuti / Izin / Sakit',
      count: metrics.leaveCount,
      badge: 'Izin Resmi',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      description: `${metrics.leaveCount} karyawan sedang tidak masuk`,
      icon: CalendarDays,
      iconColor: 'text-amber-700 bg-amber-100',
    },
    {
      key: 'missing',
      condition: 'noout',
      label: 'Missing Punch / Anomali',
      count: metrics.missingScanCount,
      badge: metrics.missingScanCount > 0 ? 'Perlu Cek' : 'Lengkap',
      badgeColor: metrics.missingScanCount > 0 ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100',
      description: metrics.missingScanCount > 0 ? `${metrics.missingScanCount} scan belum lengkap` : 'Tidak ada scan hilang ✨',
      icon: FileQuestion,
      iconColor: metrics.missingScanCount > 0 ? 'text-rose-700 bg-rose-100' : 'text-emerald-600 bg-emerald-50',
    },
  ];

  return (
    <section aria-label="Pantauan Kehadiran Hari Ini" className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Matriks Pantauan Hari Ini
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">
            (8 Indikator Operasional)
          </span>
        </div>
        <Link
          href={`/dashboard/attendance${targetDate ? `?date=${targetDate}` : ''}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
        >
          <span>Buka Data Operasional Absensi</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          const href = `/dashboard/attendance?condition=${c.condition}${targetDate ? `&date=${targetDate}` : ''}`;
          return (
            <Link
              key={c.key}
              href={href}
              className="hr-panel p-3.5 sm:p-4 text-left transition-all duration-150 hover:shadow-sm hover:border-emerald-300 hover:bg-slate-50/50 block group cursor-pointer"
            >
              <div className="flex items-center justify-between gap-1.5 mb-2.5">
                <div className={`p-1.5 sm:p-2 rounded-xl shrink-0 ${c.iconColor}`}>
                  <Icon size={16} />
                </div>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border truncate max-w-[120px] ${c.badgeColor}`}>
                  {c.badge}
                </span>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-baseline justify-between">
                  <span className="block text-xl sm:text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {c.count}
                  </span>
                </div>
                <span className="block text-xs font-semibold text-slate-800 truncate group-hover:text-emerald-800 transition-colors">
                  {c.label}
                </span>
                <p className="text-[11px] text-slate-500 leading-tight truncate">
                  {c.description}
                </p>
              </div>

              {typeof c.progressRate === 'number' && (
                <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, c.progressRate))}%` }}
                  />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
