'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Loader2, RefreshCw, X, MapPin, ScanFace } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { useMobileEnvironment } from '@/hooks/useMobileEnvironment';
import { canCaptureAttendance } from '@/lib/attendance/mobilePresentation';
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
export default function FaceAttendanceSheet({ isOpen, onClose, isCheckOut = false, isDirectOut = false, notes, isOnline = true, isFaceEnrolled = false, employeeName, employeeNik, onSuccess }: Props) {
  const location = useRealtimeLocation(isOpen);
  const { online } = useMobileEnvironment();
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
    if (!isOnline || !online || !navigator.onLine) { setError('Koneksi internet diperlukan.'); return; }
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
  const canCapture = canCaptureAttendance({ online: online && isOnline, enrolled: isFaceEnrolled, cameraReady: ready, busy, locationLoading: location.loading, latitude: location.latitude, longitude: location.longitude, locationError: location.error });
  const title = isDirectOut ? 'Presensi pulang langsung' : isCheckOut ? 'Absen pulang' : 'Absen masuk';
  return <ModalShell isOpen={isOpen} onClose={onClose} title={title} isLoading={busy} fullScreen showCloseButton={false}>
    <div className="relative isolate flex h-full flex-col overflow-hidden bg-slate-950 text-white">
      {isFaceEnrolled && <video ref={video} autoPlay playsInline muted className="absolute inset-0 -z-10 h-full w-full -scale-x-100 object-cover" aria-label="Pratinjau kamera wajah" />}
      <div className="shrink-0 bg-slate-950/80 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose} disabled={busy} aria-label="Tutup kamera" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"><X size={22} /></button>
          <div className="min-w-0"><h2 className="text-xl font-extrabold">{title}</h2><p className="mt-0.5 break-words text-xs text-slate-200">{employeeName}{employeeNik ? ` · ${employeeNik}` : ''}</p></div>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-200"><MapPin size={16} className="mt-0.5 shrink-0 text-emerald-300" /><span className="line-clamp-2">{location.displayText}</span></p>
      </div>
      <div className="relative flex min-h-24 flex-1 flex-col items-center justify-center px-6 py-4">
        {isFaceEnrolled ? <>
          <div aria-hidden="true" className="aspect-[4/5] max-h-[38dvh] w-[min(62vw,240px)] rounded-[50%] border-2 border-dashed border-emerald-200/90 shadow-[0_0_0_100vmax_rgba(2,6,23,0.25)]" />
          <p className="z-10 mt-4 rounded-xl bg-slate-950/75 px-4 py-2 text-center text-xs">Posisikan wajah utuh di dalam bingkai.</p>
        </> : <div className="max-w-sm space-y-4 text-center"><ScanFace size={48} className="mx-auto text-emerald-300" /><p role="alert" className="text-sm">Wajah belum terdaftar. Daftarkan melalui Profil sebelum melakukan presensi.</p><Link href="/m/profile" onClick={onClose} className="inline-flex min-h-12 items-center rounded-xl bg-white px-5 font-bold text-emerald-800">Buka Profil</Link></div>}
      </div>
      <div className="z-10 shrink-0 space-y-3 overflow-y-auto bg-slate-950/90 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[50dvh]">
        <div className="flex items-center gap-2 text-xs text-slate-200"><span className={`h-2 w-2 rounded-full ${ready ? 'bg-emerald-300' : 'bg-amber-300'}`} />{ready ? 'Kamera siap' : 'Menyiapkan kamera'}<span className="ml-auto">{online && isOnline ? 'Terhubung' : 'Tidak ada koneksi'}</span></div>
        {(!online || !isOnline) && <p role="status" className="text-sm text-amber-200">Hubungkan ke internet sebelum mengirim presensi.</p>}
        {(error || location.error) && <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-950/80 p-3 text-sm text-rose-100">{error || location.error}</p>}
        <button type="button" onClick={capture} disabled={!canCapture} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-300">{busy ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}{busy ? 'Memeriksa & menyimpan…' : 'Ambil foto dan presensi'}</button>
        <p className="text-center text-xs text-slate-300">Foto digunakan untuk verifikasi kehadiran.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" disabled={busy || !isFaceEnrolled} onClick={() => setAttempt(a => a + 1)} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-xs text-slate-200 disabled:opacity-40"><Camera size={16} />Nyalakan ulang kamera</button>
          <button type="button" disabled={busy || location.loading} onClick={location.refetch} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-xs text-slate-200 disabled:opacity-40">{location.loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}Perbarui lokasi</button>
        </div>
      </div>
    </div>
  </ModalShell>;
}
