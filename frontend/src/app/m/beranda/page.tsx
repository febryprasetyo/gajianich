'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  FileCheck2,
  CalendarCheck,
  XCircle,
  Clock4,
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
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    approvalNote: string;
  }>({
    checkedIn: true,
    checkedOut: false,
    checkInTime: '07:55',
    checkOutTime: '--:--',
    totalHours: '04:15',
    txHash: 'TX-GJN-20261022-772',
    approvalStatus: 'PENDING',
    approvalNote: 'Menunggu review & approval tim HRD Pusat.',
  });

  const [isFaceSheetOpen, setIsFaceSheetOpen] = useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayDetailData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
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
    setIsFaceSheetOpen(false);

    if (data.eventType === 'IN') {
      setAttendanceState((prev) => ({
        ...prev,
        checkedIn: true,
        checkInTime: data.scanTime,
        txHash: data.txHash,
        approvalStatus: 'PENDING',
        approvalNote: 'Pengajuan presensi masuk dikirim ke HRD untuk di-review.',
      }));
      showToast(`Presensi masuk dicatat (${data.scanTime} WIB), diteruskan ke review HRD`);
    } else {
      setAttendanceState((prev) => ({
        ...prev,
        checkedOut: true,
        checkOutTime: data.scanTime,
        txHash: data.txHash,
        totalHours: '09:08',
        approvalStatus: 'PENDING',
        approvalNote: 'Pengajuan presensi pulang dikirim ke HRD untuk di-review.',
      }));
      showToast(`Presensi pulang dicatat (${data.scanTime} WIB), diteruskan ke review HRD`);
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
      approvalStatus: 'PENDING',
      approvalNote: 'Belum ada pengajuan presensi hari ini.',
    });
    showToast('Presensi hari ini direset untuk simulasi.');
  };

  const openRecentDetail = () => {
    setSelectedDayDetail({
      id: 'D-20261021',
      dayName: 'Rabu',
      dateStr: '21 Oktober 2026',
      status: 'TEPAT_WAKTU',
      statusText: 'Hadir Tepat Waktu',
      checkIn: '07:52',
      checkOut: '17:04',
      duration: '09j 12m',
      note: 'Presensi verifikasi biometrik wajah valid di area kantor.',
      serverRef: 'TX-GJN-20261021-104',
      employeeName: 'Febry Prasetyo',
      approvalStatus: 'APPROVED',
      approvalNote: 'Telah disetujui HRD (Auto-matched dengan log GPS kantor).',
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
        <div className="flex flex-wrap justify-between items-center gap-2.5 mt-5 mb-2.5">
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

        {/* REQUEST STATUS ABSENSI (Review HRD) */}
        <div className="border border-slate-200 rounded-2xl bg-white p-3.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-[#059669]" />
              <span>Status Request Absensi</span>
            </span>
            {attendanceState.approvalStatus === 'APPROVED' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[#059669] text-[11px] font-extrabold">
                <CheckCircle2 className="w-3 h-3" />
                <span>Disetujui HRD</span>
              </span>
            )}
            {attendanceState.approvalStatus === 'PENDING' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-extrabold">
                <Clock className="w-3 h-3 animate-pulse text-amber-600" />
                <span>Menunggu Review HRD</span>
              </span>
            )}
            {attendanceState.approvalStatus === 'REJECTED' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-extrabold">
                <XCircle className="w-3 h-3" />
                <span>Ditolak HRD</span>
              </span>
            )}
          </div>

          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/80 text-xs">
            <div className="flex justify-between items-center text-slate-700">
              <span className="text-slate-500 font-medium">Pengajuan Terakhir:</span>
              <span className="font-bold text-slate-900">
                {attendanceState.checkedIn ? `Masuk (${attendanceState.checkInTime} WIB)` : 'Belum Ada'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1.5 leading-snug">
              <strong className="font-bold text-slate-800">Catatan: </strong>
              {attendanceState.approvalNote}
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Circle Action */}
      <PresensiRingButton
        status={getRingStatus()}
        onOpenFlow={handleOpenFaceFlow}
        onResetDemo={handleResetToday}
        showResetDemo={attendanceState.checkedIn}
      />

      {/* 3 Metric Cards Hari Ini */}
      <div className="px-4 pb-2">
        <AttendanceMetricsCards
          checkInTime={attendanceState.checkInTime}
          checkInSub={attendanceState.checkedIn ? 'Tercatat server' : 'Belum absen'}
          checkOutTime={attendanceState.checkOutTime}
          checkOutSub={
            attendanceState.checkedOut
              ? 'Tercatat server'
              : attendanceState.checkedIn
              ? 'Menunggu pulang'
              : 'Belum absen'
          }
          totalHours={attendanceState.totalHours}
          totalSub="Hari ini"
        />
      </div>

      {/* REKAPAN ABSENSI DALAM PERIODE PAYROLL */}
      <div className="px-4 pt-2">
        <div className="border border-slate-200 bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                Rekap Periode Payroll Aktif
              </span>
              <h3 className="text-xs font-extrabold text-slate-900 mt-0.5">
                21 Sep 2026 – 20 Okt 2026
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#059669] border border-emerald-200">
              22 Hari Kerja
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            {/* Total Absensi */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Absen</span>
              <p className="text-base font-extrabold font-mono text-slate-900 mt-0.5">22</p>
              <span className="text-[9px] text-slate-500 font-semibold">100% Tercatat</span>
            </div>

            {/* Disetujui */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Disetujui</span>
              <p className="text-base font-extrabold font-mono text-[#059669] mt-0.5">20</p>
              <span className="text-[9px] text-emerald-700 font-semibold">Valid Payroll</span>
            </div>

            {/* Ditolak */}
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-2.5">
              <span className="text-[10px] font-bold text-rose-800 uppercase block">Ditolak</span>
              <p className="text-base font-extrabold font-mono text-rose-700 mt-0.5">1</p>
              <span className="text-[9px] text-rose-600 font-semibold">1 Menunggu</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent History Section */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex justify-between items-center mb-2.5">
          <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Presensi Terakhir
          </h2>
          <Link
            href="/m/presensi"
            className="text-[11px] font-bold text-[#059669] flex items-center gap-1 hover:underline"
          >
            <span>Buka log lengkap</span>
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
            <div className="flex items-center gap-1.5">
              <strong className="text-xs font-bold text-slate-900">Rabu, 21 Oktober</strong>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Disetujui HRD" />
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              07:52 <span className="px-0.5">→</span> 17:04 (09j 12m)
            </span>
          </div>
          <span className="text-[10px] font-bold text-[#059669] bg-emerald-50 rounded-lg px-2 py-1 shrink-0 border border-emerald-200">
            Disetujui
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      </div>

      {/* Install PWA Hint */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 mt-3 px-4 pb-4">
        <Smartphone className="w-3.5 h-3.5" />
        <span>GAJIANICH PWA — Akses presensi mandiri karyawan</span>
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
