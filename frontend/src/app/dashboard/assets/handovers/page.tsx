'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import KpiGrid, { type KpiCardItem } from '@/components/ui/KpiGrid';
import FilterToolbar from '@/components/ui/FilterToolbar';
import TableShell from '@/components/ui/TableShell';
import TablePagination from '@/components/ui/TablePagination';
import RowActionButton from '@/components/ui/RowActionButton';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import {
  fetchHandovers,
  fetchHandoverStats,
  deleteHandover,
  formatHandoverDate,
  getItemTypeLabel,
  HANDOVER_ITEM_TYPE_OPTIONS,
} from '@/lib/assetHandovers';
import type { AssetHandover, HandoverStats } from '@/types/assetHandover';
import {
  FileSignature,
  Plus,
  Printer,
  ExternalLink,
  Edit,
  Trash2,
  Files,
  Calendar,
  Laptop,
  CheckCircle2,
} from 'lucide-react';

export default function HandoversPage() {
  // Data states
  const [handovers, setHandovers] = useState<AssetHandover[]>([]);
  const [stats, setStats] = useState<HandoverStats>({
    total: 0,
    thisMonth: 0,
    withLaptopsOrPc: 0,
    activeCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Pagination states
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Delete modal state
  const [deletingHandover, setDeletingHandover] = useState<AssetHandover | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Stats
  const loadStats = useCallback(async () => {
    try {
      const res = await fetchHandoverStats();
      setStats(res);
    } catch (err) {
      console.warn('Gagal memuat statistik tanda terima:', err);
    }
  }, []);

  // Fetch List
  const loadHandovers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Map active KPI filter to query params if not manually overridden
      let itemTypeParam = selectedType;
      let statusParam = selectedStatus;

      if (activeKpiFilter === 'LAPTOP_PC' && !selectedType) {
        itemTypeParam = 'laptop';
      } else if (activeKpiFilter === 'COMPLETED' && !selectedStatus) {
        statusParam = 'COMPLETED';
      }

      const res = await fetchHandovers({
        search: search.trim() || undefined,
        itemType: itemTypeParam || undefined,
        status: statusParam || undefined,
        page,
        limit,
      });

      setHandovers(res.data);
      setTotal(res.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar tanda terima');
    } finally {
      setLoading(false);
    }
  }, [search, selectedType, selectedStatus, activeKpiFilter, page]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadHandovers();
  }, [loadHandovers]);

  // Handle KPI Quick-Filter Selection
  const handleSelectKpi = (id: string) => {
    setActiveKpiFilter(id);
    setPage(1);
    if (id === 'ALL') {
      setSelectedType('');
      setSelectedStatus('');
    } else if (id === 'THIS_MONTH') {
      setSelectedType('');
      setSelectedStatus('');
    } else if (id === 'LAPTOP_PC') {
      setSelectedType('laptop');
      setSelectedStatus('');
    } else if (id === 'COMPLETED') {
      setSelectedStatus('COMPLETED');
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setSelectedType('');
    setSelectedStatus('');
    setActiveKpiFilter('ALL');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search || selectedType || selectedStatus || (activeKpiFilter && activeKpiFilter !== 'ALL')
  );

  // Delete Action
  const handleConfirmDelete = async () => {
    if (!deletingHandover) return;
    try {
      setIsDeleting(true);
      await deleteHandover(deletingHandover.id);
      setDeletingHandover(null);
      await Promise.all([loadStats(), loadHandovers()]);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus dokumen tanda terima');
    } finally {
      setIsDeleting(false);
    }
  };

  // KPI Items
  const kpiItems: KpiCardItem[] = [
    {
      id: 'ALL',
      title: 'TOTAL TANDA TERIMA',
      value: stats.total,
      icon: Files,
      iconColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      helper: 'Semua dokumen tercatat',
    },
    {
      id: 'THIS_MONTH',
      title: 'BULAN INI',
      value: stats.thisMonth,
      icon: Calendar,
      iconColor: 'text-sky-700',
      bgColor: 'bg-sky-50',
      helper: 'Diterbitkan bulan berjalan',
    },
    {
      id: 'LAPTOP_PC',
      title: 'BERISI LAPTOP / PC',
      value: stats.withLaptopsOrPc,
      icon: Laptop,
      iconColor: 'text-indigo-700',
      bgColor: 'bg-indigo-50',
      helper: 'Penyerahan komputer kerja',
    },
    {
      id: 'COMPLETED',
      title: 'STATUS SELESAI',
      value: stats.activeCount,
      icon: CheckCircle2,
      iconColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      helper: 'Dokumen sah & ditandatangani',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 1. Page Header */}
        <PageHeader
          title="Daftar Tanda Terima & Serah Terima Barang"
          subtitle="Pencatatan resmi penyerahan laptop, monitor, PC, printer, dan inventaris kantor kepada karyawan/pemegang barang."
          icon={FileSignature}
          actions={
            <Link
              href="/dashboard/assets/handovers/new"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Tanda Terima Baru</span>
            </Link>
          }
        />

        {/* 2. KPI Cards Interaktif */}
        <KpiGrid
          items={kpiItems}
          activeFilter={activeKpiFilter}
          onSelectFilter={handleSelectKpi}
        />

        {/* 3. Toolbar Pencarian & Filter */}
        <FilterToolbar
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          searchPlaceholder="Cari nomor tanda terima, nama penerima, petugas, barang..."
          hasActiveFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
          dropdownFilters={
            <>
              {/* Filter Jenis Barang */}
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Semua Jenis Barang</option>
                {HANDOVER_ITEM_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Filter Status */}
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Semua Status</option>
                <option value="COMPLETED">Selesai (Completed)</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Diarsipkan (Archived)</option>
              </select>
            </>
          }
        />

        {/* 4. Table Data & Pagination */}
        <TableShell
          loading={loading}
          error={error}
          isEmpty={!loading && handovers.length === 0}
          emptyTitle="Belum Ada Dokumen Tanda Terima"
          emptyDescription="Belum ada riwayat form tanda terima barang yang tercatat sesuai pencarian atau filter saat ini."
          emptyAction={
            <Link
              href="/dashboard/assets/handovers/new"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Tanda Terima Pertama</span>
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                  <th className="py-3 px-4">No. Dokumen & Tanggal</th>
                  <th className="py-3 px-4">Penerima (Nama & Jabatan)</th>
                  <th className="py-3 px-4">Jenis Barang</th>
                  <th className="py-3 px-4">Rincian Item</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {handovers.map((h) => (
                  <tr
                    key={h.id}
                    className="hover:bg-slate-50/60 transition-colors text-xs text-slate-700"
                  >
                    {/* No. Dokumen & Tanggal */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900">
                        {h.handoverNumber}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {formatHandoverDate(h.handoverDate)}
                      </div>
                    </td>

                    {/* Penerima */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {h.recipientName}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {h.recipientPosition || 'Karyawan'}
                        {h.recipientPhone ? ` • ${h.recipientPhone}` : ''}
                      </div>
                    </td>

                    {/* Jenis Barang (Pill badges) */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(h.itemTypes || []).map((t, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {getItemTypeLabel(t)}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Rincian Item */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {h.firstItemName || 'Barang Serah Terima'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        {h.itemsCount ? `${h.itemsCount} total barang` : '1 item'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <StatusBadge
                        variant={
                          h.status === 'COMPLETED'
                            ? 'success'
                            : h.status === 'DRAFT'
                            ? 'warning'
                            : 'slate'
                        }
                      >
                        {h.status === 'COMPLETED'
                          ? 'Selesai'
                          : h.status === 'DRAFT'
                          ? 'Draft'
                          : 'Arsip'}
                      </StatusBadge>
                    </td>

                    {/* Aksi Berbasis Ikon */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <RowActionButton
                          icon={Printer}
                          label="Cetak Tanda Terima"
                          title="Cetak Dokumen Form Tanda Terima"
                          href={`/dashboard/assets/handovers/${h.id}`}
                          variant="emerald"
                        />
                        <RowActionButton
                          icon={ExternalLink}
                          label="Lihat Detail"
                          title="Lihat Pratinjau Dokumen"
                          href={`/dashboard/assets/handovers/${h.id}`}
                          variant="default"
                        />
                        <RowActionButton
                          icon={Edit}
                          label="Edit Tanda Terima"
                          title="Edit Formulir"
                          href={`/dashboard/assets/handovers/${h.id}/edit`}
                          variant="default"
                        />
                        <RowActionButton
                          icon={Trash2}
                          label="Hapus Tanda Terima"
                          title="Hapus Dokumen"
                          onClick={() => setDeletingHandover(h)}
                          variant="rose"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={page}
            limit={limit}
            total={total}
            onPageChange={(p) => setPage(p)}
            itemName="tanda terima"
          />
        </TableShell>

        {/* 5. Modal Konfirmasi Hapus */}
        <ConfirmDeleteModal
          isOpen={Boolean(deletingHandover)}
          onClose={() => setDeletingHandover(null)}
          onConfirm={handleConfirmDelete}
          isLoading={isDeleting}
          title="Hapus Dokumen Tanda Terima?"
          description={
            <span>
              Dokumen tanda terima{' '}
              <strong className="text-slate-900 font-mono">
                {deletingHandover?.handoverNumber}
              </strong>{' '}
              atas nama{' '}
              <strong className="text-slate-900">
                {deletingHandover?.recipientName}
              </strong>{' '}
              akan dihapus permanen beserta seluruh rincian barangnya.
            </span>
          }
          confirmText="Ya, Hapus Dokumen"
          cancelText="Batal"
          variant="danger"
        />
      </div>
    </DashboardLayout>
  );
}
