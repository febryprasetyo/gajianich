'use client';

import React, { useState, useEffect, useRef } from "react";
import { extractCanvasFaceDescriptor } from "@/lib/attendance/faceMatcher";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  ScanFace,
  CheckCircle2,
  Camera,
  History,
  Server,
  LogOut,
  RefreshCw,
} from "lucide-react";
import LogoutSheet from "@/components/mobile/LogoutSheet";
import {
  fetchMobileSummary,
  postEnrollFace,
  MobileSummaryData,
} from "@/lib/attendance/mobileApi";

export default function MobileProfilePage() {
  const router = useRouter();
  const [summaryData, setSummaryData] = useState<MobileSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFaceEnrolled, setIsFaceEnrolled] = useState(true);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await fetchMobileSummary();
      setSummaryData(res);
      setIsFaceEnrolled(res.faceEnrollment.isFaceEnrolled);
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("token missing")) {
        router.push("/login");
        return;
      }
      console.warn("loadProfile error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleEnrollNow = () => {
    if (photoInputRef.current) {
      photoInputRef.current.click();
    }
  };

  const handlePhotoCaptured = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast("Memproses foto & biometrik wajah...");
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(img.width, 800);
          canvas.height = Math.min(img.height, 800);
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL("image/jpeg", 0.8);
          const descriptor = extractCanvasFaceDescriptor(canvas);

          const res = await postEnrollFace({
            isEnrolled: true,
            faceDescriptor: descriptor,
            samplePhotoBase64: base64,
          });

          setIsFaceEnrolled(res.isEnrolled);
          showToast("✓ Foto & biometrik wajah berhasil didaftarkan secara riil!");
          await loadProfile();
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      showToast(err.message || "Gagal mendaftarkan biometrik wajah.");
    }
  };

  const toggleFaceEnrollment = async () => {
    try {
      const nextState = !isFaceEnrolled;
      const res = await postEnrollFace({ isEnrolled: nextState });
      setIsFaceEnrolled(res.isEnrolled);
      showToast(res.isEnrolled ? "Biometrik wajah: Terdaftar & Aktif" : "Biometrik wajah dinonaktifkan.");
    } catch (err: any) {
      showToast(err.message || "Gagal mengubah status wajah.");
    }
  };

  const handleConfirmLogout = () => {
    setIsLogoutOpen(false);
    try {
      localStorage.removeItem("token");
    } catch {
      // Ignore
    }
    router.push("/login");
  };

  const employeeName = summaryData?.employee.fullName || "Karyawan";
  const employeePosition = summaryData?.employee.position || "Staff";
  const employeeNik = summaryData?.employee.employeeCode || "-";
  const departmentName = summaryData?.employee.department || "Departemen";
  const locationName = summaryData?.employee.workLocation || "Kantor Utama";
  const avatarInitial = summaryData?.employee.avatarInitial || "FP";
  const faceId = summaryData?.faceEnrollment.faceId || "BIO-CMC-089-V3";

  return (
    <main className="flex-1 flex flex-col bg-[#F8FAFC] pb-10">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handlePhotoCaptured}
        className="hidden"
        aria-hidden="true"
      />
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}

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
          <h1 className="text-lg font-extrabold tracking-tight">Profil Karyawan</h1>
          <button
            type="button"
            onClick={loadProfile}
            aria-label="Muat ulang profil"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center transition"
          >
            <RefreshCw className={`w-4 h-4 text-white ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-3.5">
        {/* Identitas Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col items-center text-center pb-4 border-b border-slate-200">
            <div className="relative">
              <span className="w-20 h-20 rounded-full bg-[#d1fae5] border border-[#a7f3d0] flex items-center justify-center text-2xl font-extrabold text-[#065f46]">
                {avatarInitial}
              </span>
              <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#059669] text-white border-2 border-white flex items-center justify-center shadow-sm">
                <BadgeCheck className="w-3.5 h-3.5" />
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 mt-3">{employeeName}</h2>
            <p className="text-xs font-semibold text-slate-600">{employeePosition}</p>
          </div>

          <div className="divide-y divide-slate-100 text-xs pt-2">
            <div className="py-2.5 flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500 shrink-0">NIK Karyawan</span>
              <span className="font-mono font-extrabold text-slate-900 text-right">{employeeNik}</span>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500 shrink-0">Departemen</span>
              <span className="font-bold text-slate-900 text-right">{departmentName}</span>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500 shrink-0">Jabatan</span>
              <span className="font-bold text-slate-900 text-right">{employeePosition}</span>
            </div>
            <div className="py-2.5 flex items-start justify-between gap-3">
              <span className="font-semibold text-slate-500 shrink-0">Lokasi Kerja</span>
              <span className="font-bold text-slate-900 text-right">{locationName}</span>
            </div>
          </div>
        </div>

        {/* Status Biometrik Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-[#059669] flex items-center justify-center shrink-0">
                <ScanFace className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-900">Status Pendaftaran Wajah</h3>
                <p className="text-[11px] text-slate-500">Verifikasi 1:1 & Anti-Spoofing</p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold ${
                isFaceEnrolled
                  ? "bg-emerald-50 border-emerald-200 text-[#059669]"
                  : "bg-rose-50 border-rose-200 text-rose-700"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isFaceEnrolled ? "Terdaftar" : "Belum Terdaftar"}</span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span>ID Wajah Sistem:</span>
              <span className="font-mono font-bold text-slate-900">{faceId}</span>
            </div>
            <div className="flex justify-between">
              <span>Proteksi Keaktifan:</span>
              <span className="font-bold text-[#059669]">Aktif (Anti-Spoofing)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleEnrollNow}
              className="min-h-[46px] px-3 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Perbarui Wajah</span>
            </button>
            <button
              type="button"
              onClick={toggleFaceEnrollment}
              className="min-h-[46px] px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span>{isFaceEnrolled ? "Nonaktifkan" : "Aktifkan"}</span>
            </button>
          </div>
        </div>

        {/* Navigation & Logout Links */}
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
          <Link
            href="/m/presensi"
            className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-[#059669]" />
              <div>
                <p className="text-xs font-bold text-slate-900">Riwayat Kehadiran Pribadi</p>
                <p className="text-[11px] text-slate-500">Lihat catatan masuk, pulang, dan jam kerja</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </Link>

          <div className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-[#059669]" />
              <div>
                <p className="text-xs font-bold text-slate-900">Akses PWA Mandiri</p>
                <p className="text-[11px] text-slate-500">Aplikasi Web Progresif (Tanpa APK)</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-[#059669] border border-emerald-200 text-[10px] font-bold">
              Standalone
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsLogoutOpen(true)}
            className="w-full min-h-[54px] px-4 py-3.5 flex items-center justify-between text-left bg-rose-50/60 hover:bg-rose-100/70 text-rose-700 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-rose-600" />
              <span className="text-xs font-extrabold">Keluar akun</span>
            </div>
            <ChevronRight className="w-4 h-4 text-rose-500" />
          </button>
        </div>
      </div>

      {/* Logout Confirmation Sheet */}
      <LogoutSheet
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleConfirmLogout}
      />
    </main>
  );
}
