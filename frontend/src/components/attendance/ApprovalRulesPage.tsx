'use client';

import { Sliders } from 'lucide-react';
import ShiftApprovalSettingsCard from './ShiftApprovalSettingsCard';

export default function ApprovalRulesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-slate-900">
          <Sliders className="w-5 h-5 text-emerald-600" />
          <h1 className="text-lg font-bold">Aturan Auto-Approve</h1>
        </div>
        <p className="text-xs text-slate-500">
          Atur kebijakan persetujuan otomatis presensi masuk dan pulang untuk masing-masing jadwal shift kerja.
        </p>
      </header>

      <ShiftApprovalSettingsCard />
    </div>
  );
}
