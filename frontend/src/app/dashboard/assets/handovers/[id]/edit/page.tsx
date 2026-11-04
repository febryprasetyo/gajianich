'use client';

import React, { useState, useEffect, use } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import { HandoverForm } from '@/components/assets/HandoverForm';
import { fetchHandoverById } from '@/lib/assetHandovers';
import type { AssetHandover } from '@/types/assetHandover';
import { FileSignature, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function EditHandoverPage({
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={`Edit Tanda Terima: ${handover?.handoverNumber || '...'}`}
          subtitle="Perbarui metadata, checklist jenis barang, atau rincian item serah terima."
          icon={FileSignature}
        />

        {loading ? (
          <div className="min-h-[300px] flex items-center justify-center bg-white border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Memuat data tanda terima...</span>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-rose-700 text-sm font-semibold">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <Link
              href="/dashboard/assets/handovers"
              className="inline-block px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kembali ke Daftar
            </Link>
          </div>
        ) : handover ? (
          <HandoverForm initialData={handover} />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
