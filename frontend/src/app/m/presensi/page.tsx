'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  MoreHorizontal,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import PresensiRingButton from '@/components/mobile/PresensiRingButton';
import DayDetailSheet, { DayDetailData } from '@/components/mobile/DayDetailSheet';
import FaceAttendanceSheet from '@/components/mobile/FaceAttendanceSheet';

interface AttendanceLogRow {
  id: string;
  dayShort: string;
  dateStr: string;
  fullDateText: string;
  clockIn: string;
  clockOut: string;
  workHours: string;
  isAbsent: boolean;
  status: 'TEPAT_WAKTU' | 'TERLAMBAT' | 'TIDAK_ABSEN';
  statusText: string;
  approvalStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
  approvalNote: string;
  serverRef: string;
  note: string;
}

const MOCK_ATTENDANCE_LOG: AttendanceLogRow[] = [
  {
    id: 'D-20261022',
    dayShort: 'Kam',
    dateStr: '22 Okt',
    fullDateText: 'Kamis, 22 Oktober 2026',
    clockIn: '08:25',
    clockOut: '--:--',
    workHours: '04h 15m',
    isAbsent: false,
    status: 'TEPAT_WAKTU',
    statusText: 'Hadir Tepat Waktu',
    approvalStatus: 'PENDING',
    approvalNote: 'Pengajuan presensi sedang diperiksa oleh HRD.',
    serverRef: 'TX-GJN-20261022-772',
    note: 'Presensi masuk tercatat valid via verifikasi wajah.',
  },
  {
    id: 'D-20261021',
    dayShort: 'Rab',
    dateStr: '21 Okt',
    fullDateText: 'Rabu, 21 Oktober 2026',
    clockIn: '07:52',
    clockOut: '17:04',
    workHours: '9h 12m',
    isAbsent: false,
    status: 'TEPAT_WAKTU',
    statusText: 'Hadir Tepat Waktu',
    approvalStatus: 'APPROVED',
    approvalNote: 'Telah diverifikasi dan disetujui HRD Pusat.',
    serverRef: 'TX-GJN-20261021-104',
    note: 'Presensi dan lokasi sekarang tersimpan rapi di server.',
  },
  {
    id: 'D-20261020',
    dayShort: 'Sel',
    dateStr: '20 Okt',
    fullDateText: 'Selasa, 20 Oktober 2026',
    clockIn: '08:15',
    clockOut: '17:30',
    workHours: '9h 15m',
    isAbsent: false,
    status: 'TEPAT_WAKTU',
    statusText: 'Hadir Tepat Waktu',
    approvalStatus: 'APPROVED',
    approvalNote: 'Disetujui HRD.',
    serverRef: 'TX-GJN-20261020-098',
    note: 'Presensi harian terkonfirmasi valid.',
  },
  {
    id: 'D-20261019',
    dayShort: 'Sen',
    dateStr: '19 Okt',
    fullDateText: 'Senin, 19 Oktober 2026',
    clockIn: '--',
    clockOut: '--',
    workHours: '0h',
    isAbsent: true,
    status: 'TIDAK_ABSEN',
    statusText: 'Tidak Absen (Alpa)',
    approvalStatus: 'REJECTED',
    approvalNote: 'Ditolak HRD: Tidak ada catatan presensi dan tanpa surat izin/cuti.',
    serverRef: 'TX-GJN-20261019-000',
    note: 'Tidak ada rekaman kehadiran server pada tanggal ini.',
  },
  {
    id: 'D-20261016',
    dayShort: 'Jum',
    dateStr: '16 Okt',
    fullDateText: 'Jumat, 16 Oktober 2026',
    clockIn: '08:10',
    clockOut: '17:15',
    workHours: '9h 05m',
    isAbsent: false,
    status: 'TEPAT_WAKTU',
    statusText: 'Hadir Tepat Waktu',
    approvalStatus: 'APPROVED',
    approvalNote: 'Disetujui HRD.',
    serverRef: 'TX-GJN-20261016-512',
    note: 'Presensi tercatat sesuai jadwal.',
  },
  {
    id: 'D-20261015',
    dayShort: 'Kam',
    dateStr: '15 Okt',
    fullDateText: 'Kamis, 15 Oktober 2026',
    clockIn: '08:42',
    clockOut: '17:45',
    workHours: '9h 03m',
    isAbsent: false,
    status: 'TERLAMBAT',
    statusText: 'Terlambat 42 Menit',
    approvalStatus: 'APPROVED',
    approvalNote: 'Disetujui HRD dengan toleransi perjalanan dinas.',
    serverRef: 'TX-GJN-20261015-321',
    note: 'Keterlambatan masuk telah diverifikasi HRD.',
  },
  {
    id: 'D-20261014',
    dayShort: 'Rab',
    dateStr: '14 Okt',
    fullDateText: 'Rabu, 14 Oktober 2026',
    clockIn: '08:00',
    clockOut: '17:00',
    workHours: '9h',
    isAbsent: false,
    status: 'TEPAT_WAKTU',
    statusText: 'Hadir Tepat Waktu',
    approvalStatus: 'APPROVED',
    approvalNote: 'Disetujui HRD.',
    serverRef: 'TX-GJN-20261014-411',
    note: 'Presensi tercatat normal.',
  },
  {
    id: 'D-20261013',
    dayShort: 'Sel',
    dateStr: '13 Okt',
    fullDateText: 'Selasa, 13 Oktober 2026',
    clockIn: '--',
    clockOut: '--',
    workHours: '0h',
    isAbsent: true,
    status: 'TIDAK_ABSEN',
    statusText: 'Tidak Absen',
    approvalStatus: 'REJECTED',
    approvalNote: 'Ditolak: Belum ada konfirmasi atau pengajuan izin resmi.',
    serverRef: 'TX-GJN-20261013-000',
    note: 'Data kehadiran kosong.',
  },
];

