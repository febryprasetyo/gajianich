'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AssetKpiCard from '@/components/assets/dashboard/AssetKpiCard';
import AssetTrendChart, { PurchaseTrendItem } from '@/components/assets/dashboard/AssetTrendChart';
import AssetDepartmentBar, { DepartmentDistributionItem } from '@/components/assets/dashboard/AssetDepartmentBar';
import AssetCategoryBreakdown, { CategoryDistributionItem } from '@/components/assets/dashboard/AssetCategoryBreakdown';
import AssetRecentTable, { RecentAssetItem } from '@/components/assets/dashboard/AssetRecentTable';
import AssetFormModal from '@/components/assets/AssetFormModal';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { canManageAssets } from '@/lib/assetImport';
import { getTimeBasedGreeting } from '@/lib/attendance/overviewMetrics';
import {
  HardDrive,
  Plus,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  PackageCheck,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface DashboardSummaryResponse {
  success: boolean;
  data: {
    kpis: {
      totalAssets: number;
      assignedAssets: number;
      availableAssets: number;
      maintenanceAssets: number;
      damagedAssets: number;
      assignedPercentage: number;
    };
    purchaseTrend: PurchaseTrendItem[];
    byDepartment: DepartmentDistributionItem[];
    byCategory: CategoryDistributionItem[];
    recentAssets: RecentAssetItem[];
  };
}

export default function AssetDashboardOverviewPage() {
  const { user } = useAuth();
  const canManage = canManageAssets(user?.roleName);

  const [data, setData] = useState<DashboardSummaryResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get<DashboardSummaryResponse>('/assets/dashboard-summary');
      if (res && res.data) {
        setData(res.data);
      } else {
        throw new Error('Format data respon tidak valid');
      }
    } catch (err: any) {
      console.error('Failed to load asset dashboard summary:', err);
      setError(err.message || 'Gagal memuat ringkasan dashboard aset operasional');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const greeting = getTimeBasedGreeting(user?.fullName || 'Admin');
  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());

  const attentionCount = (data?.kpis.maintenanceAssets || 0) + (data?.kpis.damagedAssets || 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
        {/* Header / Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 p-6 sm:p-8 border border-slate-200/80 shadow-sm">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 font-mono text-[11px] font-bold tracking-wide uppercase border border-emerald-200">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  IT Administrator Workspace
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {formattedDate}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {greeting}
              </h1>

              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Pusat kendali dan analitik inventaris perangkat IT perusahaan. Pantau status pengadaan, alokasi penggunaan, dan kesiapan perangkat kerja secara terpusat.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">

              <Link
                href="/dashboard/assets"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Inventaris Penuh</span>
              </Link>

              {canManage && (
                <button
                  type="button"
                  onClick={() => setIsAssetModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Aset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between text-xs text-red-700">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchDashboardData()}
              className="text-red-700 font-bold underline hover:text-red-800 ml-4 cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* KPI Cards Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AssetKpiCard
            title="Total Aset Terdata"
            value={loading ? "..." : (data?.kpis.totalAssets ?? 0)}
            subtext="Semua unit terdaftar di sistem"
            icon={HardDrive}
            variant="emerald"
            badge="Total Unit"
          />

          <AssetKpiCard
            title="Aset Sedang Digunakan"
            value={loading ? "..." : (data?.kpis.assignedAssets ?? 0)}
            subtext={loading ? "" : `${data?.kpis.assignedPercentage ?? 0}% Tingkat Utilisasi`}
            icon={PackageCheck}
            variant="blue"
            badge="Assigned"
          />

          <AssetKpiCard
            title="Cadangan Siap Pakai"
            value={loading ? "..." : (data?.kpis.availableAssets ?? 0)}
            subtext="Tersedia di pool / stok gudang"
            icon={ShieldCheck}
            variant="amber"
            badge="Available"
          />

          <AssetKpiCard
            title="Perlu Perhatian"
            value={loading ? "..." : attentionCount}
            subtext={
              loading
                ? ""
                : `${data?.kpis.maintenanceAssets ?? 0} Perbaikan, ${data?.kpis.damagedAssets ?? 0} Rusak`
            }
            icon={AlertTriangle}
            variant="rose"
            badge="Maintenance"
          />
        </section>

        {/* Analytics Row: Trend & Department */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <AssetTrendChart data={data?.purchaseTrend || []} />
          <AssetDepartmentBar data={data?.byDepartment || []} />
        </section>

        {/* Analytics Row: Categories & Recent Table */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 h-full">
            <AssetCategoryBreakdown data={data?.byCategory || []} />
          </div>

          <div className="lg:col-span-7 h-full">
            <AssetRecentTable data={data?.recentAssets || []} />
          </div>
        </section>
      </div>

      {/* Asset Form Modal for Quick Creation */}
      {isAssetModalOpen && (
        <AssetFormModal
          isOpen={isAssetModalOpen}
          onClose={() => setIsAssetModalOpen(false)}
          canManage={canManage}
          onSuccess={() => {
            setIsAssetModalOpen(false);
            fetchDashboardData();
          }}
        />
      )}
    </DashboardLayout>
  );
}
