'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ScanFace,
  Eye,
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
  const [stageProgress, setStageProgress] = useState({
    step: 2,
    label: 'Tahap 2/5: Posisikan wajah di dalam bingkai',
    pct: 40,
  });
  const [scenario, setScenario] = useState<CameraScenario>('NORMAL');
  const [errorType, setErrorType] = useState<CameraScenario | null>(null);
  const [receipt, setReceipt] = useState<{ time: string; hash: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasRealCamera, setHasRealCamera] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

    // Check if secure context for WebRTC
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
      setCameraLoading(false);
      setCameraNote('Kamera asli browser memerlukan HTTPS. Mode simulasi wajah tetap aktif.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraLoading(false);
      setCameraNote('Peramban ini tidak mendukung akses kamera langsung. Mode simulasi aktif.');
      return;
    }

    try {
      // Set timeout so it never hangs indefinitely on mobile
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
        setCameraNote('Kamera fisik tidak dapat diakses. Menggunakan simulasi wajah terverifikasi.');
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setViewState('CAMERA');
      setStageProgress({
        step: 2,
        label: 'Tahap 2/5: Posisikan wajah di dalam bingkai',
        pct: 40,
      });
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
      // Note: We deliberately do NOT auto-block on getUserMedia on open.
      // The user can tap "Coba Kamera Perangkat" or proceed with simulation.
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const handleSimulateOrCapture = () => {
    if (!isOnline) {
      triggerError('NETWORK_OFFLINE');
      return;
    }

    setViewState('PROCESSING');
    setStageProgress({
      step: 3,
      label: 'Tahap 3/5: Memeriksa Keaktifan & Kecocokan 1:1',
      pct: 65,
    });

    setTimeout(() => {
      if (scenario === 'VERIFY_FAILED') {
        triggerError('VERIFY_FAILED');
        return;
      }

      setStageProgress({
        step: 4,
        label: 'Tahap 4/5: Menyimpan ke Server GAJIANICH',
        pct: 85,
      });

      setTimeout(() => {
        stopCamera();
        setStageProgress({
          step: 5,
          label: 'Tahap 5/5: Bukti Berhasil Tercatat Server',
          pct: 100,
        });

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
      aria-labelledby="sheetFlowTitle"
      className="fixed inset-0 sm:absolute sm:inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-[32px] max-h-[94%] flex flex-col overflow-hidden border-t border-slate-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#059669] block">
              Presensi wajah
            </span>
            <h2 id="sheetFlowTitle" className="text-base font-extrabold text-slate-900">
              {isCheckOut ? 'Absen Pulang — Kamera Biometrik' : 'Absen Masuk — Kamera Biometrik'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup kamera"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sheet Body */}
        <div className="p-4 overflow-y-auto space-y-3.5">
          {/* Progress Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span className="text-slate-800">{stageProgress.label}</span>
              <span className="font-mono text-[#059669]">{stageProgress.pct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#059669] transition-all duration-300"
                style={{ width: `${stageProgress.pct}%` }}
              ></div>
            </div>
          </div>

          {/* Test Scenario Buttons */}
          <details className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 group">
            <summary className="text-[11px] font-bold text-slate-500 cursor-pointer list-none flex justify-between items-center">
              <span>Uji Kondisi Alur Presensi:</span>
              <span className="text-emerald-700 text-[10px] group-open:rotate-180 transition">▼</span>
            </summary>
            <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold mt-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setScenario('NORMAL');
                  setViewState('CAMERA');
                }}
                className={`py-1.5 px-2 rounded-lg ${
                  scenario === 'NORMAL' ? 'bg-[#059669] text-white' : 'bg-white border border-slate-300 text-slate-700'
                }`}
              >
                1. Normal
              </button>
              <button
                type="button"
                onClick={() => {
                  setScenario('CAMERA_DENIED');
                  triggerError('CAMERA_DENIED');
                }}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-300 text-slate-700"
              >
                2. Ditolak
              </button>
              <button
                type="button"
                onClick={() => {
                  setScenario('FACE_NOT_ENROLLED');
                  triggerError('FACE_NOT_ENROLLED');
                }}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-300 text-slate-700"
              >
                3. Belum Daftar
              </button>
              <button
                type="button"
                onClick={() => {
                  setScenario('VERIFY_FAILED');
                  triggerError('VERIFY_FAILED');
                }}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-300 text-slate-700"
              >
                4. Gagal Cocok
              </button>
              <button
                type="button"
                onClick={() => {
                  setScenario('NETWORK_OFFLINE');
                  triggerError('NETWORK_OFFLINE');
                }}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-300 text-slate-700"
              >
                5. Offline
              </button>
              <button
                type="button"
                onClick={() => {
                  setScenario('ALREADY_RECORDED');
                  triggerError('ALREADY_RECORDED');
                }}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-300 text-slate-700"
              >
                6. Sudah Absen
              </button>
            </div>
          </details>

          {/* VIEWPORT: CAMERA */}
          {viewState === 'CAMERA' && (
            <div className="space-y-3.5">
              <div className="relative w-full aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden border border-slate-300 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover -scale-x-100 ${hasRealCamera ? '' : 'hidden'}`}
                />

                {!hasRealCamera && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-950 text-white gap-2 p-4 text-center">
                    <span className="w-16 h-16 rounded-full bg-[#d1fae5] border border-[#a7f3d0] text-[#065f46] text-xl font-bold flex items-center justify-center shadow-md">
                      FP
                    </span>
                    <strong className="text-sm font-bold text-white">Area Kamera Wajah</strong>
                    <span className="text-[11px] text-slate-300">
                      {cameraNote || 'Mode simulasi biometrik aktif'}
                    </span>
                    <button
                      type="button"
                      disabled={cameraLoading}
                      onClick={startCamera}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-[#059669] text-xs font-bold flex items-center gap-1.5 mt-1 shadow-sm transition active:scale-95 disabled:opacity-50"
                    >
                      {cameraLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#059669]" />
                      ) : (
                        <Camera className="w-3.5 h-3.5 text-[#059669]" />
                      )}
                      <span>{cameraLoading ? 'Menghubungkan...' : 'Coba Kamera Perangkat'}</span>
                    </button>
                  </div>
                )}

                {/* Oval Framing Guide */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-40 h-52 rounded-full border-2 border-dashed border-emerald-400 relative animate-pulse"></div>
                </div>

                {/* Status Overlay */}
                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/70 text-white text-[11px] font-bold flex items-center gap-1.5 pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{hasRealCamera ? 'Kamera Aktif' : 'Pratinjau Simulasi'}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <p className="font-extrabold text-sm text-emerald-800 flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  <span>Wajah terlihat jelas</span>
                </p>
                <p className="leading-relaxed text-slate-700">
                  Gunakan pencahayaan cukup dan hadapkan wajah ke kamera. Sistem memeriksa keaktifan wajah sebelum menyimpan data presensi ke server.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSimulateOrCapture}
                className="w-full min-h-[52px] py-3.5 px-5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99]"
              >
                <ScanFace className="w-5 h-5" />
                <span>{isCheckOut ? 'Simulasikan Absen Pulang' : 'Simulasikan Absen Masuk'}</span>
              </button>
            </div>
          )}

          {/* VIEWPORT: PROCESSING */}
          {viewState === 'PROCESSING' && (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#059669] flex items-center justify-center mx-auto">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Memproses simulasi presensi…
              </h3>
              <p className="text-xs text-slate-600 px-4">
                Memverifikasi keaktifan wajah dan mengonfirmasi pencatatan ke server GAJIANICH.
              </p>
            </div>
          )}

          {/* VIEWPORT: ERROR */}
          {viewState === 'ERROR' && (
            <div className="space-y-3.5">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[10px] font-extrabold">
                      {errorType || 'ERR_PRESENSI'}
                    </span>
                    <h3 className="text-base font-extrabold text-rose-950 mt-0.5">
                      {errorType === 'CAMERA_DENIED' && 'Akses Kamera Ditolak'}
                      {errorType === 'FACE_NOT_ENROLLED' && 'Wajah Belum Terdaftar di Sistem'}
                      {errorType === 'VERIFY_FAILED' && 'Pencocokan Wajah atau Liveness Gagal'}
                      {errorType === 'NETWORK_OFFLINE' && 'Tidak Ada Koneksi ke Server'}
                      {errorType === 'ALREADY_RECORDED' && 'Presensi Hari Ini Sudah Lengkap'}
                    </h3>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-rose-900 leading-relaxed">
                  {errorType === 'CAMERA_DENIED' &&
                    'Aplikasi membutuhkan izin kamera melalui HTTPS untuk memverifikasi wajah Anda. Presensi belum tercatat.'}
                  {errorType === 'FACE_NOT_ENROLLED' &&
                    'Anda wajib memiliki profil biometrik wajah terdaftar agar sistem dapat mencocokkan identitas presensi Anda.'}
                  {errorType === 'VERIFY_FAILED' &&
                    'Wajah tidak cocok dengan profil terdaftar atau terdeteksi objek statis. Presensi ditolak.'}
                  {errorType === 'NETWORK_OFFLINE' &&
                    'Presensi wajib online dan baru dinyatakan sah setelah server mengonfirmasi penyimpanan.'}
                  {errorType === 'ALREADY_RECORDED' &&
                    'Server mengonfirmasi jam masuk dan jam pulang Anda hari ini telah tercatat lengkap.'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScenario('NORMAL');
                    setViewState('CAMERA');
                  }}
                  className="flex-1 min-h-[48px] py-3 px-4 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-extrabold text-sm flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Coba Lagi</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[48px] py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          {/* VIEWPORT: SUCCESS */}
          {viewState === 'SUCCESS' && receipt && (
            <div className="space-y-3.5">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-[#059669] text-white flex items-center justify-center mx-auto">
                  <CheckCheck className="w-6 h-6" />
                </div>
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-white border border-emerald-200 text-[#059669] text-[11px] font-extrabold">
                  Tercatat Resmi di Server
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {isCheckOut ? 'Presensi Pulang Berhasil' : 'Presensi Masuk Berhasil'}
                </h3>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Karyawan</span>
                  <span className="font-bold text-slate-900">
                    {employeeName} ({employeeNik})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Waktu Tercatat</span>
                  <span className="font-mono font-extrabold text-[#059669]">{receipt.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Verifikasi Wajah</span>
                  <span className="font-bold text-[#059669]">Terverifikasi 1:1 Sah</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Referensi Server</span>
                  <span className="font-mono font-bold text-slate-800">{receipt.hash}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[50px] py-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-extrabold text-sm transition"
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
