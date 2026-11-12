'use client';

import { Clock, MapPin, ScanFace } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { useMobileEnvironment } from '@/hooks/useMobileEnvironment';
import { resolveClientTimeZone, formatTimeZoneAbbr } from '@/lib/attendance/mobilePresentation';

export type AttendanceRingState = 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'COMPLETED';
interface Props {
  status: AttendanceRingState;
  onOpenFlow: () => void;
  officeName?: string;
  disabled?: boolean;
  isCheckoutCooldown?: boolean;
  cooldownText?: string | null;
  isCheckOutUpdate?: boolean;
  shiftName?: string;
  schedule?: string;
  timeZone?: string;
  workDate?: string;
}
export default function PresensiRingButton({ status, onOpenFlow, disabled = false, isCheckoutCooldown = false, cooldownText, isCheckOutUpdate = false, shiftName, schedule, timeZone = 'Asia/Jakarta', workDate }: Props) {
  const { now, online } = useMobileEnvironment();
  const completed = status === 'COMPLETED';
  const label = isCheckoutCooldown ? cooldownText || 'Jeda pulang' : isCheckOutUpdate ? 'Perbarui Pulang' : status === 'CHECKED_IN' ? 'Absen Pulang' : completed ? 'Presensi selesai' : 'Absen Masuk';
  const unavailable = disabled || !online || isCheckoutCooldown || (completed && !isCheckOutUpdate);
  const activeTimeZone = resolveClientTimeZone(timeZone, status !== 'NOT_CHECKED_IN');
  const tzAbbr = formatTimeZoneAbbr(activeTimeZone);
  const date = workDate ? new Date(`${workDate}T12:00:00Z`) : now;
  const timeString = now ? now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: activeTimeZone }) : '--.--';
  return <section aria-label="Presensi hari ini" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{date ? date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', timeZone: activeTimeZone }) : 'Hari ini'}</p>
      <StatusBadge variant={status === 'NOT_CHECKED_IN' ? 'slate' : 'success'} icon={<span className="h-1.5 w-1.5 rounded-full bg-current" />}>{status === 'NOT_CHECKED_IN' ? 'Belum masuk' : completed || isCheckOutUpdate ? 'Sudah pulang' : 'Sudah masuk'}</StatusBadge>
    </div>
    <div className="flex items-baseline gap-2.5">
      <p className="text-5xl font-extrabold tabular-nums tracking-tight text-slate-900">{timeString}</p>
      {tzAbbr && <span className="text-sm font-extrabold uppercase tracking-wide text-slate-500">{tzAbbr}</span>}
    </div>
    <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{shiftName || 'Jadwal kerja'}{schedule ? ` · ${schedule}` : ''}</span></p>
    <div className="space-y-1"><p className="text-sm font-bold text-slate-800">Presensi luar kantor</p><p className="text-xs leading-relaxed text-slate-500">Gunakan hanya ketika bertugas di luar kantor.</p></div>
    <button type="button" onClick={onOpenFlow} disabled={unavailable} aria-label={`${label} dengan verifikasi wajah`} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"><ScanFace size={20} />{label}</button>
    {isCheckoutCooldown && <p className="text-xs leading-relaxed text-amber-800">Absen pulang tersedia minimal 30 menit setelah jam masuk tercatat.</p>}
    {!online && <p role="status" className="text-xs text-rose-700">Hubungkan ke internet untuk mengirim presensi.</p>}
    <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>Absensi mesin kantor dan presensi luar kantor tampil dalam riwayat yang sama.</span></p>
  </section>;
}
