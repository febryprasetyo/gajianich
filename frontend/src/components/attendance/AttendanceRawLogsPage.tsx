'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Calendar,
  Cpu,
  Calculator,
  Download,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  RawAttendanceLog,
  INITIAL_RAW_LOGS,
  calculateRecordsFromRawLogs,
  KNOWN_SHIFTS,
} from './attendanceMachineStore';

export default function AttendanceRawLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<RawAttendanceLog[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_attendance_raw_logs');
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return INITIAL_RAW_LOGS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('2026-10-27');
  const [endDate, setEndDate] = useState('2026-10-27');
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [selectedState, setSelectedState] = useState<'all' | 'Masuk' | 'Pulang' | 'Scan Antara'>('all');
  const [isCalculating, setIsCalculating] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sync logs if updated from another page
  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('ams_attendance_raw_logs');
      if (saved) {
        try { setLogs(JSON.parse(saved)); } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedDevice('all');
    setSelectedState('all');
    setCurrentPage(1);
  };

  // Filtered raw logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (startDate && log.workDate < startDate) return false;
      if (endDate && log.workDate > endDate) return false;
      if (selectedDevice !== 'all' && log.deviceIp !== selectedDevice) return false;
      if (selectedState !== 'all' && log.inOutState !== selectedState) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = log.employeeName.toLowerCase().includes(q);
        const matchCode = log.employeeCode.toLowerCase().includes(q);
        const matchPin = log.pin.includes(q);
        const matchDept = log.department.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchPin && !matchDept) return false;
      }
      return true;
    });
  }, [logs, startDate, endDate, selectedDevice, selectedState, searchQuery]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const uniqueDevices = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => map.set(l.deviceIp, l.deviceName));
    return Array.from(map.entries()).map(([ip, name]) => ({ ip, name }));
  }, [logs]);

  const handleCalculate = () => {
    setIsCalculating(true);
    setTimeout(() => {
      const { processed, unassigned } = calculateRecordsFromRawLogs(logs, KNOWN_SHIFTS);
      localStorage.setItem('ams_attendance_processed_records', JSON.stringify(processed));
      localStorage.setItem('ams_attendance_unassigned_shift_records', JSON.stringify(unassigned));
      setIsCalculating(false);
      router.push('/dashboard/attendance/transactions');
    }, 500);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Data Presensi
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Daftar seluruh riwayat tap masuk dan pulang yang ditarik langsung dari mesin.
          </p>
        </div>

        {/* Tombol Aksi Utama */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/attendance/devices"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Download dari Mesin
          </Link>
          <button
            type="button"
            onClick={handleCalculate}
            disabled={isCalculating || logs.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" />
            {isCalculating ? 'Mengkalkulasi...' : 'Kalkulasi ke Laporan Presensi'}
          </button>
        </div>
      </div>

      {/* Bagian 1: Pencarian Cepat */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Pencarian Cepat
          </label>
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama karyawan, NIK, nomor PIN, atau departemen..."
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

            {/* Filter Mesin */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl">
              <Cpu className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedDevice}
                onChange={(e) => {
                  setSelectedDevice(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value="all">Semua Mesin</option>
                {uniqueDevices.map((d) => (
                  <option key={d.ip} value={d.ip}>
                    {d.name} ({d.ip})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Tipe Scan */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value="all">Semua Jenis Tap</option>
                <option value="Masuk">Tap Masuk</option>
                <option value="Pulang">Tap Pulang</option>
                <option value="Scan Antara">Scan Antara (Siang)</option>
              </select>
            </div>

            {/* Tombol Reset Filter yang Jelas & Tegas */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Filter
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Ditemukan <span className="font-semibold text-slate-800">{filteredLogs.length}</span> data
          </div>
        </div>
      </div>

      {/* Tabel Data Presensi */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="py-2.5 px-3 w-10 text-center">No</th>
                <th className="py-2.5 px-3">Waktu Presensi</th>
                <th className="py-2.5 px-3">No. PIN / NIK</th>
                <th className="py-2.5 px-3">Nama Karyawan</th>
                <th className="py-2.5 px-3">Departemen</th>
                <th className="py-2.5 px-3">Mesin Presensi</th>
                <th className="py-2.5 px-3">Metode Verifikasi</th>
                <th className="py-2.5 px-3">Status Tap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log, index) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                      {log.timestamp}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {log.pin} / <span className="text-emerald-700 font-semibold">{log.employeeCode}</span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {log.employeeName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {log.department}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {log.deviceName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                        {log.verifyMode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {log.inOutState === 'Masuk' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Masuk
                        </span>
                      )}
                      {log.inOutState === 'Pulang' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          Pulang
                        </span>
                      )}
                      {log.inOutState === 'Scan Antara' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          Scan Antara
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="text-xs font-medium text-slate-600">Tidak ada data presensi yang sesuai dengan filter.</p>
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
              Menampilkan {filteredLogs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
              {Math.min(currentPage * pageSize, filteredLogs.length)} dari {filteredLogs.length} data
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
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
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
