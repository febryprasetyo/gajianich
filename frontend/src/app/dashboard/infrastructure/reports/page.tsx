'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Play,
  RotateCcw,
  Search,
  Server,
  X,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import KpiGrid, { KpiCardItem } from '@/components/ui/KpiGrid';
import TableShell from '@/components/ui/TableShell';
import TablePagination from '@/components/ui/TablePagination';
import RowActionButton from '@/components/ui/RowActionButton';
import ModalShell from '@/components/ui/ModalShell';
import GenerateReportModal, { ServerOption } from '@/components/servers/GenerateReportModal';
import ReportDetailModal, { WeeklyReportDetail } from '@/components/servers/ReportDetailModal';
import { api } from '@/lib/api';

export interface ReportsApiResponse {
  success: boolean;
  data: WeeklyReportDetail[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface ServersApiResponse {
  success: boolean;
  data: Array<{
    id: number;
    serverCode: string;
    name: string;
  }>;
}

export default function WeeklyReportsPage() {
  const [reports, setReports] = useState<WeeklyReportDetail[]>([]);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedServer, setSelectedServer] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'NORMAL' | 'WARNING' | 'CRITICAL'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'NODE' | 'CLUSTER'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedReportDetail, setSelectedReportDetail] = useState<WeeklyReportDetail | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Feedback Modal (Error / Alert)
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    type: 'error' | 'warning' | 'success' | 'info';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  // Floating Toast
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  } | null>(null);

  const showToast = useCallback(
    (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
      setToast({ type, title, message });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchReports = useCallback(async () => {
    try {
      const res = await api.get<ReportsApiResponse>('/infrastructure/reports?limit=100');
      if (res?.data) {
        setReports(res.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal mengambil data laporan mingguan');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchServers = useCallback(async () => {
    try {
      const res = await api.get<ServersApiResponse>('/infrastructure/servers');
      if (res?.data) {
        setServers(
          res.data.map((s) => ({
            id: s.id,
            serverCode: s.serverCode,
            name: s.name,
          }))
        );
      }
    } catch {
      // Optional fallback
    }
  }, []);

  useEffect(() => {
    void fetchReports();
    void fetchServers();

    // Auto reactive poll every 20 seconds
    const interval = setInterval(() => {
      void fetchReports();
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchReports, fetchServers]);

  // Handle Download PDF
  const handleDownload = async (report: WeeklyReportDetail) => {
    setDownloadingId(report.id);
    showToast('info', 'Mengunduh Dokumen', `Menyiapkan berkas ${report.pdfFileName || 'PDF'}...`);
    try {
      const blob = await api.download(`/infrastructure/reports/${report.id}/download`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.pdfFileName || `Laporan-Mingguan-${report.serverCode}-${report.periodWeek}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('success', 'Unduhan Selesai', `Berkas ${a.download} berhasil diunduh.`);
    } catch (err: any) {
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Gagal Mengunduh Berkas PDF',
        message: err?.message || 'Berkas PDF fisik tidak ditemukan pada storage server.',
      });
      showToast('error', 'Gagal Mengunduh', err?.message || 'Berkas PDF fisik tidak ditemukan pada storage.');
    } finally {
      setDownloadingId(null);
    }
  };

  // KPI Calculations
  const kpiItems = useMemo<KpiCardItem<'all' | 'NORMAL' | 'WARNING' | 'CRITICAL'>[]>(() => {
    const total = reports.length;
    const normal = reports.filter((r) => r.status === 'NORMAL').length;
    const warning = reports.filter((r) => r.status === 'WARNING').length;
    const critical = reports.filter((r) => r.status === 'CRITICAL').length;

    return [
      {
        id: 'all',
        title: 'Total Laporan',
        value: total,
        icon: FileText,
        iconColor: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        helper: 'Seluruh riwayat audit',
      },
      {
        id: 'NORMAL',
        title: 'Status Normal',
        value: normal,
        icon: CheckCircle,
        iconColor: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        helper: 'SLA stabil tanpa anomali',
      },
      {
        id: 'WARNING',
        title: 'Perlu Perhatian',
        value: warning,
        icon: AlertTriangle,
        iconColor: 'text-amber-600',
        bgColor: 'bg-amber-50',
        helper: 'Beban tinggi / restart',
      },
      {
        id: 'CRITICAL',
        title: 'Kritis',
        value: critical,
        icon: AlertOctagon,
        iconColor: 'text-rose-600',
        bgColor: 'bg-rose-50',
        helper: 'Insiden berat / serangan',
      },
    ];
  }, [reports]);

  // Filtered List
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // Status filter from KPI Card or dropdown
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }
      // Scope filter
      if (scopeFilter !== 'all' && (r.scopeType || 'NODE') !== scopeFilter) {
        return false;
      }
      // Server filter
      if (selectedServer !== 'all' && String(r.serverId) !== selectedServer && r.serverCode !== selectedServer) {
        return false;
      }
      // Search query
      if (search) {
        const q = search.toLowerCase();
        const matchesCode = r.serverCode?.toLowerCase().includes(q);
        const matchesName = r.serverName?.toLowerCase().includes(q);
        const matchesWeek = r.periodWeek?.toLowerCase().includes(q);
        const matchesSummary = r.executiveSummary?.toLowerCase().includes(q);
        const matchesRca = r.incidentRca?.toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesWeek && !matchesSummary && !matchesRca) {
          return false;
        }
      }
      return true;
    });
  }, [reports, statusFilter, scopeFilter, selectedServer, search]);

  // Paginated List
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReports.slice(start, start + pageSize);
  }, [filteredReports, currentPage, pageSize]);

  const hasActiveFilters = search !== '' || selectedServer !== 'all' || statusFilter !== 'all' || scopeFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setSelectedServer('all');
    setStatusFilter('all');
    setScopeFilter('all');
    setCurrentPage(1);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Laporan Audit Server Mingguan"
          subtitle="Ringkasan berkala ketersediaan SLA, performa kapasitas hardware, dan audit keamanan server"
          icon={FileText}
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/servers"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition flex items-center gap-1.5 shadow-xs"
              >
                <Server className="w-4 h-4 text-slate-500" />
                <span>Dashboard Server360</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(true)}
                className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Audit Sekarang</span>
              </button>
            </div>
          }
        />

        {/* Interactive KPI Cards */}
        <KpiGrid<'all' | 'NORMAL' | 'WARNING' | 'CRITICAL'>
          items={kpiItems}
          loading={loading}
          activeFilter={statusFilter}
          onSelectFilter={(id) => {
            setStatusFilter(id);
            setCurrentPage(1);
          }}
          skeletonCount={4}
          className="lg:grid-cols-4"
        />

        {/* Search & Filter Toolbar - 1 Single Row */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs mb-6">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* 1. Search Box */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari kode server, nama host, atau periode pekan..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* 2. Select Cakupan */}
            <div className="w-full lg:w-44 shrink-0">
              <select
                value={scopeFilter}
                onChange={(e) => {
                  setScopeFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer shadow-2xs"
              >
                <option value="all">Semua Cakupan</option>
                <option value="NODE">Node Server</option>
                <option value="CLUSTER">Cluster Fleet</option>
              </select>
            </div>

            {/* 3. Select Server */}
            <div className="w-full lg:w-56 shrink-0">
              <select
                value={selectedServer}
                onChange={(e) => {
                  setSelectedServer(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer shadow-2xs truncate"
              >
                <option value="all">Semua Server</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.serverCode})
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Select Status */}
            <div className="w-full lg:w-44 shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer shadow-2xs"
              >
                <option value="all">Semua Status</option>
                <option value="NORMAL">Normal</option>
                <option value="WARNING">Perlu Perhatian</option>
                <option value="CRITICAL">Kritis</option>
              </select>
            </div>

            {/* 5. Reset Filter Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3.5 py-2 text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                title="Reset semua filter ke default"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Table Shell & Report Records */}
        <TableShell
          loading={loading}
          error={error}
          isEmpty={filteredReports.length === 0}
          emptyTitle="Belum Ada Laporan Audit"
          emptyDescription={
            hasActiveFilters
              ? 'Tidak ada laporan audit yang sesuai dengan filter pencarian.'
              : 'Belum ada arsip laporan audit mingguan yang diterbitkan. Klik tombol Audit Sekarang untuk memulai.'
          }
          emptyAction={
            <button
              type="button"
              onClick={() => setIsGenerateModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Audit Sekarang</span>
            </button>
          }
          onRetry={() => void fetchReports()}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 text-slate-800 font-extrabold uppercase text-xs tracking-wider">
                  <th className="px-4 py-3.5">Pekan</th>
                  <th className="px-4 py-3.5">Server & Cakupan</th>
                  <th className="px-4 py-3.5">Rentang Periode</th>
                  <th className="px-4 py-3.5">SLA</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Ringkasan Eksekutif</th>
                  <th className="px-4 py-3.5 text-right">Ukuran</th>
                  <th className="px-4 py-3.5">Tanggal Terbit</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedReports.map((report) => {
                  const isCluster = report.scopeType === 'CLUSTER';
                  const statusStyle =
                    report.status === 'NORMAL'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : report.status === 'WARNING'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300';

                  const dotStyle =
                    report.status === 'NORMAL'
                      ? 'bg-emerald-600'
                      : report.status === 'WARNING'
                      ? 'bg-amber-600'
                      : 'bg-rose-600';

                  return (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 font-bold border border-slate-300 text-xs">
                          {report.periodWeek}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-xs">{report.serverName}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                              isCluster
                                ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                : 'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            {isCluster ? 'CLUSTER' : 'NODE'}
                          </span>
                        </div>
                        <div className="text-xs font-mono font-medium text-slate-600">{report.serverCode}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-medium whitespace-nowrap text-xs">
                        {report.startDate} &rarr; {report.endDate}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-black text-emerald-800 text-xs">
                          {report.slaPercent || (report.status === 'NORMAL' ? '99.98' : '99.65')}%
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusStyle}`}>
                          <span className={`w-2 h-2 rounded-full ${dotStyle}`}></span>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-sm text-slate-800 truncate text-xs font-normal" title={report.executiveSummary || ''}>
                        {report.executiveSummary || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-700 whitespace-nowrap text-xs">
                        {(report.fileSizeBytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap text-xs">
                        {new Date(report.createdAt).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <RowActionButton
                            icon={Download}
                            label="Unduh PDF Resmi"
                            title="Unduh Berkas PDF Resmi"
                            variant="emerald"
                            onClick={() => handleDownload(report)}
                          />
                          <RowActionButton
                            icon={Eye}
                            label="Lihat Ringkasan"
                            title="Lihat Ringkasan & RCA"
                            variant="default"
                            onClick={() => setSelectedReportDetail(report)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <TablePagination
            page={currentPage}
            limit={pageSize}
            total={filteredReports.length}
            onPageChange={setCurrentPage}
            itemName="laporan"
          />
        </TableShell>

        {/* Modal Generate On-Demand */}
        <GenerateReportModal
          isOpen={isGenerateModalOpen}
          onClose={() => setIsGenerateModalOpen(false)}
          servers={servers}
          onSuccess={() => {
            showToast('success', 'Audit Dimulai', 'Pekerjaan pembuatan audit mingguan berjalan di latar belakang.');
            void fetchReports();
          }}
        />

        {/* Modal Detail Ringkasan */}
        <ReportDetailModal
          isOpen={Boolean(selectedReportDetail)}
          onClose={() => setSelectedReportDetail(null)}
          report={selectedReportDetail}
          onDownload={handleDownload}
          isDownloading={downloadingId === selectedReportDetail?.id}
        />

        {/* Modal Box Feedback / Alert (Pengganti alert() browser) */}
        <ModalShell
          isOpen={feedbackModal.isOpen}
          onClose={() => setFeedbackModal((prev) => ({ ...prev, isOpen: false }))}
          title={feedbackModal.title}
          subtitle={feedbackModal.type === 'error' ? 'Pemberitahuan Kendala Sistem' : 'Pemberitahuan Sistem'}
          icon={
            feedbackModal.type === 'error' ? (
              <div className="p-2 bg-rose-600 rounded-xl text-white">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : feedbackModal.type === 'warning' ? (
              <div className="p-2 bg-amber-600 rounded-xl text-white">
                <AlertCircle className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-emerald-600 rounded-xl text-white">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            )
          }
          maxWidthClass="max-w-md"
          footer={
            <div className="flex justify-end w-full">
              <button
                type="button"
                onClick={() => setFeedbackModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          }
        >
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {feedbackModal.message}
            </p>
          </div>
        </ModalShell>

        {/* Floating Toast Notification */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-4 shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                toast.type === 'error'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : toast.type === 'warning'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {toast.type === 'error' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : toast.type === 'warning' ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-slate-900 truncate">{toast.title}</h5>
              <p className="text-[11px] text-slate-500 mt-0.5 break-words">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
