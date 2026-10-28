'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AssetFormModal from '@/components/assets/AssetFormModal';
import AssetInformationCard from '@/components/assets/AssetInformationCard';
import ComputerSpecsCard from '@/components/assets/ComputerSpecsCard';
import AssetAccessoriesCard from '@/components/assets/AssetAccessoriesCard';
import AssetHistoryTabs, { type AssetHistoryData } from '@/components/assets/AssetHistoryTabs';
import LogMaintenanceModal from '@/components/assets/LogMaintenanceModal';
import DisposeAssetModal from '@/components/assets/DisposeAssetModal';
import PrintAssetTagModal from '@/components/assets/PrintAssetTagModal';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { isComputerCategoryName } from '@/lib/assetForm';
import { canManageAssets } from '@/lib/assetImport';
import {
  ArrowLeft,
  Edit,
  Printer,
  Wrench,
  Archive,
  QrCode,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { AssetDetail } from '@/lib/assets/types';

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const assetId = Number(resolvedParams.id);
  const { user } = useAuth();
  const canManage = canManageAssets(user?.roleName);

  // Data States
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [history, setHistory] = useState<AssetHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isDisposeModalOpen, setIsDisposeModalOpen] = useState(false);

  // Fetch Asset & History Data
  const fetchAssetData = useCallback(async () => {
    if (isNaN(assetId)) {
      setError('Invalid asset ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [assetData, historyData] = await Promise.all([
        api.get<AssetDetail>(`/assets/${assetId}`),
        api.get<AssetHistoryData>(`/assets/${assetId}/history`).catch(() => null),
      ]);

      setAsset(assetData);
      setHistory(historyData);
    } catch (err: any) {
      setError(err.message || 'Failed to load asset details');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchAssetData();
  }, [fetchAssetData]);

  // Generate QR Code for on-page preview
  useEffect(() => {
    if (asset && typeof window !== 'undefined') {
      const qrPayload = `${window.location.origin}/dashboard/assets/${asset.id}`;
      QRCode.toDataURL(qrPayload, {
        width: 300,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code', err));
    }
  }, [asset]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-24 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
          <p className="mt-3 text-sm text-slate-500 font-mono">Loading Asset Information...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !asset) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Asset Not Found</h2>
            <p className="text-xs text-slate-500 mt-1">{error || 'Data could not be retrieved.'}</p>
          </div>
          <Link
            href="/dashboard/assets"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Inventory</span>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const isComputer = isComputerCategoryName(asset.categoryName);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Link & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard/assets"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-500 hover:text-emerald-600 mb-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Asset Catalog</span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-xl font-extrabold font-mono text-emerald-600 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-xl">
                {asset.assetCode}
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{asset.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canManage && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="px-3.5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-bold rounded-xl text-xs shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Edit className="w-4 h-4 text-slate-600" />
                <span>Edit Asset</span>
              </button>
            )}

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded-xl text-xs shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-600" />
              <span>Print Asset Tag QR</span>
            </button>

            <button
              onClick={() => setIsMaintenanceModalOpen(true)}
              className="px-3.5 py-2.5 bg-white border border-slate-200 hover:border-amber-300 text-slate-700 hover:text-amber-700 font-bold rounded-xl text-xs shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Wrench className="w-4 h-4 text-amber-600" />
              <span>Log Maintenance</span>
            </button>

            {asset.status !== 'Disposed' && (
              <button
                onClick={() => setIsDisposeModalOpen(true)}
                className="px-3.5 py-2.5 bg-white border border-slate-200 hover:border-rose-300 text-slate-700 hover:text-rose-700 font-bold rounded-xl text-xs shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Archive className="w-4 h-4 text-rose-600" />
                <span>Dispose Asset</span>
              </button>
            )}
          </div>
        </div>

        {/* Top Info Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <AssetInformationCard asset={asset} />

          {/* Asset Scannable QR Code Badge Preview */}
          <div className="glass-panel p-6 rounded-3xl bg-gradient-to-br from-white via-slate-50 to-emerald-50/20 border border-slate-200 flex flex-col justify-between items-center text-center">
            <div className="w-full border-b border-slate-200 pb-3 flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-slate-900 uppercase">
                GAJIANICH Property Tag
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="my-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-center w-full max-w-[220px]">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Scannable QR Code"
                  className="w-32 h-32 mx-auto border border-slate-900 p-1 bg-white"
                />
              ) : (
                <div className="w-32 h-32 bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}
              <p className="text-[10px] font-mono text-slate-500 font-bold mt-2 tracking-wider uppercase">
                {asset.assetCode}
              </p>
            </div>

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Thermal Sticker Preview</span>
            </button>
          </div>
        </div>

        {/* Computer Specific Cards (Specs & Accessories) */}
        {isComputer && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ComputerSpecsCard asset={asset} />
            <AssetAccessoriesCard asset={asset} />
          </div>
        )}

        {/* History Tabs Navigation */}
        <AssetHistoryTabs
          history={history}
          onOpenMaintenanceModal={() => setIsMaintenanceModalOpen(true)}
        />
      </div>

      {/* Edit Asset Modal (Reused existing component!) */}
      <AssetFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        asset={asset}
        canManage={canManage}
        onSuccess={fetchAssetData}
      />

      {/* Print Thermal QR Sticker Modal */}
      <PrintAssetTagModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        asset={asset}
      />

      {/* Log Maintenance Modal */}
      <LogMaintenanceModal
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        onSuccess={fetchAssetData}
        asset={asset}
      />

      {/* Dispose Asset Modal */}
      <DisposeAssetModal
        isOpen={isDisposeModalOpen}
        onClose={() => setIsDisposeModalOpen(false)}
        onSuccess={fetchAssetData}
        asset={asset}
      />
    </DashboardLayout>
  );
}
