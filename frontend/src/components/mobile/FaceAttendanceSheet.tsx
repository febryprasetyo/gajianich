'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  Check,
  MapPin,
  Clock,
  Camera,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCheck,
} from 'lucide-react';

export type CameraScenario =
  | 'NORMAL'
  | 'CAMERA_DENIED'
  | 'FACE_NOT_ENROLLED'
  | 'VERIFY_FAILED'
  | 'NETWORK_OFFLINE'
  | 'ALREADY_RECORDED';

interface FaceAttendanceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isCheckOut?: boolean;
  isOnline?: boolean;
  isFaceEnrolled?: boolean;
  employeeName?: string;
  employeeNik?: string;
  onSuccess: (data: {
    eventType: 'IN' | 'OUT';
    scanTime: string;
    txHash: string;
    photoBase64?: string;
  }) => void;
}

export default function FaceAttendanceSheet({
  isOpen,
  onClose,
  isCheckOut = false,
  isOnline = true,
  isFaceEnrolled = true,
  employeeName = 'Febry Prasetyo',
  employeeNik = 'CMC-2024-089',
  onSuccess,
}: FaceAttendanceSheetProps) {
  const [viewState, setViewState] = useState<'CAMERA' | 'PROCESSING' | 'ERROR' | 'SUCCESS'>('CAMERA');
  const [scenario, setScenario] = useState<CameraScenario>('NORMAL');
  const [errorType, setErrorType] = useState<CameraScenario | null>(null);
  const [receipt, setReceipt] = useState<{ time: string; hash: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasRealCamera, setHasRealCamera] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Live dynamic clock: HH : mm
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState('09 : 12');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setCurrentTimeFormatted(`${hh} : ${mm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setHasRealCamera(false);
    setCameraLoading(false);
  };

  const triggerError = (type: CameraScenario) => {
    stopCamera();
    setErrorType(type);
    setViewState('ERROR');
  };

  const startCamera = async () => {
    setCameraLoading(true);
    setCameraNote(null);

    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
      setCameraLoading(false);
      setCameraNote('Kamera asli memerlukan HTTPS. Mode simulasi wajah aktif.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraLoading(false);
      setCameraNote('Browser tidak mendukung akses kamera langsung.');
      return;
    }

    try {
      const streamPromise = navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('CAMERA_TIMEOUT')), 5000)
      );

      const stream = await Promise.race([streamPromise, timeoutPromise]);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        setHasRealCamera(true);
      }
      setCameraLoading(false);
    } catch (err: unknown) {
      stopCamera();
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        triggerError('CAMERA_DENIED');
      } else {
        setCameraNote('Kamera tidak dapat diakses. Menggunakan simulasi wajah.');
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setViewState('CAMERA');
      setErrorType(null);
      setReceipt(null);
      setCameraNote(null);

      if (!isOnline) {
        triggerError('NETWORK_OFFLINE');
        return;
      }
      if (!isFaceEnrolled) {
        triggerError('FACE_NOT_ENROLLED');
        return;
      }
      if (scenario === 'CAMERA_DENIED') {
        triggerError('CAMERA_DENIED');
        return;
      }
      if (scenario === 'ALREADY_RECORDED') {
        triggerError('ALREADY_RECORDED');
        return;
      }
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const handleClockInAction = () => {
    if (!isOnline) {
      triggerError('NETWORK_OFFLINE');
      return;
    }

    setViewState('PROCESSING');

    setTimeout(() => {
      if (scenario === 'VERIFY_FAILED') {
        triggerError('VERIFY_FAILED');
        return;
      }

      setTimeout(() => {
        stopCamera();

        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const scanTimeShort = `${hh}:${mm}`;
        const scanTimeFull = `${hh}:${mm}:${ss} WIB`;
        const txHash = `TX-GJN-20261022-${Math.floor(100 + Math.random() * 899)}`;

        setReceipt({ time: scanTimeFull, hash: txHash });
        setViewState('SUCCESS');

        onSuccess({
          eventType: isCheckOut ? 'OUT' : 'IN',
          scanTime: scanTimeShort,
          txHash,
        });
      }, 700);
    }, 700);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendanceModalTitle"
      className="fixed inset-0 sm:absolute sm:inset-0 z-50 bg-slate-950 flex flex-col justify-between overflow-hidden animate-in fade-in duration-200"
    >
      <style jsx>{`
        @keyframes laserSweep {
          0% {
            transform: translateY(10px);
            opacity: 0.7;
          }
          50% {
            transform: translateY(195px);
            opacity: 1;
          }
          100% {
            transform: translateY(10px);
            opacity: 0.7;
          }
        }
        .animate-laser {
          animation: laserSweep 2.6s ease-in-out infinite;
        }
      `}</style>

      {/* BACKGROUND CAMERA / SIMULATION FEED */}
      <div className="absolute inset-0 z-0 bg-slate-900">
        {hasRealCamera ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />
        ) : (
          <div className="relative w-full h-full">
            <Image
              src="/images/mock-face-scan.jpg"
              alt="Face scan preview"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          </div>
        )}

        {/* Soft vignette gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
      </div>

      {/* TOP BAR OVERLAY */}
      <div className="relative z-10 px-4 pt-4 sm:pt-6 flex items-center justify-between gap-2">
        {/* Back Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Kembali ke Beranda"
          className="w-10 h-10 rounded-full bg-white/40 backdrop-blur-md border border-white/30 text-white flex items-center justify-center shadow-md active:scale-95 transition"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* Status Pill Badge */}
        <div className="px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-md flex items-center gap-1.5 max-w-[calc(100%-96px)]">
          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </span>
          <span className="text-[11px] font-semibold text-slate-700 truncate">
            You have entered at absence zone
          </span>
        </div>

        {/* Camera Toggle Button */}
        <button
          type="button"
          onClick={hasRealCamera ? stopCamera : startCamera}
          disabled={cameraLoading}
          aria-label="Alihkan Kamera"
          title={hasRealCamera ? 'Gunakan Simulasi' : 'Gunakan Kamera Fisik'}
          className="w-10 h-10 rounded-full bg-white/40 backdrop-blur-md border border-white/30 text-white flex items-center justify-center shadow-md active:scale-95 transition disabled:opacity-50"
        >
          {cameraLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Camera className="w-4 h-4 text-white" />
          )}
        </button>
      </div>

      {/* CENTER: FACE SCANNER VIEWPORT */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-2 pointer-events-none">
        <div className="relative w-[250px] h-[280px] sm:w-[270px] sm:h-[300px] flex items-center justify-center">
          {/* Rounded Corner SVG Frame */}
          <svg
            viewBox="0 0 260 290"
            className="w-full h-full drop-shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Top Left */}
            <path
              d="M 14 74 L 14 46 A 34 34 0 0 1 48 12 L 76 12"
              stroke="white"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            {/* Top Right */}
            <path
              d="M 184 12 L 212 12 A 34 34 0 0 1 246 46 L 246 74"
              stroke="white"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            {/* Bottom Right */}
            <path
              d="M 246 216 L 246 244 A 34 34 0 0 1 212 278 L 184 278"
              stroke="white"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            {/* Bottom Left */}
            <path
              d="M 76 278 L 48 278 A 34 34 0 0 1 14 244 L 14 216"
              stroke="white"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Laser Scan Beam */}
          <div className="absolute inset-x-3 top-2 h-16 animate-laser pointer-events-none overflow-hidden">
            <div className="w-full h-full bg-gradient-to-b from-sky-400/40 via-sky-500/20 to-transparent" />
            <div className="w-full h-[2.5px] bg-[#1d63ff] shadow-[0_0_12px_#38bdf8]" />
          </div>

          {/* Status badge when camera note is present */}
          {cameraNote && (
            <div className="absolute bottom-2 inset-x-2 text-center pointer-events-auto">
              <span className="inline-block px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-sm text-[10px] text-white font-medium">
                {cameraNote}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM FLOATING CARD */}
      <div className="relative z-10 w-full p-3 sm:p-4">
        <div className="bg-white rounded-[28px] shadow-2xl p-5 border border-slate-100 flex flex-col gap-4 max-w-md mx-auto animate-in slide-in-from-bottom duration-300">
          {/* Card Title */}
          <h2
            id="attendanceModalTitle"
            className="text-center font-extrabold text-slate-900 text-base tracking-tight"
          >
            {isCheckOut ? 'Clock Out' : 'Clock In'}
          </h2>

          {/* Location & Time Grid */}
          <div className="grid grid-cols-2 gap-3 text-center">
            {/* Current Location */}
            <div className="flex flex-col items-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Current Location</span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 text-center mt-1.5 leading-snug">
                Head Quarter Jakarta - Lobby
              </p>
            </div>

            {/* Current Time */}
            <div className="flex flex-col items-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Current Time</span>
              </div>
              <p className="text-sm font-bold text-slate-800 text-center mt-1.5 font-mono tracking-wider">
                {currentTimeFormatted}
              </p>
            </div>
          </div>

          {/* Main Action Button */}
          {viewState === 'CAMERA' && (
            <button
              type="button"
              onClick={handleClockInAction}
              className="w-full min-h-[50px] py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#1967d2] via-[#1a73e8] to-[#1e88e5] hover:from-[#1557b0] hover:to-[#1967d2] text-white font-extrabold text-base shadow-lg shadow-blue-500/25 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <span>{isCheckOut ? 'Clock Out' : 'Clock In'}</span>
            </button>
          )}

          {/* Processing View */}
          {viewState === 'PROCESSING' && (
            <div className="py-2 flex flex-col items-center justify-center gap-2 text-center">
              <div className="flex items-center justify-center gap-2 text-blue-600 font-bold text-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Memverifikasi Wajah...</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Pencocokan biometrik dan koordinat lokasi kantor
              </p>
            </div>
          )}

          {/* Error View */}
          {viewState === 'ERROR' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">
                    {errorType === 'CAMERA_DENIED' && 'Akses Kamera Ditolak'}
                    {errorType === 'FACE_NOT_ENROLLED' && 'Wajah Belum Terdaftar'}
                    {errorType === 'VERIFY_FAILED' && 'Pencocokan Wajah Gagal'}
                    {errorType === 'NETWORK_OFFLINE' && 'Jaringan Offline'}
                    {errorType === 'ALREADY_RECORDED' && 'Sudah Tercatat Hari Ini'}
                  </strong>
                  <span className="text-[11px] text-slate-600">
                    {errorType === 'CAMERA_DENIED' && 'Izin kamera dibutuhkan untuk verifikasi.'}
                    {errorType === 'VERIFY_FAILED' && 'Posisikan wajah tepat di dalam bingkai.'}
                    {errorType === 'NETWORK_OFFLINE' && 'Periksa sambungan internet Anda.'}
                    {errorType === 'ALREADY_RECORDED' && 'Presensi Anda sudah tersimpan di server.'}
                    {!errorType && 'Terjadi kendala saat memproses presensi.'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScenario('NORMAL');
                    setViewState('CAMERA');
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba Lagi</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          {/* Success View */}
          {viewState === 'SUCCESS' && receipt && (
            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-emerald-950">
                  {isCheckOut ? 'Clock Out Berhasil!' : 'Clock In Berhasil!'}
                </h3>
                <p className="text-[11px] text-emerald-800">
                  Waktu: <span className="font-mono font-bold">{receipt.time}</span>
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Ref: {receipt.hash}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow transition"
              >
                Selesai
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
