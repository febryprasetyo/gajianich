'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import {
  ProcessedAttendanceRecord,
  UnassignedShiftRecord,
  RawAttendanceLog,
  INITIAL_RAW_LOGS,
  calculateRecordsFromRawLogs,
  KNOWN_SHIFTS,
} from './attendanceMachineStore';

type SyncFailureScenario = 'UNASSIGNED_SHIFTS' | 'DATE_LOCKED' | 'TIMEOUT';

interface SyncErrorDetail {
  code: string;
  title: string;
  message: string;
  actionHint: string;
  timestamp: string;
}

export default function AttendanceTransactionsPage() {
  const [activeTab, setActiveTab] = useState<'laporan' | 'tanpa_shift'>('laporan');

  const [processedRecords, setProcessedRecords] = useState<ProcessedAttendanceRecord[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_attendance_processed_records');
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
      const rawSaved = localStorage.getItem('ams_attendance_raw_logs');
      const rawLogs = rawSaved ? JSON.parse(rawSaved) : INITIAL_RAW_LOGS;
      const { processed } = calculateRecordsFromRawLogs(rawLogs);
      return processed;
    }
    return [];
  });

  const [unassignedRecords, setUnassignedRecords] = useState<UnassignedShiftRecord[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_attendance_unassigned_shift_records');
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
      const rawSaved = localStorage.getItem('ams_attendance_raw_logs');
      const rawLogs = rawSaved ? JSON.parse(rawSaved) : INITIAL_RAW_LOGS;
      const { unassigned } = calculateRecordsFromRawLogs(rawLogs);
      return unassigned;
    }
    return [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('2026-10-27');
  const [endDate, setEndDate] = useState('2026-10-27');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sync to Data Absensi Simulation States
  const [simulateSyncFailure, setSimulateSyncFailure] = useState(false);
  const [syncFailureScenario, setSyncFailureScenario] = useState<SyncFailureScenario>('UNASSIGNED_SHIFTS');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStepLabel, setSyncStepLabel] = useState('');
  const [syncSuccess, setSyncSuccess] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ams_attendance_sync_status') === 'synced';
    }
    return false;
  });
  const [syncError, setSyncError] = useState<SyncErrorDetail | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ams_attendance_last_synced_time');
    }
    return null;
  });

  // Persist updates
  useEffect(() => {
    localStorage.setItem('ams_attendance_processed_records', JSON.stringify(processedRecords));
  }, [processedRecords]);

  useEffect(() => {
    localStorage.setItem('ams_attendance_unassigned_shift_records', JSON.stringify(unassignedRecords));
  }, [unassignedRecords]);

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
  };

  const handleRecalculate = () => {
    const rawSaved = localStorage.getItem('ams_attendance_raw_logs');
    const rawLogs: RawAttendanceLog[] = rawSaved ? JSON.parse(rawSaved) : INITIAL_RAW_LOGS;
    const { processed, unassigned } = calculateRecordsFromRawLogs(rawLogs, KNOWN_SHIFTS);
    setProcessedRecords(processed);
    setUnassignedRecords(unassigned);
    setCurrentPage(1);
    setToastMessage('Kalkulasi ulang berhasil diperbarui!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAssignDefaultShift = (employeeCode: string) => {
    const target = unassignedRecords.find((r) => r.employeeCode === employeeCode);
    if (!target) return;

    const newShift = { shiftName: 'Reguler Pagi (08:00 - 17:00)', shiftCode: 'PAGI', shiftIn: '08:00', shiftOut: '17:00' };
    KNOWN_SHIFTS[employeeCode] = newShift;

    // Remove from unassigned
    setUnassignedRecords((prev) => prev.filter((r) => r.employeeCode !== employeeCode));

    // Calculate late & early
    const scanInTime = target.scanIn || '08:00';
    const [scanInH, scanInM] = scanInTime.split(':').map(Number);
    const late = Math.max(0, (scanInH * 60 + scanInM) - (8 * 60));

    let early = 0;
    if (target.scanOut) {
      const [scanOutH, scanOutM] = target.scanOut.split(':').map(Number);
      early = Math.max(0, 17 * 60 - (scanOutH * 60 + scanOutM));
    }

    let status: ProcessedAttendanceRecord['status'] = 'Hadir Tepat Waktu';
    if (late > 0) status = 'Terlambat';
    else if (early > 0) status = 'Pulang Cepat';
    if (!target.scanOut) status = 'Belum Scan Pulang';

    const newProc: ProcessedAttendanceRecord = {
      id: `proc-${target.employeeCode}-${target.workDate}`,
      employeeCode: target.employeeCode,
      employeeName: target.employeeName,
      department: target.department,
      workDate: target.workDate,
      shiftName: newShift.shiftName,
      shiftCode: newShift.shiftCode,
      shiftIn: newShift.shiftIn,
      shiftOut: newShift.shiftOut,
      scanIn: target.scanIn,
      scanOut: target.scanOut,
      lateMinutes: late,
      earlyMinutes: early,
      status,
      rawPunchesCount: target.rawPunchesCount,
    };

    setProcessedRecords((prev) => [...prev, newProc]);
    setToastMessage(`Shift Reguler Pagi berhasil ditetapkan untuk ${target.employeeName}. Data telah masuk ke Laporan Presensi!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handler Sinkronisasi ke Data Absensi
  const handleStartSync = () => {
    setSyncError(null);
    setIsSyncModalOpen(true);
  };

  const handleResetSyncState = () => {
    setSyncSuccess(false);
    setSyncError(null);
    setLastSyncedTime(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ams_attendance_sync_status');
      localStorage.removeItem('ams_attendance_last_synced_time');
    }
    setToastMessage('Status sinkronisasi telah di-reset ke mode awal.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExecuteSync = async () => {
    setIsSyncing(true);
    setSyncProgress(20);
    setSyncStepLabel('Memvalidasi kelengkapan jam tap masuk dan keluar...');

    await new Promise((res) => setTimeout(res, 600));
    setSyncProgress(55);
    setSyncStepLabel('Mencocokkan shift kerja aktif dan menghitung keterlambatan...');

    await new Promise((res) => setTimeout(res, 700));
    setSyncProgress(85);
    setSyncStepLabel('Mengirim catatan kehadiran ke modul Data Absensi resmi...');

    await new Promise((res) => setTimeout(res, 600));

    // Evaluasi Skenario Gagal
    if (simulateSyncFailure) {
      setIsSyncing(false);
      setIsSyncModalOpen(false);
      setSyncSuccess(false);

      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (syncFailureScenario === 'UNASSIGNED_SHIFTS') {
        setSyncError({
          code: 'ERR_UNASSIGNED_SHIFTS',
          title: 'Validasi Shift Belum Lengkap',
          message: `Ditemukan ${unassignedRecords.length} karyawan pada tab "Perlu Ditetapkan Shift" yang belum memiliki jadwal kerja. Sistem menolak sinkronisasi agar tidak terjadi potongan gaji keliru.`,
          actionHint: 'Tetapkan shift karyawan yang bersangkutan pada tab "Perlu Ditetapkan Shift" sebelum mengirim ke Data Absensi.',
          timestamp: nowTime,
        });
      } else if (syncFailureScenario === 'DATE_LOCKED') {
        setSyncError({
          code: 'ERR_DATE_LOCKED',
          title: 'Periode Absensi Terkunci (Lock Conflict)',
          message: `Data tanggal ${startDate || 'pilihan'} sedang dikunci oleh tim HR / Payroll untuk rekap bulanan. Server menolak mutasi data baru pada tanggal yang terkunci.`,
          actionHint: 'Buka kunci tanggal di Pengaturan Absensi atau koordinasikan dengan Superadmin HR.',
          timestamp: nowTime,
        });
      } else {
        setSyncError({
          code: 'ERR_SYNC_TIMEOUT',
          title: 'Koneksi API Server Absensi Timeout',
          message: 'Gagal menghubungi layanan backend absensi (/attendance/commands) dalam batas waktu 10.000 ms. Socket koneksi terputus.',
          actionHint: 'Pastikan server backend AMS berjalan dengan normal lalu klik tombol "Coba Kirim Lagi".',
          timestamp: nowTime,
        });
      }
    } else {
      // Skenario Normal: Cek apakah masih ada karyawan tanpa shift
      if (unassignedRecords.length > 0) {
        setIsSyncing(false);
        setIsSyncModalOpen(false);
        const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setSyncError({
          code: 'ERR_UNASSIGNED_SHIFTS',
          title: 'Validasi Shift Belum Lengkap',
          message: `Masih terdapat ${unassignedRecords.length} karyawan di tab "Perlu Ditetapkan Shift". Lengkapi shift mereka terlebih dahulu agar keterlambatan dihitung secara akurat.`,
          actionHint: 'Buka tab "Perlu Ditetapkan Shift" dan klik tombol "Tetapkan Shift Reguler Pagi".',
          timestamp: nowTime,
        });
        return;
      }

      // Skenario Sukses Penuh
      setSyncProgress(100);
      setIsSyncing(false);
      setIsSyncModalOpen(false);
      setSyncError(null);
      setSyncSuccess(true);
      const nowStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSyncedTime(nowStr);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ams_attendance_sync_status', 'synced');
        localStorage.setItem('ams_attendance_last_synced_time', nowStr);
      }
      setToastMessage(`Sukses! ${processedRecords.length} catatan presensi berhasil dikirim dan disinkronkan ke Data Absensi.`);
      setTimeout(() => setToastMessage(null), 4000);
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
              Rekap kehadiran harian karyawan yang sudah disesuaikan dengan jadwal shift kerja.
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
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Calculator className="w-4 h-4 text-emerald-600" />
            <span>Kalkulasi Ulang</span>
          </button>
          <button
            type="button"
            onClick={handleStartSync}
            disabled={isSyncing || processedRecords.length === 0}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Kirim ke Data Absensi</span>
          </button>
        </div>
      </div>

      {/* Control Box: Status Integrasi & Simulasi Sinkronisasi */}
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
              Belum Terkirim (Staging Kalkulasi)
            </span>
          )}
          {syncSuccess && (
            <button
              type="button"
              onClick={handleResetSyncState}
              className="text-slate-400 hover:text-slate-600 underline text-xs ml-1 cursor-pointer"
              title="Reset status simulasi ke keadaan belum kirim"
            >
              Reset Status
            </button>
          )}
        </div>

        {/* Kontrol Pengujian Skenario Gagal */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs">
          <input
            type="checkbox"
            id="simSyncFailureToggle"
            checked={simulateSyncFailure}
            onChange={(e) => {
              setSimulateSyncFailure(e.target.checked);
              if (!e.target.checked) setSyncError(null);
            }}
            className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
          />
          <label htmlFor="simSyncFailureToggle" className="font-semibold cursor-pointer select-none">
            Simulasi Gagal Kirim
          </label>

          {simulateSyncFailure && (
            <select
              value={syncFailureScenario}
              onChange={(e) => setSyncFailureScenario(e.target.value as SyncFailureScenario)}
              className="ml-1 bg-white border border-amber-300 rounded-lg text-[11px] px-2 py-0.5 text-amber-950 font-medium focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
            >
              <option value="UNASSIGNED_SHIFTS">Karyawan Tanpa Shift (ERR_UNASSIGNED_SHIFTS)</option>
              <option value="DATE_LOCKED">Tanggal Terkunci oleh Payroll HR (ERR_DATE_LOCKED)</option>
              <option value="TIMEOUT">Server API Timeout (ERR_SYNC_TIMEOUT)</option>
            </select>
          )}
        </div>
      </div>

      {/* Banner Notifikasi Error / Kegagalan Kirim */}
      {syncError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
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
                Sebanyak <strong>{processedRecords.length} catatan kehadiran karyawan</strong> dari mesin presensi telah berhasil diverifikasi dan disinkronkan ke modul <strong>Data Absensi</strong> resmi.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Link
              href={`/dashboard/attendance?date=${startDate}`}
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
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama karyawan, NIK, atau departemen..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Bagian 2: Filter Data & Tombol Reset */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Rentang Tanggal */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="date"
                    value={startDate}
                    onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-xs text-slate-700 cursor-pointer focus:outline-none"
                  />
                  <span className="text-slate-400 text-xs px-1">s/d</span>
                  <input
                    type="date"
                    value={endDate}
                    onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-xs text-slate-700 cursor-pointer focus:outline-none"
                  />
                </div>

                {/* Filter Status */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-xs text-slate-700 cursor-pointer focus:outline-none"
                  >
                    <option value="all">Semua Status Kehadiran</option>
                    <option value="Hadir Tepat Waktu">Hadir Tepat Waktu</option>
                    <option value="Terlambat">Terlambat</option>
                    <option value="Pulang Cepat">Pulang Cepat</option>
                    <option value="Belum Scan Pulang">Belum Scan Pulang</option>
                  </select>
                </div>

                {/* Tombol Reset Filter */}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  Reset Filter
                </button>
              </div>

              <div className="text-xs text-slate-500">
                Ditemukan <span className="font-semibold text-slate-800">{filteredProcessed.length}</span> data
              </div>
            </div>
          </div>

          {/* Tabel Laporan Presensi */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-semibold">
                    <th className="py-2.5 px-3">NIK</th>
                    <th className="py-2.5 px-3">Nama Karyawan</th>
                    <th className="py-2.5 px-3">Departemen</th>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Shift</th>
                    <th className="py-2.5 px-3">Jadwal Masuk</th>
                    <th className="py-2.5 px-3">Scan Masuk</th>
                    <th className="py-2.5 px-3">Jadwal Pulang</th>
                    <th className="py-2.5 px-3">Scan Pulang</th>
                    <th className="py-2.5 px-3">Keterlambatan</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Sinkron</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedProcessed.length > 0 ? (
                    paginatedProcessed.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-emerald-800">
                          {rec.employeeCode}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {rec.employeeName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {rec.department}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-mono">
                          {rec.workDate}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {rec.shiftCode || 'PAGI'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {rec.shiftIn}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 bg-emerald-50/40">
                          {rec.scanIn || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {rec.shiftOut}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 bg-blue-50/40">
                          {rec.scanOut || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {rec.lateMinutes > 0 ? (
                            <span className="text-rose-600 font-semibold">{rec.lateMinutes} m</span>
                          ) : (
                            <span className="text-slate-400">0 m</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {rec.status === 'Hadir Tepat Waktu' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Tepat Waktu
                            </span>
                          )}
                          {rec.status === 'Terlambat' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                              Terlambat
                            </span>
                          )}
                          {rec.status === 'Pulang Cepat' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              Pulang Cepat
                            </span>
                          )}
                          {rec.status === 'Belum Scan Pulang' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Belum Scan Pulang
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {syncSuccess ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Tersinkron
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                              Draft
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="py-10 text-center text-slate-400 text-xs">
                        Belum ada laporan presensi final yang cocok. Klik tombol "Kalkulasi Ulang" atau buka halaman Data Presensi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Kontrol Pagination */}
            <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>Baris per halaman:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span>
                  Menampilkan {filteredProcessed.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
                  {Math.min(currentPage * pageSize, filteredProcessed.length)} dari {filteredProcessed.length} data
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-medium text-slate-700">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Perlu Ditetapkan Shift */}
      {activeTab === 'tanpa_shift' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm">Perhatian: Karyawan Belum Terdaftar Jadwal Shift</p>
              <p className="text-amber-800 leading-relaxed">
                Daftar karyawan di bawah ini memiliki data tap fisik di mesin absensi, tetapi belum memiliki shift kerja yang terdaftar di sistem.
                Tetapkan jadwal shift kerja karyawan agar status kehadiran dan jam terlambat dapat dihitung secara akurat sebelum dikirim ke Data Absensi.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-semibold">
                    <th className="py-2.5 px-3">NIK</th>
                    <th className="py-2.5 px-3">Nama Karyawan</th>
                    <th className="py-2.5 px-3">Departemen</th>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Tap Masuk Terdeteksi</th>
                    <th className="py-2.5 px-3">Tap Pulang Terdeteksi</th>
                    <th className="py-2.5 px-3">Total Tap Mesin</th>
                    <th className="py-2.5 px-3 text-right">Tindakan Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unassignedRecords.length > 0 ? (
                    unassignedRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-amber-800">
                          {rec.employeeCode}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {rec.employeeName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {rec.department}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-mono">
                          {rec.workDate}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 bg-amber-50/40">
                          {rec.scanIn || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 bg-amber-50/40">
                          {rec.scanOut || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {rec.rawPunchesCount} tap
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleAssignDefaultShift(rec.employeeCode)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Tetapkan Shift Reguler Pagi
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                          <p className="font-semibold text-slate-700">
                            Semua Karyawan Telah Memiliki Jadwal Shift
                          </p>
                          <p className="text-slate-500">
                            Seluruh karyawan yang melakukan tap di mesin telah memiliki shift kerja aktif lengkap. Siap dikirim ke Data Absensi.
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
        subtitle="Sinkronisasi hasil kalkulasi tap mesin ke buku besar absensi resmi"
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
                  <span>Memproses Sinkronisasi...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Konfirmasi & Kirim Sekarang</span>
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
              <span>Total Catatan Siap Kirim:</span>
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
