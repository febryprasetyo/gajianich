'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  Download,
  Eye,
  FileText,
  Play,
  Server,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/ui/PageHeader';
import KpiGrid, { KpiCardItem } from '@/components/ui/KpiGrid';
import FilterToolbar from '@/components/ui/FilterToolbar';
import TableShell from '@/components/ui/TableShell';
import TablePagination from '@/components/ui/TablePagination';
import RowActionButton from '@/components/ui/RowActionButton';
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedReportDetail, setSelectedReportDetail] = useState<WeeklyReportDetail | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

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
    } catch (err: any) {
      alert(`Gagal mengunduh berkas PDF: ${err?.message || 'Terjadi kesalahan'}`);
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
  }, [reports, statusFilter, selectedServer, search]);

  // Paginated List
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReports.slice(start, start + pageSize);
  }, [filteredReports, currentPage, pageSize]);

  const hasActiveFilters = search !== '' || selectedServer !== 'all' || statusFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setSelectedServer('all');
    setStatusFilter('all');
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

        {/* Search & Filter Toolbar */}
        <FilterToolbar
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          searchPlaceholder="Cari kode server, nama host, atau periode pekan..."
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
          dropdownFilters={
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <select
                  value={selectedServer}
                  onChange={(e) => {
                    setSelectedServer(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="all">Semua Server</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.serverCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="all">Semua Status</option>
                  <option value="NORMAL">Normal</option>
                  <option value="WARNING">Perlu Perhatian</option>
                  <option value="CRITICAL">Kritis</option>
                </select>
              </div>
            </div>
          }
        />

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
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="px-4 py-3">Pekan</th>
                  <th className="px-4 py-3">Server</th>
                  <th className="px-4 py-3">Rentang Periode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ringkasan Eksekutif</th>
                  <th className="px-4 py-3 text-right">Ukuran</th>
                  <th className="px-4 py-3">Tanggal Terbit</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedReports.map((report) => {
                  const statusStyle =
                    report.status === 'NORMAL'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : report.status === 'WARNING'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200';

                  const dotStyle =
                    report.status === 'NORMAL'
                      ? 'bg-emerald-500'
                      : report.status === 'WARNING'
                      ? 'bg-amber-500'
                      : 'bg-rose-500';

                  return (
                    <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                          {report.periodWeek}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{report.serverName}</div>
                        <div className="text-[11px] font-mono text-slate-400">{report.serverCode}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-[11px]">
                        {report.startDate} &rarr; {report.endDate}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusStyle}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dotStyle}`}></span>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs text-slate-600 truncate" title={report.executiveSummary || ''}>
                        {report.executiveSummary || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap text-[11px]">
                        {(report.fileSizeBytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
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
      </div>
    </DashboardLayout>
  );
}
