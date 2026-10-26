'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import HardwareAuditFilters from '@/components/hardware-audits/HardwareAuditFilters';
import HardwareAuditCard from '@/components/hardware-audits/HardwareAuditCard';
import LinkAuditToAssetModal from '@/components/hardware-audits/LinkAuditToAssetModal';
import CreateAssetFromAuditModal from '@/components/hardware-audits/CreateAssetFromAuditModal';
import { api } from '@/lib/api';
import {
  HardwareAuditItem,
  CategoryOption,
  LocationOption,
  AllAssetOption,
} from '@/lib/hardware-audits/types';
import {
  Cpu,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

export default function HardwareAuditsPage() {
  const [audits, setAudits] = useState<HardwareAuditItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [allAssets, setAllAssets] = useState<AllAssetOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'SYNCED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [linkModalAudit, setLinkModalAudit] = useState<HardwareAuditItem | null>(null);
  const [createModalAudit, setCreateModalAudit] = useState<HardwareAuditItem | null>(null);
  const [deletingAudit, setDeletingAudit] = useState<HardwareAuditItem | null>(null);
  const [deleteAuditError, setDeleteAuditError] = useState<string | null>(null);
  const [isClearingSyncedOpen, setIsClearingSyncedOpen] = useState(false);
  const [clearSyncedError, setClearSyncedError] = useState<string | null>(null);

  // UI state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchAudits = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ data: HardwareAuditItem[]; total: number }>('/hardware-audits');
      setAudits(res.data || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal memuat daftar audit hardware' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [cats, locs, assetsRes] = await Promise.all([
        api.get<CategoryOption[]>('/assets/categories').catch(() => []),
        api.get<LocationOption[]>('/master/locations').catch(() => []),
        api.get<any>('/assets?limit=500').catch(() => []),
      ]);
      setCategories(cats || []);
      setLocations(locs || []);

      const assetList = Array.isArray(assetsRes) ? assetsRes : assetsRes?.data || [];
      setAllAssets(assetList);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAudits();
    fetchReferenceData();
  }, [fetchAudits, fetchReferenceData]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenDeleteAudit = (audit: HardwareAuditItem) => {
    setDeletingAudit(audit);
    setDeleteAuditError(null);
  };

  const handleConfirmDeleteAudit = async () => {
    if (!deletingAudit) return;
    try {
      setIsActionLoading(true);
      setDeleteAuditError(null);
      await api.delete(`/hardware-audits/${deletingAudit.id}`);
      setFeedback({ type: 'success', message: 'Data audit berhasil dihapus dari daftar' });
      setDeletingAudit(null);
      fetchAudits();
    } catch (err: any) {
      setDeleteAuditError(err.message || 'Gagal menghapus audit');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOpenClearSynced = () => {
    setIsClearingSyncedOpen(true);
    setClearSyncedError(null);
  };

  const handleConfirmClearSynced = async () => {
    try {
      setIsActionLoading(true);
      setClearSyncedError(null);
      const res: any = await api.delete('/hardware-audits/clear-synced');
      setFeedback({
        type: 'success',
        message: res.message || 'Riwayat audit yang sudah disinkronkan berhasil dibersihkan',
      });
      setIsClearingSyncedOpen(false);
      fetchAudits();
    } catch (err: any) {
      setClearSyncedError(err.message || 'Gagal membersihkan data audit yang sudah disinkronkan');
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredAudits = audits.filter((item) => {
    if (activeTab === 'PENDING' && item.status !== 'PENDING') return false;
    if (activeTab === 'SYNCED' && !item.status.startsWith('SYNCED')) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.custodianName.toLowerCase().includes(q) ||
      (item.serialNumber && item.serialNumber.toLowerCase().includes(q)) ||
      (item.model && item.model.toLowerCase().includes(q)) ||
      (item.cpuName && item.cpuName.toLowerCase().includes(q))
    );
  });

  const pendingCount = audits.filter((a) => a.status === 'PENDING').length;
  const syncedCount = audits.filter((a) => a.status.startsWith('SYNCED')).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Cpu className="w-6 h-6 text-emerald-600" />
              <span>Hardware Audits & Collector Sync</span>
              {pendingCount > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-mono font-bold">
                  {pendingCount} Pending
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Antrean hasil scan laptop/PC dari portable tool flashdisk. Tautkan spesifikasi ke aset terdaftar, atau buat aset baru.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            <Link
              href="/dashboard/assets"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <HardDrive className="w-4 h-4 text-slate-300" />
              <span>Kembali ke IT Inventory</span>
            </Link>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl flex items-start gap-3 border shadow-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs font-medium">{feedback.message}</div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Stats & Filter Toolbar */}
        <HardwareAuditFilters
          totalCount={audits.length}
          pendingCount={pendingCount}
          syncedCount={syncedCount}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClearSynced={handleOpenClearSynced}
        />

        {/* Audit List Table / Cards */}
        <div className="glass-panel rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              <p className="text-xs font-mono font-medium text-slate-600">Memuat data hasil audit hardware...</p>
            </div>
          ) : filteredAudits.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-2.5">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Cpu className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-700">Belum ada data audit hardware</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
                Colokkan flashdisk berisi tool collector ke laptop user, masukkan nama dan klik Scan &amp; Sync.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredAudits.map((item) => (
                <HardwareAuditCard
                  key={item.id}
                  item={item}
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                  onOpenLink={(audit) => setLinkModalAudit(audit)}
                  onOpenCreate={(audit) => setCreateModalAudit(audit)}
                  onDelete={handleOpenDeleteAudit}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Tautkan ke Aset */}
      <LinkAuditToAssetModal
        isOpen={!!linkModalAudit}
        onClose={() => setLinkModalAudit(null)}
        audit={linkModalAudit}
        allAssets={allAssets}
        onSuccess={(message) => {
          setFeedback({ type: 'success', message });
          setLinkModalAudit(null);
          fetchAudits();
          fetchReferenceData();
        }}
      />

      {/* Modal: Buat Aset Baru */}
      <CreateAssetFromAuditModal
        isOpen={!!createModalAudit}
        onClose={() => setCreateModalAudit(null)}
        audit={createModalAudit}
        categories={categories}
        locations={locations}
        onSuccess={(message) => {
          setFeedback({ type: 'success', message });
          setCreateModalAudit(null);
          fetchAudits();
          fetchReferenceData();
        }}
      />

      {/* Modal: Hapus Audit */}
      <ConfirmDeleteModal
        isOpen={!!deletingAudit}
        onClose={() => setDeletingAudit(null)}
        onConfirm={handleConfirmDeleteAudit}
        title="Hapus Data Audit"
        description={`Hapus data audit untuk "${deletingAudit?.custodianName}" (${deletingAudit?.model || 'Hardware'})? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus Audit"
        variant="danger"
        isLoading={isActionLoading}
        error={deleteAuditError}
      />

      {/* Modal: Bersihkan Riwayat Synced */}
      <ConfirmDeleteModal
        isOpen={isClearingSyncedOpen}
        onClose={() => setIsClearingSyncedOpen(false)}
        onConfirm={handleConfirmClearSynced}
        title="Bersihkan Data yang Sudah Disinkronkan"
        description={`Apakah Anda yakin ingin menghapus ${syncedCount} riwayat audit yang statusnya sudah disinkronkan (SYNCED_AUTO / SYNCED_MANUAL)? Data audit pending tidak akan dihapus.`}
        confirmText="Bersihkan Riwayat"
        variant="danger"
        isLoading={isActionLoading}
        error={clearSyncedError}
      />
    </DashboardLayout>
  );
}
