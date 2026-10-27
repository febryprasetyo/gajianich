'use client';

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Clock,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  FileCheck2,
  CalendarCheck,
  XCircle,
  Clock4,
  MapPin,
  LogOut,
  Loader2,
} from "lucide-react";
import PresensiRingButton, { AttendanceRingState } from "@/components/mobile/PresensiRingButton";
import AttendanceMetricsCards from "@/components/mobile/AttendanceMetricsCards";
import SmartClockSelectionModal, { SmartClockSelectionResult } from "@/components/mobile/SmartClockSelectionModal";
import FaceAttendanceSheet, { type AttendanceReceipt } from "@/components/mobile/FaceAttendanceSheet";
import DayDetailSheet, { DayDetailData } from "@/components/mobile/DayDetailSheet";
import {
  fetchMobileSummary,
  MobileSummaryData,
} from "@/lib/attendance/mobileApi";

export default function MobileBerandaPage() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
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
    approvalStatus: string | null;
    approvalNote: string;
  }>({
    checkedIn: false,
    checkedOut: false,
    checkInTime: "--:--",
    checkOutTime: "--:--",
    totalHours: "--:--",
    txHash: null,
    approvalStatus: null,
    approvalNote: "Memuat status presensi...",
  });

  const [isFaceSheetOpen, setIsFaceSheetOpen] = useState(false);
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false);
  const [smartSelection, setSmartSelection] = useState<SmartClockSelectionResult | null>(null);
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
      const msg = err.message || "";
      if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("token missing")) {
        router.push("/login");
        return;
      }
      setErrorBanner(msg || "Gagal memuat rekap presensi server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setIsAuthenticated(false);
      router.replace("/login");
      return;
    }
    setIsAuthenticated(true);
    loadSummary();
  }, [router, loadSummary]);

  const getRingStatus = (): AttendanceRingState => {
    if (attendanceState.checkedOut) return "COMPLETED";
    if (attendanceState.checkedIn) return "CHECKED_IN";
    return "NOT_CHECKED_IN";
  };

  const handleOpenFaceFlow = () => {
    if (attendanceState.checkedIn && attendanceState.checkedOut) return;
    if (!attendanceState.checkedIn && !attendanceState.checkedOut && summaryData?.attendance.shiftWindow?.canDirectOut) {
      setIsSmartModalOpen(true);
      return;
    }
    setSmartSelection(null);
    setIsFaceSheetOpen(true);
  };

  const handleSmartConfirm = (result: SmartClockSelectionResult) => {
    setIsSmartModalOpen(false);
    setSmartSelection(result);
    setIsFaceSheetOpen(true);
  };

  const handleFaceSuccess = async (data: AttendanceReceipt) => {
    setIsFaceSheetOpen(false);

    try {
      const clockRes = { success: true, data };

      if (clockRes.success) {
        showToast(
          data.eventType === "IN"
            ? `Presensi masuk tercatat (${data.scanTime} ${data.timeZoneLabel})! ${clockRes.data.approvalNote}`
            : `Presensi pulang tercatat (${data.scanTime} ${data.timeZoneLabel})! ${clockRes.data.approvalNote}`
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
    if (!summaryData) return;
    setSelectedDayDetail({
      id: "D-TODAY",
      dayName: "Hari Ini",
      dateStr: summaryData.attendance.workDate,
      schedule: `${summaryData.shift.scheduleIn} – ${summaryData.shift.scheduleOut} ${summaryData.attendance.timeZoneLabel}`,
      status: summaryData.attendance.status === "COMPLETED" ? "COMPLETED" : summaryData.attendance.status === "CHECKED_IN" ? "CHECKED_IN" : "NOT_CHECKED_IN",
      statusText: summaryData.attendance.status === "COMPLETED" ? "Presensi lengkap" : summaryData.attendance.status === "CHECKED_IN" ? "Sudah absen masuk" : "Belum absen",
      checkIn: summaryData.attendance.checkInTime || "--:--",
      checkOut: summaryData.attendance.checkOutTime || "--:--",
      duration: summaryData.attendance.totalHours || "--:--",
      note: summaryData.attendance.approvalNote || "Presensi mobile mandiri.",
      serverRef: summaryData.attendance.txHash || "-",
      employeeName: summaryData.employee.fullName,
      approvalStatus: summaryData.attendance.approvalStatus,
      approvalNote: summaryData.attendance.approvalNote,
      events: summaryData.attendance.events,
    });
  };

  const employeeName = summaryData?.employee.fullName || "Karyawan";
  const employeePosition = summaryData?.employee.position || "Staff";
  const avatarInitial = summaryData?.employee.avatarInitial || "EM";
  const shiftName = summaryData?.shift.name || "Shift Reguler";
  const shiftSchedule = summaryData ? `${summaryData.shift.scheduleIn} – ${summaryData.shift.scheduleOut} ${summaryData.attendance.timeZoneLabel}` : "Jadwal mengikuti waktu lokal";

    if (isAuthenticated !== true) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#059669]" />
        <p className="text-xs text-slate-500 font-semibold">Memeriksa sesi login...</p>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-[#F8FAFC] pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}

      
      {/* Admin Notice Banner if logged in as Non-Employee */}
      {user && user.roleName && user.roleName.toLowerCase() !== "employee" && (
        <div className="mx-4 mt-2 mb-1 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <p className="text-[11px] leading-tight">
              Login sebagai <strong>{user.fullName || user.username}</strong> ({user.roleName})
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-[10px] font-extrabold text-blue-700 bg-white border border-blue-300 rounded-lg px-2 py-1 shadow-2xs hover:bg-blue-100 shrink-0 transition"
          >
            Buka Dashboard
          </Link>
        </div>
      )}

      
      {/* Admin Notice Banner if logged in as Non-Employee */}
      {user && user.roleName && user.roleName.toLowerCase() !== "employee" && (
        <div className="mx-4 mt-2 mb-1 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <p className="text-[11px] leading-tight">
              Login sebagai <strong>{user.fullName || user.username}</strong> ({user.roleName})
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-[10px] font-extrabold text-blue-700 bg-white border border-blue-300 rounded-lg px-2 py-1 shadow-2xs hover:bg-blue-100 shrink-0 transition"
          >
            Buka Dashboard
          </Link>
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
            onClick={logout}
            title="Keluar / Ganti Akun"
            aria-label="Keluar akun"
            className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
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
                <span>Disetujui</span>
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
            {!attendanceState.approvalStatus && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold">
                <span>Belum Ada Pengajuan</span>
              </span>
            )}
          </div>

          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/80 text-xs">
            <div className="flex justify-between items-center text-slate-700">
              <span className="text-slate-500 font-medium">Pengajuan Terakhir:</span>
              <span className="font-bold text-slate-900">
                {attendanceState.checkedIn ? `Masuk (${attendanceState.checkInTime} ${summaryData?.attendance.timeZoneLabel || ""})` : "Belum Ada"}
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
        disabled={attendanceState.checkedIn && attendanceState.checkedOut}
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

        {attendanceState.checkedIn ? (
          <button
            type="button"
            onClick={openRecentDetail}
            className="flex items-center text-left gap-2.5 w-full border border-slate-200 bg-white rounded-2xl p-3 shadow-sm hover:border-emerald-200 transition active:scale-[0.99] cursor-pointer"
          >
            <div className="w-10 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col items-center justify-center shrink-0">
              <strong className="text-sm font-bold text-[#059669] leading-none">
                {summaryData?.attendance.workDate ? new Date(summaryData.attendance.workDate).getDate() : "Hari Ini"}
              </strong>
              <small className="text-[8px] font-bold text-[#059669] uppercase mt-0.5">PRESENSI</small>
            </div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <strong className="text-xs font-bold text-slate-900">
                  {summaryData?.attendance.workDate || "Presensi Hari Ini"}
                </strong>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    attendanceState.approvalStatus === "APPROVED" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                  }`}
                  title={attendanceState.approvalStatus || undefined}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {attendanceState.checkInTime} <span className="px-0.5">→</span> {attendanceState.checkOutTime || "--:--"} ({attendanceState.totalHours || "--:--"})
              </span>
            </div>
            <span
              className={`text-[10px] font-bold rounded-lg px-2 py-1 shrink-0 border ${
                attendanceState.approvalStatus === "APPROVED"
                  ? "text-[#059669] bg-emerald-50 border-emerald-200"
                  : "text-amber-800 bg-amber-50 border-amber-200"
              }`}
            >
              {attendanceState.approvalStatus === "APPROVED" ? "Disetujui" : attendanceState.approvalStatus === "REJECTED" ? "Ditolak" : attendanceState.approvalStatus === "PENDING" ? "Menunggu HRD" : "Belum Ada"}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        ) : (
          <div className="p-4 rounded-2xl border border-slate-200 bg-white text-center space-y-1">
            <p className="text-xs font-bold text-slate-700">Belum ada catatan presensi hari ini</p>
            <p className="text-[11px] text-slate-500">Tekan tombol lingkaran di atas untuk merekam jam masuk Anda.</p>
          </div>
        )}
      </div>

      {/* Face Flow Sheet Dialog */}
      <FaceAttendanceSheet
        isOpen={isFaceSheetOpen}
        onClose={() => {
          setIsFaceSheetOpen(false);
          setSmartSelection(null);
        }}
        isCheckOut={smartSelection ? smartSelection.eventType === "OUT" : Boolean(attendanceState.checkedIn || attendanceState.checkedOut)}
        isDirectOut={smartSelection?.isDirectOut ?? false}
        notes={smartSelection?.notes}
        isOnline={true}
        isFaceEnrolled={summaryData?.faceEnrollment.isFaceEnrolled ?? false}
        employeeName={employeeName}
        employeeNik={summaryData?.employee.employeeCode || ""}
        onSuccess={handleFaceSuccess}
      />

      {/* Smart Clock Selection Modal */}
      <SmartClockSelectionModal
        isOpen={isSmartModalOpen}
        onClose={() => setIsSmartModalOpen(false)}
        currentTimeStr={new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        scheduleIn={summaryData?.shift.scheduleIn}
        scheduleOut={summaryData?.shift.scheduleOut}
        onConfirm={handleSmartConfirm}
      />

      {/* Day Detail Sheet Dialog */}
      <DayDetailSheet
        isOpen={Boolean(selectedDayDetail)}
        onClose={() => setSelectedDayDetail(null)}
        onUpdated={() => { setSelectedDayDetail(null); void loadSummary(); }}
        data={selectedDayDetail}
      />
    </main>
  );
}
