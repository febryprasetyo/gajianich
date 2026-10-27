'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ListFilter,
  Search,
  Calendar,
  Cpu,
  Calculator,
  Download,
  ArrowRight,
  CheckCircle2,
  Filter,
  RefreshCw,
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
  const [selectedDate, setSelectedDate] = useState('2026-10-27');
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [selectedState, setSelectedState] = useState<'all' | 'Masuk' | 'Pulang' | 'Scan Antara'>('all');
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcNotice, setCalcNotice] = useState<string | null>(null);

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

  // Filtered raw logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedDate && log.workDate !== selectedDate) return false;
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
  }, [logs, selectedDate, selectedDevice, selectedState, searchQuery]);

  const uniqueDevices = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => map.set(l.deviceIp, l.deviceName));
    return Array.from(map.entries()).map(([ip, name]) => ({ ip, name }));
  }, [logs]);

  const handleCalculate = () => {
    setIsCalculating(true);
    setCalcNotice(null);

    setTimeout(() => {
      const { processed, unassigned } = calculateRecordsFromRawLogs(logs, KNOWN_SHIFTS);
      localStorage.setItem('ams_attendance_processed_records', JSON.stringify(processed));
      localStorage.setItem('ams_attendance_unassigned_shift_records', JSON.stringify(unassigned));
      setIsCalculating(false);
      setCalcNotice(
        `Kalkulasi selesai! ${processed.length} data absensi diproses${
          unassigned.length > 0 ? `, ${unassigned.length} data butuh pengaturan shift.` : '.'
        }`
      );
      setTimeout(() => {
        router.push('/dashboard/attendance/transactions');
      }, 1200);
    }, 600);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Data Presensi (Log Mentah Mesin)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              {logs.length} Total Rekaman Mentah
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Audit otentik stempel waktu asli dari mesin per detik, termasuk tap berulang pagi hari dan scan siang hari.
          </p>
        </div>

        {/* Tombol Aksi Utama: Kalkulasi ke Laporan Presensi */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/attendance/devices"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Download dari Mesin
          </Link>
          <button
            type="button"
            onClick={handleCalculate}
            disabled={isCalculating || logs.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" />
            {isCalculating ? 'Mengkalkulasi...' : 'Kalkulasi ke Laporan Presensi'}
          </button>
        </div>
      </div>

      {/* Notifikasi Berhasil Kalkulasi */}
      {calcNotice && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{calcNotice} Mengalihkan ke halaman Laporan Presensi...</span>
        </div>
      )}

      {/* Toolbar Filter & Pencarian */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari NIK, PIN, Nama, Dept..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Date */}
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

          {/* Device filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">Semua Mesin</option>
              {uniqueDevices.map((d) => (
                <option key={d.ip} value={d.ip}>
                  {d.name} ({d.ip})
                </option>
              ))}
            </select>
          </div>

          {/* State filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">Semua Tipe Scan</option>
              <option value="Masuk">Scan Masuk</option>
              <option value="Pulang">Scan Pulang</option>
              <option value="Scan Antara">Scan Antara (Siang)</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Menampilkan <span className="font-semibold text-slate-800">{filteredLogs.length}</span> dari {logs.length} data
        </div>
      </div>

      {/* Tabel Log Mentah Presensi (Solution Data Grid) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="py-2.5 px-3 w-10 text-center">No</th>
                <th className="py-2.5 px-3">Waktu Fisik Riil</th>
                <th className="py-2.5 px-3">No. PIN / NIK</th>
                <th className="py-2.5 px-3">Nama Karyawan</th>
                <th className="py-2.5 px-3">Departemen</th>
                <th className="py-2.5 px-3">Lokasi / Mesin</th>
                <th className="py-2.5 px-3">Metode Verifikasi</th>
                <th className="py-2.5 px-3">Status Tap Mesin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, index) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                      {index + 1}
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
                    <div className="max-w-xs mx-auto space-y-2">
                      <ListFilter className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-medium text-slate-600">Tidak ada log presensi yang cocok dengan filter.</p>
                      <p className="text-[11px] text-slate-400">
                        Coba ubah tanggal atau tarik data terbaru melalui menu Download Presensi.
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
  );
}
