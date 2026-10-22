'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ClockAlert,
  Clock,
} from 'lucide-react';
import DayDetailSheet, { DayDetailData } from '@/components/mobile/DayDetailSheet';

export default function MobilePresensiPage() {
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'TIDAK_ABSEN' | 'TEPAT_WAKTU' | 'TERLAMBAT'>('ALL');
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayDetailData | null>(null);

  const logsByMonth: Record<string, DayDetailData[]> = {
    '2026-10': [
      {
        id: 'D-20261022',
        dayName: 'Kamis',
        dateStr: '22 Oktober 2026',
        schedule: 'Shift Pagi (08:00 – 17:00 WIB)',
        status: 'BELUM_ABSEN',
        statusText: 'Belum Absen Masuk',
        checkIn: '--:--',
        checkOut: '--:--',
        duration: '00j 00m',
        note: 'Menunggu presensi kamera wajah hari ini.',
        serverRef: '-',
        employeeName: 'Febry Prasetyo',
      },
      {
        id: 'D-20261021',
        dayName: 'Rabu',
        dateStr: '21 Oktober 2026',
        schedule: 'Shift Pagi (08:00 – 17:00 WIB)',
        status: 'TEPAT_WAKTU',
        statusText: 'Hadir Tepat Waktu',
        checkIn: '07:52',
        checkOut: '17:04',
        duration: '09j 12m',
        note: 'Presensi dengan verifikasi wajah terkonfirmasi server.',
        serverRef: 'TX-GJN-20261021-104',
        employeeName: 'Febry Prasetyo',
      },
      {
        id: 'D-20261020',
        dayName: 'Selasa',
        dateStr: '20 Oktober 2026',
        schedule: 'Shift Pagi (08:00 – 17:00 WIB)',
        status: 'TIDAK_ABSEN',
        statusText: 'Tidak Absen',
        checkIn: '--:--',
        checkOut: '--:--',
        duration: '00j 00m',
        note: 'Tidak tercatat presensi masuk maupun pulang pada hari kerja efektif.',
        serverRef: 'ALPHA-AUTO-20261020',
        employeeName: 'Febry Prasetyo',
      },
      {
        id: 'D-20261019',
        dayName: 'Senin',
        dateStr: '19 Oktober 2026',
        schedule: 'Shift Pagi (08:00 – 17:00 WIB)',
        status: 'TERLAMBAT',
        statusText: 'Terlambat 14m',
        checkIn: '08:14',
        checkOut: '17:18',
        duration: '09j 04m',
        note: 'Presensi masuk melewati batas toleransi 08:00 WIB. Kendala kemacetan lalu lintas.',
        serverRef: 'TX-GJN-20261019-088',
        employeeName: 'Febry Prasetyo',
      },
      {
        id: 'D-20261016',
        dayName: 'Jumat',
        dateStr: '16 Oktober 2026',
        schedule: 'Shift Pagi (08:00 – 17:00 WIB)',
        status: 'TEPAT_WAKTU',
        statusText: 'Hadir Tepat Waktu',
        checkIn: '07:55',
        checkOut: '17:02',
        duration: '09j 07m',
        note: 'Verifikasi wajah dan keaktifan berhasil dikonfirmasi server.',
        serverRef: 'TX-GJN-20261016-042',
        employeeName: 'Febry Prasetyo',
      },
      {
        id: 'D-20261015',
        dayName: 'Kamis',
        dateStr: '15 Oktober 2026',
        schedule: 'Shift Pagi (08:00 – 17:00 WIB)',
        status: 'TEPAT_WAKTU',
        statusText: 'Hadir Tepat Waktu',
        checkIn: '07:50',
        checkOut: '17:05',
        duration: '09j 15m',
        note: 'Verifikasi wajah & keaktifan berhasil.',
        serverRef: 'TX-GJN-20261015-019',
        employeeName: 'Febry Prasetyo',
      },
    ],
    '2026-09': [
      {
        id: 'D-20260930',
        dayName: 'Rabu',
        dateStr: '30 September 2026',
        schedule: 'Shift Pagi (08:00 – 17:00 WIB)',
        status: 'TEPAT_WAKTU',
        statusText: 'Hadir Tepat Waktu',
        checkIn: '07:54',
        checkOut: '17:01',
        duration: '09j 07m',
        note: 'Verifikasi biometrik terkonfirmasi.',
        serverRef: 'TX-GJN-20260930-077',
        employeeName: 'Febry Prasetyo',
      },
    ],
  };

  const currentList = logsByMonth[selectedMonth] || [];
  const filteredList =
    selectedFilter === 'ALL'
      ? currentList
      : currentList.filter((item) => item.status === selectedFilter);

  return (
    <main className="flex-1 flex flex-col">
      {/* Curved Emerald Header */}
      <div className="bg-[#059669] rounded-b-[28px] px-4 pt-4 pb-5 text-white shadow-sm">
        <div className="flex items-center justify-between gap-2 relative z-10">
          <Link
            href="/m/beranda"
            aria-label="Kembali ke Beranda"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center transition"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </Link>
          <div className="text-center">
            <h1 className="text-lg font-extrabold tracking-tight">Riwayat Presensi</h1>
            <p className="text-xs text-emerald-100 font-medium">Febry Prasetyo · NIK CMC-2024-089</p>
          </div>
          <div className="w-11"></div>
        </div>

        {/* Month Selector Row */}
        <div className="mt-3.5 flex items-center justify-between gap-2 relative z-10">
          <label htmlFor="mobileMonthSelect" className="sr-only">
            Pilih Bulan
          </label>
          <select
            id="mobileMonthSelect"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white text-slate-900 font-extrabold text-xs sm:text-sm border border-white focus:outline-none shadow-sm cursor-pointer"
          >
            <option value="2026-10">Oktober 2026</option>
            <option value="2026-09">September 2026</option>
          </select>

          <div className="px-3 py-2 rounded-xl bg-black/20 border border-white/20 text-xs font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
            <span>Sinkron Server</span>
          </div>
        </div>
      </div>

      {/* Filter Chips Horizontal Scroll */}
      <div className="px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedFilter('ALL')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl font-extrabold text-xs shrink-0 transition ${
              selectedFilter === 'ALL'
                ? 'bg-[#059669] text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Semua Hari
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('TIDAK_ABSEN')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl font-extrabold text-xs shrink-0 flex items-center gap-1.5 transition ${
              selectedFilter === 'TIDAK_ABSEN'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100/70'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
            <span>Tidak Absen</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('TEPAT_WAKTU')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl font-bold text-xs shrink-0 transition ${
              selectedFilter === 'TEPAT_WAKTU'
                ? 'bg-[#059669] text-white shadow-sm font-extrabold'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Tepat Waktu
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('TERLAMBAT')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl font-bold text-xs shrink-0 transition ${
              selectedFilter === 'TERLAMBAT'
                ? 'bg-amber-500 text-white shadow-sm font-extrabold'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Terlambat
          </button>
        </div>
      </div>

      {/* List of Attendance Cards */}
      <div className="px-4 py-2 space-y-3 pb-6">
        {filteredList.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-1">
            <p className="text-sm font-extrabold text-slate-800">Tidak Ada Data pada Filter Ini</p>
            <p className="text-xs text-slate-500">
              Pilih "Semua Hari" untuk menampilkan seluruh riwayat harian Anda.
            </p>
          </div>
        ) : (
          filteredList.map((item) => {
            let cardStyle = 'bg-white border-slate-200';
            let badgeStyle = 'bg-emerald-50 text-[#059669] border-emerald-200';
            let IconComponent = CheckCircle2;
            let timeColor = 'text-slate-900';

            if (item.status === 'TIDAK_ABSEN') {
              cardStyle = 'bg-rose-50/70 border-rose-300';
              badgeStyle = 'bg-rose-600 text-white border-rose-600';
              IconComponent = XCircle;
              timeColor = 'text-rose-700';
            } else if (item.status === 'TERLAMBAT') {
              cardStyle = 'bg-white border-amber-300';
              badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
              IconComponent = ClockAlert;
            } else if (item.status === 'BELUM_ABSEN') {
              cardStyle = 'bg-white border-slate-200';
              badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
              IconComponent = Clock;
            }

            const isToday = item.id === 'D-20261022';

            return (
              <article
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDayDetail(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDayDetail(item);
                  }
                }}
                className={`border rounded-2xl p-4 shadow-sm transition cursor-pointer active:scale-[0.99] hover:border-emerald-300 ${cardStyle}`}
              >
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                        {item.dayName}, {item.dateStr}
                      </h3>
                      {isToday && (
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">
                          Hari Ini
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{item.schedule}</p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-extrabold shrink-0 ${badgeStyle}`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{item.statusText}</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2.5 text-xs">
                  <div>
                    <span className="text-slate-500 font-semibold block">Jam Masuk</span>
                    <span className={`font-mono font-extrabold text-sm ${timeColor}`}>
                      {item.checkIn}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">Jam Pulang</span>
                    <span className={`font-mono font-extrabold text-sm ${timeColor}`}>
                      {item.checkOut}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">Durasi</span>
                    <span className="font-mono font-extrabold text-sm text-slate-800">
                      {item.duration || '00j 00m'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2 text-xs">
                  <p
                    className={`truncate ${
                      item.status === 'TIDAK_ABSEN' ? 'text-rose-800 font-bold' : 'text-slate-600'
                    }`}
                  >
                    {item.note}
                  </p>
                  <span className="font-extrabold text-[#059669] shrink-0 flex items-center gap-0.5">
                    <span>Detail</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Day Detail Sheet Dialog */}
      <DayDetailSheet
        isOpen={Boolean(selectedDayDetail)}
        onClose={() => setSelectedDayDetail(null)}
        data={selectedDayDetail}
      />
    </main>
  );
}
