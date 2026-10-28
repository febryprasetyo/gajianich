'use client';

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Loader2,
} from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal";
import { apiFetch } from "@/lib/api";
import { AttendanceDevice } from "./attendanceMachineStore";

type FailureScenario = "TIMEOUT" | "AUTH_FAILED" | "REFUSED";

interface ConnectionErrorDetail {
  code: string;
  title: string;
  message: string;
  troubleshooting: string[];
  timestamp: string;
}

export default function AttendanceDevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | number>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [idleSecondsLeft, setIdleSecondsLeft] = useState<number | null>(null);

  // Connection Simulation Failure State
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [failureScenario, setFailureScenario] = useState<FailureScenario>("TIMEOUT");
  const [connectionError, setConnectionError] = useState<ConnectionErrorDetail | null>(null);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);

  // Modal Download Data Presensi state
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadCount, setDownloadCount] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [downloadCompleted, setDownloadCompleted] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Modal Tambah Mesin state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingDevice, setDeletingDevice] = useState<AttendanceDevice | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceIp, setNewDeviceIp] = useState("");
  const [newDevicePort, setNewDevicePort] = useState(4370);
  const [newDeviceCommKey, setNewDeviceCommKey] = useState(0);
  const [newDeviceNumber, setNewDeviceNumber] = useState(1);
  const [newDeviceLocation, setNewDeviceLocation] = useState("");

  // Modal Edit Mesin state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDeviceName, setEditDeviceName] = useState("");
  const [editDeviceIp, setEditDeviceIp] = useState("");
  const [editDevicePort, setEditDevicePort] = useState(4370);
  const [editDeviceCommKey, setEditDeviceCommKey] = useState(0);
  const [editDeviceNumber, setEditDeviceNumber] = useState(1);
  const [editDeviceLocation, setEditDeviceLocation] = useState("");

  // Toast / Warning notification
  const [pageToast, setPageToast] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch<{ success: boolean; data: AttendanceDevice[] }>("/attendance/devices");
      if (res.success && res.data) {
        setDevices(res.data);
        if (res.data.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(res.data[0].id);
          if (res.data[0].idleSecondsLeft) {
            setIdleSecondsLeft(res.data[0].idleSecondsLeft);
          }
        }
      }
    } catch (err: any) {
      console.error("Gagal memuat perangkat mesin:", err);
      setPageToast("Gagal memuat daftar perangkat dari server.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Idle timeout timer: 15 menit auto-disconnect
  useEffect(() => {
    if (idleSecondsLeft === null) return;
    if (idleSecondsLeft <= 0) {
      setDevices((prev) =>
        prev.map((d) => (d.id === selectedDeviceId ? { ...d, status: "disconnected" } : d))
      );
      setIdleSecondsLeft(null);
      return;
    }
    const timer = setInterval(() => {
      setIdleSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [idleSecondsLeft, selectedDeviceId]);

  const activeDevice = devices.find((d) => String(d.id) === String(selectedDeviceId)) || devices[0];

  const handleConnect = async () => {
    if (!activeDevice) return;
    setIsConnecting(true);
    setConnectionError(null);

    // Simulasi kegagalan koneksi jika mode simulasi diaktifkan
    if (simulateFailure) {
      setTimeout(() => {
        setIsConnecting(false);
        setDevices((prev) =>
          prev.map((d) => (d.id === activeDevice.id ? { ...d, status: "error" } : d))
        );
        setIdleSecondsLeft(null);

        const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        let detail: ConnectionErrorDetail;
        if (failureScenario === "AUTH_FAILED") {
          detail = {
            code: "AUTH_FAILED (ZK Code 2005/6001)",
            title: "Autentikasi Kunci Komunikasi Ditolak",
            message: `Koneksi TCP terbuka, namun mesin menolak autentikasi. Kunci komunikasi (CommKey: ${activeDevice.commKey}) tidak sesuai dengan konfigurasi pada mesin fisik.`,
            troubleshooting: [
              `Buka menu mesin fisik > Pengaturan Komunikasi > Kunci Komunikasi.`,
              `Samakan angka kunci komunikasi di sistem AMS (saat ini: ${activeDevice.commKey}) dengan mesin.`,
              `Jika mesin tidak menggunakan kata sandi komunikasi, pastikan CommKey bernilai 0.`,
            ],
            timestamp: now,
          };
        } else if (failureScenario === "REFUSED") {
          detail = {
            code: "CONN_REFUSED (ECONNREFUSED)",
            title: "Sambungan Socket TCP Ditolak (Port 4370)",
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
            code: "TCP_TIMEOUT (ETIMEDOUT / Host Unreachable)",
            title: "Koneksi Waktu Habis (Mesin Tidak Merespon)",
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
      }, 800);
      return;
    }

    try {
      const res = await apiFetch<{ success: boolean; data: any }>(`/attendance/devices/${activeDevice.id}/connect`, {
        method: "POST",
        body: JSON.stringify({ simulate: false }),
      });

      if (res.success) {
        setDevices((prev) =>
          prev.map((d) => (d.id === activeDevice.id ? { ...d, status: "connected" } : d))
        );
        setIdleSecondsLeft(res.data.idleSecondsLeft || 900);
        setConnectionError(null);
        setPageToast(`Berhasil terhubung ke ${activeDevice.name}`);
        setTimeout(() => setPageToast(null), 3000);
      }
    } catch (err: any) {
      setDevices((prev) =>
        prev.map((d) => (d.id === activeDevice.id ? { ...d, status: "error" } : d))
      );
      setIdleSecondsLeft(null);

      const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const detail: ConnectionErrorDetail = {
        code: err.code || "CONNECTION_FAILED",
        title: "Koneksi Mesin Gagal",
        message: err.message || `Tidak dapat terhubung ke ${activeDevice.name} di ${activeDevice.ip}:${activeDevice.port}`,
        troubleshooting: [
          `Periksa kabel LAN atau jaringan WiFi mesin absensi.`,
          `Pastikan IP ${activeDevice.ip} dan port ${activeDevice.port} dapat diakses dari server.`,
          `Pastikan kunci komunikasi (commKey: ${activeDevice.commKey}) sesuai dengan mesin.`,
        ],
        timestamp: now,
      };
      setConnectionError(detail);
      setIsDiagnosticModalOpen(true);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!activeDevice) return;
    try {
      await apiFetch(`/attendance/devices/${activeDevice.id}/disconnect`, { method: "POST" });
    } catch (err) {
      console.warn("Disconnect API:", err);
    }
    setDevices((prev) =>
      prev.map((d) => (d.id === activeDevice.id ? { ...d, status: "disconnected" } : d))
    );
    setIdleSecondsLeft(null);
    setConnectionError(null);
  };

  const handleOpenDownloadModal = () => {
    if (!activeDevice) return;
    if (activeDevice.status !== "connected") {
      setPageToast(`Mesin "${activeDevice.name}" belum terhubung. Silakan klik tombol "Koneksikan" terlebih dahulu.`);
      setTimeout(() => setPageToast(null), 4000);
      return;
    }
    setDownloadCompleted(false);
    setDownloadProgress(0);
    setDownloadError(null);
    setIsDownloadModalOpen(true);
  };

  const handleStartDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress(20);
    setDownloadCount(0);
    setDownloadCompleted(false);

    try {
      setDownloadProgress(45);
      const res = await apiFetch<{ success: boolean; data: { totalProcessed: number; totalFetched: number; logs: any[] } }>(
        `/attendance/devices/${activeDevice.id}/sync`,
        {
          method: "POST",
          body: JSON.stringify({ startDate, endDate, overwriteExisting }),
        }
      );

      setDownloadProgress(100);
      const total = res.data?.totalProcessed || res.data?.totalFetched || 0;
      setDownloadCount(total);
      setDownloadTotal(total);
      setDownloadCompleted(true);

      const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);
      setDevices((prev) =>
        prev.map((d) => (d.id === activeDevice.id ? { ...d, lastSyncAt: nowStr, totalLogs: (d.totalLogs || 0) + total, status: "connected" } : d))
      );
    } catch (err: any) {
      const errMsg = err.message || "Mesin tidak merespons (Koneksi Putus / Offline)";
      setDownloadError(errMsg);
      setPageToast(`Gagal mengunduh log: ${errMsg}`);
      setTimeout(() => setPageToast(null), 5000);
      setDevices((prev) =>
        prev.map((d) => (d.id === activeDevice.id ? { ...d, status: "error" } : d))
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName || !newDeviceIp) return;
    try {
      const res = await apiFetch<{ success: boolean; data: AttendanceDevice }>("/attendance/devices", {
        method: "POST",
        body: JSON.stringify({
          name: newDeviceName,
          ip: newDeviceIp,
          port: newDevicePort,
          commKey: newDeviceCommKey,
          deviceNumber: newDeviceNumber,
          location: newDeviceLocation || "Kantor Cabang",
          connectionType: "Ethernet",
        }),
      });
      if (res.success && res.data) {
        setDevices((prev) => [...prev, res.data]);
        setSelectedDeviceId(res.data.id);
        setIsAddModalOpen(false);
        setNewDeviceName("");
        setNewDeviceIp("");
        setPageToast("Perangkat mesin baru berhasil ditambahkan.");
        setTimeout(() => setPageToast(null), 3000);
      }
    } catch (err: any) {
      setPageToast(`Gagal menambahkan mesin: ${err.message}`);
      setTimeout(() => setPageToast(null), 4000);
    }
  };

  const handleOpenEditModal = (deviceToEdit?: AttendanceDevice) => {
    const target = deviceToEdit || activeDevice;
    if (!target) return;
    setSelectedDeviceId(target.id);
    setEditDeviceName(target.name);
    setEditDeviceIp(target.ip);
    setEditDevicePort(target.port);
    setEditDeviceCommKey(target.commKey);
    setEditDeviceNumber(target.deviceNumber);
    setEditDeviceLocation(target.location);
    setIsEditModalOpen(true);
  };

  const handleSaveEditDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = devices.find((d) => String(d.id) === String(selectedDeviceId)) || activeDevice;
    if (!target) return;
    try {
      const res = await apiFetch<{ success: boolean; data: AttendanceDevice }>(`/attendance/devices/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editDeviceName,
          ip: editDeviceIp,
          port: editDevicePort,
          commKey: editDeviceCommKey,
          deviceNumber: editDeviceNumber,
          location: editDeviceLocation,
        }),
      });
      if (res.success && res.data) {
        setDevices((prev) =>
          prev.map((d) => (d.id === activeDevice.id ? { ...d, ...res.data } : d))
        );
        setIsEditModalOpen(false);
        setPageToast("Perubahan mesin berhasil disimpan.");
        setTimeout(() => setPageToast(null), 3000);
      }
    } catch (err: any) {
      setPageToast(`Gagal memperbarui mesin: ${err.message}`);
      setTimeout(() => setPageToast(null), 4000);
    }
  };

  const handleDeleteDevice = async () => {
    if (!deletingDevice) return;
    try {
      await apiFetch(`/attendance/devices/${deletingDevice.id}`, { method: "DELETE" });
      setDevices((prev) => prev.filter((d) => d.id !== deletingDevice.id));
      if (selectedDeviceId === deletingDevice.id) {
        const remaining = devices.filter((d) => d.id !== deletingDevice.id);
        setSelectedDeviceId(remaining[0]?.id || "");
      }
      setIsDeleteModalOpen(false);
      setDeletingDevice(null);
      setPageToast(`Mesin ${deletingDevice.name} berhasil dihapus.`);
      setTimeout(() => setPageToast(null), 3000);
    } catch (err: any) {
      setPageToast(`Gagal menghapus mesin: ${err.message}`);
      setTimeout(() => setPageToast(null), 4000);
    }
  };

  // Format detik countdown idle
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {pageToast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <AlertCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">{pageToast}</p>
        </div>
      )}

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
            <p className="text-xs text-slate-500 mt-0.5">
              Hubungkan mesin absensi kantor untuk menarik catatan kehadiran terbaru.
            </p>
          </div>
        </div>

        {/* Tombol Tambah Mesin */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Mesin</span>
          </button>
        </div>
      </div>

      {/* Alert Banner jika koneksi gagal */}
      {connectionError && (
        <div className="rounded-2xl p-4 bg-rose-50 border border-rose-200 text-rose-900 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-rose-900">{connectionError.title}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                  {connectionError.code}
                </span>
              </div>
              <p className="text-xs text-rose-700 mt-1 max-w-3xl leading-relaxed">
                {connectionError.message}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsDiagnosticModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-100/50 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Panduan Solusi</span>
            </button>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="rounded-2xl p-3 bg-white border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Tombol Operasi Mesin */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeDevice?.status === "connected" ? (
            <button
              onClick={handleDisconnect}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 border border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors cursor-pointer"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Putuskan</span>
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting || !activeDevice}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isConnecting ? "Menghubungkan..." : "Koneksikan"}</span>
            </button>
          )}

          <button
            onClick={() => handleOpenDownloadModal()}
            disabled={activeDevice?.status !== "connected"}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Data Presensi</span>
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Perangkat aktif: <strong className="text-slate-800">{activeDevice ? `${activeDevice.name} (${activeDevice.ip})` : 'Pilih dari tabel'}</strong>
        </div>
      </div>

      {/* Tabel Ringkas Mesin Absensi */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Daftar Mesin Absensi Terdaftar
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100/70 text-emerald-800 rounded-full">
              {devices.length} Unit
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Pilih satu mesin via tombol radio untuk melakukan penarikan data
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
            <p className="text-xs text-slate-500">Memuat daftar mesin dari database...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="p-8 text-center">
            <Cpu className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">Belum ada mesin absensi terdaftar</p>
            <p className="text-xs text-slate-400 mt-1">Silakan klik Tambah Mesin untuk mendaftarkan Solution X900</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">Pilih</th>
                  <th className="py-2.5 px-4">Nama Mesin</th>
                  <th className="py-2.5 px-4">Status Koneksi</th>
                  <th className="py-2.5 px-4">Alamat IP & Port</th>
                  <th className="py-2.5 px-4">No. Mesin</th>
                  <th className="py-2.5 px-4">Tipe Komunikasi</th>
                  <th className="py-2.5 px-4">Serial Number</th>
                  <th className="py-2.5 px-4">Lokasi</th>
                  <th className="py-2.5 px-4">Terakhir Tarik Data</th>
                  <th className="py-2.5 px-4 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map((device) => {
                  const isSelected = String(device.id) === String(selectedDeviceId);
                  const isConn = device.status === "connected";
                  const isErr = device.status === "error";

                  return (
                    <tr
                      key={device.id}
                      onClick={() => setSelectedDeviceId(device.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-emerald-50/40 font-medium" : "hover:bg-slate-50/70"
                      }`}
                    >
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="radio"
                          name="selected_device"
                          checked={isSelected}
                          onChange={() => setSelectedDeviceId(device.id)}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 text-slate-900 font-semibold">
                        <div className="flex items-center gap-2">
                          <Cpu className={`w-4 h-4 ${isConn ? "text-emerald-600" : isErr ? "text-rose-500" : "text-slate-400"}`} />
                          <span>{device.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {isConn ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            <span>Terhubung</span>
                            {idleSecondsLeft !== null && isSelected && (
                              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-200/60 px-1.5 py-0.2 rounded-sm ml-1">
                                {formatCountdown(idleSecondsLeft)}
                              </span>
                            )}
                          </div>
                        ) : isErr ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            <span>Gagal Terhubung</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>Terputus</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {device.ip}:{device.port}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{device.deviceNumber}</td>
                      <td className="py-3 px-4 text-slate-600">{device.connectionType}</td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {device.serialNumber || "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{device.location}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {device.lastSyncAt ? (
                          <span className="font-mono text-slate-700">{device.lastSyncAt}</span>
                        ) : (
                          <span className="italic text-slate-400">Belum pernah</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(device);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title={`Edit Konfigurasi ${device.name}`}
                            aria-label={`Edit ${device.name}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingDevice(device);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title={`Hapus Mesin ${device.name}`}
                            aria-label={`Hapus ${device.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Download Data Presensi */}
      <ModalShell
        isOpen={isDownloadModalOpen}
        onClose={() => { if (!isDownloading) setIsDownloadModalOpen(false); }}
        title="Download Data Presensi"
        subtitle={`Menarik catatan transaksi dari mesin ${activeDevice?.name} (${activeDevice?.ip})`}
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Nama Mesin:</span>
              <span className="font-bold text-slate-800">{activeDevice?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Alamat IP:</span>
              <span className="font-mono text-slate-800">{activeDevice?.ip}:{activeDevice?.port}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Serial Number:</span>
              <span className="font-mono text-slate-800">{activeDevice?.serialNumber || "-"}</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Pilih Rentang Tanggal Penarikan
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div
                className="cursor-pointer"
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
                <span className="text-[11px] text-slate-500 block mb-1">Mulai Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as HTMLInputElement).showPicker?.();
                    } catch {}
                  }}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
              <div
                className="cursor-pointer"
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
                <span className="text-[11px] text-slate-500 block mb-1">Sampai Dengan:</span>
                <input
                  type="date"
                  value={endDate}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as HTMLInputElement).showPicker?.();
                    } catch {}
                  }}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-700">
                Perbarui stempel waktu jika data log sudah ada
              </span>
            </label>
          </div>

          {/* Progress Bar Dinamis */}
          {isDownloading && (
            <div className="space-y-2 pt-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                  Mengunduh log transaksi dari mesin...
                </span>
                <span className="font-mono text-slate-600 font-bold">{downloadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2.5 rounded-full transition-all duration-150"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Download Error Info */}
          {downloadError && (
            <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Koneksi ke Mesin Gagal</span>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed">{downloadError}</p>
            </div>
          )}

          {/* Download Completed Info */}
          {downloadCompleted && (
            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Penarikan Data Berhasil!</span>
              </div>
              <p className="text-xs text-emerald-700">
                Total <span className="font-bold">{downloadCount} baris</span> catatan presensi berhasil ditarik dan disimpan ke database.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDownloadModalOpen(false);
                    router.push("/dashboard/attendance/raw-logs");
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                >
                  Buka Data Presensi (Log Mentah) ➔
                </button>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDownloadModalOpen(false)}
              disabled={isDownloading}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Tutup
            </button>
            {!downloadCompleted && (
              <button
                type="button"
                onClick={handleStartDownload}
                disabled={isDownloading}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-xs inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isDownloading ? "Mengunduh..." : "Mulai Download"}</span>
              </button>
            )}
          </div>
        </div>
      </ModalShell>

      {/* Modal Tambah Mesin */}
      <ModalShell
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Mesin Absensi"
        subtitle="Daftarkan perangkat Solution X900 baru ke dalam sistem"
      >
        <form onSubmit={handleAddDevice} className="space-y-4">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Mesin</label>
              <input
                type="text"
                required
                placeholder="Contoh: Solution X900 Lobby Barat"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Alamat IP (IPv4)</label>
                <input
                  type="text"
                  required
                  placeholder="192.168.10.224"
                  value={newDeviceIp}
                  onChange={(e) => setNewDeviceIp(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Port Komunikasi</label>
                <input
                  type="number"
                  required
                  value={newDevicePort}
                  onChange={(e) => setNewDevicePort(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kunci Komunikasi (CommKey)</label>
                <input
                  type="number"
                  value={newDeviceCommKey}
                  onChange={(e) => setNewDeviceCommKey(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                <span className="text-[10px] text-slate-400">Default: 0</span>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor Mesin (Device ID)</label>
                <input
                  type="number"
                  value={newDeviceNumber}
                  onChange={(e) => setNewDeviceNumber(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Lokasi Pemasangan</label>
              <input
                type="text"
                placeholder="Contoh: Gedung A Lantai 1"
                value={newDeviceLocation}
                onChange={(e) => setNewDeviceLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
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
        title="Edit Konfigurasi Mesin"
        subtitle={`Mengubah parameter komunikasi untuk ${activeDevice?.name}`}
      >
        <form onSubmit={handleSaveEditDevice} className="space-y-4">
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Mesin</label>
              <input
                type="text"
                required
                value={editDeviceName}
                onChange={(e) => setEditDeviceName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Alamat IP (IPv4)</label>
                <input
                  type="text"
                  required
                  value={editDeviceIp}
                  onChange={(e) => setEditDeviceIp(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Port Komunikasi</label>
                <input
                  type="number"
                  required
                  value={editDevicePort}
                  onChange={(e) => setEditDevicePort(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kunci Komunikasi (CommKey)</label>
                <input
                  type="number"
                  value={editDeviceCommKey}
                  onChange={(e) => setEditDeviceCommKey(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                <span className="text-[10px] text-slate-400">Samakan dengan pengaturan di menu mesin fisik (default: 0)</span>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor Mesin (Device ID)</label>
                <input
                  type="number"
                  value={editDeviceNumber}
                  onChange={(e) => setEditDeviceNumber(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Lokasi Pemasangan</label>
              <input
                type="text"
                value={editDeviceLocation}
                onChange={(e) => setEditDeviceLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Modal Diagnostik Troubleshooting */}
      <ModalShell
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        title="Detail Diagnostik & Solusi Koneksi"
        subtitle={`Hasil pengecekan koneksi ke mesin ${activeDevice?.name} (${activeDevice?.ip})`}
      >
        <div className="space-y-4">
          {connectionError && (
            <>
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-900">{connectionError.title}</span>
                  <span className="font-mono text-[10px] text-rose-700 bg-rose-200/50 px-2 py-0.5 rounded-sm">
                    {connectionError.timestamp}
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">{connectionError.message}</p>
                <div className="text-[11px] font-mono text-rose-800 pt-1">
                  Kode Teknis: {connectionError.code}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Langkah Penanganan (Troubleshooting):</span>
                </h4>
                <ul className="space-y-2">
                  {connectionError.troubleshooting.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsDiagnosticModalOpen(false);
                handleOpenEditModal();
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Periksa Pengaturan Mesin</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDiagnosticModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDiagnosticModalOpen(false);
                  handleConnect();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
              >
                Uji Ulang Koneksi
              </button>
            </div>
          </div>
        </div>
      </ModalShell>

      {/* Modal Konfirmasi Hapus Mesin */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteDevice}
        title="Hapus Mesin Absensi?"
        description={`Apakah Anda yakin ingin menghapus mesin "${deletingDevice?.name}" (${deletingDevice?.ip})? Perangkat yang dihapus tidak akan dapat menarik data transaksi otomatis lagi.`}
      />
    </div>
  );
}