export default function MobilePresensiPage() {
  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [isFaceSheetOpen, setIsFaceSheetOpen] = useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayDetailData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'CURRENT' | 'PREVIOUS'>('CURRENT');

  const handleClockButtonClick = () => {
    setIsFaceSheetOpen(true);
  };

  const handleFaceSuccess = (data: { eventType: 'IN' | 'OUT'; scanTime: string; txHash: string }) => {
    setIsFaceSheetOpen(false);
    setIsCheckedIn(data.eventType === 'IN');
  };

  const handleRowClick = (row: AttendanceLogRow) => {
    setSelectedDayDetail({
      id: row.id,
      dayName: row.fullDateText.split(',')[0] || row.dayShort,
      dateStr: row.fullDateText.split(',')[1]?.trim() || row.dateStr,
      schedule: '08:00 – 17:00 WIB',
      status: row.status,
      statusText: row.statusText,
      checkIn: row.clockIn,
      checkOut: row.clockOut,
      duration: row.workHours,
      note: row.note,
      serverRef: row.serverRef,
      employeeName: 'Febry Prasetyo',
      approvalStatus: row.approvalStatus,
      approvalNote: row.approvalNote,
    });
  };

  return (
    <main className="flex-1 flex flex-col bg-[#F8FAFC] pb-10">
      {/* 1. Header Top Bar */}
      <header className="px-5 pt-3.5 pb-2 flex items-center justify-between">
        <Link
          href="/m/beranda"
          aria-label="Kembali ke Beranda"
          className="w-10 h-10 rounded-full bg-white border border-slate-200/90 shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>

        <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
          Presensi
        </h1>

        <button
          type="button"
          aria-label="Pilihan opsi presensi"
          className="w-10 h-10 rounded-full bg-white border border-slate-200/90 shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </header>

      {/* 2. Hero Action: Circular Face Scan Button (Shared with Beranda) */}
      <PresensiRingButton
        status={isCheckedIn ? 'CHECKED_IN' : 'NOT_CHECKED_IN'}
        onOpenFlow={handleClockButtonClick}
      />

      {/* 3. Today Summary Card: Clock In, Clock Out, Work Hours (NO Break Time) */}
      <section className="px-5 py-2">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm grid grid-cols-3 gap-2 text-center divide-x divide-slate-100">
          {/* Clock In */}
          <div className="px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Clock In
            </span>
            <p className="text-sm font-extrabold font-mono text-slate-800 mt-1">
              {isCheckedIn ? '08:25' : '--'}
            </p>
          </div>

          {/* Clock Out */}
          <div className="px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Clock Out
            </span>
            <p className="text-sm font-extrabold font-mono text-slate-800 mt-1">
              --
            </p>
          </div>

          {/* Work Hours */}
          <div className="px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Work Hours
            </span>
            <p className="text-sm font-extrabold font-mono text-slate-800 mt-1">
              {isCheckedIn ? '04h 15m' : '--'}
            </p>
          </div>
        </div>
      </section>

      {/* 4. Riwayat Presensi Table Section */}
      <section className="px-5 pt-3 pb-6 flex-1 flex flex-col">
        {/* Section Header with Period Filter */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
            Riwayat Presensi
          </h2>

          <div className="relative">
            <select
              aria-label="Filter Periode Presensi"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as 'CURRENT' | 'PREVIOUS')}
              className="appearance-none bg-white border border-slate-200 text-slate-700 font-extrabold text-xs rounded-full py-1.5 pl-3.5 pr-7 shadow-2xs hover:bg-slate-50 focus:outline-none cursor-pointer"
            >
              <option value="CURRENT">Bulan ini</option>
              <option value="PREVIOUS">Bulan lalu</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Table Header Bar */}
          <div className="bg-slate-600 text-white text-[11px] font-extrabold uppercase tracking-wider px-3.5 py-2.5 grid grid-cols-12 items-center">
            <span className="col-span-4">Tanggal</span>
            <span className="col-span-3 text-center">Masuk</span>
            <span className="col-span-3 text-center">Pulang</span>
            <span className="col-span-2 text-right">Durasi</span>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-slate-100">
            {MOCK_ATTENDANCE_LOG.map((row) => {
              const isToday = row.id === 'D-20261022';

              return (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRowClick(row)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(row);
                    }
                  }}
                  className={`px-3.5 py-3 grid grid-cols-12 items-center text-xs transition cursor-pointer hover:bg-slate-50/90 active:bg-slate-100/80 ${
                    isToday ? 'bg-emerald-50/30' : ''
                  }`}
                >
                  {/* Column 1: Date */}
                  <div className="col-span-4 flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {row.dayShort}
                    </span>
                    <strong className="text-xs font-extrabold text-slate-900">
                      {row.dateStr}
                    </strong>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#059669] shrink-0" title="Hari Ini" />
                    )}
                  </div>

                  {/* Column 2 & 3: Clock In & Clock Out */}
                  {row.isAbsent ? (
                    <div className="col-span-6 flex items-center justify-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold">
                        <XCircle className="w-3 h-3" />
                        <span>Tidak Absen</span>
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="col-span-3 text-center font-mono font-extrabold text-slate-900">
                        {row.clockIn}
                      </div>
                      <div className="col-span-3 text-center font-mono font-extrabold text-slate-900">
                        {row.clockOut}
                      </div>
                    </>
                  )}

                  {/* Column 4: Work Hours */}
                  <div className="col-span-2 text-right font-mono font-extrabold text-slate-700 text-[11px]">
                    {row.workHours}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[10px] text-center text-slate-400 mt-3">
          Ketuk tanggal untuk melihat detail presensi & status persetujuan HRD.
        </p>
      </section>

      {/* Face Flow Sheet Dialog */}
      <FaceAttendanceSheet
        isOpen={isFaceSheetOpen}
        onClose={() => setIsFaceSheetOpen(false)}
        isCheckOut={isCheckedIn}
        isOnline={true}
        isFaceEnrolled={true}
        employeeName="Febry Prasetyo"
        employeeNik="CMC-2024-089"
        onSuccess={handleFaceSuccess}
      />

      {/* Day Detail Sheet Dialog */}
      <DayDetailSheet
        isOpen={Boolean(selectedDayDetail)}
        onClose={() => setSelectedDayDetail(null)}
        data={selectedDayDetail}
      />
    </main>
  );
}
