'use client';

import { Check } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { ApprovalBadge } from './AttendanceReview';
import type { AttendanceReceipt } from './FaceAttendanceSheet';

export default function AttendanceReceiptModal({ receipt, onClose }: { receipt: AttendanceReceipt | null; onClose: () => void }) {
  return <ModalShell isOpen={Boolean(receipt)} onClose={onClose} title="Bukti presensi" maxWidthClass="max-w-md" footer={<button type="button" onClick={onClose} className="min-h-12 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">Selesai</button>}>
    {receipt && <div className="space-y-5">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Check size={30} /></div>
      <div className="text-center"><h2 className="text-xl font-extrabold text-slate-900">Presensi {receipt.eventType === 'IN' ? 'masuk' : 'pulang'} tercatat</h2><p className="mt-2 text-sm text-slate-600">Data sudah tersimpan di server.</p></div>
      <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">{receipt.workDate}</p><p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{receipt.scanTime} <span className="text-base">{receipt.timeZoneLabel}</span></p><p className="mt-3 text-xs text-slate-600">{receipt.isWithinGeofence ? 'Di dalam area kerja' : 'Di luar area kerja'}{receipt.distanceMeters !== null ? ` · ${Math.round(receipt.distanceMeters)} m dari titik absensi` : ''}</p></div>
      <div className="space-y-2"><ApprovalBadge status={receipt.approvalStatus} /><p className="text-sm leading-relaxed text-slate-600">{receipt.approvalNote}</p></div>
    </div>}
  </ModalShell>;
}
