'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { HandoverDocumentView } from '@/components/assets/HandoverDocumentView';
import { fetchHandoverById } from '@/lib/assetHandovers';
import type { AssetHandover } from '@/types/assetHandover';
import {
  Printer,
  Edit,
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';

export default function HandoverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [handover, setHandover] = useState<AssetHandover | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchHandoverById(id);
        setHandover(data);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat dokumen tanda terima');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Action Bar Atas (Hidden saat Cetak) */}
        <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/assets/handovers"
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Kembali</span>
            </Link>

            <span className="text-xs font-mono font-semibold text-slate-500 hidden sm:inline">
              {handover?.handoverNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {handover && (
              <Link
                href={`/dashboard/assets/handovers/${handover.id}/edit`}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Dokumen</span>
              </Link>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Form Tanda Terima</span>
            </button>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="min-h-[400px] flex items-center justify-center bg-white border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span>Menyiapkan pratinjau dokumen tanda terima...</span>
            </div>
          </div>
        ) : error ? (
          <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-rose-700 text-sm font-semibold">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <Link
              href="/dashboard/assets/handovers"
              className="inline-block px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kembali ke Daftar Tanda Terima
            </Link>
          </div>
        ) : handover ? (
          /* Area Dokumen Cetak */
          <div className="handover-print-wrapper py-2">
            <HandoverDocumentView handover={handover} />
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
