'use client';

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  MoreHorizontal,
  XCircle,
  ChevronDown,
  Clock,
  RefreshCw,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import PresensiRingButton from "@/components/mobile/PresensiRingButton";
import DayDetailSheet, { DayDetailData } from "@/components/mobile/DayDetailSheet";
import FaceAttendanceSheet from "@/components/mobile/FaceAttendanceSheet";
import {
  fetchMobileSummary,
  fetchMobileHistory,
  postMobileClock,
  MobileSummaryData,
  MobileHistoryItem,
} from "@/lib/attendance/mobileApi";

export default function MobilePresensiPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [summaryData, setSummaryData] = useState<MobileSummaryData | null>(null);
  const [historyItems, setHistoryItems] = useState<MobileHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFaceSheetOpen, setIsFaceSheetOpen] = useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState<DayDetailData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<"CURRENT" | "PREVIOUS">("CURRENT");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [sum, hist] = await Promise.all([
        fetchMobileSummary().catch(() => null),
        fetchMobileHistory(selectedPeriod).catch(() => null),
      ]);

      if (sum) setSummaryData(sum);
      if (hist) setHistoryItems(hist.records || []);
    } catch (err: any) {
      console.warn("loadData error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setIsAuthenticated(false);
      router.replace("/login");
      return;
    }
    setIsAuthenticated(true);
    loadData();
  }, [router, loadData]);

  const isCheckedIn = summaryData?.attendance.checkedIn ?? false;
  const isCheckedOut = summaryData?.attendance.checkedOut ?? false;

  const handleClockButtonClick = () => {
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
      const res = await postMobileClock({
        eventType: data.eventType,
        scanTime: data.scanTime,
        txHash: data.txHash,
        photoBase64: data.photoBase64,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        address: data.address,
      });

      if (res.success) {
        showToast(
          data.eventType === "IN"
            ? `Presensi masuk berhasil dicatat (${data.scanTime} WIB).`
            : `Presensi pulang berhasil dicatat (${data.scanTime} WIB).`
        );
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || "Gagal mencatat presensi.");
    }
  };

  const handleRowClick = (row: MobileHistoryItem) => {
    setSelectedDayDetail({
      id: String(row.id),
      dayName: row.dayShort,
      dateStr: `${row.dateStr} (${row.workDate})`,
      schedule: row.schedule,
      status: row.status,
      statusText: row.statusText,
      checkIn: row.clockIn,
      checkOut: row.clockOut,
      duration: row.workHours,
      note: row.approvalNote || "Presensi tercatat di sistem.",
      serverRef: row.serverRef,
      employeeName: row.employeeName || summaryData?.employee.fullName || "Karyawan",
      approvalStatus: row.approvalStatus,
      approvalNote: row.approvalNote,
      mapUrl: row.mapUrl,
      googleMapsUrl: row.googleMapsUrl,
      address: row.address,
      photoUrl: row.photoUrl,
    });
  };

  const todayStr = summaryData?.attendance.workDate || new Date().toISOString().slice(0, 10);

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
          onClick={loadData}
          aria-label="Segarkan data presensi"
          className="w-10 h-10 rounded-full bg-white border border-slate-200/90 shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#059669]" : ""}`} />
        </button>
      </header>

      {/* 2. Hero Action: Circular Face Scan Button (Shared with Beranda) */}
      <PresensiRingButton
        status={isCheckedOut ? "COMPLETED" : isCheckedIn ? "CHECKED_IN" : "NOT_CHECKED_IN"}
        onOpenFlow={handleClockButtonClick}
      />

      {/* 3. Today Summary Card: Clock In, Clock Out, Work Hours */}
      <section className="px-5 py-2">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm grid grid-cols-3 gap-2 text-center divide-x divide-slate-100">
          {/* Clock In */}
          <div className="px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Clock In
            </span>
            <p className="text-sm font-extrabold font-mono text-slate-800 mt-1">
              {summaryData?.attendance.checkInTime || "--:--"}
            </p>
          </div>

          {/* Clock Out */}
          <div className="px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Clock Out
            </span>
            <p className="text-sm font-extrabold font-mono text-slate-800 mt-1">
              {summaryData?.attendance.checkOutTime || "--:--"}
            </p>
          </div>

          {/* Work Hours */}
          <div className="px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Work Hours
            </span>
            <p className="text-sm font-extrabold font-mono text-slate-800 mt-1">
              {summaryData?.attendance.totalHours || "--:--"}
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
              onChange={(e) => setSelectedPeriod(e.target.value as "CURRENT" | "PREVIOUS")}
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
            {historyItems.length === 0 ? (
              <div className="py-8 px-4 text-center text-slate-400 text-xs font-medium">
                {loading ? "Memuat riwayat presensi..." : "Belum ada catatan presensi untuk periode ini."}
              </div>
            ) : (
              historyItems.map((row) => {
                const isToday = row.workDate === todayStr;

                return (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowClick(row);
                      }
                    }}
                    className={`px-3.5 py-3 grid grid-cols-12 items-center text-xs transition cursor-pointer hover:bg-slate-50/90 active:bg-slate-100/80 ${
                      isToday ? "bg-emerald-50/30" : ""
                    }`}
                  >
                    {/* Column 1: Date */}
                    <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                        {row.dayShort}
                      </span>
                      <strong className="text-xs font-extrabold text-slate-900 truncate">
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
              })
            )}
          </div>
        </div>

        <p className="text-[10px] text-center text-slate-400 mt-3">
          Ketuk baris tanggal untuk melihat detail presensi, peta lokasi, & status persetujuan HRD.
        </p>
      </section>

      {/* Face Flow Sheet Dialog */}
      <FaceAttendanceSheet
        isOpen={isFaceSheetOpen}
        onClose={() => setIsFaceSheetOpen(false)}
        isCheckOut={isCheckedIn && !isCheckedOut}
        isOnline={true}
        isFaceEnrolled={summaryData?.faceEnrollment.isFaceEnrolled ?? true}
        employeeName={summaryData?.employee.fullName || "Karyawan"}
        employeeNik={summaryData?.employee.employeeCode || ""}
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
