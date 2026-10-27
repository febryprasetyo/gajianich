'use client';

import React from "react";
import Link from "next/link";
import { LeaveRequestForm } from "@/components/leaves/LeaveRequestForm";
import { ArrowLeft, CalendarDays } from "lucide-react";

export default function NewLeaveRequestPage() {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Form Pengajuan Cuti</h1>
            <p className="text-xs text-slate-500 mt-1">
              Isi formulir pengajuan cuti karyawan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/leaves"
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-600" /> Kembali ke Daftar
          </Link>
        </div>
      </div>

      {/* Main Form */}
      <LeaveRequestForm />
    </div>
  );
}
