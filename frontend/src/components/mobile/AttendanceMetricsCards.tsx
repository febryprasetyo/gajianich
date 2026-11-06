'use client';

interface Props {
  checkInTime: string;
  checkInSub?: string;
  checkOutTime: string;
  checkOutSub?: string;
  totalHours: string;
  totalSub?: string;
}
export default function AttendanceMetricsCards({ checkInTime, checkInSub, checkOutTime, checkOutSub, totalHours, totalSub }: Props) {
  return <dl aria-label="Ringkasan jam kerja hari ini" className="grid grid-cols-3 gap-3 px-1 py-2">
    {[
      ['Masuk', checkInTime, checkInSub],
      ['Pulang', checkOutTime, checkOutSub],
      ['Durasi', totalHours, totalSub],
    ].map(([label, value, hint]) => <div key={label} className="min-w-0 space-y-1.5"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="break-words text-xl font-extrabold tabular-nums tracking-tight text-slate-900">{value}</dd>{hint && <dd className="text-xs leading-relaxed text-slate-500">{hint}</dd>}</div>)}
  </dl>;
}
