'use client';

import { Sliders } from 'lucide-react';
import ShiftApprovalSettingsCard from './ShiftApprovalSettingsCard';

export default function ApprovalRulesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Aturan Auto-Approve
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Atur kebijakan persetujuan otomatis presensi masuk dan pulang untuk masing-masing jadwal shift kerja.
          </p>
        </div>
      </div>

      <ShiftApprovalSettingsCard />
    </div>
  );
}
