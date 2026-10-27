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
} from 'lucide-react';
import {
  ProcessedAttendanceRecord,
  UnassignedShiftRecord,
  RawAttendanceLog,
  INITIAL_RAW_LOGS,
  calculateRecordsFromRawLogs,
  KNOWN_SHIFTS,
} from './attendanceMachineStore';

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
  const [selectedDate, setSelectedDate] = useState('2026-10-27');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persist updates
  useEffect(() => {
    localStorage.setItem('ams_attendance_processed_records', JSON.stringify(processedRecords));
  }, [processedRecords]);

  useEffect(() => {
    localStorage.setItem('ams_attendance_unassigned_shift_records', JSON.stringify(unassignedRecords));
  }, [unassignedRecords]);

  const filteredProcessed = useMemo(() => {
    return processedRecords.filter((rec) => {
      if (selectedDate && rec.workDate !== selectedDate) return false;
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
  }, [processedRecords, selectedDate, selectedStatus, searchQuery]);

  const handleRecalculate = () => {
    const rawSaved = localStorage.getItem('ams_attendance_raw_logs');
    const rawLogs: RawAttendanceLog[] = rawSaved ? JSON.parse(rawSaved) : INITIAL_RAW_LOGS;
    const { processed, unassigned } = calculateRecordsFromRawLogs(rawLogs, KNOWN_SHIFTS);
    setProcessedRecords(processed);
    setUnassignedRecords(unassigned);
    setToastMessage('Kalkulasi ulang berhasil diperbarui!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAssignDefaultShift = (employeeCode: string) => {
    const target = unassignedRecords.find((r) => r.employeeCode === employeeCode);
    if (!target) return;

    const newShift = { shiftName: 'Reguler Pagi (08:00 - 17:00)', shiftIn: '08:00', shiftOut: '17:00' };
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

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Laporan Presensi (Data Final Terkalkulasi)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {processedRecords.length} Data Terkalkulasi
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Data absensi final hasil kalkulasi jadwal shift karyawan dengan aturan First-In, Last-Out (scan pertama = masuk, scan terakhir = pulang).
          </p>
        </div>

        {/* Toolbar kanan */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/attendance/raw-logs"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
          >
            <span>Buka Data Presensi (Mentah)</span>
          </Link>
          <button
            type="button"
            onClick={handleRecalculate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <Calculator className="w-4 h-4" />
            Kalkulasi Ulang
          </button>
        </div>
      </div>

      {/* Toast Notifikasi */}
      {toastMessage && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Tab Navigasi: Laporan Presensi vs Tidak Ada Shift */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('laporan')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'laporan'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Laporan Presensi Final</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
            {processedRecords.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tanpa_shift')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'tanpa_shift'
              ? 'border-amber-600 text-amber-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>⚠️ Karyawan Tanpa Shift</span>
          {unassignedRecords.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold border border-amber-200">
              {unassignedRecords.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Laporan Presensi Final */}
      {activeTab === 'laporan' && (
        <div className="space-y-4">
          {/* Toolbar Filter */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[200px] max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari NIK, Nama, Departemen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500"
                />
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate('')}
                    className="text-[11px] text-slate-400 hover:text-slate-600"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="all">Semua Status</option>
                  <option value="Hadir Tepat Waktu">Hadir Tepat Waktu</option>
                  <option value="Terlambat">Terlambat</option>
                  <option value="Pulang Cepat">Pulang Cepat</option>
                  <option value="Belum Scan Pulang">Belum Scan Pulang</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Menampilkan <span className="font-semibold text-slate-800">{filteredProcessed.length}</span> data
            </div>
          </div>

          {/* Tabel Laporan Presensi Final */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-semibold">
                    <th className="py-2.5 px-3">NIK</th>
                    <th className="py-2.5 px-3">Nama Karyawan</th>
                    <th className="py-2.5 px-3">Departemen</th>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Shift Kerja</th>
                    <th className="py-2.5 px-3">Jadwal Masuk</th>
                    <th className="py-2.5 px-3">Scan Masuk (Tap 1)</th>
                    <th className="py-2.5 px-3">Jadwal Pulang</th>
                    <th className="py-2.5 px-3">Scan Pulang (Tap Akhir)</th>
                    <th className="py-2.5 px-3">Terlambat</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Jml Tap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProcessed.length > 0 ? (
                    filteredProcessed.map((rec) => (
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
                        <td className="py-2.5 px-3 text-slate-700">
                          {rec.shiftName}
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
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono">
                          {rec.rawPunchesCount}x
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
          </div>
        </div>
      )}

      {/* Tab 2: Karyawan Tanpa Shift */}
      {activeTab === 'tanpa_shift' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-amber-950">
              <span className="font-bold text-sm">Pencegahan Kehilangan Data Absensi:</span>
              <p>
                Daftar karyawan di bawah ini memiliki data tap fisik di mesin absensi, tetapi belum memiliki shift kerja yang terdaftar di sistem.
                Jika tidak ditetapkan shift, data absensi mereka tidak akan muncul di laporan payroll.
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
                    <th className="py-2.5 px-3">Tanggal Absen</th>
                    <th className="py-2.5 px-3">Scan Pertama</th>
                    <th className="py-2.5 px-3">Scan Terakhir</th>
                    <th className="py-2.5 px-3">Total Tap Mesin</th>
                    <th className="py-2.5 px-4 text-center">Aksi Cepat</th>
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
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {rec.workDate}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-900 font-semibold">
                          {rec.scanIn || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-900 font-semibold">
                          {rec.scanOut || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {rec.rawPunchesCount}x tap
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleAssignDefaultShift(rec.employeeCode)}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors"
                          >
                            Tetapkan Shift Default
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-emerald-800 font-medium text-xs">
                        ✓ Seluruh karyawan yang melakukan tap di mesin telah memiliki shift kerja aktif lengkap.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
