'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  LockKeyhole,
  UnlockKeyhole,
  History,
  ShieldCheck,
  CalendarCheck,
  Upload,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAttendance } from './AttendanceWorkspace';
import HrHeroGreeting from './dashboard/HrHeroGreeting';
import HrTodayKpiCards from './dashboard/HrTodayKpiCards';
import HrPriorityChecks from './dashboard/HrPriorityChecks';
import HrDepartmentSummary from './dashboard/HrDepartmentSummary';
import {
  calculateOverviewMetrics,
  getActionablePriorities,
  getDepartmentPresenceSummary,
} from '@/lib/attendance/overviewMetrics';
import { validDate, getJakartaToday } from '@/lib/attendance/domain';

export default function HrOverviewPage() {
  const { user } = useAuth();
  const { data, canWrite } = useAttendance();

  const defaultDate = useMemo(() => {
    if (data.meta.defaultDate && validDate(data.meta.defaultDate)) return data.meta.defaultDate;
    if (data.records.length > 0) {
      return data.records.reduce((max, r) => (r.workDate > max ? r.workDate : max), data.records[0].workDate);
    }
    return getJakartaToday();
  }, [data]);

  const [date, setDate] = useState(defaultDate);

  const overviewMetrics = useMemo(() => calculateOverviewMetrics(data, date), [data, date]);
  const priorities = useMemo(() => getActionablePriorities(data, date, 5), [data, date]);
  const departmentSummary = useMemo(() => getDepartmentPresenceSummary(data, date), [data, date]);

  const locked = data.locks.some(l => l.workDate === date);
  const latestBatch = data.batches && data.batches.length > 0 ? data.batches[0] : null;
  const activeSources = (data.sources || []).filter(s => s.isActive);
  const todayRecordsCount = (data.records || []).filter(r => r.workDate === date).length;

  return (
    <div className="space-y-6">
      {/* 1. Header Personal GAJIANICH HR */}
      <HrHeroGreeting
        userName={user?.fullName || user?.username || data.meta.actor}
        targetDate={date}
        canWrite={canWrite}
        onDateChange={setDate}
      />

      {/* 2. Matriks Pantauan Hari Ini (8 Indikator Padat & Ringkas) */}
      <HrTodayKpiCards
        metrics={overviewMetrics}
        targetDate={date}
      />

      {/* 3. Layout Grid 2 Kolom untuk Operasional & Aktivitas Mesin */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Kolom Kiri (2 Kolom): Perlu Dicek & Distribusi Departemen */}
        <div className="lg:col-span-2 space-y-5">
          <HrPriorityChecks
            priorities={priorities}
            totalRecordsCount={todayRecordsCount}
          />

          <HrDepartmentSummary
            departments={departmentSummary}
            initialVisible={4}
          />
        </div>

        {/* Kolom Kanan (1 Kolom): Status Mesin, Data Terkunci & Quick Hub */}
        <div className="space-y-5">
          {/* Card Status Operasional & Mesin */}
          <div className="hr-panel p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Status Operasional & Mesin
                </h2>
                <p className="text-xs text-slate-500">
                  Integritas data absensi dan status integrasi.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Status Kunci Tanggal */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${locked ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {locked ? <LockKeyhole size={15} /> : <UnlockKeyhole size={15} />}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800">
                      Status Tanggal Ini
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {locked ? 'Terkunci (Tidak dapat diedit)' : 'Terbuka (Dapat disinkronisasi)'}
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${locked ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                  {locked ? 'LOCKED' : 'ACTIVE'}
                </span>
              </div>

              {/* Status File Mesin Terakhir */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <History size={14} className="text-slate-500" />
                    Impor Log Mesin Terakhir
                  </span>
                  {latestBatch && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                      {latestBatch.status}
                    </span>
                  )}
                </div>
                {latestBatch ? (
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <p className="font-medium truncate text-slate-800">
                      {latestBatch.filename}
                    </p>
                    <p className="text-slate-500">
                      {latestBatch.rows.length} baris scan · {latestBatch.createdAt}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    {data.meta.sourceFile ? `Sumber: ${data.meta.sourceFile}` : 'Belum ada berkas impor mesin.'}
                  </p>
                )}
              </div>

              {/* Mesin Absensi Terdaftar */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <span className="text-xs font-bold text-slate-800 block">
                  Mesin Terkoneksi ({activeSources.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeSources.map(s => (
                    <span key={s.id} className="text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-medium">
                      {s.name} ({s.code})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Link Navigasi Cepat ke Halaman Data */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <Link
                href="/dashboard/attendance"
                className="hr-btn-primary w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <CalendarCheck size={15} />
                  Kelola Data Harian Absensi
                </span>
                <ArrowRight size={14} />
              </Link>
              {canWrite && (
                <Link
                  href="/dashboard/attendance/imports"
                  className="hr-btn w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Upload size={15} />
                    Impor Log Mesin Baru
                  </span>
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
