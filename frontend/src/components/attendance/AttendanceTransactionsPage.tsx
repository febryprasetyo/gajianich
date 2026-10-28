'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileCheck2,
  AlertTriangle,
  Search,
  Calendar,
  Calculator,
  Download,
  CheckCircle2,
  Filter,
  UserCheck,
  Building2,
  Clock,
  ArrowRight,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  ExternalLink,
  Cpu,
  Check,
  Loader2,
  XCircle,
} from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { apiFetch } from '@/lib/api';
import {
  ProcessedAttendanceRecord,
  UnassignedShiftRecord,
} from './attendanceMachineStore';

interface SyncErrorDetail {
  code: string;
  title: string;
  message: string;
  actionHint: string;
  timestamp: string;
}

export default function AttendanceTransactionsPage() {
  const [activeTab, setActiveTab] = useState<'laporan' | 'tanpa_shift'>('laporan');

  const [processedRecords, setProcessedRecords] = useState<ProcessedAttendanceRecord[]>([]);
  const [unassignedRecords, setUnassignedRecords] = useState<UnassignedShiftRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sync to Data Absensi States
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStepLabel, setSyncStepLabel] = useState('');
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<SyncErrorDetail | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  // Load Calculation Data from backend
  const fetchCalculation = useCallback(async (opts?: {
    assignDefault?: boolean;
    saveToDb?: boolean;
    customStartDate?: string;
    customEndDate?: string;
  }) => {
    const sDate = opts?.customStartDate !== undefined ? opts.customStartDate : startDate;
    const eDate = opts?.customEndDate !== undefined ? opts.customEndDate : endDate;

    try {
      const res = await apiFetch<{
        success: boolean;
        message?: string;
        data: {
          processedRecords: any[];
          unassignedShiftRecords: any[];
          totalRawPunches: number;
          totalProcessed: number;
          totalUnassigned: number;
        };
      }>('/attendance/devices/calculate', {
        method: 'POST',
        body: JSON.stringify({
          startDate: sDate || undefined,
          endDate: eDate || undefined,
          assignDefaultShiftIfUnassigned: opts?.assignDefault || false,
          saveToDatabase: opts?.saveToDb || false,
        }),
      });

      if (res && res.success && res.data) {
        const mappedProcessed: ProcessedAttendanceRecord[] = (res.data.processedRecords || []).map((r, idx) => ({
          id: r.id || `proc-${r.employeeCode || idx}-${r.workDate}`,
          employeeId: r.employeeId,
          employeeCode: r.employeeCode || '-',
          employeeName: r.employeeName || 'Tanpa Nama',
          department: r.department || 'Umum',
          workDate: r.workDate,
          shiftName: r.shiftName || 'Shift Baku',
          shiftCode: r.shiftCode || 'REG',
          shiftIn: r.scheduleIn || '08:00',
          shiftOut: r.scheduleOut || '17:00',
          scheduleIn: r.scheduleIn || '08:00',
          scheduleOut: r.scheduleOut || '17:00',
          scanIn: r.scanIn,
          scanOut: r.scanOut,
          lateMinutes: r.lateMinutes || 0,
          earlyMinutes: r.earlyMinutes || 0,
          status: r.statusLabel || (r.lateMinutes > 0 ? 'Terlambat' : r.earlyMinutes > 0 ? 'Pulang Cepat' : !r.scanOut ? 'Belum Scan Pulang' : 'Hadir Tepat Waktu'),
          rawPunchesCount: r.rawPunchesCount || 1,
        }));

        const mappedUnassigned: UnassignedShiftRecord[] = (res.data.unassignedShiftRecords || []).map((u, idx) => ({
          id: u.id || `unassigned-${u.employeeCode || idx}-${u.workDate}`,
          employeeId: u.employeeId,
          employeeCode: u.employeeCode || '-',
          employeeName: u.employeeName || 'Karyawan Tanpa Shift',
          department: u.department || 'Umum',
          workDate: u.workDate,
          scanIn: u.scanIn,
          scanOut: u.scanOut,
          rawPunchesCount: u.rawPunchesCount || 1,
          suggestedShiftCode: u.suggestedShiftCode || 'REGULER',
        }));

        setProcessedRecords(mappedProcessed);
        setUnassignedRecords(mappedUnassigned);
        return { processed: mappedProcessed, unassigned: mappedUnassigned };
      }
    } catch (err: any) {
      console.error('Error fetching calculation:', err);
      setToastMessage(`Gagal memuat kalkulasi: ${err.message || 'Koneksi error'}`);
    }
    return null;
  }, [startDate, endDate]);

  useEffect(() => {
    setIsLoading(true);
    fetchCalculation({ assignDefault: true }).finally(() => setIsLoading(false));
  }, [fetchCalculation]);

  const filteredProcessed = useMemo(() => {
    return processedRecords.filter((rec) => {
      if (startDate && rec.workDate < startDate) return false;
      if (endDate && rec.workDate > endDate) return false;
      if (selectedStatus !== 'all' && rec.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = rec.employeeName.toLowerCase().includes(q);
        const matchCode = rec.employeeCode.toLowerCase().includes(q);
        const matchDept = rec.department.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDept) return false;
      }
      return true;
    });
  }, [processedRecords, startDate, endDate, selectedStatus, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredProcessed.length / pageSize));
  const paginatedProcessed = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProcessed.slice(start, start + pageSize);
  }, [filteredProcessed, currentPage, pageSize]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedStatus('all');
    setCurrentPage(1);
    fetchCalculation({ customStartDate: '', customEndDate: '' });
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetchCalculation({ assignDefault: true });
      if (res) {
        setToastMessage(`Kalkulasi ulang berhasil: ${res.processed.length} presensi terhitung.`);
      }
    } finally {
      setIsRecalculating(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleAssignDefaultShift = async (employeeCode?: string) => {
    setIsRecalculating(true);
    try {
      const res = await fetchCalculation({ assignDefault: true });
      if (res) {
        setToastMessage(
          employeeCode
            ? `Shift berhasil ditetapkan untuk karyawan ${employeeCode}. Data telah masuk ke Laporan Presensi!`
            : 'Seluruh karyawan tanpa shift telah ditetapkan ke Shift Reguler Pagi!'
        );
      }
    } finally {
      setIsRecalculating(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Handler Sinkronisasi ke Data Absensi
  const handleStartSync = () => {
    setSyncError(null);
    setIsSyncModalOpen(true);
  };

  const handleExecuteSync = async () => {
    setIsSyncing(true);
    setSyncProgress(25);
    setSyncStepLabel('Memvalidasi kelengkapan jam tap masuk dan keluar...');

    try {
      setSyncProgress(50);
      setSyncStepLabel('Mencocokkan shift kerja aktif dan menghitung keterlambatan...');

      const res = await fetchCalculation({ saveToDb: true, assignDefault: true });
      setSyncProgress(85);
      setSyncStepLabel('Menyimpan catatan kehadiran ke Data Absensi resmi...');

      if (res) {
        if (res.unassigned.length > 0 && res.processed.length === 0) {
          const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setSyncError({
            code: 'ERR_UNASSIGNED_SHIFTS',
            title: 'Validasi Shift Belum Lengkap',
            message: `Terdapat ${res.unassigned.length} karyawan di tab "Perlu Ditetapkan Shift" yang belum memiliki jadwal kerja. Tetapkan shift terlebih dahulu agar hasil akurat.`,
            actionHint: 'Klik tombol "Tetapkan Shift Reguler Pagi" pada tab "Perlu Ditetapkan Shift".',
            timestamp: nowTime,
          });
          setIsSyncing(false);
          setIsSyncModalOpen(false);
          return;
        }

        setSyncProgress(100);
        setIsSyncing(false);
        setIsSyncModalOpen(false);
        setSyncError(null);
        setSyncSuccess(true);
        try {
          localStorage.setItem("gajianich:attendance-workspace:v2", Date.now().toString());
          window.dispatchEvent(new Event("storage"));
          window.dispatchEvent(new CustomEvent("gajianich:attendance-updated"));
        } catch {}
        const nowStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
          new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastSyncedTime(nowStr);
        setToastMessage(`Sukses! ${res.processed.length} catatan presensi berhasil disimpan ke Data Absensi.`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        throw new Error('Gagal memproses sinkronisasi ke server.');
      }
    } catch (err: any) {
      setIsSyncing(false);
      setIsSyncModalOpen(false);
      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSyncError({
        code: 'ERR_SYNC_FAILED',
        title: 'Sinkronisasi Gagal',
        message: err.message || 'Terjadi kesalahan saat menyimpan ke database.',
        actionHint: 'Periksa koneksi jaringan atau coba beberapa saat lagi.',
        timestamp: nowTime,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Laporan Presensi Mesin
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Rekap kehadiran harian karyawan yang sudah disesuaikan dengan jadwal shift kerja resmi.
            </p>
          </div>
        </div>

        {/* Toolbar kanan */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/attendance/raw-logs"
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <span>Buka Data Log Presensi</span>
          </Link>
          <button
            type="button"
            onClick={handleRecalculate}
            disabled={isRecalculating || isLoading}
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isRecalculating ? (
              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4 text-emerald-600" />
            )}
            <span>Kalkulasi Ulang</span>
          </button>
          <button
            type="button"
            onClick={handleStartSync}
            disabled={isSyncing || isLoading || processedRecords.length === 0}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Kirim ke Data Absensi</span>
          </button>
        </div>
      </div>

      {/* Control Box: Status Integrasi */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-emerald-600" />
            Status Pengiriman:
          </span>
          {syncSuccess ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Tersinkron ke Data Absensi ({lastSyncedTime || 'Terkirim'})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Belum Disimpan (Pratinjau Hasil Kalkulasi)
            </span>
          )}
        </div>
        <div className="text-slate-500 text-[11px]">
          Total Data Terhitung: <strong className="text-slate-800">{processedRecords.length}</strong> | Tanpa Shift: <strong className="text-amber-600">{unassignedRecords.length}</strong>
        </div>
      </div>

      {/* Banner Error Sinkronisasi */}
      {syncError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-rose-900 text-sm">{syncError.title}</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-900 font-semibold">
                  {syncError.code}
                </span>
                <span className="text-[11px] text-rose-500">Pukul {syncError.timestamp}</span>
              </div>
              <p className="text-rose-800 leading-relaxed">{syncError.message}</p>
              <p className="text-rose-700 font-medium pt-1">💡 Saran Tindakan: {syncError.actionHint}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {syncError.code === 'ERR_UNASSIGNED_SHIFTS' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('tanpa_shift');
                  setSyncError(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Buka Tab Tanpa Shift
              </button>
            )}
            <button
              type="button"
              onClick={handleStartSync}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Coba Kirim Lagi
            </button>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="text-rose-400 hover:text-rose-600 p-1 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Banner Notifikasi Sukses Sinkronisasi */}
      {syncSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-emerald-900 text-sm">Sinkronisasi Absensi Berhasil</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 font-semibold">
                  SYNC_SUCCESS
                </span>
                <span className="text-[11px] text-emerald-600">Tersinkron pada {lastSyncedTime}</span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                Sebanyak <strong>{processedRecords.length} catatan kehadiran karyawan</strong> dari mesin presensi telah berhasil diverifikasi dan disimpan ke modul <strong>Data Absensi</strong> resmi.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Link
              href={startDate ? `/dashboard/attendance?date=${startDate}` : (endDate ? `/dashboard/attendance?date=${endDate}` : "/dashboard/attendance")}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>Buka di Data Absensi</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between shadow-xs">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('laporan')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'laporan'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Laporan Presensi Sesuai Shift ({processedRecords.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tanpa_shift')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'tanpa_shift'
              ? 'border-amber-600 text-amber-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Perlu Ditetapkan Shift ({unassignedRecords.length})</span>
          {unassignedRecords.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
              Action Required
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Laporan Presensi */}
      {activeTab === 'laporan' && (
        <div className="space-y-4">
          {/* Card Pencarian & Filter Terpisah */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            {/* Bagian 1: Pencarian Cepat */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Pencarian Cepat
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari NIK, nama karyawan, atau departemen..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Bagian 2: Filter Parameter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Filter Parameter
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {/* Tanggal Mulai */}
                <div>
                  <div
                    className="relative cursor-pointer"
                    onClick={(e) => {
                      const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement | null;
                      if (input && e.target !== input) {
                        input.focus();
                        try {
                          input.showPicker?.();
                        } catch {}
                      }
                    }}
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={startDate}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker?.();
                        } catch {}
                      }}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all text-slate-800 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Tanggal Sampai */}
                <div>
                  <div
                    className="relative cursor-pointer"
                    onClick={(e) => {
                      const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement | null;
                      if (input && e.target !== input) {
                        input.focus();
                        try {
                          input.showPicker?.();
                        } catch {}
                      }
                    }}
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={endDate}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker?.();
                        } catch {}
                      }}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all text-slate-800 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Status Kehadiran */}
                <div>
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all text-slate-800 cursor-pointer"
                  >
                    <option value="all">Semua Status</option>
                    <option value="Hadir Tepat Waktu">Hadir Tepat Waktu</option>
                    <option value="Terlambat">Terlambat</option>
                    <option value="Pulang Cepat">Pulang Cepat</option>
                    <option value="Belum Scan Pulang">Belum Scan Pulang</option>
                  </select>
                </div>

                {/* Tombol Terapkan & Reset */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchCalculation()}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer text-center"
                  >
                    Terapkan
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
                    title="Reset semua filter"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Cards Ringkasan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500">Total Terhitung</span>
              <p className="text-xl font-extrabold text-slate-900 mt-0.5">{processedRecords.length}</p>
              <span className="text-[10px] text-slate-400">Record presensi</span>
            </div>
            <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-emerald-700">Tepat Waktu</span>
              <p className="text-xl font-extrabold text-emerald-900 mt-0.5">
                {processedRecords.filter((r) => r.status === 'Hadir Tepat Waktu').length}
              </p>
              <span className="text-[10px] text-emerald-600">Disiplin kerja</span>
            </div>
            <div className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-rose-700">Terlambat</span>
              <p className="text-xl font-extrabold text-rose-900 mt-0.5">
                {processedRecords.filter((r) => r.status === 'Terlambat').length}
              </p>
              <span className="text-[10px] text-rose-600">Scan &gt; shift masuk</span>
            </div>
            <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-amber-700">Pulang Cepat / Belum Pulang</span>
              <p className="text-xl font-extrabold text-amber-900 mt-0.5">
                {processedRecords.filter((r) => r.status === 'Pulang Cepat' || r.status === 'Belum Scan Pulang').length}
              </p>
              <span className="text-[10px] text-amber-600">Perlu konfirmasi</span>
            </div>
          </div>

          {/* Tabel Hasil Kalkulasi */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-3">Tanggal</th>
                    <th className="py-3 px-3">Shift Terjadwal</th>
                    <th className="py-3 px-3 text-center">Scan Masuk</th>
                    <th className="py-3 px-3 text-center">Scan Pulang</th>
                    <th className="py-3 px-3 text-center">Terlambat</th>
                    <th className="py-3 px-3 text-center">Pulang Cepat</th>
                    <th className="py-3 px-4 text-center">Status Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                          <p>Memuat kalkulasi presensi mesin...</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedProcessed.length > 0 ? (
                    paginatedProcessed.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{rec.employeeName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {rec.employeeCode} • {rec.department}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-700">
                          {rec.workDate}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800">{rec.shiftName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {rec.shiftIn || rec.scheduleIn} - {rec.shiftOut || rec.scheduleOut}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                          {rec.scanIn ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                              {rec.scanIn}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                          {rec.scanOut ? (
                            <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                              {rec.scanOut}
                            </span>
                          ) : (
                            <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-amber-200">
                              Belum Scan
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {rec.lateMinutes > 0 ? (
                            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full text-[11px] border border-rose-100">
                              +{rec.lateMinutes} m
                            </span>
                          ) : (
                            <span className="text-slate-400">0 m</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {rec.earlyMinutes > 0 ? (
                            <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[11px] border border-amber-100">
                              -{rec.earlyMinutes} m
                            </span>
                          ) : (
                            <span className="text-slate-400">0 m</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {rec.status === 'Hadir Tepat Waktu' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              Tepat Waktu
                            </span>
                          )}
                          {rec.status === 'Terlambat' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                              Terlambat
                            </span>
                          )}
                          {rec.status === 'Pulang Cepat' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                              Pulang Cepat
                            </span>
                          )}
                          {rec.status === 'Belum Scan Pulang' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Belum Scan Pulang
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                        Tidak ada data kalkulasi presensi untuk kriteria yang dipilih.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {filteredProcessed.length > 0 && (
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span>Menampilkan</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span>dari <strong>{filteredProcessed.length}</strong> catatan</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 font-semibold text-slate-700">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Perlu Ditetapkan Shift */}
      {activeTab === 'tanpa_shift' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-950">
                  {unassignedRecords.length} Karyawan Belum Memiliki Penugasan Shift Kerja
                </strong>
                <p className="text-amber-800 mt-0.5 leading-relaxed">
                  Log tap mesin berhasil dicatat, namun karyawan belum terdaftar pada jadwal shift harian GAJIANICH. Sistem memerlukan penentuan shift agar toleransi jam kerja dan keterlambatan dapat dikalkulasi secara presisi.
                </p>
              </div>
            </div>
            {unassignedRecords.length > 0 && (
              <button
                type="button"
                onClick={() => handleAssignDefaultShift()}
                disabled={isRecalculating}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isRecalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Tetapkan Semua ke Shift Reguler</span>
              </button>
            )}
          </div>

          {/* Tabel Karyawan Tanpa Shift */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-3">Tanggal Kerja</th>
                    <th className="py-3 px-3 text-center">Scan Masuk</th>
                    <th className="py-3 px-3 text-center">Scan Pulang</th>
                    <th className="py-3 px-3 text-center">Jumlah Tap</th>
                    <th className="py-3 px-3 text-center">Saran Shift</th>
                    <th className="py-3 px-4 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unassignedRecords.length > 0 ? (
                    unassignedRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{rec.employeeName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {rec.employeeCode} • {rec.department}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-700">
                          {rec.workDate}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                          {rec.scanIn || '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                          {rec.scanOut || '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-700">
                          {rec.rawPunchesCount} kali tap
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] border border-slate-200">
                            Reguler Pagi (08:00 - 17:00)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleAssignDefaultShift(rec.employeeCode)}
                            disabled={isRecalculating}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 ml-auto transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Tetapkan Shift Reguler Pagi
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                          <p className="font-semibold text-slate-700">
                            Semua Karyawan Telah Memiliki Jadwal Shift
                          </p>
                          <p className="text-slate-500">
                            Seluruh karyawan yang melakukan tap di mesin telah memiliki shift kerja aktif lengkap. Siap disimpan ke Data Absensi.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi & Progress Sinkronisasi ke Data Absensi */}
      <ModalShell
        isOpen={isSyncModalOpen}
        onClose={() => {
          if (!isSyncing) setIsSyncModalOpen(false);
        }}
        title="Kirim Presensi ke Data Absensi"
        subtitle="Simpan hasil kalkulasi tap mesin ke buku besar absensi resmi"
        isLoading={isSyncing}
        footer={
          <>
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => setIsSyncModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer disabled:opacity-40"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isSyncing || processedRecords.length === 0}
              onClick={handleExecuteSync}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke Database...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Konfirmasi & Simpan Sekarang</span>
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Ringkasan Data */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Total Catatan Siap Simpan:</span>
              <strong className="text-slate-900 font-mono">{processedRecords.length} karyawan</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Periode Tanggal:</span>
              <strong className="text-slate-900 font-mono">{startDate || 'Semua'} s/d {endDate || 'Semua'}</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tepat Waktu:</span>
              <span className="font-semibold text-emerald-700">
                {processedRecords.filter((r) => r.status === 'Hadir Tepat Waktu').length} karyawan
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Terlambat:</span>
              <span className="font-semibold text-rose-700">
                {processedRecords.filter((r) => r.status === 'Terlambat').length} karyawan
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Pulang Cepat / Scan Belum Lengkap:</span>
              <span className="font-semibold text-amber-700">
                {processedRecords.filter((r) => r.status === 'Pulang Cepat' || r.status === 'Belum Scan Pulang').length} karyawan
              </span>
            </div>
          </div>

          {/* Peringatan jika masih ada unassigned shift */}
          {unassignedRecords.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Perhatian: {unassignedRecords.length} karyawan belum memiliki shift.</strong>
                <p className="mt-0.5 text-amber-800 leading-relaxed">
                  Jika Anda melanjutkan, sistem akan menolak baris tanpa shift atau meminta Anda melengkapi shift terlebih dahulu.
                </p>
              </div>
            </div>
          )}

          {/* Animasi Progress Saat Sedang Sync */}
          {isSyncing && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">{syncStepLabel}</span>
                <span className="font-mono font-bold text-emerald-700">{syncProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Data yang disinkronkan akan masuk ke modul <strong>Data Absensi</strong> dan menjadi rujukan resmi perhitungan jam kerja, kehadiran, dan payroll karyawan.
          </p>
        </div>
      </ModalShell>
    </div>
  );
}
