'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, ChevronLeft, History, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import LogoutSheet from '@/components/mobile/LogoutSheet';
import { fetchMobileSummary, postEnrollFace, type MobileSummaryData } from '@/lib/attendance/mobileApi';
export default function MobileProfilePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [summary, setSummary] = useState<MobileSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [logoutOpen, setLogoutOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  async function load() {
    setLoading(true); setError('');
    try { setSummary(await fetchMobileSummary()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Profil gagal dimuat.'); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    void load();
  }, [router]);
  async function captured(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || submitting.current) return;
    submitting.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (file.size > 15_000_000) throw new Error('Ukuran foto maksimal 15 MB.');
      const bitmap = await createImageBitmap(file);
      const ratio = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio);
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Foto tidak dapat diproses.');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const response = await postEnrollFace({ samplePhotoBase64: canvas.toDataURL('image/jpeg', 0.85) });
      setMessage(response.message); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Foto gagal dikirim.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  const face = summary?.faceEnrollment;
  const pending = face?.changeStatus === 'PENDING';
  return <main className="flex-1 space-y-4 bg-slate-50 px-4 pb-10 pt-4">
    <header className="flex items-center justify-between gap-3">
      <Link href="/m/beranda" aria-label="Kembali ke beranda" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white"><ChevronLeft size={20} /></Link>
      <h1 className="text-lg font-extrabold text-slate-900">Profil Karyawan</h1>
    </header>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {loading && !summary && <p role="status" className="text-sm text-slate-600">Memuat profil...</p>}
    {summary && <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col items-center gap-2 pb-4 text-center">
          {summary.employee.photoUrl ? <img src={summary.employee.photoUrl} alt={`Foto ${summary.employee.fullName}`} className="h-20 w-20 rounded-full object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-900">{summary.employee.avatarInitial}</span>}
          <h2 className="text-base font-bold text-slate-900">{summary.employee.fullName}</h2>
        </div>
        <dl className="space-y-3 border-t border-slate-200 pt-4 text-xs text-slate-700">
          {[['NIK Karyawan', summary.employee.employeeCode], ['Departemen', summary.employee.department], ['Jabatan', summary.employee.position]].map(([label,value]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="text-right font-bold">{value}</dd></div>)}
        </dl>
      </section>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Status Pendaftaran Wajah</h2>
        <p className="text-sm font-semibold text-slate-700">{face?.isFaceEnrolled ? 'Terdaftar' : 'Belum terdaftar'}</p>
        {pending && <p className="text-xs text-amber-800">Perubahan foto menunggu persetujuan HRD. Foto sebelumnya tetap digunakan.</p>}
        {face?.changeStatus === 'REJECTED' && <p className="text-xs text-rose-800">Perubahan ditolak: {face.changeNote}</p>}
        <p className="text-xs leading-relaxed text-slate-600">{face?.isFaceEnrolled ? 'Penggantian wajah dan foto profil memerlukan persetujuan HRD.' : 'Daftarkan wajah Anda. Foto pertama langsung menjadi foto profil dan acuan presensi.'}</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={captured} className="hidden" aria-label="Ambil foto wajah" />
        <button type="button" onClick={() => input.current?.click()} disabled={busy || pending || loading} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Camera size={18} />{busy ? 'Memproses wajah...' : face?.isFaceEnrolled ? 'Ajukan perubahan wajah' : 'Daftarkan wajah'}</button>
      </section>
    </>}
    <Link href="/m/presensi" className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700"><History size={18} />Riwayat Kehadiran Pribadi</Link>
    <button type="button" onClick={() => setLogoutOpen(true)} className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800"><LogOut size={18} />Keluar akun</button>
    <LogoutSheet isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} onConfirm={() => { setLogoutOpen(false); logout(); }} />
  </main>;
}
