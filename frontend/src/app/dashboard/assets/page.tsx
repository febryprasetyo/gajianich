'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import AssetFormModal from '@/components/assets/AssetFormModal';
import AssetFilters from '@/components/assets/AssetFilters';
import AssetTable from '@/components/assets/AssetTable';
import AssignAssetModal from '@/components/assets/AssignAssetModal';
import ReturnAssetModal from '@/components/assets/ReturnAssetModal';
import AssetImportDialog from '@/components/assets/AssetImportDialog';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { canManageAssets, canManageLifecycle } from '@/lib/assetImport';
import {
  HardDrive,
  Plus,
  Download,
  Upload,
  Cpu,
  Loader2,
} from 'lucide-react';
import { AssetItem, CategoryItem, LocationItem } from '@/lib/assets/types';

export default function AssetsPage() {
  const { user } = useAuth();
  const canManage = canManageAssets(user?.roleName);
  const canLifecycle = canManageLifecycle(user?.roleName);

  // Data States
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Create/Edit Asset Modal State
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);

  // Assign Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningAsset, setAssigningAsset] = useState<AssetItem | null>(null);

  // Return/Unassign Modal State
  const [isUnassignModalOpen, setIsUnassignModalOpen] = useState(false);
  const [unassigningAsset, setUnassigningAsset] = useState<AssetItem | null>(null);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState<AssetItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // XLSX Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Fetch Auxiliary Reference Data
  useEffect(() => {
    const fetchAuxiliary = async () => {
      try {
        const [cats, locs] = await Promise.all([
          api.get<CategoryItem[]>('/assets/categories').catch(() => []),
          api.get<LocationItem[]>('/master/locations').catch(() => []),
        ]);
        setCategories(cats || []);
        setLocations(locs || []);
      } catch (err: any) {
        console.error('Failed to load auxiliary filter data:', err);
      }
    };
    fetchAuxiliary();
  }, []);

  // Fetch Assets with Filtering & Pagination
  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCategory !== 'ALL') params.append('categoryId', selectedCategory);
      if (selectedLocation !== 'ALL') params.append('locationId', selectedLocation);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const res = await api.get<AssetItem[] | { data: AssetItem[]; total?: number } | { assets: AssetItem[]; total?: number }>(
        `/assets?${params.toString()}`
      );
      if (Array.isArray(res)) {
        setAssets(res);
        setTotalCount(res.length);
      } else if (res && 'data' in res && Array.isArray(res.data)) {
        setAssets(res.data);
        setTotalCount(res.total ?? res.data.length);
      } else if (res && 'assets' in res && Array.isArray(res.assets)) {
        setAssets(res.assets);
        setTotalCount(res.total ?? res.assets.length);
      } else {
        setAssets([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load asset inventory');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedLocation, selectedStatus, page]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Handlers for Modals
  const handleOpenCreateModal = () => {
    setEditingAsset(null);
    setIsAssetModalOpen(true);
  };

  const handleOpenEditModal = (asset: AssetItem) => {
    setEditingAsset(asset);
    setIsAssetModalOpen(true);
  };

  const handleOpenDeleteModal = (asset: AssetItem) => {
    setDeletingAsset(asset);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAsset) return;
    try {
      setDeleteSubmitting(true);
      setDeleteError(null);
      await api.delete(`/assets/${deletingAsset.id}`);
      setIsDeleteModalOpen(false);
      setDeletingAsset(null);
      fetchAssets();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete asset');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleOpenAssignModal = (asset: AssetItem) => {
    setAssigningAsset(asset);
    setIsAssignModalOpen(true);
  };

  const handleOpenReturnModal = (asset: AssetItem) => {
    setUnassigningAsset(asset);
    setIsUnassignModalOpen(true);
  };

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      const blob = await api.download('/assets/import/template');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gajianich-asset-import-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to download asset import template');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Client-side window when backend returns full array
  const displayedAssets = useMemo(() => {
    if (assets.length > limit) {
      const start = (page - 1) * limit;
      return assets.slice(start, start + limit);
    }
    return assets;
  }, [assets, page, limit]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <HardDrive className="w-6 h-6 text-emerald-600" />
              <span>IT Asset & Hardware Inventory</span>
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Comprehensive hardware registry, computer specifications, accessory tracking, and custody lifecycle.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  title="Download standard 4-sheet XLSX bulk import template"
                >
                  {downloadingTemplate ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>Template</span>
                </button>

                <Link
                  href="/dashboard/hardware-audits"
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
                  title="Lihat antrean scan hardware dari portable tool flashdisk"
                >
                  <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Hardware Audits</span>
                </Link>

                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
                  title="Bulk import assets from 4-sheet XLSX template"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Bulk Import</span>
                </button>

                <button
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Asset</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <AssetFilters
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          selectedCategory={selectedCategory}
          onCategoryChange={(val) => {
            setSelectedCategory(val);
            setPage(1);
          }}
          selectedLocation={selectedLocation}
          onLocationChange={(val) => {
            setSelectedLocation(val);
            setPage(1);
          }}
          selectedStatus={selectedStatus}
          onStatusChange={(val) => {
            setSelectedStatus(val);
            setPage(1);
          }}
          categories={categories}
          locations={locations}
        />

        {/* Asset Inventory Table */}
        <AssetTable
          assets={displayedAssets}
          loading={loading}
          error={error}
          canManage={canManage}
          canLifecycle={canLifecycle}
          page={page}
          limit={limit}
          totalCount={totalCount}
          onPageChange={setPage}
          onAssign={handleOpenAssignModal}
          onReturn={handleOpenReturnModal}
          onEdit={handleOpenEditModal}
          onDelete={handleOpenDeleteModal}
          onRegisterFirst={handleOpenCreateModal}
        />
      </div>

      {/* Register / Edit Asset Modal (Reused existing component!) */}
      <AssetFormModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        asset={editingAsset}
        canManage={canManage}
        onSuccess={fetchAssets}
      />

      {/* Assign Custody Modal */}
      <AssignAssetModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onSuccess={fetchAssets}
        asset={assigningAsset}
        locations={locations}
        canManage={canManage}
      />

      {/* Return Asset to Stock Modal */}
      <ReturnAssetModal
        isOpen={isUnassignModalOpen}
        onClose={() => setIsUnassignModalOpen(false)}
        onSuccess={fetchAssets}
        asset={unassigningAsset}
      />

      {/* XLSX Bulk Import Dialog */}
      <AssetImportDialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchAssets}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteSubmitting}
        error={deleteError}
        title="Delete Asset from Registry"
        description="Are you sure you want to delete this hardware asset? This action will permanently delete all specs, accessories, and historical logs."
        itemName={deletingAsset ? `${deletingAsset.assetCode} — ${deletingAsset.name}` : null}
        itemDetails={
          deletingAsset
            ? [
                { label: 'Category', value: deletingAsset.categoryName || 'IT Asset' },
                { label: 'Status', value: deletingAsset.status },
                { label: 'Location', value: deletingAsset.locationName || 'Unassigned' },
              ]
            : undefined
        }
        confirmText="Confirm Permanent Delete"
        variant="danger"
      />
    </DashboardLayout>
  );
}
