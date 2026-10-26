'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Loader2, RefreshCw } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { useRealtimeLocation } from '@/hooks/useRealtimeLocation';
import { postMobileClock, type MobileClockResponse } from '@/lib/attendance/mobileApi';
export type AttendanceReceipt = MobileClockResponse['data'];
interface Props {
  isOpen: boolean;
  onClose: () => void;
  isCheckOut?: boolean;
  isDirectOut?: boolean;
  notes?: string;
  isOnline?: boolean;
  isFaceEnrolled?: boolean;
  employeeName?: string;
  employeeNik?: string;
  onSuccess: (data: AttendanceReceipt) => void | Promise<void>;
}
export default function FaceAttendanceSheet({ isOpen, onClose, isCheckOut = false, isDirectOut = false, notes, isOnline = true, isFaceEnrolled = false, employeeName, onSuccess }: Props) {
  const location = useRealtimeLocation(isOpen);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const submitting = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isOpen || !isFaceEnrolled) return;
    let cancelled = false;
    setReady(false); setError('');
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Akses kamera memerlukan HTTPS dan browser yang mendukung kamera.');
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 800 }, height: { ideal: 600 } }, audio: false });
        if (cancelled) { media.getTracks().forEach(t => t.stop()); return; }
        stream.current = media;
        if (video.current) { video.current.srcObject = media; await video.current.play(); }
        if (!cancelled) setReady(true);
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Izin kamera diperlukan.'); }
    }
    void start();
    return () => { cancelled = true; stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; };
  }, [isOpen, isFaceEnrolled, attempt]);
  async function capture() {
    if (submitting.current) return;
    setError('');
    if (!isOnline) { setError('Koneksi internet diperlukan.'); return; }
    if (!isFaceEnrolled) { setError('Daftarkan wajah terlebih dahulu pada profil.'); return; }
    if (location.latitude === null || location.longitude === null || location.error) { setError(location.error || 'Tunggu lokasi GPS tersedia.'); return; }
    if (!ready || !video.current?.videoWidth) { setError('Kamera belum siap. Coba nyalakan ulang kamera.'); return; }
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 800 / video.current.videoWidth);
    canvas.width = Math.round(video.current.videoWidth * scale);
    canvas.height = Math.round(video.current.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) { setError('Foto tidak dapat diambil. Ulangi presensi.'); return; }
    ctx.drawImage(video.current, 0, 0, canvas.width, canvas.height);
    submitting.current = true; setBusy(true);
    try {
      const result = await postMobileClock({ eventType: isCheckOut || isDirectOut ? 'OUT' : 'IN', isDirectOut, notes, photoBase64: canvas.toDataURL('image/jpeg', 0.85), latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy, address: location.address, deviceInfo: navigator.userAgent });
      await onSuccess(result.data);
    } catch (err) { setError(err instanceof Error ? err.message : 'Presensi gagal. Silakan ulangi.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <ModalShell isOpen={isOpen} onClose={onClose} title={isDirectOut ? 'Presensi pulang (langsung)' : isCheckOut ? 'Presensi pulang' : 'Presensi masuk'} isLoading={busy} footer={<button type="button" onClick={capture} disabled={busy || !ready || !isFaceEnrolled || location.loading} className="min-h-11 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Memeriksa wajah dan menyimpan...' : 'Ambil foto dan presensi'}</button>}>
    <div className="space-y-4">
      <p className="text-sm text-slate-700">{employeeName}. Hadapkan wajah ke kamera dengan pencahayaan cukup.</p>
      {!isFaceEnrolled ? <p role="alert" className="text-sm text-rose-800">Wajah belum terdaftar. <Link href="/m/profile" className="underline">Daftarkan melalui profil</Link>.</p> : <video ref={video} autoPlay playsInline muted className="aspect-[4/3] w-full rounded-xl bg-slate-900 object-cover -scale-x-100" aria-label="Pratinjau kamera wajah" />}
      <p className="text-xs text-slate-700">{location.displayText}</p>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => setAttempt(a => a + 1)} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-xs text-slate-700"><Camera size={16} />Nyalakan ulang kamera</button>
        <button type="button" disabled={busy || location.loading} onClick={location.refetch} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-xs text-slate-700">{location.loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}Perbarui lokasi</button>
      </div>
    </div>
  </ModalShell>;
}
