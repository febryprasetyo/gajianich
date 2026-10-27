'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Cpu,
  Power,
  PowerOff,
  Download,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  FileText,
  ListFilter,
  ArrowRight,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  Wrench,
  XCircle,
} from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import {
  AttendanceDevice,
  DEFAULT_DEVICES,
  INITIAL_RAW_LOGS,
  calculateRecordsFromRawLogs,
} from './attendanceMachineStore';

type FailureScenario = 'TIMEOUT' | 'AUTH_FAILED' | 'REFUSED';

interface ConnectionErrorDetail {
  code: string;
  title: string;
  message: string;
  troubleshooting: string[];
  timestamp: string;
}

export default function AttendanceDevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<AttendanceDevice[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ams_attendance_devices');
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return DEFAULT_DEVICES;
  });

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('dev-1');
  const [isConnecting, setIsConnecting] = useState(false);
  const [idleSecondsLeft, setIdleSecondsLeft] = useState<number | null>(null);

  // Connection Simulation Failure State
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [failureScenario, setFailureScenario] = useState<FailureScenario>('TIMEOUT');
  const [connectionError, setConnectionError] = useState<ConnectionErrorDetail | null>(null);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);

  // Modal Download Data Presensi state
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [startDate, setStartDate] = useState('2026-10-27');
  const [endDate, setEndDate] = useState('2026-10-27');
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadCount, setDownloadCount] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [downloadCompleted, setDownloadCompleted] = useState(false);

  // Modal Tambah Mesin state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceIp, setNewDeviceIp] = useState('');
  const [newDevicePort, setNewDevicePort] = useState(4370);
  const [newDeviceCommKey, setNewDeviceCommKey] = useState(0);
  const [newDeviceNumber, setNewDeviceNumber] = useState(1);
  const [newDeviceLocation, setNewDeviceLocation] = useState('');

  // Modal Edit Mesin state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDeviceName, setEditDeviceName] = useState('');
  const [editDeviceIp, setEditDeviceIp] = useState('');
  const [editDevicePort, setEditDevicePort] = useState(4370);
  const [editDeviceCommKey, setEditDeviceCommKey] = useState(0);
  const [editDeviceNumber, setEditDeviceNumber] = useState(1);
  const [editDeviceLocation, setEditDeviceLocation] = useState('');

  // Toast / Warning notification
  const [pageToast, setPageToast] = useState<string | null>(null);

  // Persist devices
  useEffect(() => {
    localStorage.setItem('ams_attendance_devices', JSON.stringify(devices));
  }, [devices]);

  // Idle timeout timer: 15 menit auto-disconnect
  useEffect(() => {
    if (idleSecondsLeft === null) return;
    if (idleSecondsLeft <= 0) {
      setDevices((prev) =>
        prev.map((d) => (d.id === selectedDeviceId ? { ...d, status: 'disconnected' } : d))
      );
      setIdleSecondsLeft(null);
      return;
    }
    const timer = setInterval(() => {
      setIdleSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [idleSecondsLeft, selectedDeviceId]);

  const activeDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0];

  const handleConnect = () => {
    if (!activeDevice) return;
    setIsConnecting(true);
    setConnectionError(null);

    // Simulasi kegagalan koneksi jika mode simulasi diaktifkan
    if (simulateFailure) {
      setTimeout(() => {
        setIsConnecting(false);
        setDevices((prev) =>
          prev.map((d) => (d.id === activeDevice.id ? { ...d, status: 'error' } : d))
        );
        setIdleSecondsLeft(null);

        const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        let detail: ConnectionErrorDetail;
        if (failureScenario === 'AUTH_FAILED') {
          detail = {
            code: 'AUTH_FAILED (ZK Code 2005/6001)',
            title: 'Autentikasi Kunci Komunikasi Ditolak',
            message: `Koneksi TCP terbuka, namun mesin menolak autentikasi. Kunci komunikasi (CommKey: ${activeDevice.commKey}) tidak sesuai dengan konfigurasi pada mesin fisik.`,
            troubleshooting: [
              `Buka menu mesin fisik > Pengaturan Komunikasi > Kunci Komunikasi.`,
              `Samakan angka kunci komunikasi di sistem AMS (saat ini: ${activeDevice.commKey}) dengan mesin.`,
              `Jika mesin tidak menggunakan kata sandi komunikasi, pastikan CommKey bernilai 0.`,
            ],
            timestamp: now,
          };
        } else if (failureScenario === 'REFUSED') {
          detail = {
            code: 'CONN_REFUSED (ECONNREFUSED)',
            title: 'Sambungan Socket TCP Ditolak (Port 4370)',
            message: `Alamat IP ${activeDevice.ip} merespon, namun sambungan ke port ${activeDevice.port} ditolak atau sedang terkunci oleh sesi lain.`,
            troubleshooting: [
              `Pastikan tidak ada aplikasi lain (software desktop Solution / ZKTime) yang sedang membuka koneksi ke mesin.`,
              `Restart mesin absensi (matikan 10 detik lalu nyalakan kembali) untuk mereset socket TCP.`,
              `Pastikan nomor port komunikasi di menu mesin disetel ke ${activeDevice.port}.`,
            ],
            timestamp: now,
          };
        } else {
          detail = {
            code: 'TCP_TIMEOUT (ETIMEDOUT / Host Unreachable)',
            title: 'Koneksi Waktu Habis (Mesin Tidak Merespon)',
            message: `Tidak dapat menjangkau mesin ${activeDevice.name} di ${activeDevice.ip}:${activeDevice.port}. Paket handshake TCP tidak dibalas dalam batas waktu 5 detik.`,
            troubleshooting: [
              `Pastikan mesin dalam kondisi menyala dan kabel LAN/WiFi terhubung stabil.`,
              `Pastikan alamat IP ${activeDevice.ip} berada dalam satu subnet jaringan lokal dan dapat di-ping.`,
              `Pastikan port ${activeDevice.port} tidak diblokir oleh firewall router atau switch kantor.`,
            ],
            timestamp: now,
          };
        }

        setConnectionError(detail);
        setIsDiagnosticModalOpen(true);
      }, 1200);
      return;
    }

    // Koneksi normal berhasil
    setTimeout(() => {
      setDevices((prev) =>
        prev.map((d) => (d.id === activeDevice.id ? { ...d, status: 'connected' } : d))
      );
      setIsConnecting(false);
      setIdleSecondsLeft(900); // 15 mins
      setConnectionError(null);
    }, 800);
  };

  const handleDisconnect = () => {
    if (!activeDevice) return;
    setDevices((prev) =>
      prev.map((d) => (d.id === activeDevice.id ? { ...d, status: 'disconnected' } : d))
    );
    setIdleSecondsLeft(null);
    setConnectionError(null);
  };

  const handleOpenDownloadModal = () => {
    if (!activeDevice) return;
    if (activeDevice.status !== 'connected') {
      setPageToast(`Mesin "${activeDevice.name}" belum terhubung. Silakan klik tombol "Koneksikan" terlebih dahulu.`);
      setTimeout(() => setPageToast(null), 4000);
      return;
    }
    setDownloadCompleted(false);
    setDownloadProgress(0);
    setIsDownloadModalOpen(true);
  };

  const handleStartDownload = () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadCount(0);
    setDownloadCompleted(false);

    const total = activeDevice?.totalLogs || 142;
    setDownloadTotal(total);

    let current = 0;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 25) + 15;
      if (current >= total) {
        current = total;
        clearInterval(interval);
        setDownloadProgress(100);
        setDownloadCount(total);
        setIsDownloading(false);
        setDownloadCompleted(true);

        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
        setDevices((prev) =>
          prev.map((d) => (d.id === activeDevice.id ? { ...d, lastSyncAt: nowStr } : d))
        );

        localStorage.setItem('ams_attendance_raw_logs', JSON.stringify(INITIAL_RAW_LOGS));
        const { processed, unassigned } = calculateRecordsFromRawLogs(INITIAL_RAW_LOGS);
        localStorage.setItem('ams_attendance_processed_records', JSON.stringify(processed));
        localStorage.setItem('ams_attendance_unassigned_shift_records', JSON.stringify(unassigned));
      } else {
        const pct = Math.floor((current / total) * 100);
        setDownloadProgress(pct);
        setDownloadCount(current);
      }
    }, 120);
  };

  const handleAddDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName || !newDeviceIp) return;
    const newDev: AttendanceDevice = {
      id: `dev-${Date.now()}`,
      name: newDeviceName,
      ip: newDeviceIp,
      port: newDevicePort,
      commKey: newDeviceCommKey,
      deviceNumber: newDeviceNumber,
      location: newDeviceLocation || 'Kantor Cabang',
      connectionType: 'Ethernet',
      status: 'disconnected',
      lastSyncAt: null,
      totalLogs: 0,
    };
    setDevices((prev) => [...prev, newDev]);
    setIsAddModalOpen(false);
    setNewDeviceName('');
    setNewDeviceIp('');
  };

  const handleOpenEditModal = () => {
    if (!activeDevice) return;
    setEditDeviceName(activeDevice.name);
    setEditDeviceIp(activeDevice.ip);
    setEditDevicePort(activeDevice.port);
    setEditDeviceCommKey(activeDevice.commKey);
    setEditDeviceNumber(activeDevice.deviceNumber);
    setEditDeviceLocation(activeDevice.location);
    setIsEditModalOpen(true);
  };

  const handleSaveEditDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDevice) return;
    setDevices((prev) =>
      prev.map((d) =>
        d.id === activeDevice.id
          ? {
              ...d,
              name: editDeviceName,
              ip: editDeviceIp,
              port: editDevicePort,
              commKey: editDeviceCommKey,
              deviceNumber: editDeviceNumber,
              location: editDeviceLocation,
              status: d.status === 'error' ? 'disconnected' : d.status,
            }
          : d
      )
    );
    setIsEditModalOpen(false);
    setConnectionError(null);
  };

  const handleDeleteDevice = () => {
    if (!activeDevice) return;
    if (confirm(`Yakin ingin menghapus mesin ${activeDevice.name} (${activeDevice.ip})?`)) {
      setDevices((prev) => prev.filter((d) => d.id !== activeDevice.id));
      if (devices.length > 1) {
        setSelectedDeviceId(devices.find((d) => d.id !== activeDevice.id)?.id || '');
      }
    }
  };

  const formatIdleTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Download Presensi Mesin
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Hubungkan mesin absensi kantor untuk menarik catatan kehadiran terbaru secara terpadu.
            </p>
          </div>
        </div>

        {/* Status Indikator Idle & Quick Link */}
        <div className="flex items-center gap-2.5">
          {activeDevice?.status === 'connected' && idleSecondsLeft !== null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Terhubung ke {activeDevice.name}</span>
              <span className="font-mono bg-emerald-200/60 px-1.5 py-0.5 rounded text-[11px] text-emerald-900">
                Otomatis terputus dalam {formatIdleTime(idleSecondsLeft)}
              </span>
            </div>
          )}
          <Link
            href="/dashboard/attendance/raw-logs"
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <ListFilter className="w-4 h-4 text-emerald-600" />
            <span>Lihat Data Presensi</span>
          </Link>
        </div>
      </div>

      {/* Toast Peringatan / Informasi */}
      {pageToast && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{pageToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setPageToast(null)}
            className="text-amber-700 hover:text-amber-900 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner Peringatan Jika Koneksi Gagal */}
      {connectionError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-rose-900 text-sm">{connectionError.title}</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-900 font-semibold">
                  {connectionError.code}
                </span>
                <span className="text-[11px] text-rose-500">Pukul {connectionError.timestamp}</span>
              </div>
              <p className="text-rose-800 leading-relaxed">
                {connectionError.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setIsDiagnosticModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 hover:bg-rose-100 text-rose-800 font-semibold text-xs transition-colors shadow-xs"
            >
              Lihat Detail Diagnostik
            </button>
            <button
              type="button"
              onClick={() => setConnectionError(null)}
              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 transition-colors"
              title="Tutup pesan error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Toolbar Aksi Operasi & Fitur Simulasi Gagal */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {activeDevice?.status === 'connected' ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              <PowerOff className="w-4 h-4" />
              Putuskan
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50 ${
                activeDevice?.status === 'error'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {activeDevice?.status === 'error' ? (
                <RotateCcw className="w-4 h-4" />
              ) : (
                <Power className="w-4 h-4" />
              )}
              {isConnecting
                ? 'Menghubungkan...'
                : activeDevice?.status === 'error'
                ? 'Coba Hubungkan Kembali'
                : 'Koneksikan'}
            </button>
          )}

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={handleOpenDownloadModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-white" />
            Download Data Presensi
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Kontrol Simulasi Gagal Koneksi */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs">
            <input
              type="checkbox"
              id="simFailureToggle"
              checked={simulateFailure}
              onChange={(e) => {
                setSimulateFailure(e.target.checked);
                if (!e.target.checked) setConnectionError(null);
              }}
              className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="simFailureToggle" className="font-semibold cursor-pointer select-none">
              Simulasi Gagal Hubung
            </label>

            {simulateFailure && (
              <select
                value={failureScenario}
                onChange={(e) => setFailureScenario(e.target.value as FailureScenario)}
                className="ml-1 bg-white border border-amber-300 rounded-lg text-[11px] px-2 py-0.5 text-amber-950 font-medium focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
              >
                <option value="TIMEOUT">Mesin Offline / Kabel Putus (ETIMEDOUT)</option>
                <option value="AUTH_FAILED">CommKey Salah (AUTH_FAILED)</option>
                <option value="REFUSED">Port 4370 Ditolak / Sibuk (ECONNREFUSED)</option>
              </select>
            )}
          </div>
        </div>

        {/* Tombol Manajemen Mesin */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenEditModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            Edit Mesin
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            Tambah Mesin
          </button>
          <button
            type="button"
            onClick={handleDeleteDevice}
            disabled={devices.length <= 1}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-xs font-medium text-rose-700 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus Mesin
          </button>
        </div>
      </div>

      {/* Tabel Ringkas Mesin Absensi */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-700" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Daftar Mesin Absensi
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Total {devices.length} mesin terdaftar
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="py-2.5 px-3 w-10 text-center">Pilih</th>
                <th className="py-2.5 px-3">Status Socket</th>
                <th className="py-2.5 px-3">Nama Mesin</th>
                <th className="py-2.5 px-3">IP : Port</th>
                <th className="py-2.5 px-3">No. Mesin</th>
                <th className="py-2.5 px-3">Tipe Koneksi</th>
                <th className="py-2.5 px-3">Serial Number</th>
                <th className="py-2.5 px-3">Lokasi</th>
                <th className="py-2.5 px-3">Terakhir Tarik Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.map((device) => {
                const isSelected = device.id === selectedDeviceId;
                const isConnected = device.status === 'connected';
                const isError = device.status === 'error';

                return (
                  <tr
                    key={device.id}
                    onClick={() => setSelectedDeviceId(device.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? isError
                          ? 'bg-rose-50/70 font-medium'
                          : 'bg-emerald-50/70 font-medium'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="radio"
                        name="selected_device"
                        checked={isSelected}
                        onChange={() => setSelectedDeviceId(device.id)}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      {isConnected ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Terhubung
                        </span>
                      ) : isError ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          Gagal Terhubung
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Terputus
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-900 font-semibold">
                      {device.name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {device.ip}:{device.port}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono">
                      #{device.deviceNumber}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {device.connectionType}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {device.serialNumber || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {device.location}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {device.lastSyncAt || 'Belum pernah'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigasi Card Menuju Halaman Lain */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Data Presensi */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-800">
                <ListFilter className="w-5 h-5 text-emerald-700" />
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Riwayat Tap
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Data Presensi
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Daftar seluruh riwayat tap masuk dan pulang yang ditarik langsung dari mesin.
            </p>
          </div>
          <div className="pt-4 mt-2 border-t border-slate-100">
            <Link
              href="/dashboard/attendance/raw-logs"
              className="inline-flex items-center justify-between w-full px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 text-emerald-800 text-xs font-semibold border border-slate-200 hover:border-emerald-300 transition-colors"
            >
              <span>Buka Halaman Data Presensi</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Card 2: Laporan Presensi */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-slate-100 text-slate-800">
                <FileText className="w-5 h-5 text-emerald-700" />
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Rekap Shift
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Laporan Presensi
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Rekap kehadiran harian karyawan yang sudah disesuaikan dengan jadwal shift.
            </p>
          </div>
          <div className="pt-4 mt-2 border-t border-slate-100">
            <Link
              href="/dashboard/attendance/transactions"
              className="inline-flex items-center justify-between w-full px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 text-emerald-800 text-xs font-semibold border border-slate-200 hover:border-emerald-300 transition-colors"
            >
              <span>Buka Halaman Laporan Presensi</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Modal Diagnostik Kegagalan Koneksi */}
      <ModalShell
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        title="Detail Diagnostik Koneksi Mesin"
        maxWidthClass="max-w-lg"
      >
        {connectionError && (
          <div className="space-y-4 text-xs">
            {/* Header Error Info */}
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-900 text-sm">{connectionError.title}</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-bold">
                  {connectionError.code}
                </span>
              </div>
              <p className="text-rose-800 leading-relaxed">
                {connectionError.message}
              </p>
            </div>

            {/* Target Spesifikasi Mesin */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                Parameter Perangkat yang Diuji
              </span>
              <div className="grid grid-cols-2 gap-2 text-slate-700 font-mono text-[11px] pt-1">
                <div>Nama Mesin: <span className="font-semibold text-slate-900">{activeDevice.name}</span></div>
                <div>IP Address: <span className="font-semibold text-slate-900">{activeDevice.ip}</span></div>
                <div>Port Socket: <span className="font-semibold text-slate-900">{activeDevice.port}</span></div>
                <div>Comm Key: <span className="font-semibold text-slate-900">{activeDevice.commKey}</span></div>
              </div>
            </div>

            {/* Panduan Penyelesaian Masalah */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-xs block">
                Langkah Pemeriksaan & Solusi:
              </span>
              <ul className="space-y-1.5 text-slate-700 pl-1">
                {connectionError.troubleshooting.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tombol Aksi Diagnostik */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsDiagnosticModalOpen(false);
                  handleOpenEditModal();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium"
              >
                <Wrench className="w-3.5 h-3.5 text-slate-500" />
                Edit Parameter Mesin
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDiagnosticModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDiagnosticModalOpen(false);
                    handleConnect();
                  }}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Coba Ulangi
                </button>
              </div>
            </div>
          </div>
        )}
      </ModalShell>

      {/* Modal Download Data Presensi */}
      <ModalShell
        isOpen={isDownloadModalOpen}
        onClose={() => !isDownloading && setIsDownloadModalOpen(false)}
        title="Download Data Presensi"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 flex items-start gap-2.5">
            <Cpu className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Mesin Terpilih: </span>
              {activeDevice?.name} ({activeDevice?.ip}:{activeDevice?.port})
              <div className="text-[11px] text-emerald-800 mt-0.5">
                Pastikan mesin sudah terhubung sebelum memulai penarikan data.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Pilih Rentang Tanggal Penarikan
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Tanggal Mulai</label>
                <input
                  type="date"
                  value={startDate}
                  disabled={isDownloading}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs cursor-pointer focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Tanggal Selesai</label>
                <input
                  type="date"
                  value={endDate}
                  disabled={isDownloading}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs cursor-pointer focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Quick shortcuts */}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => {
                  const today = new Date().toISOString().substring(0, 10);
                  setStartDate(today);
                  setEndDate(today);
                }}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium"
              >
                Hari Ini
              </button>
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => {
                  const today = new Date();
                  const end = today.toISOString().substring(0, 10);
                  const startD = new Date(today.getTime() - 7 * 86400000);
                  setStartDate(startD.toISOString().substring(0, 10));
                  setEndDate(end);
                }}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium"
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => {
                  const now = new Date();
                  const y = now.getFullYear();
                  const m = String(now.getMonth() + 1).padStart(2, '0');
                  setStartDate(`${y}-${m}-01`);
                  setEndDate(now.toISOString().substring(0, 10));
                }}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium"
              >
                Bulan Ini
              </button>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={overwriteExisting}
                disabled={isDownloading}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Perbarui data kehadiran jika sudah ada rekaman pada tanggal tersebut</span>
            </label>
          </div>

          {/* Progress Bar & Counter */}
          {(isDownloading || downloadCompleted) && (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex justify-between text-xs text-slate-700 font-medium">
                <span>
                  {downloadCompleted
                    ? '✓ Penarikan data selesai'
                    : `Mengunduh catatan presensi: ${downloadCount} / ${downloadTotal} data...`}
                </span>
                <span className="font-mono">{downloadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2.5 rounded-full transition-all duration-150"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {downloadCompleted && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Berhasil mengunduh {downloadTotal} catatan kehadiran.</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsDownloadModalOpen(false);
                    router.push('/dashboard/attendance/raw-logs');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                >
                  Buka Data Presensi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDownloadModalOpen(false);
                    router.push('/dashboard/attendance/transactions');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold"
                >
                  Buka Laporan Presensi
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              disabled={isDownloading}
              onClick={() => setIsDownloadModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium"
            >
              {downloadCompleted ? 'Tutup' : 'Batal'}
            </button>
            {!downloadCompleted && (
              <button
                type="button"
                disabled={isDownloading}
                onClick={handleStartDownload}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {isDownloading ? 'Sedang Mengunduh...' : 'Mulai Download'}
              </button>
            )}
          </div>
        </div>
      </ModalShell>

      {/* Modal Tambah Mesin */}
      <ModalShell
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Mesin Absensi Baru"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleAddDevice} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Mesin</label>
            <input
              type="text"
              required
              placeholder="Contoh: Solution X900 Lobby"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">IP Address</label>
              <input
                type="text"
                required
                placeholder="192.168.10.224"
                value={newDeviceIp}
                onChange={(e) => setNewDeviceIp(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Port TCP</label>
              <input
                type="number"
                required
                value={newDevicePort}
                onChange={(e) => setNewDevicePort(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Comm Key</label>
              <input
                type="number"
                value={newDeviceCommKey}
                onChange={(e) => setNewDeviceCommKey(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-emerald-500 focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-400">Default 0 jika tanpa kata sandi</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Mesin (ID)</label>
              <input
                type="number"
                value={newDeviceNumber}
                onChange={(e) => setNewDeviceNumber(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Lokasi Mesin</label>
            <input
              type="text"
              placeholder="Contoh: Gedung A Lantai 1"
              value={newDeviceLocation}
              onChange={(e) => setNewDeviceLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
            >
              Simpan Mesin
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Modal Edit Mesin */}
      <ModalShell
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Data Mesin Absensi"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSaveEditDevice} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Mesin</label>
            <input
              type="text"
              required
              value={editDeviceName}
              onChange={(e) => setEditDeviceName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">IP Address</label>
              <input
                type="text"
                required
                value={editDeviceIp}
                onChange={(e) => setEditDeviceIp(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Port TCP</label>
              <input
                type="number"
                required
                value={editDevicePort}
                onChange={(e) => setEditDevicePort(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Comm Key</label>
              <input
                type="number"
                value={editDeviceCommKey}
                onChange={(e) => setEditDeviceCommKey(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Mesin (ID)</label>
              <input
                type="number"
                value={editDeviceNumber}
                onChange={(e) => setEditDeviceNumber(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Lokasi Mesin</label>
            <input
              type="text"
              value={editDeviceLocation}
              onChange={(e) => setEditDeviceLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
