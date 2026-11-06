'use client';

import { CalendarCheck, MapPin, ShieldCheck } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { attendanceReviewPresentation } from '@/lib/attendance/mobilePresentation';

export function ApprovalBadge({ status, recorded = false }: { status?: string | null; recorded?: boolean }) {
  const view = attendanceReviewPresentation(status, recorded);
  return <StatusBadge variant={view.variant} icon={<span className="block h-1.5 w-1.5 rounded-full bg-current" />}>
    {view.label}
  </StatusBadge>;
}

export default function AttendanceReview({ status, note, recorded = false }: { status?: string | null; note?: string; recorded?: boolean }) {
  const view = attendanceReviewPresentation(status, recorded);
  const Icon = status ? ShieldCheck : recorded ? CalendarCheck : MapPin;
  return <section aria-label={view.title} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Icon className="h-4 w-4 text-emerald-600" />{view.title}</h2>{(status || recorded) && <ApprovalBadge status={status} recorded={recorded} />}</div>
    <p className="text-xs leading-relaxed text-slate-600">{status && note ? note : view.description}</p>
  </section>;
}
