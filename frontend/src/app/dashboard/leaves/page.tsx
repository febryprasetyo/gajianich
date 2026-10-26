'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Plus,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Trash2,
  AlertCircle,
  Loader2,
  Filter,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Eye,
  Edit,
} from 'lucide-react';
import { api } from '@/lib/api';

interface LeaveItem {
  id: number;
  requestNumber: string;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  leaveType: string;
  reason: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  resumeWorkDate: string;
  status: string;
  createdAt: string;
}

export default function LeaveRequestsListPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states for manual HR approval & deletion
  const [confirmApproveItem, setConfirmApproveItem] = useState<LeaveItem | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<LeaveItem | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const fetchLeaves = useCallback(async (year: number) => {
    setIsLoading(true);
    try {
      const data = await api.get<LeaveItem[]>(`/leaves/requests?year=${year}`);
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error('Failed to fetch leaves:', err);
      const msg = err instanceof Error ? err.message : 'Gagal memuat daftar permohonan cuti.';
      setToastMessage({ type: 'error', text: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves(selectedYear);
  }, [selectedYear, fetchLeaves]);

  // Filter & Search
  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return leaves.filter((item) => {
      const matchesSearch =
        (item.requestNumber || '').toLowerCase().includes(q) ||
        (item.employeeName || '').toLowerCase().includes(q) ||
        (item.employeeCode || '').toLowerCase().includes(q) ||
        (item.reason || '').toLowerCase().includes(q);

      const matchesStatus = !statusFilter || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leaves, searchTerm, statusFilter]);

  // Reset page when search or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, pageSize]);

  // Pagination slice
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedLeaves = filtered.slice(startIndex, endIndex);

  // KPI counts
  const pendingCount = leaves.filter((l) => l.status === 'PENDING').length;
  const approvedCount = leaves.filter((l) => l.status === 'APPROVED').length;
  const rejectedCount = leaves.filter((l) => l.status === 'REJECTED').length;

  // Action: Manual HR Approval (Requirement 9)
  const handleApprove = async () => {
    if (!confirmApproveItem) return;
    setIsProcessingAction(true);
    try {
      const res = await api.patch<{ success: boolean; message: string }>(
        `/leaves/requests/${confirmApproveItem.id}/approve`
      );
      setToastMessage({
        type: 'success',
        text: res.message || `Permohonan cuti ${confirmApproveItem.requestNumber} berhasil disetujui.`,
      });
      setConfirmApproveItem(null);
      await fetchLeaves(selectedYear);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyetujui permohonan cuti.';
      setToastMessage({ type: 'error', text: msg });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Action: Delete Draft (Requirement 11)
  const handleDeleteDraft = async () => {
    if (!confirmDeleteItem) return;
    setIsProcessingAction(true);
    try {
      const res = await api.delete<{ success: boolean; message: string }>(
        `/leaves/requests/${confirmDeleteItem.id}`
      );
      setToastMessage({
        type: 'success',
        text: res.message || `Draft permohonan cuti ${confirmDeleteItem.requestNumber} berhasil dihapus.`,
      });
      setConfirmDeleteItem(null);
      await fetchLeaves(selectedYear);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus draft permohonan cuti.';
      setToastMessage({ type: 'error', text: msg });
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header (Template Standard) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-emerald-600" />
            <span>Permohonan Cuti</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola dan proses pengajuan cuti tahunan dan cuti khusus karyawan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Tahun */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 shadow-sm">
            <CalendarDays className="w-4 h-4 text-emerald-600 shrink-0" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent font-bold outline-none cursor-pointer text-slate-800"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/dashboard/leaves/new"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Ajukan Cuti Baru
          </Link>
        </div>
      </div>

      {/* 2. KPI / Stats Cards (Template Standard) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'TOTAL PENGAJUAN',
            value: leaves.length,
            icon: <CalendarDays className="w-5 h-5" />,
            tone: 'bg-emerald-50 border-emerald-100 text-emerald-600',
          },
          {
            label: 'MENUNGGU PERSETUJUAN',
            value: pendingCount,
            icon: <Clock className="w-5 h-5" />,
            tone: 'bg-amber-50 border-amber-100 text-amber-600',
          },
          {
            label: 'DISETUJUI',
            value: approvedCount,
            icon: <UserCheck className="w-5 h-5" />,
            tone: 'bg-emerald-50 border-emerald-100 text-emerald-600',
          },
          {
            label: 'DITOLAK',
            value: rejectedCount,
            icon: <XCircle className="w-5 h-5" />,
            tone: 'bg-rose-50 border-rose-100 text-rose-600',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="p-4 rounded-2xl flex items-center gap-4 bg-white border border-slate-200 shadow-sm"
          >
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${s.tone}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">{s.label}</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Search & Filter Bar (Template Standard) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nomor permohonan, nama karyawan, NIK, atau alasan..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-400 transition-all cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="PENDING">Menunggu Persetujuan</option>
            <option value="APPROVED">Disetujui</option>
            <option value="REJECTED">Ditolak</option>
          </select>
        </div>
        <span className="text-xs text-slate-500 ml-auto hidden sm:inline">
          Menampilkan <strong className="text-slate-900">{filtered.length}</strong> dari {leaves.length} permohonan
        </span>
      </div>

      {/* 4. Table Structure (Template Standard) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center gap-3 text-slate-500 text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> Memuat data permohonan cuti...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-semibold text-sm">Tidak ada permohonan cuti ditemukan</p>
            <p className="text-xs text-slate-400 mt-1">Coba ubah filter pencarian atau ajukan cuti baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider font-mono">
                  <th className="py-3.5 px-4">No. Permohonan</th>
                  <th className="py-3.5 px-4">Karyawan</th>
                  <th className="py-3.5 px-4">Jenis Cuti</th>
                  <th className="py-3.5 px-4">Periode</th>
                  <th className="py-3.5 px-4 text-center">Durasi</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLeaves.map((item) => {
                  const isApproved = item.status === 'APPROVED';
                  const isPending = item.status === 'PENDING';
                  const isRejected = item.status === 'REJECTED';

                  return (
                    <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors group">
                      <td className="py-3.5 px-4 font-mono">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[11px]">
                          {item.requestNumber}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {item.employeeName}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {item.employeeCode}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            item.leaveType === 'ANNUAL'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {item.leaveType === 'ANNUAL' ? 'Cuti Tahunan' : 'Cuti Khusus'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-700">
                          {item.startDate} s/d {item.endDate}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Masuk: {item.resumeWorkDate}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        {item.durationDays} Hari
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isApproved ? 'bg-emerald-500' : isPending ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                          />
                          {isApproved ? 'Disetujui' : isPending ? 'Menunggu' : 'Ditolak'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Action: View Form */}
                          <Link
                            href={`/dashboard/leaves/${item.id}/print`}
                            className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all flex items-center gap-1 font-semibold text-xs cursor-pointer"
                            title="Lihat Formulir F4"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">View</span>
                          </Link>

                          {/* Action: Edit Form (khusus status PENDING) */}
                          {isPending && (
                            <Link
                              href={`/dashboard/leaves/${item.id}/edit`}
                              className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all flex items-center gap-1 font-semibold text-xs cursor-pointer"
                              title="Edit Permohonan Cuti"
                            >
                              <Edit className="w-4 h-4" />
                              <span className="hidden sm:inline">Edit</span>
                            </Link>
                          )}

                          {/* Action: Approve Manual HR (Requirement 9) */}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => setConfirmApproveItem(item)}
                              className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all flex items-center gap-1 font-bold text-xs cursor-pointer"
                              title="Setujui permohonan setelah ditandatangani"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Approve</span>
                            </button>
                          )}

                          {/* Action: Delete Draft (Requirement 11) */}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteItem(item)}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                              title="Hapus Draft"
                            >
                              <Trash2 className="w-4 h-4" />
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
        )}

        {/* 5. Pagination Bar (Requirement 6) */}
        {filtered.length > 0 && (
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span>Baris per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="py-1 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none cursor-pointer shadow-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-slate-400 ml-1">
                ({startIndex + 1} - {endIndex} dari {totalItems})
              </span>
            </div>

            <div className="flex items-center gap-1.5 self-center sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal: HR Approve */}
      {confirmApproveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-emerald-600 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Setujui Permohonan Cuti?
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {confirmApproveItem.requestNumber}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Konfirmasi persetujuan manual oleh HR setelah dokumen fisik formulir permohonan cuti (F4) ditandatangani oleh pemohon dan atasan yang berwenang.
            </p>

            <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600 mb-6 space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-400">Karyawan:</span>
                <span className="font-semibold text-slate-800">{confirmApproveItem.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Durasi:</span>
                <span className="font-semibold text-slate-800">{confirmApproveItem.durationDays} Hari</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Periode:</span>
                <span className="font-semibold text-slate-800">{confirmApproveItem.startDate} s/d {confirmApproveItem.endDate}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmApproveItem(null)}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Setujui Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Draft */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 border border-rose-100">
                <Trash2 className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Draft Permohonan?
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {confirmDeleteItem.requestNumber}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Draft permohonan ini akan dihapus secara permanen. Jika merupakan cuti tahunan, kuota yang sebelumnya terpotong ({confirmDeleteItem.durationDays} hari) akan otomatis dikembalikan ke saldo karyawan.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteDraft}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Hapus Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
