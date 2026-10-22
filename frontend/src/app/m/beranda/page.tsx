'use client';

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
  MapPin,
  RefreshCw,
} from "lucide-react";
import PresensiRingButton, { AttendanceRingState } from "@/components/mobile/PresensiRingButton";
import AttendanceMetricsCards from "@/components/mobile/AttendanceMetricsCards";
import FaceAttendanceSheet from "@/components/mobile/FaceAttendanceSheet";
import DayDetailSheet, { DayDetailData } from "@/components/mobile/DayDetailSheet";
import {
  fetchMobileSummary,
  postMobileClock,
  MobileSummaryData,
} from "@/lib/attendance/mobileApi";

export default function MobileBerandaPage() {
  const [summaryData, setSummaryData] = useState<MobileSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [attendanceState, setAttendanceState] = useState<{
    checkedIn: boolean;
    checkedOut: boolean;
    checkInTime: string;
    checkOutTime: string;
    totalHours: string;
    txHash: string | null;
    approvalStatus: string;
    approvalNote: string;
  }>({
    checkedIn: false,
    checkedOut: false,
    checkInTime: "--:--",
    checkOutTime: "--:--",
    totalHours: "--:--",
    txHash: null,
    approvalStatus: "PENDING",
    approvalNote: "Memuat status presensi...",
  });

  const [isFaceSheetOpen, setIsFaceSheetOpen] = useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayDetailData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await fetchMobileSummary();
      setSummaryData(res);
      setAttendanceState({
        checkedIn: res.attendance.checkedIn,
        checkedOut: res.attendance.checkedOut,
        checkInTime: res.attendance.checkInTime || "--:--",
        checkOutTime: res.attendance.checkOutTime || "--:--",
        totalHours: res.attendance.totalHours || "--:--",
        txHash: res.attendance.txHash,
        approvalStatus: res.attendance.approvalStatus,
        approvalNote: res.attendance.approvalNote,
      });
    } catch (err: any) {
      console.warn("loadSummary error:", err);
      setErrorBanner(err.message || "Gagal memuat rekap presensi server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const getRingStatus = (): AttendanceRingState => {
    if (!attendanceState.checkedIn) return "NOT_CHECKED_IN";
    if (attendanceState.checkedIn && !attendanceState.checkedOut) return "CHECKED_IN";
    return "COMPLETED";
  };

  const handleOpenFaceFlow = () => {
    setIsFaceSheetOpen(true);
  };

  const handleFaceSuccess = async (data: {
    eventType: "IN" | "OUT";
    scanTime: string;
    txHash: string;
    photoBase64?: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
    address?: string | null;
  }) => {
    setIsFaceSheetOpen(false);

    try {
      const clockRes = await postMobileClock({
        eventType: data.eventType,
        scanTime: data.scanTime,
        txHash: data.txHash,
        photoBase64: data.photoBase64,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        address: data.address,
      });

      if (clockRes.success) {
        showToast(
          data.eventType === "IN"
            ? `Presensi masuk tercatat (${data.scanTime} WIB)! ${clockRes.data.approvalNote}`
            : `Presensi pulang tercatat (${data.scanTime} WIB)! ${clockRes.data.approvalNote}`
        );
        // Refresh server summary
        await loadSummary();
      }
    } catch (err: any) {
      console.error("Presensi gagal disimpan:", err);
      showToast(err.message || "Presensi gagal disimpan ke server.");
    }
  };

  const openRecentDetail = () => {
    setSelectedDayDetail({
      id: "D-RECENT",
      dayName: "Kemarin",
      dateStr: "21 Oktober 2026",
      schedule: summaryData ? `${summaryData.shift.scheduleIn} – ${summaryData.shift.scheduleOut} WIB` : "08:00 – 17:00 WIB",
      status: "TEPAT_WAKTU",
      statusText: "Hadir Tepat Waktu",
      checkIn: "07:52",
      checkOut: "17:04",
      duration: "09h 12m",
      note: "Presensi mobile terverifikasi sistem dan disetujui HRD.",
      serverRef: "TX-GJN-20261021-992",
      employeeName: summaryData?.employee.fullName || "Karyawan",
      approvalStatus: "APPROVED",
      approvalNote: "Presensi telah diverifikasi & disetujui HRD Pusat.",
    });
  };

  const employeeName = summaryData?.employee.fullName || "Karyawan";
  const employeePosition = summaryData?.employee.position || "Staff";
  const avatarInitial = summaryData?.employee.avatarInitial || "EM";
  const shiftName = summaryData?.shift.name || "Shift Reguler";
  const shiftSchedule = summaryData ? `${summaryData.shift.scheduleIn} – ${summaryData.shift.scheduleOut} WIB` : "08:00 – 17:00 WIB";
  const officeLocation = summaryData?.employee.workLocation || "PT Cahaya Mas Cemerlang HQ";

  return (
    <main className="flex-1 flex flex-col bg-[#F8FAFC] pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}

      {/* Header Info Karyawan */}
      <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-full bg-[#d1fae5] border border-[#a7f3d0] flex items-center justify-center text-sm font-extrabold text-[#065f46]">
            {avatarInitial}
          </span>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 leading-tight">
              {employeeName}
            </h1>
            <p className="text-[11px] font-semibold text-slate-600">
              {employeePosition}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSummary}
            aria-label="Refresh status presensi"
            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 active:scale-95 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#059669]" : ""}`} />
          </button>
          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-[#059669] border border-emerald-200 tracking-wider">
            PORTAL
          </span>
        </div>
      </div>

      {/* Error / Account Linking Banner */}
      {errorBanner && (
        <div className="mx-4 mt-2 mb-1 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-extrabold block">Akses Akun Presensi</strong>
            <p className="text-[11px] leading-relaxed text-amber-800">{errorBanner}</p>
          </div>
        </div>
      )}

      {/* Tanggal & Shift Information */}
      <div className="px-4 py-2 space-y-2">
        <div className="border border-slate-200 rounded-2xl bg-white p-3.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              Hari Ini
            </span>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                attendanceState.checkedOut
                  ? "bg-slate-100 text-slate-700 border-slate-300"
                  : attendanceState.checkedIn
                  ? "bg-emerald-50 text-[#059669] border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              {attendanceState.checkedOut
                ? "Selesai Hari Ini"
                : attendanceState.checkedIn
                ? "Sudah Masuk"
                : "Belum Absen"}
            </span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <div>
              <p className="text-xs font-extrabold text-slate-900">{shiftName}</p>
              <p className="text-[11px] font-mono font-bold text-slate-600 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-[#059669]" />
                <span>{shiftSchedule}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                Lokasi Kantor
              </span>
              <p className="text-[11px] font-bold text-slate-700 truncate max-w-[150px]">
                {officeLocation}
              </p>
            </div>
          </div>
        </div>

        {/* REQUEST STATUS ABSENSI (Review HRD) */}
        <div className="border border-slate-200 rounded-2xl bg-white p-3.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-[#059669]" />
              <span>Status Request Absensi</span>
            </span>
            {attendanceState.approvalStatus === "APPROVED" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[#059669] text-[11px] font-extrabold">
                <CheckCircle2 className="w-3 h-3" />
                <span>Disetujui HRD</span>
              </span>
            )}
            {attendanceState.approvalStatus === "PENDING" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-extrabold">
                <Clock className="w-3 h-3 animate-pulse text-amber-600" />
                <span>Menunggu Review HRD</span>
              </span>
            )}
            {attendanceState.approvalStatus === "REJECTED" && (
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
                {attendanceState.checkedIn ? `Masuk (${attendanceState.checkInTime} WIB)` : "Belum Ada"}
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
      />

      {/* 3 Metric Cards Hari Ini */}
      <div className="px-4 pb-2">
        <AttendanceMetricsCards
          checkInTime={attendanceState.checkInTime}
          checkInSub={attendanceState.checkedIn ? "Tercatat server" : "Belum absen"}
          checkOutTime={attendanceState.checkOutTime}
          checkOutSub={
            attendanceState.checkedOut
              ? "Tercatat server"
              : attendanceState.checkedIn
              ? "Menunggu pulang"
              : "Belum absen"
          }
          totalHours={attendanceState.totalHours}
          totalSub="Hari ini"
        />
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
            <span>Buka riwayat lengkap</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        <button
          type="button"
          onClick={openRecentDetail}
          className="flex items-center text-left gap-2.5 w-full border border-slate-200 bg-white rounded-2xl p-3 shadow-sm hover:border-emerald-200 transition active:scale-[0.99] cursor-pointer"
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
        isFaceEnrolled={summaryData?.faceEnrollment.isFaceEnrolled ?? true}
        employeeName={employeeName}
        employeeNik={summaryData?.employee.employeeCode || "CMC-2024-089"}
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
