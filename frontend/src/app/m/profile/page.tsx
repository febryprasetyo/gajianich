'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, ChevronLeft, History, Loader2, LogOut, ScanFace, ChevronRight, Monitor, Upload, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ModalShell from '@/components/ui/ModalShell';
import StatusBadge from '@/components/ui/StatusBadge';
import { useMobileRevalidation } from '@/hooks/useMobileEnvironment';
import LogoutSheet from '@/components/mobile/LogoutSheet';
import { fetchMobileSummary, postEnrollFace, type MobileSummaryData } from '@/lib/attendance/mobileApi';
export default function MobileProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState<MobileSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const submitting = useRef(false);
  const summaryRequest = useRef(0);
  const load = useCallback(async () => {
    const requestId = ++summaryRequest.current;
    setLoading(true); setError('');
    try { const data = await fetchMobileSummary(); if (requestId === summaryRequest.current) setSummary(data); }
    catch (err) { if (requestId === summaryRequest.current) setError(err instanceof Error ? err.message : 'Profil gagal dimuat.'); }
    finally { if (requestId === summaryRequest.current) setLoading(false); }
  }, []);
  useMobileRevalidation(load);
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    void load();
  }, [router, load]);
  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;
    setCameraReady(false);
    setCameraError('');
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Kamera langsung tidak tersedia.');
        }
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 800 }, height: { ideal: 600 } },
          audio: false,
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
        if (!cancelled) setCameraReady(true);
      } catch {
        if (!cancelled) {
          setCameraOpen(false);
          input.current?.click();
        }
      }
    }
    void start();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [cameraOpen]);
  function openFaceCapture() {
    setError('');
    setMessage('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      input.current?.click();
      return;
    }
    setCameraOpen(true);
  }
  async function submitFaceDataUrl(samplePhotoBase64: string, fromCameraModal = false) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setCameraError('');
    setMessage('');
    try {
      const response = await postEnrollFace({ samplePhotoBase64 });
      setMessage(response.message);
      if (fromCameraModal) setCameraOpen(false);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Foto gagal dikirim.';
      if (fromCameraModal) setCameraError(msg);
      else setError(msg);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function captureFromVideo() {
    if (submitting.current) return;
    setCameraError('');
    if (!cameraReady || !video.current?.videoWidth) {
      setCameraError('Kamera belum siap. Tunggu sebentar atau pilih foto dari galeri.');
      return;
    }
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 800 / video.current.videoWidth);
    canvas.width = Math.round(video.current.videoWidth * scale);
    canvas.height = Math.round(video.current.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Foto tidak dapat diambil. Ulangi kembali.');
      return;
    }
    ctx.drawImage(video.current, 0, 0, canvas.width, canvas.height);
    await submitFaceDataUrl(canvas.toDataURL('image/jpeg', 0.85), true);
  }
  async function captured(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || submitting.current) return;
    setError(''); setMessage('');
    try {
      if (file.size > 15_000_000) throw new Error('Ukuran foto maksimal 15 MB.');
      const bitmap = await createImageBitmap(file);
      const ratio = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio);
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Foto tidak dapat diproses.');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      await submitFaceDataUrl(canvas.toDataURL('image/jpeg', 0.85), false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Foto gagal dikirim.'); }
  }
  const face = summary?.faceEnrollment;
  const pending = face?.changeStatus === 'PENDING';
  return <main className="flex-1 space-y-5 bg-slate-50 px-5 pb-6 pt-6">
    <header className="flex items-center justify-between gap-3">
      <Link href="/m/beranda" aria-label="Kembali ke beranda" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white"><ChevronLeft size={20} /></Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Profil saya</h1>
    </header>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {loading && !summary && <p role="status" className="text-sm text-slate-600">Memuat profil...</p>}
    {summary && <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col items-center gap-2 pb-5 text-center">
          {summary.employee.photoUrl ? <img src={summary.employee.photoUrl} alt={`Foto ${summary.employee.fullName}`} className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-sm ring-1 ring-emerald-200" /> : <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-emerald-100 text-2xl font-extrabold text-emerald-800 shadow-sm ring-1 ring-emerald-200">{summary.employee.avatarInitial}</span>}
          <h2 className="mt-2 break-words text-xl font-extrabold tracking-tight text-slate-900">{summary.employee.fullName}</h2>
          <p className="text-sm text-slate-500">{summary.employee.position} · {summary.employee.department}</p>
        </div>
        <dl className="space-y-3 border-t border-slate-200 pt-4 text-sm text-slate-600">
          {[['NIK Karyawan', summary.employee.employeeCode], ['Departemen', summary.employee.department], ['Jabatan', summary.employee.position]].map(([label,value]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="text-right font-bold">{value}</dd></div>)}
        </dl>
      </section>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900"><ScanFace size={18} className="mr-2 inline text-emerald-600" />Verifikasi wajah</h2>
        <StatusBadge variant={face?.isFaceEnrolled ? 'success' : 'warning'} icon={<span className="h-1.5 w-1.5 rounded-full bg-current" />}>{face?.isFaceEnrolled ? 'Terdaftar' : 'Belum terdaftar'}</StatusBadge>
        {pending && <p className="text-xs text-amber-800">Perubahan foto menunggu persetujuan HRD. Foto sebelumnya tetap digunakan.</p>}
        {face?.changeStatus === 'REJECTED' && <p className="text-xs text-rose-800">Perubahan ditolak: {face.changeNote}</p>}
        <p className="text-xs leading-relaxed text-slate-600">{face?.isFaceEnrolled ? 'Penggantian wajah dan foto profil memerlukan persetujuan HRD.' : 'Daftarkan wajah Anda. Foto pertama langsung menjadi foto profil dan acuan presensi.'}</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={captured} className="hidden" aria-label="Ambil foto wajah" />
        <button type="button" onClick={openFaceCapture} disabled={busy || pending || loading} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Camera size={18} />{busy ? 'Memproses wajah...' : face?.isFaceEnrolled ? 'Ajukan perubahan wajah' : 'Daftarkan wajah'}</button>
      </section>
    </>}
    <Link href="/m/presensi" className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700"><History size={18} />Riwayat presensi<ChevronRight size={18} className="ml-auto text-slate-400" /></Link>
    
    {/* Switch to Desktop Dashboard */}
    {user?.roleName && user.roleName.toLowerCase() !== 'employee' && user.roleName.toLowerCase() !== 'karyawan' && (
      <Link
        href="/dashboard"
        className="flex min-h-11 items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"
      >
        <Monitor size={18} className="text-emerald-700" />
        Buka Dashboard Desktop
        <ChevronRight size={18} className="ml-auto text-emerald-600" />
      </Link>
    )}

    <button type="button" onClick={() => setLogoutOpen(true)} className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800"><LogOut size={18} />Keluar akun</button>
    <ModalShell
      isOpen={cameraOpen}
      onClose={() => { if (!busy) setCameraOpen(false); }}
      title={face?.isFaceEnrolled ? 'Perbarui foto wajah' : 'Daftarkan foto wajah'}
      isLoading={busy}
      fullScreen
      showCloseButton={false}
    >
      <div className="relative isolate flex h-full flex-col overflow-hidden bg-slate-950 text-white">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 -z-10 h-full w-full -scale-x-100 object-cover"
          aria-label="Pratinjau kamera pendaftaran wajah"
        />
        <div className="shrink-0 bg-slate-950/80 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCameraOpen(false)}
              disabled={busy}
              aria-label="Tutup kamera"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"
            >
              <X size={22} />
            </button>
            <div className="min-w-0">
              <h2 className="text-xl font-extrabold">{face?.isFaceEnrolled ? 'Perbarui foto wajah' : 'Daftarkan foto wajah'}</h2>
              <p className="mt-0.5 break-words text-xs text-slate-200">{summary?.employee.fullName}</p>
            </div>
          </div>
        </div>
        <div className="relative flex min-h-24 flex-1 flex-col items-center justify-center px-6 py-4">
          <div
            aria-hidden="true"
            className="aspect-[4/5] max-h-[38dvh] w-[min(62vw,240px)] rounded-[50%] border-2 border-dashed border-emerald-200/90 shadow-[0_0_0_100vmax_rgba(2,6,23,0.25)]"
          />
          <p className="z-10 mt-4 rounded-xl bg-slate-950/75 px-4 py-2 text-center text-xs">
            Posisikan wajah utuh di dalam bingkai dengan pencahayaan cukup.
          </p>
        </div>
        <div className="z-10 shrink-0 space-y-3 bg-slate-950/90 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <span className={`h-2 w-2 rounded-full ${cameraReady ? 'bg-emerald-300' : 'bg-amber-300'}`} />
            {cameraReady ? 'Kamera siap' : 'Menyiapkan kamera'}
          </div>
          {cameraError && (
            <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-950/80 p-3 text-sm text-rose-100">
              {cameraError}
            </p>
          )}
          <button
            type="button"
            onClick={captureFromVideo}
            disabled={!cameraReady || busy}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-300"
          >
            {busy ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
            {busy ? 'Memproses wajah…' : 'Ambil foto wajah'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setCameraOpen(false);
              input.current?.click();
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-3 text-xs font-semibold text-slate-200 disabled:opacity-40"
          >
            <Upload size={16} />
            Pilih dari Galeri / Kamera HP
          </button>
        </div>
      </div>
    </ModalShell>
    <LogoutSheet isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} onConfirm={() => { setLogoutOpen(false); logout(); }} />
  </main>;
}
