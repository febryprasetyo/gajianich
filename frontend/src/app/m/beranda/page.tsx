'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
  ChevronRight,
  Smartphone,
} from 'lucide-react';
import PresensiRingButton, { AttendanceRingState } from '@/components/mobile/PresensiRingButton';
import AttendanceMetricsCards from '@/components/mobile/AttendanceMetricsCards';
import FaceAttendanceSheet from '@/components/mobile/FaceAttendanceSheet';
import DayDetailSheet, { DayDetailData } from '@/components/mobile/DayDetailSheet';

export default function MobileBerandaPage() {
  const [attendanceState, setAttendanceState] = useState<{
    checkedIn: boolean;
    checkedOut: boolean;
    checkInTime: string;
    checkOutTime: string;
    totalHours: string;
    txHash: string | null;
  }>({
    checkedIn: false,
    checkedOut: false,
    checkInTime: '--:--',
    checkOutTime: '--:--',
    totalHours: '00:00',
    txHash: null,
  });

  const [isFaceSheetOpen, setIsFaceSheetOpen] = useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayDetailData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const getRingStatus = (): AttendanceRingState => {
    if (!attendanceState.checkedIn) return 'NOT_CHECKED_IN';
    if (attendanceState.checkedIn && !attendanceState.checkedOut) return 'CHECKED_IN';
    return 'COMPLETED';
  };

  const handleOpenFaceFlow = () => {
    setIsFaceSheetOpen(true);
  };

  const handleFaceSuccess = (data: { eventType: 'IN' | 'OUT'; scanTime: string; txHash: string }) => {
    if (data.eventType === 'IN') {
      setAttendanceState((prev) => ({
        ...prev,
        checkedIn: true,
        checkInTime: data.scanTime,
        txHash: data.txHash,
        totalHours: '00:15',
      }));
      showToast(`Presensi masuk berhasil dicatat pukul ${data.scanTime} WIB`);
    } else {
      setAttendanceState((prev) => ({
        ...prev,
        checkedOut: true,
        checkOutTime: data.scanTime,
        txHash: data.txHash,
        totalHours: '09:08',
      }));
      showToast(`Presensi pulang berhasil dicatat pukul ${data.scanTime} WIB`);
    }
  };

  const handleResetToday = () => {
    setAttendanceState({
      checkedIn: false,
      checkedOut: false,
      checkInTime: '--:--',
      checkOutTime: '--:--',
      totalHours: '00:00',
      txHash: null,
    });
    showToast('Presensi hari ini direset untuk simulasi.');
  };

  const openRecentDetail = () => {
    setSelectedDayDetail({
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
    });
  };

  return (
    <main className="flex-1 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-14 inset-x-4 z-50 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Container */}
      <div className="px-5 pt-4 pb-2">
        {/* Greeting Row */}
        <div className="flex justify-between items-center gap-3">
          <div>
            <p className="text-xs text-slate-500 font-medium">Selamat datang,</p>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-0.5">
              Febry Prasetyo
            </h1>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5 max-w-[240px] truncate">
              Project & Commissioning Engineer
            </p>
          </div>
          <Link
            href="/m/profile"
            className="w-12 h-12 rounded-full bg-[#d1fae5] border border-[#a7f3d0] flex items-center justify-center text-sm font-extrabold text-[#065f46] shadow-sm hover:scale-105 transition"
            aria-label="Buka profil Febry Prasetyo"
          >
            FP
          </Link>
        </div>

        {/* Today Heading & Status Badge */}
        <div className="flex flex-wrap justify-between items-center gap-2.5 mt-5 mb-3">
          <div>
            <p className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">
              Kamis, 22 Oktober 2026
            </p>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
              Presensi hari ini
            </h2>
          </div>

          {!attendanceState.checkedIn && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-300 text-amber-800 text-xs font-extrabold">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Belum Absen</span>
            </span>
          )}

          {attendanceState.checkedIn && !attendanceState.checkedOut && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#059669] text-xs font-extrabold">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Sudah Masuk</span>
            </span>
          )}

          {attendanceState.checkedIn && attendanceState.checkedOut && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#059669] text-xs font-extrabold">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Selesai Hari Ini</span>
            </span>
          )}
        </div>

        {/* Shift Panel */}
        <div className="flex items-center gap-2.5 border border-slate-200 rounded-2xl bg-white p-3 shadow-sm">
          <div className="p-2 bg-emerald-50 text-[#059669] rounded-xl">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <strong className="text-xs font-bold text-slate-900">Shift Pagi</strong>
            <p className="text-[11px] text-slate-500 mt-0.5">08:00 – 17:00 WIB</p>
          </div>
          <span className="ml-auto text-[10px] font-semibold text-slate-500">
            Kantor pusat
          </span>
        </div>
      </div>

      {/* Main Interactive Circle Action */}
      <PresensiRingButton
        status={getRingStatus()}
        onOpenFlow={handleOpenFaceFlow}
        officeName="PT Cahaya Mas Cemerlang"
        onResetDemo={handleResetToday}
        showResetDemo={attendanceState.checkedIn && attendanceState.checkedOut}
      />

      {/* 3 Metric Cards */}
      <div className="px-4 pb-3">
        <AttendanceMetricsCards
          checkInTime={attendanceState.checkInTime}
          checkInSub={attendanceState.checkedIn ? 'Tercatat server' : 'Jadwal 08:00'}
          checkOutTime={attendanceState.checkOutTime}
          checkOutSub={
            attendanceState.checkedOut
              ? 'Tercatat server'
              : attendanceState.checkedIn
              ? 'Menunggu pulang'
              : 'Jadwal 17:00'
          }
          totalHours={attendanceState.totalHours}
          totalSub="Hari ini"
        />
      </div>

      {/* Recent History Section */}
      <div className="px-4 pt-2">
        <div className="flex justify-between items-center mb-2.5">
          <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Presensi terakhir
          </h2>
          <Link
            href="/m/presensi"
            className="text-[11px] font-bold text-[#059669] flex items-center gap-1 hover:underline"
          >
            <span>Lihat semua</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        <button
          type="button"
          onClick={openRecentDetail}
          className="flex items-center text-left gap-2.5 w-full border border-slate-200 bg-white rounded-2xl p-3 shadow-sm hover:border-emerald-200 transition active:scale-[0.99]"
        >
          <div className="w-10 h-11 rounded-xl bg-slate-100 flex flex-col items-center justify-center shrink-0">
            <strong className="text-sm font-bold text-slate-900 leading-none">21</strong>
            <small className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">OKT</small>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <strong className="text-xs font-bold text-slate-900">Rabu, 21 Oktober</strong>
            <span className="text-[10px] font-mono text-slate-500">
              07:52 <span className="px-0.5">→</span> 17:04
            </span>
          </div>
          <span className="text-[10px] font-bold text-[#059669] bg-emerald-50 rounded-lg px-2 py-1 shrink-0">
            Tepat waktu
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      </div>

      {/* Install PWA Hint */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 mt-5 px-4 pb-2">
        <Smartphone className="w-3.5 h-3.5" />
        <span>Dirancang untuk akses cepat PWA dari layar utama.</span>
      </div>

      {/* Face Flow Sheet Dialog */}
      <FaceAttendanceSheet
        isOpen={isFaceSheetOpen}
        onClose={() => setIsFaceSheetOpen(false)}
        isCheckOut={attendanceState.checkedIn && !attendanceState.checkedOut}
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
