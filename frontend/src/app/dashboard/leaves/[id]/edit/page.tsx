'use client';

import { api } from '@/lib/api';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LeaveRequestForm } from '@/components/leaves/LeaveRequestForm';
import type { FullLeaveDocumentData } from '@/types/leaves';
import { ArrowLeft, CalendarDays, AlertCircle, ShieldAlert, Loader2 } from 'lucide-react';

export default function EditLeaveRequestPage() {
  const params = useParams();
  const id = params?.id as string;

  const [documentData, setDocumentData] = useState<FullLeaveDocumentData | null>(null);
  const [requestStatus, setRequestStatus] = useState<string>('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    async function fetchDoc() {
      try {
        const data = await api.get<FullLeaveDocumentData>(`/leaves/requests/${id}`);
        setDocumentData(data);
        const status = (data as any).status || (data as any).approvals?.applicant?.status || 'PENDING';
        setRequestStatus(status);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat data permohonan cuti');
      } finally {
        setIsLoading(false);
      }
    }
    fetchDoc();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-500 text-sm">
        <div className="flex items-center gap-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
          <span>Memuat data formulir permohonan cuti...</span>
        </div>
      </div>
    );
  }

  if (error || !documentData) {
    return (
      <div className="max-w-xl mx-auto mt-12 bg-white p-6 rounded-2xl border border-rose-200 shadow-sm text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">Permohonan Cuti Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500">{error || 'Data permohonan cuti tidak dapat dimuat.'}</p>
        <Link
          href="/dashboard/leaves"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Daftar Cuti
        </Link>
      </div>
    );
  }

  // Jika status bukan PENDING, blokir edit
  if (requestStatus !== 'PENDING') {
    return (
      <div className="max-w-xl mx-auto mt-12 bg-white p-6 rounded-2xl border border-amber-200 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Permohonan Cuti Tidak Dapat Diedit</h2>
        <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
          Permohonan cuti nomor <strong className="font-mono text-slate-800">{documentData.requestNumber}</strong> saat ini telah berstatus <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{requestStatus}</span>. Hanya permohonan berstatus PENDING yang dapat diubah.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard/leaves"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Daftar
          </Link>
          <Link
            href={`/dashboard/leaves/${id}/print`}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition cursor-pointer shadow-sm"
          >
            Lihat Dokumen F4
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Edit Permohonan Cuti</h1>
            <p className="text-xs text-slate-500 mt-1">
              Ubah rincian pengajuan cuti untuk nomor permohonan <strong className="font-mono text-slate-700">{documentData.requestNumber}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/leaves"
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-600" /> Batal & Kembali
          </Link>
        </div>
      </div>

      {/* Form in Edit Mode */}
      <LeaveRequestForm
        mode="edit"
        requestId={Number(id)}
        initialData={documentData}
      />
    </div>
  );
}
