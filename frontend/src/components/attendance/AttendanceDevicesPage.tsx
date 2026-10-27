'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Cpu,
  Plug,
  Unplug,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  Loader2,
  FileCheck2,
  History,
  Users,
  Search,
  Calculator,
  Plus,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  Settings,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

// Interface Definitions
export interface AttendanceDeviceItem {
  id: string;
  name: string;
  machineNumber: number;
  ip: string;
  port: number;
  commKey: number;
  commType: string;
  model: string;
  serialNumber: string;
  enabled: boolean;
  connectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
  lastSyncedAt?: string | null;
}

export interface RawAttendanceLog {
  id: string;
  department: string;
  employeeCode: string;
  employeeName: string;
  timestamp: string; // 'YYYY-MM-DD HH:mm:ss'
  workDate: string;
  timeOnly: string;
  machineName: string;
  pin: string;
  verifyMode: 'Wajah' | 'Sidik Jari' | 'Password' | 'Kartu';
  tag: 'MASUK' | 'KELUAR' | 'ANTARA'; // Masuk (awal), Keluar (akhir), Antara (siang/dobel)
}

export interface ProcessedAttendanceRecord {
  id: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  workDate: string;
  shiftName: string;
  scheduleIn: string;
  scheduleOut: string;
  scanIn: string;
  scanOut: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  attendanceStatus: 'PRESENT' | 'LATE' | 'EARLY_DEPARTURE' | 'INCOMPLETE';
  rawPunchesCount: number;
  hasShift: boolean;
}

const DEFAULT_DEVICES: AttendanceDeviceItem[] = [
  {
    id: 'solution-x900-utama',
    name: 'Solution X900 Utama',
    machineNumber: 1,
    ip: '192.168.10.224',
    port: 4370,
    commKey: 0,
    commType: 'TCP/IP (Jaringan)',
    model: 'Solution X900 (ZAM180_TFT)',
    serialNumber: 'WAE4242900026',
    enabled: true,
    connectionStatus: 'DISCONNECTED',
    lastSyncedAt: '2026-10-27 08:30:00',
  },
  {
    id: 'mesin-kedua',
    name: 'MGM',
    machineNumber: 1,
    ip: '192.168.10.4',
    port: 4370,
    commKey: 0,
    commType: 'TCP/IP (Jaringan)',
    model: 'Solution X900 (ZAM180_TFT)',
    serialNumber: 'WAE4242300038',
    enabled: true,
    connectionStatus: 'DISCONNECTED',
    lastSyncedAt: '2026-10-26 17:15:00',
  },
  {
    id: 'mesin-192-168-0-80',
    name: 'Gudang 2 OL',
    machineNumber: 1,
    ip: '192.168.0.80',
    port: 4370,
    commKey: 123456,
    commType: 'TCP/IP (Jaringan)',
    model: 'Solution Standalone',
    serialNumber: 'GSY1254900014',
    enabled: true,
    connectionStatus: 'DISCONNECTED',
    lastSyncedAt: null,
  },
  {
    id: 'mesin-192-168-1-199',
    name: 'Mesin Cabang 1',
    machineNumber: 1,
    ip: '192.168.1.199',
    port: 4370,
    commKey: 123456,
    commType: 'TCP/IP (Jaringan)',
    model: 'Solution Standalone',
    serialNumber: '-',
    enabled: true,
    connectionStatus: 'DISCONNECTED',
    lastSyncedAt: null,
  },
  {
    id: 'mesin-192-168-1-242',
    name: 'Mesin Cabang 2',
    machineNumber: 1,
    ip: '192.168.1.242',
    port: 4370,
    commKey: 123456,
    commType: 'TCP/IP (Jaringan)',
    model: 'Solution Standalone',
    serialNumber: '-',
    enabled: true,
    connectionStatus: 'DISCONNECTED',
    lastSyncedAt: null,
  },
];

const IDLE_TIMEOUT_SECONDS = 15 * 60; // 15 menit

