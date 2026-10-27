'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import CustodianDirectoryTable from '@/components/custodians/CustodianDirectoryTable';
import HeldAssetsModal from '@/components/custodians/HeldAssetsModal';
import CustodianMetadataModal from '@/components/custodians/CustodianMetadataModal';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  canManageCustodians,
  type CustodianAssetsResponse,
  type CustodianHeldAsset,
  type CustodianSearchResponse,
  type CustodianSummary,
} from '@/lib/assetCustodian';
import {
  AlertCircle,
  GitMerge,
  Plus,
  Search,
  UserRoundCog,
} from 'lucide-react';

interface LocationOption {
  id: number;
  code: string;
  name: string;
}

export default function AssetCustodiansPage() {
  const { user } = useAuth();
  const canManage = canManageCustodians(user?.roleName);

  const [directory, setDirectory] = useState<CustodianSummary[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [reconciliationCount, setReconciliationCount] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'MERGED' | 'ALL'>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Status toggle confirmation
  const [statusTarget, setStatusTarget] = useState<{
    custodian: CustodianSummary;
    recordStatus: 'ACTIVE' | 'INACTIVE';
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Metadata Modal State (both create & edit)
  const [metadataModalOpen, setMetadataModalOpen] = useState(false);
  const [editingCustodian, setEditingCustodian] = useState<CustodianSummary | null>(null);

  // Held Assets Modal State
  const [viewingCustodian, setViewingCustodian] = useState<CustodianSummary | null>(null);
  const [heldAssets, setHeldAssets] = useState<CustodianHeldAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ search: search.trim(), status });
      const [directoryResult, reconciliationResult, locationResult] = await Promise.all([
        api.get<CustodianSearchResponse>(`/asset-custodians?${query.toString()}`),
        api.get<unknown[]>('/asset-custodians/reconciliation-candidates'),
        api.get<LocationOption[]>('/master/locations'),
      ]);
      setDirectory(Array.isArray(directoryResult?.custodians) ? directoryResult.custodians : []);
      setReconciliationCount(Array.isArray(reconciliationResult) ? reconciliationResult.length : 0);
      setLocations(Array.isArray(locationResult) ? locationResult : []);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load the custodian directory');
    } finally {
      setLoading(false);
    }
  }, [canManage, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(fetchData, 200);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  // Open Edit Modal
  const openEdit = (custodian: CustodianSummary) => {
    setEditingCustodian(custodian);
    setMetadataModalOpen(true);
  };

  // Open Create Modal
  const openCreate = () => {
    setEditingCustodian(null);
    setMetadataModalOpen(true);
  };

  // Open Held Assets Modal
  const openHeldAssets = async (custodian: CustodianSummary) => {
    setViewingCustodian(custodian);
    setHeldAssets([]);
    setLoadingAssets(true);
    setAssetsError(null);
    try {
      const response = await api.get<CustodianAssetsResponse>(
        `/asset-custodians/${custodian.id}/assets`
      );
      setHeldAssets(Array.isArray(response?.assets) ? response.assets : []);
    } catch (err: unknown) {
      setAssetsError((err as Error).message || 'Failed to load assigned assets');
    } finally {
      setLoadingAssets(false);
    }
  };

  // Deactivate / Reactivate
  const handleOpenStatusConfirm = (
    custodian: CustodianSummary,
    recordStatus: 'ACTIVE' | 'INACTIVE'
  ) => {
    setStatusTarget({ custodian, recordStatus });
    setStatusError(null);
  };

  const handleConfirmStatusChange = async () => {
    if (!statusTarget) return;
    const { custodian, recordStatus } = statusTarget;
    setIsUpdatingStatus(true);
    setStatusError(null);
    setBusyId(custodian.id);
    try {
      await api.patch(`/asset-custodians/${custodian.id}`, { recordStatus });
      setStatusTarget(null);
      await fetchData();
    } catch (err: unknown) {
      setStatusError((err as Error).message || 'Gagal mengubah status pemegang aset');
    } finally {
      setIsUpdatingStatus(false);
      setBusyId(null);
    }
  };

  if (!canManage) {
    return (
      <DashboardLayout>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <h1 className="text-lg font-bold text-slate-900">Administrator access required</h1>
          <p className="mt-1 text-xs text-slate-600">
            Custodian management requires SuperAdmin or ITAdmin role.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
                <UserRoundCog className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Asset Custodians
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage equipment holders, track assigned assets, and review HR directory linkages.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/master/asset-custodians/reconciliation"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <GitMerge className="h-4 w-4 text-emerald-600" />
              <span>HR Reconciliation</span>
              {reconciliationCount > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {reconciliationCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" /> New Custodian
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Directory Controls */}
        <section className="space-y-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search holder name or employee code..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
            >
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
              <option value="MERGED">Merged Only</option>
              <option value="ALL">All Statuses</option>
            </select>
          </div>

          {/* Directory Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CustodianDirectoryTable
              directory={directory}
              loading={loading}
              busyId={busyId}
              onOpenHeldAssets={openHeldAssets}
              onOpenEdit={openEdit}
              onOpenStatusConfirm={handleOpenStatusConfirm}
            />
          </div>
        </section>
      </div>

      {/* Held Assets Modal */}
      <HeldAssetsModal
        isOpen={!!viewingCustodian}
        onClose={() => setViewingCustodian(null)}
        custodian={viewingCustodian}
        heldAssets={heldAssets}
        loading={loadingAssets}
        error={assetsError}
      />

      {/* Create / Edit Custodian Metadata Modal */}
      <CustodianMetadataModal
        isOpen={metadataModalOpen}
        onClose={() => {
          setMetadataModalOpen(false);
          setEditingCustodian(null);
        }}
        custodian={editingCustodian}
        locations={locations}
        onSuccess={fetchData}
      />

      {/* Deactivate / Reactivate Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!statusTarget}
        onClose={() => {
          setStatusTarget(null);
          setStatusError(null);
        }}
        onConfirm={handleConfirmStatusChange}
        title={
          statusTarget?.recordStatus === 'ACTIVE'
            ? 'Aktifkan Kembali Pemegang Aset'
            : 'Nonaktifkan Pemegang Aset'
        }
        description={
          statusTarget?.recordStatus === 'ACTIVE'
            ? 'Pemegang aset ini akan diaktifkan kembali dan dapat dipilih untuk peminjaman/alokasi aset.'
            : 'Pemegang aset ini akan dinonaktifkan sehingga tidak dapat dipilih untuk alokasi baru.'
        }
        itemName={statusTarget?.custodian.displayName}
        itemDetails={
          statusTarget
            ? [
                { label: 'Nama Pemegang', value: statusTarget.custodian.displayName },
                ...(statusTarget.custodian.employeeCode
                  ? [{ label: 'NIK / Kode', value: statusTarget.custodian.employeeCode }]
                  : []),
                ...(statusTarget.custodian.locationName
                  ? [{ label: 'Lokasi', value: statusTarget.custodian.locationName }]
                  : []),
                ...(statusTarget.custodian.unitText
                  ? [{ label: 'Unit', value: statusTarget.custodian.unitText }]
                  : []),
                {
                  label: 'Total Aset',
                  value: `${statusTarget.custodian.assignedAssetCount ?? 0} unit`,
                },
              ]
            : []
        }
        confirmText={statusTarget?.recordStatus === 'ACTIVE' ? 'Aktifkan' : 'Nonaktifkan'}
        cancelText="Batal"
        variant={statusTarget?.recordStatus === 'ACTIVE' ? 'primary' : 'warning'}
        isLoading={isUpdatingStatus}
        error={statusError}
      />
    </DashboardLayout>
  );
}
