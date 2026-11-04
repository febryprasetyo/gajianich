'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import { HandoverForm } from '@/components/assets/HandoverForm';
import { FileSignature } from 'lucide-react';

function NewHandoverContent() {
  const searchParams = useSearchParams();
  const prefillAssetId = searchParams.get('assetId');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buat Form Tanda Terima Baru"
        subtitle="Penerbitan dokumen tanda terima dan serah terima perlengkapan kerja / inventaris aset."
        icon={FileSignature}
      />

      <HandoverForm
        prefillAssetId={prefillAssetId ? Number(prefillAssetId) : undefined}
      />
    </div>
  );
}

export default function NewHandoverPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Memuat formulir...</div>}>
        <NewHandoverContent />
      </Suspense>
    </DashboardLayout>
  );
}
