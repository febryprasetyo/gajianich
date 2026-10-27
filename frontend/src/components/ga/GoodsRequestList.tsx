'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  Loader2,
  FileText,
  Search,
  Pencil,
  Trash2,
  Clock,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  GA_API_PATH,
  GA_BASE_PATH,
  GoodsRequest,
  capitalizeWords,
  formatFirstItemTitle,
  requestNumber,
  rupiah,
} from '@/lib/goodsRequests';
import StatusTransitionModal from './StatusTransitionModal';
import { getAllowedTransitions, getStatusSelectionClass, getStatusBadgeConfig, getStatusLabel, isRequestEditable } from '@/lib/ga/goodsRequestStatus';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';

export default function GoodsRequestList() {
  const { hasPermission } = useAuth();
  const [decision, setDecision] = useState<{ request: GoodsRequest; target: 'approved_manually' | 'rejected' }>();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<{ items: GoodsRequest[]; total: number; pageSize: number }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<GoodsRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleDeleteConfirm() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`${GA_API_PATH}/${deleteTarget.id}`);
      setDeleteTarget(null);
      setRetry(v => v + 1);
    } catch (err) {
      setDeleteError((err as Error).message || 'Gagal menghapus pengajuan.');
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page) });
    if (statusFilter !== 'all') {
      query.set('status', statusFilter);
    }

    if (search.trim()) query.set('search', search.trim());

    setLoading(true);
    api.get<{ items: GoodsRequest[]; total: number; pageSize: number }>(`${GA_API_PATH}?${query.toString()}`)
      .then(result => {
        if (active) {
          setData(result);
          setError('');
        }
      })
      .catch(cause => {
        if (active) setError(cause.message || 'Gagal memuat daftar pengajuan.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [page, statusFilter, search, retry]);

  function reload() {
    setLoading(true);
    setError('');
    setRetry(v => v + 1);
  }

  function handleFilterChange(key: string) {
    setStatusFilter(key);
    setPage(1);
  }

  const items = data?.items || [];
  // Metric counts based on loaded data
  const approvedCount = items.filter(i => i.status === 'approved_manually').length;
  const draftCount = items.filter(i => i.status === 'draft').length;
  const rejectedCount = items.filter(i => i.status === 'rejected').length;
  const cancelledCount = items.filter(i => i.status === 'cancelled').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header - Standard AMS Directory Pattern */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
                <ClipboardList className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Permintaan Barang GA
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Direktori pengajuan pengadaan barang dengan alur pengesahan fisik (tanda tangan basah).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasPermission('ga.requests.create') && (
              <Link
                href={`${GA_BASE_PATH}/new`}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" /> Buat Pengajuan
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" role="group" aria-label="Filter status pengajuan barang">
          {([
            { key: 'all', label: 'Total Pengajuan', count: data?.total ?? 0, Icon: ClipboardList, tone: 'bg-slate-50 border-slate-200 text-slate-600' },
            { key: 'draft', label: 'Draft', count: draftCount, Icon: FileText, tone: 'bg-slate-50 border-slate-200 text-slate-600' },
            { key: 'rejected', label: 'Ditolak', count: rejectedCount, Icon: XCircle, tone: 'bg-rose-100 border-rose-300 text-rose-800' },
            { key: 'approved_manually', label: 'Disetujui', count: approvedCount, Icon: Clock, tone: 'bg-emerald-100 border-emerald-300 text-emerald-800' },
            { key: 'cancelled', label: 'Dibatalkan', count: cancelledCount, Icon: AlertCircle, tone: 'bg-slate-100 border-slate-300 text-slate-800' },
          ] as const).map(({ key, label, count, Icon, tone }) => (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={statusFilter === key}
              onClick={() => handleFilterChange(key)}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left shadow-sm transition-colors ${statusFilter === key ? getStatusSelectionClass(key) : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50'}`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
                <Icon size={20} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-mono text-[11px] uppercase tracking-wider text-slate-600">{label}</span>
                <span className="mt-0.5 block text-xl font-bold text-slate-900">{count}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center gap-3 shadow-sm">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              aria-label="Cari pengajuan"
              maxLength={1000}
              placeholder="Cari nomor pengajuan, nama barang, pemohon, atau divisi..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            />
          </div>
        </div>

        {/* Table Container - Standard AMS Data Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <p role="status" className="flex items-center justify-center gap-2 p-12 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Memuat daftar pengajuan barang...
            </p>
          ) : error ? (
            <div role="alert" className="p-6 text-xs text-rose-700">
              <p>{error}</p>
              <button
                onClick={reload}
                className="mt-3 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Coba kembali
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              <p>Tidak ada pengajuan ditemukan untuk filter ini.</p>
              {hasPermission('ga.requests.create') && (
                <Link
                  href={`${GA_BASE_PATH}/new`}
                  className="mt-3 inline-flex items-center rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Buat Pengajuan Baru
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    <tr>
                      <th scope="col" className="p-4 font-semibold">Nomor & Barang</th>
                      <th scope="col" className="p-4 font-semibold">Tanggal</th>
                      <th scope="col" className="p-4 font-semibold">Pemohon</th>
                      <th scope="col" className="p-4 font-semibold text-right">Total Estimasi</th>
                      <th scope="col" className="p-4 font-semibold text-center">Status Administrasi</th>
                      <th scope="col" className="p-4 font-semibold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((request) => {
                      const badge = getStatusBadgeConfig(request.status);
                      const displayTitle = formatFirstItemTitle(request);
                      const itemCount = request.itemCount ?? request.items?.length ?? 1;
                      const extraItems = Math.max(0, itemCount - 1);
                      return (
                        <tr
                          key={request.id}
                          className="text-slate-700 hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="p-4">
                            <div className="font-mono font-bold text-slate-900">
                              {requestNumber(request)}
                            </div>
                            <div
                              className="mt-0.5 block max-w-[200px] sm:max-w-xs md:max-w-sm lg:max-w-md truncate font-medium text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis"
                              title={displayTitle}
                            >
                              {displayTitle}
                            </div>
                            {extraItems > 0 && (
                              <p className="mt-0.5 text-xs font-medium text-slate-500">
                                +{extraItems} barang
                              </p>
                            )}
                            {!!request.matchedItemNames?.length && (
                              <p className="mt-1 max-w-[200px] sm:max-w-xs md:max-w-sm lg:max-w-md truncate text-xs text-emerald-800" title={request.matchedItemNames.join(', ')}>
                                Barang cocok: {request.matchedItemNames.join(', ')}
                              </p>
                            )}
                          </td>
                          <td className="p-4 whitespace-nowrap text-slate-600">
                            {request.requestDate.split('-').reverse().join('/')}
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-slate-900">
                              {capitalizeWords(request.requesterName)}
                            </div>
                          </td>
                          <td className="p-4 text-right font-semibold text-slate-900">
                            {rupiah(request.totalEstimated || 0)}
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClass}`} />
                              {getStatusLabel(request.status)}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-2">
                            {hasPermission('ga.requests.create') && (['approved_manually', 'rejected'] as const).map(target => (
                              <button key={target} type="button" disabled={!getAllowedTransitions(request.status).includes(target)} onClick={() => setDecision({ request, target })} className={`inline-flex min-h-10 items-center rounded-xl border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${target === 'approved_manually' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'}`}>
                                {target === 'approved_manually' ? 'Disetujui' : 'Ditolak'}
                              </button>
                            ))}
                            <Link
                              href={`${GA_BASE_PATH}/${request.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> Detail
                            </Link>

                            {isRequestEditable(request.status) && (
                              <Link
                                href={`${GA_BASE_PATH}/${request.id}/edit`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                                title="Edit pengajuan"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </Link>
                            )}

                            {isRequestEditable(request.status) && (
                              <button
                                type="button"
                                onClick={() => { setDeleteError(''); setDeleteTarget(request); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                                title="Hapus pengajuan"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Hapus
                              </button>
                            )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data && data.total > data.pageSize && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 text-xs text-slate-500">
                  <p>
                    {data.total} pengajuan · Halaman {page} dari {Math.max(1, Math.ceil(data.total / data.pageSize))}
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <button
                      disabled={page * data.pageSize >= data.total}
                      onClick={() => setPage(p => p + 1)}
                      className="px-3 py-1 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {decision && <StatusTransitionModal key={`${decision.request.id}-${decision.target}`} isOpen onClose={() => setDecision(undefined)} requestId={decision.request.id} currentStatus={decision.request.status} initialStatus={decision.target} onSuccess={reload} />}

      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => { if (!deleting) setDeleteTarget(null); }}
          onConfirm={handleDeleteConfirm}
          title="Hapus Permintaan Barang?"
          description="Pengajuan yang dihapus tidak dapat dipulihkan kembali. Seluruh data item dan bukti harga terkait akan dihapus secara permanen."
          itemName={requestNumber(deleteTarget)}
          itemDetails={[
            { label: 'Pemohon', value: deleteTarget.requesterName },
            { label: 'Divisi', value: deleteTarget.division },
            { label: 'Total Estimasi', value: rupiah(deleteTarget.totalEstimated || 0) },
            { label: 'Status', value: getStatusLabel(deleteTarget.status) },
          ]}
          confirmText="Hapus Pengajuan"
          variant="danger"
          isLoading={deleting}
          error={deleteError}
        />
      )}
    </DashboardLayout>
  );
}