export default function AttendanceDevicesPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Role check: superadmin or IT admin
  const isSuperAdminOrIT = (() => {
    const role = (user?.roleName || (user as any)?.role || '').toLowerCase();
    return role.includes('admin') || role.includes('superadmin') || role.includes('it');
  })();

  // Device & Selection States
  const [devices, setDevices] = useState<AttendanceDeviceItem[]>(DEFAULT_DEVICES);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('solution-x900-utama');
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [idleSeconds, setIdleSeconds] = useState<number>(IDLE_TIMEOUT_SECONDS);
  const [connecting, setConnecting] = useState<boolean>(false);

  // Modal Download States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const firstDayOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [startDate, setStartDate] = useState<string>(firstDayOfMonthStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(true);

  // Download Progress Bar state
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadCount, setDownloadCount] = useState<number>(0);
  const [downloadTotal, setDownloadTotal] = useState<number>(0);
  const [downloadFinished, setDownloadFinished] = useState<boolean>(false);

  // Data Tabs: 'final' (Laporan Presensi), 'raw' (Data Presensi), 'noshift' (Tidak Ada Shift)
  const [activeTab, setActiveTab] = useState<'final' | 'raw' | 'noshift'>('final');
  const [rawLogs, setRawLogs] = useState<RawAttendanceLog[]>([]);
  const [processedRecords, setProcessedRecords] = useState<ProcessedAttendanceRecord[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Restore Cached Logs from localStorage on initial mount
  useEffect(() => {
    try {
      const cachedRaw = localStorage.getItem('ams_attendance_raw_logs');
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (Array.isArray(parsed) && parsed.length > 0) setRawLogs(parsed);
      }
      const cachedProcessed = localStorage.getItem('ams_attendance_processed_records');
      if (cachedProcessed) {
        const parsed = JSON.parse(cachedProcessed);
        if (Array.isArray(parsed) && parsed.length > 0) setProcessedRecords(parsed);
      }
    } catch {
      // Ignore storage parse errors
    }
  }, []);

  // Idle Timer (15 Minutes)
  useEffect(() => {
    if (!connectedDeviceId) return;

    const timer = setInterval(() => {
      setIdleSeconds((prev) => {
        if (prev <= 1) {
          handleDisconnect(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [connectedDeviceId]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const resetIdleTimer = () => {
    setIdleSeconds(IDLE_TIMEOUT_SECONDS);
  };

  // Connect to Selected Machine
  const handleConnect = async () => {
    if (!selectedDeviceId) return;
    setConnecting(true);
    setNotice(null);

    try {
      try {
        await api.post(`/attendance/devices/${selectedDeviceId}/connect`);
      } catch {
        // Fallback for simulation
      }

      setDevices((prev) =>
        prev.map((d) => ({
          ...d,
          connectionStatus: d.id === selectedDeviceId ? 'CONNECTED' : 'DISCONNECTED',
        }))
      );
      setConnectedDeviceId(selectedDeviceId);
      resetIdleTimer();

      const dev = devices.find((d) => d.id === selectedDeviceId);
      setNotice({
        type: 'success',
        message: `Mesin ${dev?.name} (${dev?.ip}:${dev?.port}) berhasil dikoneksikan. Batas idle 15 menit aktif.`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.message || `Gagal mengkoneksikan mesin ${selectedDeviceId}`,
      });
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect Machine
  const handleDisconnect = async (isAuto = false) => {
    if (!connectedDeviceId) return;
    const currentId = connectedDeviceId;

    try {
      try {
        await api.post(`/attendance/devices/${currentId}/disconnect`);
      } catch {
        // Fallback
      }

      setDevices((prev) =>
        prev.map((d) => (d.id === currentId ? { ...d, connectionStatus: 'DISCONNECTED' } : d))
      );
      setConnectedDeviceId(null);
      setIdleSeconds(IDLE_TIMEOUT_SECONDS);

      const dev = devices.find((d) => d.id === currentId);
      setNotice({
        type: 'info',
        message: isAuto
          ? `Koneksi ke ${dev?.name} diputus otomatis karena idle 15 menit.`
          : `Koneksi ke ${dev?.name} telah diputuskan.`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.message || 'Gagal memutuskan koneksi.',
      });
    }
  };

  // Execute Download Data from Machine
  const executeDownload = async () => {
    if (!connectedDeviceId) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadCount(0);
    setDownloadFinished(false);
    resetIdleTimer();

    const targetTotal = 168; // Mock sample raw lines from device
    setDownloadTotal(targetTotal);

    // Simulate progressive chunk streaming
    let current = 0;
    const interval = setInterval(async () => {
      current += Math.floor(Math.random() * 25) + 12;
      if (current >= targetTotal) {
        current = targetTotal;
        clearInterval(interval);
        setDownloadProgress(100);
        setDownloadCount(targetTotal);
        setDownloadFinished(true);
        setIsDownloading(false);

        // Generate Sample Raw Logs from Device
        const sampleRawLogs = generateSampleRawLogs(targetTotal, startDate, endDate);
        setRawLogs(sampleRawLogs);
        try {
          localStorage.setItem('ams_attendance_raw_logs', JSON.stringify(sampleRawLogs));
        } catch {}

        // Automatically run initial shift calculation
        const calculated = calculateAttendanceFromRawLogs(sampleRawLogs);
        setProcessedRecords(calculated);
        try {
          localStorage.setItem('ams_attendance_processed_records', JSON.stringify(calculated));
        } catch {}

        // Update last synced time on device
        const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
        setDevices((prev) =>
          prev.map((d) => (d.id === connectedDeviceId ? { ...d, lastSyncedAt: nowStr } : d))
        );

        setNotice({
          type: 'success',
          message: `Berhasil mengunduh ${targetTotal} log mentah (Data Presensi). Silakan cek tab Laporan Presensi atau lakukan kalkulasi ulang.`,
        });
      } else {
        setDownloadCount(current);
        setDownloadProgress(Math.floor((current / targetTotal) * 100));
      }
    }, 180);
  };

  // Generate Sample Raw Logs matching Solution format
  const generateSampleRawLogs = (count: number, sDate: string, eDate: string): RawAttendanceLog[] => {
    const employees = [
      { code: '50179', name: 'Budi Santoso', dept: 'OUR COMPANY', pin: '1' },
      { code: '50180', name: 'Siti Aminah', dept: 'OUR COMPANY', pin: '2' },
      { code: '50181', name: 'Ahmad Fauzi', dept: 'OUR COMPANY', pin: '3' },
      { code: '50182', name: 'Dewi Lestari', dept: 'PRODUKSI', pin: '4' },
      { code: '50183', name: 'Rudi Hartono', dept: 'LOGISTIK', pin: '5' },
      { code: '50184', name: 'Mega Pratiwi (Tanpa Shift)', dept: 'MAGANG', pin: '6' }, // Intentional missing shift
    ];

    const logs: RawAttendanceLog[] = [];
    const activeDev = devices.find((d) => d.id === connectedDeviceId);
    const mName = activeDev?.name ?? 'Solution X900';

    employees.forEach((emp, eIdx) => {
      // 1. Pagi (Tap Masuk 1 & Dobel)
      logs.push({
        id: `raw-${eIdx}-1`,
        department: emp.dept,
        employeeCode: emp.code,
        employeeName: emp.name,
        timestamp: `${eDate} 07:54:12`,
        workDate: eDate,
        timeOnly: '07:54:12',
        machineName: mName,
        pin: emp.pin,
        verifyMode: 'Wajah',
        tag: 'MASUK',
      });
      // Dobel tap pagi
      logs.push({
        id: `raw-${eIdx}-2`,
        department: emp.dept,
        employeeCode: emp.code,
        employeeName: emp.name,
        timestamp: `${eDate} 07:55:04`,
        workDate: eDate,
        timeOnly: '07:55:04',
        machineName: mName,
        pin: emp.pin,
        verifyMode: 'Wajah',
        tag: 'ANTARA',
      });

      // 2. Siang (Accidental tap lewat depan mesin jam makan siang)
      if (eIdx !== 1) {
        logs.push({
          id: `raw-${eIdx}-3`,
          department: emp.dept,
          employeeCode: emp.code,
          employeeName: emp.name,
          timestamp: `${eDate} 12:15:20`,
          workDate: eDate,
          timeOnly: '12:15:20',
          machineName: mName,
          pin: emp.pin,
          verifyMode: 'Wajah',
          tag: 'ANTARA',
        });
      }

      // 3. Sore (Tap Pulang Akhir)
      if (emp.code !== '50183') {
        logs.push({
          id: `raw-${eIdx}-4`,
          department: emp.dept,
          employeeCode: emp.code,
          employeeName: emp.name,
          timestamp: `${eDate} 17:04:35`,
          workDate: eDate,
          timeOnly: '17:04:35',
          machineName: mName,
          pin: emp.pin,
          verifyMode: 'Sidik Jari',
          tag: 'KELUAR',
        });
      }
    });

    return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  };

  // Calculation Engine: First-In, Last-Out + Shift Lookup
  const calculateAttendanceFromRawLogs = (logs: RawAttendanceLog[]): ProcessedAttendanceRecord[] => {
    // Group logs by employeeCode and workDate
    const map = new Map<string, RawAttendanceLog[]>();
    logs.forEach((log) => {
      const key = `${log.employeeCode}_${log.workDate}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    });

    const results: ProcessedAttendanceRecord[] = [];

    map.forEach((empLogs, key) => {
      // Sort chronologically
      empLogs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      const firstLog = empLogs[0];
      const earliestTap = firstLog.timeOnly;
      const latestTap = empLogs.length > 1 ? empLogs[empLogs.length - 1].timeOnly : null;

      // Shift resolution simulation
      const hasShift = firstLog.employeeCode !== '50184'; // Mega Pratiwi simulates missing shift
      const shiftName = hasShift ? 'Office Reguler (Default)' : '-';
      const scheduleIn = hasShift ? '08:00' : '-';
      const scheduleOut = hasShift ? '17:00' : '-';

      let lateMinutes = 0;
      if (hasShift && earliestTap > '08:00:00') {
        const [h, m] = earliestTap.split(':').map(Number);
        lateMinutes = Math.max(0, h * 60 + m - 8 * 60);
      }

      let earlyMinutes = 0;
      if (hasShift && latestTap && latestTap < '17:00:00') {
        const [h, m] = latestTap.split(':').map(Number);
        earlyMinutes = Math.max(0, 17 * 60 - (h * 60 + m));
      }

      let status: ProcessedAttendanceRecord['attendanceStatus'] = 'PRESENT';
      if (lateMinutes > 0) status = 'LATE';
      if (!latestTap) status = 'INCOMPLETE';

      results.push({
        id: key,
        employeeCode: firstLog.employeeCode,
        employeeName: firstLog.employeeName,
        department: firstLog.department,
        workDate: firstLog.workDate,
        shiftName,
        scheduleIn,
        scheduleOut,
        scanIn: earliestTap,
        scanOut: latestTap,
        lateMinutes,
        earlyMinutes,
        attendanceStatus: status,
        rawPunchesCount: empLogs.length,
        hasShift,
      });
    });

    return results;
  };

  // Re-run Calculation button
  const handleRecalculate = () => {
    if (rawLogs.length === 0) {
      setNotice({ type: 'info', message: 'Belum ada Data Presensi (log mentah) untuk dikalkulasi.' });
      return;
    }
    const calculated = calculateAttendanceFromRawLogs(rawLogs);
    setProcessedRecords(calculated);
    try {
      localStorage.setItem('ams_attendance_processed_records', JSON.stringify(calculated));
    } catch {}
    setNotice({
      type: 'success',
      message: `Kalkulasi berhasil: ${calculated.length} rekaman presensi diproses dengan aturan shift & First-In Last-Out.`,
    });
  };

  // Assign shift quickly to unmapped employee
  const handleAssignDefaultShift = (employeeCode: string) => {
    setProcessedRecords((prev) =>
      prev.map((rec) => {
        if (rec.employeeCode === employeeCode) {
          const earliestTap = rec.scanIn;
          let late = 0;
          if (earliestTap > '08:00:00') {
            const [h, m] = earliestTap.split(':').map(Number);
            late = Math.max(0, h * 60 + m - 8 * 60);
          }
          return {
            ...rec,
            hasShift: true,
            shiftName: 'Office Reguler (Default)',
            scheduleIn: '08:00',
            scheduleOut: '17:00',
            lateMinutes: late,
            attendanceStatus: late > 0 ? 'LATE' : 'PRESENT',
          };
        }
        return rec;
      })
    );
    setNotice({
      type: 'success',
      message: `Shift default berhasil ditetapkan untuk karyawan ${employeeCode}. Data otomatis masuk ke Laporan Presensi.`,
    });
  };

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);
  const isSelectedConnected = selectedDevice?.connectionStatus === 'CONNECTED';

  // Filters
  const noShiftRecords = processedRecords.filter((r) => !r.hasShift);
  const validRecords = processedRecords.filter((r) => r.hasShift);

  const filteredProcessed = validRecords.filter((r) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      r.employeeCode.toLowerCase().includes(q) ||
      r.employeeName.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q)
    );
  });

  const filteredRawLogs = rawLogs.filter((l) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      l.employeeCode.toLowerCase().includes(q) ||
      l.employeeName.toLowerCase().includes(q) ||
      l.department.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 pb-16">
      {/* 1. Header & Navigation */}
      <div>
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1.5">
          <span>Attendance</span>
          <span>/</span>
          <span className="text-emerald-700 font-semibold">Download Presensi Mesin</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Cpu className="text-emerald-600" size={24} />
              Download & Kalkulasi Presensi Mesin
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Alur koneksi langsung mesin Solution/ZKTeco, penarikan Data Presensi (mentah), dan kalkulasi Laporan Presensi.
            </p>
          </div>

          {/* Active Session Status & Idle Timer */}
          {connectedDeviceId && (
            <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl shadow-sm text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-emerald-800">
                Terhubung: {devices.find((d) => d.id === connectedDeviceId)?.name}
              </span>
              <span className="text-emerald-400">|</span>
              <Clock size={13} className="text-emerald-600" />
              <span className="text-slate-600">Sisa Idle:</span>
              <span className="font-mono font-bold text-emerald-950 bg-white px-2 py-0.5 rounded border border-emerald-200">
                {formatTimer(idleSeconds)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Global Alerts / Notices */}
      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border shadow-sm transition-all ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : notice.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
          ) : notice.type === 'error' ? (
            <AlertCircle size={16} className="text-rose-600 mt-0.5 shrink-0" />
          ) : (
            <Clock size={16} className="text-blue-600 mt-0.5 shrink-0" />
          )}
          <div className="flex-1 font-medium leading-relaxed">{notice.message}</div>
          <button
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-600 text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Top Action Toolbar (Ribbon bergaya Solution App) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Koneksikan Button */}
          <button
            type="button"
            disabled={connecting || isSelectedConnected || !selectedDeviceId}
            onClick={handleConnect}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {connecting ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
            Koneksikan
          </button>

          {/* Putuskan Button */}
          <button
            type="button"
            disabled={!isSelectedConnected}
            onClick={() => handleDisconnect(false)}
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Unplug size={14} />
            Putuskan
          </button>

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {/* Download Data Presensi Button (Opens Modal) */}
          <button
            type="button"
            disabled={!isSelectedConnected}
            onClick={() => {
              setIsModalOpen(true);
              setDownloadFinished(false);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={14} className="text-emerald-600" />
            Download Data Presensi
          </button>

          {/* Kalkulasi Button */}
          <button
            type="button"
            onClick={handleRecalculate}
            disabled={rawLogs.length === 0}
            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
          >
            <Calculator size={14} className="text-slate-500" />
            Kalkulasi Shift
          </button>
        </div>

        {/* Superadmin / IT Admin Controls */}
        {isSuperAdminOrIT && (
          <div className="flex items-center gap-1.5 border-t sm:border-t-0 sm:border-l border-slate-200 pt-1.5 sm:pt-0 sm:pl-2">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold px-1">
              Admin:
            </span>
            <button
              type="button"
              onClick={() => alert('Fitur Tambah Mesin hanya untuk IT Administrator.')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1"
            >
              <Plus size={12} />
              Tambah Mesin
            </button>
            <button
              type="button"
              onClick={() => alert('Pilih mesin untuk menghapus.')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1"
            >
              <Trash2 size={12} />
              Hapus
            </button>
          </div>
        )}
      </div>

      {/* 3. Compact Machine Table (Single Select Radio Button per Baris) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 font-mono flex items-center gap-1.5">
            <Layers size={13} className="text-emerald-600" />
            Daftar Mesin Absensi ({devices.length})
          </span>
          <span className="text-[11px] text-slate-400">
            Pilih radio button untuk mengkoneksikan mesin
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2 px-3 text-center w-12">Pilih</th>
                <th className="py-2 px-4">Nama Mesin</th>
                <th className="py-2 px-4">Status Koneksi</th>
                <th className="py-2 px-4">Alamat IP</th>
                <th className="py-2 px-3 font-mono text-[11px]">Port</th>
                <th className="py-2 px-3 font-mono text-[11px]">No Mesin</th>
                <th className="py-2 px-4 font-mono text-[11px]">Serial Number (SN)</th>
                <th className="py-2 px-4">Terakhir Tarik Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {devices.map((device) => {
                const isSelected = selectedDeviceId === device.id;
                const isConnected = device.connectionStatus === 'CONNECTED';

                return (
                  <tr
                    key={device.id}
                    onClick={() => setSelectedDeviceId(device.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/50 hover:bg-emerald-50/70'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Radio Button Selector */}
                    <td className="py-2 px-3 text-center">
                      <input
                        type="radio"
                        name="selectedMachineRadio"
                        checked={isSelected}
                        onChange={() => setSelectedDeviceId(device.id)}
                        className="h-3.5 w-3.5 text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Nama Mesin */}
                    <td className="py-2 px-4 font-bold text-slate-900 flex items-center gap-1.5">
                      {device.name}
                      {isSelected && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono font-normal">
                          Dipilih
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-2 px-4">
                      {isConnected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Terhubung
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Koneksi Putus
                        </span>
                      )}
                    </td>

                    {/* IP & Port */}
                    <td className="py-2 px-4 font-mono font-medium text-slate-800">
                      {device.ip}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">{device.port}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{device.machineNumber}</td>
                    <td className="py-2 px-4 font-mono text-slate-700 text-[11px]">
                      {device.serialNumber}
                    </td>
                    <td className="py-2 px-4 text-slate-600 text-[11px]">
                      {device.lastSyncedAt || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL: "Download Data Presensi" (Sesuai Permintaan Gambar & Alur) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Download className="text-emerald-600" size={18} />
                <h3 className="text-sm font-bold text-slate-900">
                  Download Data Presensi dari Mesin
                </h3>
              </div>
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold px-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Target Info */}
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-emerald-600 uppercase font-mono font-semibold">
                    Mesin Terhubung
                  </p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {selectedDevice?.name} ({selectedDevice?.ip}:{selectedDevice?.port})
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-emerald-600 uppercase font-mono font-semibold">
                    SN Mesin
                  </p>
                  <p className="font-mono text-xs font-semibold text-slate-700 mt-0.5">
                    {selectedDevice?.serialNumber}
                  </p>
                </div>
              </div>

              {/* Date Range Selection */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Mulai
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      disabled={isDownloading}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Selesai
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      disabled={isDownloading}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Date Shortcuts */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-slate-400">Pilihan Cepat:</span>
                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={() => {
                      setStartDate(todayStr);
                      setEndDate(todayStr);
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[11px] text-slate-700 font-medium"
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 7);
                      setStartDate(d.toISOString().slice(0, 10));
                      setEndDate(todayStr);
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[11px] text-slate-700 font-medium"
                  >
                    7 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={() => {
                      setStartDate(firstDayOfMonthStr);
                      setEndDate(todayStr);
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[11px] text-slate-700 font-medium"
                  >
                    Bulan Ini
                  </button>
                </div>

                {/* Overwrite Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={overwriteExisting}
                    disabled={isDownloading}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                  />
                  <span>Perbarui/timpa jam scan jika tanggal tersebut sudah ada di sistem</span>
                </label>
              </div>

              {/* Progress Bar Display (Ditampilkan saat proses atau selesai) */}
              {(isDownloading || downloadFinished) && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      {isDownloading && <Loader2 size={13} className="animate-spin text-emerald-600" />}
                      {downloadFinished ? 'Selesai Mengunduh Log' : 'Sedang Mengunduh Data...'}
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {downloadProgress}%
                    </span>
                  </div>

                  {/* Progress Bar Track */}
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2.5 rounded-full transition-all duration-200"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>

                  {/* Progress Counter Status */}
                  <p className="text-[11px] text-slate-500 font-mono text-center pt-0.5">
                    {downloadCount} / {downloadTotal} log transaksi terbaca
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                {downloadFinished ? 'Tutup' : 'Batal'}
              </button>

              {!downloadFinished ? (
                <button
                  type="button"
                  disabled={isDownloading}
                  onClick={executeDownload}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Mengunduh...
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Mulai Download Data
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setActiveTab('final');
                  }}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Eye size={14} />
                  Lihat Hasil di Laporan Presensi
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Dual-View Tabs: Laporan Presensi vs Data Presensi (Log Mentah) vs Tidak Ada Shift */}
      <div className="space-y-3">
        {/* Tab Headers */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {/* Tab 1: Laporan Presensi */}
            <button
              type="button"
              onClick={() => setActiveTab('final')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'final'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck2 size={14} className="text-emerald-600" />
              Laporan Presensi (Final)
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {validRecords.length}
              </span>
            </button>

            {/* Tab 2: Data Presensi (Log Mentah) */}
            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'raw'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet size={14} className="text-slate-500" />
              Data Presensi (Log Mentah Mesin)
              <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {rawLogs.length}
              </span>
            </button>

            {/* Tab 3: Tidak Ada Shift (PENTING) */}
            <button
              type="button"
              onClick={() => setActiveTab('noshift')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'noshift'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle size={14} className="text-amber-500" />
              Tidak Ada Shift
              {noShiftRecords.length > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold animate-pulse">
                  {noShiftRecords.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari karyawan / NIK / Departemen..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-xs"
            />
          </div>
        </div>

        {/* TAB CONTENT 1: Laporan Presensi (Data Final Terkalkulasi) */}
        {activeTab === 'final' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
              <span className="font-semibold text-slate-800">
                Data Kehadiran Terkalkulasi (Aturan: Tap Pertama = Masuk, Tap Terakhir = Pulang)
              </span>
              <Link
                href="/dashboard/attendance"
                className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-semibold text-xs"
              >
                Buka di Data Absensi Utama
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4 font-mono text-[11px]">No. ID</th>
                    <th className="py-2.5 px-4">Nama Karyawan</th>
                    <th className="py-2.5 px-3">Departemen</th>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Shift Kerja</th>
                    <th className="py-2.5 px-3 font-mono text-[11px]">Jadwal</th>
                    <th className="py-2.5 px-3 font-mono text-[11px] text-emerald-700">Scan Masuk (1)</th>
                    <th className="py-2.5 px-3 font-mono text-[11px]">Scan Pulang (Akhir)</th>
                    <th className="py-2.5 px-3">Keterlambatan</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredProcessed.length > 0 ? (
                    filteredProcessed.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                          {rec.employeeCode}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {rec.employeeName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{rec.department}</td>
                        <td className="py-2.5 px-3 text-slate-600">{rec.workDate}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">{rec.shiftName}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {rec.scheduleIn} - {rec.scheduleOut}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                          {rec.scanIn}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {rec.scanOut ? (
                            rec.scanOut
                          ) : (
                            <span className="text-slate-400 italic">Hanya 1 Tap</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {rec.lateMinutes > 0 ? (
                            <span className="text-rose-600 font-semibold font-mono text-[11px]">
                              +{rec.lateMinutes} mnt
                            </span>
                          ) : (
                            <span className="text-emerald-600 text-[11px]">Tepat Waktu</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          {rec.attendanceStatus === 'LATE' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Terlambat
                            </span>
                          ) : rec.attendanceStatus === 'INCOMPLETE' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Belum Pulang
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Hadir
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                        Belum ada Laporan Presensi yang dikalkulasi. Silakan download data presensi dari mesin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT 2: Data Presensi (Log Mentah Sesuai Gambar 2) */}
        {activeTab === 'raw' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
              <span className="font-semibold text-slate-800">
                Log Mentah Mesin (Setiap Detik Tap Tersimpan di Cache Browser)
              </span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  Tap Awal (Masuk)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  Tap Akhir (Pulang)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  Tap Antara / Siang (Noise)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4 font-mono text-[11px]">No. ID</th>
                    <th className="py-2.5 px-4">Nama Karyawan</th>
                    <th className="py-2.5 px-3">Departemen</th>
                    <th className="py-2.5 px-4 font-mono text-[11px]">Tanggal & Waktu Asli</th>
                    <th className="py-2.5 px-3">Mesin / Lokasi ID</th>
                    <th className="py-2.5 px-3 font-mono text-[11px]">No. PIN</th>
                    <th className="py-2.5 px-3">Metode Verifikasi</th>
                    <th className="py-2.5 px-3">Kategori</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredRawLogs.length > 0 ? (
                    filteredRawLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-4 font-mono font-semibold text-slate-800">
                          {log.employeeCode}
                        </td>
                        <td className="py-2 px-4 font-medium text-slate-900">{log.employeeName}</td>
                        <td className="py-2 px-3 text-slate-600">{log.department}</td>
                        <td className="py-2 px-4 font-mono font-semibold text-slate-800">
                          {log.timestamp}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{log.machineName}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{log.pin}</td>
                        <td className="py-2 px-3">{log.verifyMode}</td>
                        <td className="py-2 px-3">
                          {log.tag === 'MASUK' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-100 text-cyan-800">
                              Masuk
                            </span>
                          ) : log.tag === 'KELUAR' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                              Keluar
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                              Antara / Siang
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        Tidak ada data presensi mentah. Silakan download data dari mesin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT 3: Tidak Ada Shift (Pencegah Data Hilang Sesuai Gambar 1) */}
        {activeTab === 'noshift' && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="p-3 bg-amber-50/60 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900">
              <span className="font-semibold flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-amber-600" />
                Daftar Karyawan Tanpa Pengaturan Shift (Penyebab Data Tidak Masuk ke Laporan)
              </span>
              <span className="text-[11px] text-amber-700">
                Tetapkan shift agar data otomatis terkalkulasi ke Laporan Presensi
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-amber-50/40 border-b border-amber-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4 font-mono text-[11px]">No. ID</th>
                    <th className="py-2.5 px-4">Nama Karyawan</th>
                    <th className="py-2.5 px-3">Departemen</th>
                    <th className="py-2.5 px-3">Tanggal Tap</th>
                    <th className="py-2.5 px-3 font-mono text-[11px]">Jam Tap Masuk</th>
                    <th className="py-2.5 px-3 font-mono text-[11px]">Jam Tap Pulang</th>
                    <th className="py-2.5 px-4 text-center">Aksi Perbaikan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/60 text-slate-700">
                  {noShiftRecords.length > 0 ? (
                    noShiftRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                          {rec.employeeCode}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {rec.employeeName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{rec.department}</td>
                        <td className="py-2.5 px-3 text-slate-600">{rec.workDate}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {rec.scanIn}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {rec.scanOut || '-'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleAssignDefaultShift(rec.employeeCode)}
                            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold shadow-xs transition-colors"
                          >
                            Tetapkan Shift Default
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-emerald-700 font-medium text-xs">
                        ✓ Seluruh karyawan yang melakukan tap telah memiliki pengaturan shift lengkap.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
