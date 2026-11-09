'use client';

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ChevronRight, ArrowUpRight, AlertCircle, Loader2, Monitor } from 'lucide-react';
import EmployeeGreeting from '@/components/mobile/EmployeeGreeting';
import AttendanceReview, { ApprovalBadge } from '@/components/mobile/AttendanceReview';
import AttendanceReceiptModal from '@/components/mobile/AttendanceReceiptModal';
import { useMobileRevalidation } from '@/hooks/useMobileEnvironment';
import PresensiRingButton from "@/components/mobile/PresensiRingButton";
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
  const { user } = useAuth();
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
  const [receipt, setReceipt] = useState<AttendanceReceipt | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const summaryRequest = useRef(0);
  const loadSummary = useCallback(async () => {
    const requestId = ++summaryRequest.current;
    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await fetchMobileSummary();
      if (requestId !== summaryRequest.current) return;
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
      if (requestId !== summaryRequest.current) return;
      console.warn("loadSummary error:", err);
      const msg = err.message || "";
      if (msg.includes("Password change required") || msg.includes("change-password")) {
        router.replace("/change-password");
        if (typeof window !== "undefined") {
          window.location.replace("/change-password");
        }
        return;
      }
      if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("token missing")) {
        router.push("/login");
        return;
      }
      setErrorBanner(msg || "Gagal memuat rekap presensi server.");
    } finally {
      if (requestId === summaryRequest.current) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setIsAuthenticated(false);
      router.replace("/login");
      return;
    }
    const storedUserStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    let storedUserMustChange = false;
    try {
      if (storedUserStr) {
        storedUserMustChange = Boolean(JSON.parse(storedUserStr).mustChangePassword);
      }
    } catch {
      // ignore JSON parse error
    }

    if (user?.mustChangePassword || storedUserMustChange) {
      router.replace("/change-password");
      if (typeof window !== "undefined") {
        window.location.replace("/change-password");
      }
      return;
    }

    setIsAuthenticated(true);
    loadSummary();
  }, [router, loadSummary, user]);

  const revalidate = useCallback(() => { if (isAuthenticated) void loadSummary(); }, [isAuthenticated, loadSummary]);
  useMobileRevalidation(revalidate);

  const isCheckoutCooldown = summaryData?.attendance.isCheckoutCooldown ?? false;
  const cooldownRemaining = summaryData?.attendance.cooldownRemainingMinutes ?? 0;

  const handleOpenFaceFlow = () => {
    if (loading || errorBanner || !summaryData) return;
    if (isCheckoutCooldown) {
      showToast(`Absen pulang baru dapat dilakukan minimal 30 menit setelah jam masuk (${summaryData?.attendance.checkInTime || ""}).`);
      return;
    }
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
    setReceipt(data);

    try {
      const clockRes = { success: true, data };

      if (clockRes.success) {
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
    <main className="flex-1 space-y-5 bg-slate-50 px-5 pb-6 pt-5">
      {toastMessage && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{toastMessage}</p>}
      {user?.roleName && user.roleName.toLowerCase() !== 'employee' && user.roleName.toLowerCase() !== 'karyawan' && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0">
              <Monitor size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">Mode Akses: Mobile HR</p>
              <p className="text-[11px] text-slate-500 truncate">Login sebagai {user.fullName || user.username}</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            Dashboard
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      <EmployeeGreeting employee={summaryData?.employee} timeZone={summaryData?.attendance.timeZone} completed={attendanceState.checkedOut} />
      {errorBanner && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{errorBanner}</span></div>}
      <PresensiRingButton
        status={attendanceState.checkedOut ? 'COMPLETED' : attendanceState.checkedIn ? 'CHECKED_IN' : 'NOT_CHECKED_IN'}
        onOpenFlow={handleOpenFaceFlow}
        disabled={loading || Boolean(errorBanner) || !summaryData}
        isCheckoutCooldown={isCheckoutCooldown}
        cooldownText={cooldownRemaining > 0 ? `Jeda pulang ${cooldownRemaining}m` : undefined}
        isCheckOutUpdate={attendanceState.checkedIn && attendanceState.checkedOut}
        shiftName={shiftName} schedule={shiftSchedule}
        timeZone={summaryData?.attendance.timeZone} workDate={summaryData?.attendance.workDate}
      />
      <AttendanceMetricsCards checkInTime={attendanceState.checkInTime} checkInSub={attendanceState.checkedIn ? 'Tercatat server' : 'Belum absen'} checkOutTime={attendanceState.checkOutTime} checkOutSub={attendanceState.checkedOut ? 'Tercatat server' : 'Menunggu pulang'} totalHours={attendanceState.totalHours} totalSub="Hari ini" />
      <AttendanceReview status={attendanceState.approvalStatus} note={attendanceState.approvalNote} recorded={attendanceState.checkedIn || attendanceState.checkedOut} />
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold text-slate-900">Presensi terakhir</h2><Link href="/m/presensi" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-emerald-700">Lihat semua<ArrowUpRight size={14} /></Link></div>
        {attendanceState.checkedIn || attendanceState.checkedOut ? <button type="button" onClick={openRecentDetail} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-600">
          <div className="min-w-0 flex-1 space-y-2"><p className="text-sm font-bold text-slate-900">{summaryData?.attendance.workDate}</p><p className="text-xs tabular-nums text-slate-600">{attendanceState.checkInTime} → {attendanceState.checkOutTime} · {attendanceState.totalHours}</p><ApprovalBadge status={attendanceState.approvalStatus} recorded={attendanceState.checkedIn || attendanceState.checkedOut} /></div><ChevronRight size={18} className="shrink-0 text-slate-400" />
        </button> : <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-700">Belum ada presensi hari ini</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Catatan mesin kantor akan tampil setelah tersinkron. Gunakan presensi mobile saat bertugas di luar kantor.</p></div>}
      </section>
      <FaceAttendanceSheet isOpen={isFaceSheetOpen} onClose={() => { setIsFaceSheetOpen(false); setSmartSelection(null); }} isCheckOut={smartSelection ? smartSelection.eventType === 'OUT' : attendanceState.checkedIn} isDirectOut={smartSelection?.isDirectOut ?? false} notes={smartSelection?.notes} isFaceEnrolled={summaryData?.faceEnrollment.isFaceEnrolled ?? false} employeeName={employeeName} employeeNik={summaryData?.employee.employeeCode || ''} onSuccess={handleFaceSuccess} />
      <SmartClockSelectionModal isOpen={isSmartModalOpen} onClose={() => setIsSmartModalOpen(false)} currentTimeStr={new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: summaryData?.attendance.timeZone })} scheduleIn={summaryData?.shift.scheduleIn} scheduleOut={summaryData?.shift.scheduleOut} onConfirm={handleSmartConfirm} />
      <DayDetailSheet isOpen={Boolean(selectedDayDetail)} onClose={() => setSelectedDayDetail(null)} onUpdated={() => { setSelectedDayDetail(null); void loadSummary(); }} data={selectedDayDetail} />
      <AttendanceReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </main>
  );
}
