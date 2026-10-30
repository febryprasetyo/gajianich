'use client';

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Cpu,
  Server,
  Power,
  PowerOff,
  Download,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  ListFilter,
  AlertCircle,
  RotateCcw,
  Wrench,
  XCircle,
  Loader2,
  Settings2,
  Network,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import ModalShell from "@/components/ui/ModalShell";
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal";
import RowActionButton from "@/components/ui/RowActionButton";
import StatusBadge from "@/components/ui/StatusBadge";
import AdmsRegistrationModal from "@/components/attendance/AdmsRegistrationModal";
import { useAuth } from "@/context/AuthContext";
import { useOrganizationScope } from "@/context/OrganizationScopeContext";
import { apiFetch } from "@/lib/api";
import { AttendanceDevice } from "./attendanceMachineStore";
import type { AdmsCandidateDevice } from "@/lib/attendance/admsMonitor";

type FailureScenario = "TIMEOUT" | "AUTH_FAILED" | "REFUSED";

interface ConnectionErrorDetail {
  code: string;
  title: string;
  message: string;
  troubleshooting: string[];
  timestamp: string;
}

const dot = <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />;

export default function AttendanceDevicesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedGroupId } = useOrganizationScope();
  const normalizedRole = (user?.roleName || "").toLowerCase().replace(/_/g, "");
  const canManage = normalizedRole === "superadmin" || normalizedRole === "itadmin";

  const [activeTab, setActiveTab] = useState<"all" | "tcp" | "adms">("all");
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
  const [addConnectionType, setAddConnectionType] = useState<"Ethernet" | "ADMS">("Ethernet");
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceIp, setNewDeviceIp] = useState("");
  const [newDevicePort, setNewDevicePort] = useState(4370);
  const [newDeviceCommKey, setNewDeviceCommKey] = useState(0);
  const [newDeviceNumber, setNewDeviceNumber] = useState(1);
  const [newDeviceLocation, setNewDeviceLocation] = useState("");
  const [newDeviceSerial, setNewDeviceSerial] = useState("");
  const [newDeviceSourceCidr, setNewDeviceSourceCidr] = useState("");

  // Modal Edit Mesin state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDeviceName, setEditDeviceName] = useState("");
  const [editDeviceIp, setEditDeviceIp] = useState("");
  const [editDevicePort, setEditDevicePort] = useState(4370);
  const [editDeviceCommKey, setEditDeviceCommKey] = useState(0);
  const [editDeviceNumber, setEditDeviceNumber] = useState(1);
  const [editDeviceLocation, setEditDeviceLocation] = useState("");

  // Modal Allowlist ADMS Edit state
  const [isAdmsAllowlistModalOpen, setIsAdmsAllowlistModalOpen] = useState(false);
  const [editingAdmsCandidate, setEditingAdmsCandidate] = useState<AdmsCandidateDevice | null>(null);

  // Modal Hapus Mesin state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingDevice, setDeletingDevice] = useState<AttendanceDevice | null>(null);

  // Toast / notification
  const [pageToast, setPageToast] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch<{ success: boolean; data: AttendanceDevice[] }>("/attendance/devices");
      if (res.success && res.data) {
        setDevices(res.data);
        const targetId = selectedDeviceId || (res.data.length > 0 ? res.data[0].id : "");
        if (!selectedDeviceId && res.data.length > 0) {
          setSelectedDeviceId(res.data[0].id);
        }
        const active = res.data.find((d) => String(d.id) === String(targetId));
        if (active && active.status === "connected") {
          setIdleSecondsLeft(active.idleSecondsLeft ?? 300);
        } else if (active && active.status !== "connected") {
          setIdleSecondsLeft(null);
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

  const handleSelectDevice = (deviceId: string | number) => {
    setSelectedDeviceId(deviceId);
    const target = devices.find((d) => String(d.id) === String(deviceId));
    if (target && target.status === "connected") {
      setIdleSecondsLeft(target.idleSecondsLeft ?? 300);
    } else {
      setIdleSecondsLeft(null);
    }
  };

  // Idle timeout timer: 5 menit auto-disconnect tanpa proses
  useEffect(() => {
    if (idleSecondsLeft === null) return;
    if (idleSecondsLeft <= 0) {
      setDevices((prev) =>
        prev.map((d) => (String(d.id) === String(selectedDeviceId) ? { ...d, status: "disconnected", idleSecondsLeft: null } : d))
      );
      setIdleSecondsLeft(null);
      if (selectedDeviceId) {
        apiFetch(`/attendance/devices/${selectedDeviceId}/disconnect`, { method: "POST" })
          .catch((err) => console.warn("Auto-disconnect API error:", err));
      }
      setPageToast("Koneksi mesin otomatis diputuskan karena idle 5 menit tanpa proses.");
      setTimeout(() => setPageToast(null), 5000);
      return;
    }
    const timer = setInterval(() => {
      setIdleSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [idleSecondsLeft, selectedDeviceId]);

  // Polling reaktif: saat ada mesin yang terhubung, sinkronkan status berkala
  useEffect(() => {
    const hasConnectedDevice = devices.some((d) => d.status === "connected");
    if (!hasConnectedDevice) return;
    const interval = setInterval(() => {
      apiFetch<{ success: boolean; data: AttendanceDevice[] }>("/attendance/devices").then((res) => {
        if (res.success && res.data) {
          setDevices(res.data);
          const active = res.data.find((d) => String(d.id) === String(selectedDeviceId));
          if (active && active.status === "connected" && typeof active.idleSecondsLeft === "number") {
            setIdleSecondsLeft(active.idleSecondsLeft);
          } else if (active && active.status !== "connected") {
            setIdleSecondsLeft(null);
          }
        }
      }).catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, [devices, selectedDeviceId]);

  const activeDevice = devices.find((d) => String(d.id) === String(selectedDeviceId)) || devices[0];

  const handleConnect = async () => {
    if (!activeDevice) return;
    setIsConnecting(true);
    setConnectionError(null);

    if (simulateFailure) {
      setTimeout(() => {
        setIsConnecting(false);
        setDevices((prev) =>
          prev.map((d) => (d.id === activeDevice.id ? { ...d, status: "error" } : d))
        );
        setIdleSecondsLeft(null);

        const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const detail: ConnectionErrorDetail = {
          code: "TCP_TIMEOUT (ETIMEDOUT)",
          title: "Koneksi Waktu Habis (Mesin Tidak Merespon)",
          message: `Tidak dapat menjangkau mesin ${activeDevice.name} di ${activeDevice.ip}:${activeDevice.port}.`,
          troubleshooting: [
            "Pastikan mesin menyala dan kabel LAN terhubung stabil.",
            `Pastikan IP ${activeDevice.ip} berada dalam satu subnet jaringan lokal.`,
            `Pastikan port ${activeDevice.port} tidak diblokir firewall.`,
          ],
          timestamp: now,
        };
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
        setIdleSecondsLeft(res.data.idleSecondsLeft || 300);
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
        code: "TCP_CONNECT_ERROR",
        title: "Gagal Menghubungkan ke Mesin",
        message: err.message || `Tidak dapat membuka koneksi socket ke ${activeDevice.ip}:${activeDevice.port}.`,
        troubleshooting: [
          `Pastikan IP ${activeDevice.ip} dapat dijangkau dari server.`,
          "Periksa apakah mesin sedang sibuk atau diakses aplikasi lain.",
          "Restart mesin fisik untuk mereset socket komunikasi.",
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
      setDevices((prev) =>
        prev.map((d) => (d.id === activeDevice.id ? { ...d, status: "disconnected", idleSecondsLeft: null } : d))
      );
      setIdleSecondsLeft(null);
      setPageToast(`Koneksi ke ${activeDevice.name} diputuskan`);
      setTimeout(() => setPageToast(null), 3000);
    } catch (err: any) {
      console.error("Gagal disconnect:", err);
    }
  };

  // Toggle ADMS device
  const handleToggleAdmsDevice = async (device: AttendanceDevice) => {
    try {
      const res = await apiFetch<{ success: boolean; message?: string }>(
        `/attendance/devices/adms/${device.id}/toggle`,
        {
          method: "PATCH",
          body: JSON.stringify({ enabled: !device.admsEnabled }),
        }
      );
      if (res.success) {
        setPageToast(res.message || `Status penerimaan ADMS mesin ${device.name} berhasil diperbarui.`);
        fetchDevices();
        setTimeout(() => setPageToast(null), 3000);
      }
    } catch (err: any) {
      setPageToast(err.message || "Gagal mengubah status penerimaan ADMS mesin.");
      setTimeout(() => setPageToast(null), 4000);
    }
  };

  const handleOpenDownloadModal = (deviceToDownload?: AttendanceDevice) => {
    const target = deviceToDownload || activeDevice;
    if (!target) return;
    setSelectedDeviceId(target.id);
    setDownloadCompleted(false);
    setDownloadError(null);
    setDownloadProgress(0);
    setDownloadCount(0);
    setDownloadTotal(0);
    setIsDownloadModalOpen(true);
  };

  const handleStartDownload = async () => {
    if (!activeDevice) return;
    setIsDownloading(true);
    setDownloadProgress(10);
    setDownloadError(null);

    try {
      setDownloadProgress(35);
      const res = await apiFetch<{
        success: boolean;
        message: string;
        data: {
          totalDownloaded: number;
          inserted: number;
          duplicatesSkipped: number;
          syncLogId: number;
        };
      }>(
        `/attendance/devices/${activeDevice.id}/sync`,
        {
          method: "POST",
          body: JSON.stringify({
            startDate,
            endDate,
            overwrite: overwriteExisting,
          }),
        }
      );

      setDownloadProgress(100);
      setIsDownloading(false);

      if (res.success && res.data) {
        setDownloadCount(res.data.inserted);
        setDownloadTotal(res.data.totalDownloaded);
        setDownloadCompleted(true);
        fetchDevices();
      } else {
        setDownloadError(res.message || "Penarikan data gagal diselesaikan oleh mesin.");
      }
    } catch (err: any) {
      setIsDownloading(false);
      setDownloadError(err.message || "Terjadi kesalahan jaringan saat menarik data dari mesin.");
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName) return;

    try {
      if (addConnectionType === "ADMS") {
        if (!newDeviceSerial) {
          setPageToast("Nomor seri (SN) wajib diisi untuk mesin ADMS.");
          setTimeout(() => setPageToast(null), 3000);
          return;
        }

        const cidr = newDeviceSourceCidr.trim()
          ? newDeviceSourceCidr.includes("/")
            ? newDeviceSourceCidr.trim()
            : `${newDeviceSourceCidr.trim()}/32`
          : newDeviceIp
          ? `${newDeviceIp.trim()}/32`
          : "127.0.0.1/32";

        const res = await apiFetch<{ success: boolean; message?: string }>(
          "/attendance/devices/adms/register",
          {
            method: "POST",
            body: JSON.stringify({
              mode: "new",
              name: newDeviceName,
              serial: newDeviceSerial.trim(),
              ip: newDeviceIp.trim() || "0.0.0.0",
              port: 4370,
              sourceCidr: cidr,
              enabled: true,
              groupId: selectedGroupId,
            }),
          }
        );

        if (res.success) {
          setIsAddModalOpen(false);
          resetAddForm();
          setPageToast("Mesin ADMS baru berhasil didaftarkan.");
          fetchDevices();
          setTimeout(() => setPageToast(null), 3000);
        }
      } else {
        if (!newDeviceIp) {
          setPageToast("Alamat IP wajib diisi untuk mesin fisik Ethernet.");
          setTimeout(() => setPageToast(null), 3000);
          return;
        }

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
          setIsAddModalOpen(false);
          resetAddForm();
          setPageToast("Perangkat mesin baru berhasil ditambahkan.");
          fetchDevices();
          setTimeout(() => setPageToast(null), 3000);
        }
      }
    } catch (err: any) {
      setPageToast(`Gagal menambahkan mesin: ${err.message}`);
      setTimeout(() => setPageToast(null), 4000);
    }
  };

  const resetAddForm = () => {
    setNewDeviceName("");
    setNewDeviceIp("");
    setNewDevicePort(4370);
    setNewDeviceCommKey(0);
    setNewDeviceNumber(1);
    setNewDeviceLocation("");
    setNewDeviceSerial("");
    setNewDeviceSourceCidr("");
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
        setIsEditModalOpen(false);
        setPageToast("Perubahan mesin berhasil disimpan.");
        fetchDevices();
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
      setTimeout(() => setPageToast(null), 5000);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Convert device to candidate format for AdmsRegistrationModal
  const admsCandidatesList: AdmsCandidateDevice[] = devices.map((d) => ({
    id: Number(d.id),
    name: d.name,
    serialNumber: d.serialNumber || null,
    ip: d.ip,
    port: d.port,
    connectionType: d.connectionType === "ADMS" ? "ADMS" : "Ethernet",
    isEnabled: true,
    admsRegistered: Boolean(d.admsRegistered || d.connectionType === "ADMS"),
    admsEnabled: Boolean(d.admsEnabled),
    allowedNetwork: d.allowedNetwork || null,
    lastSeenAt: d.lastSyncAt,
    lastDataAt: d.lastSyncAt,
  }));

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
              Manajemen & Download Mesin Presensi
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola perangkat absensi kantor (Ethernet / TCP) dan mesin cloud ADMS terintegrasi dalam satu sistem.
            </p>
          </div>
        </div>

        {/* Tombol Aksi Header */}
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => {
                resetAddForm();
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Mesin</span>
            </button>
          )}

          <Link
            href="/dashboard/attendance/adms"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-xs cursor-pointer"
            title="Buka panel monitor dan log real-time ADMS"
          >
            <Server className="w-4 h-4 text-emerald-600" />
            <span>Review & Log ADMS</span>
          </Link>
        </div>
      </div>

      {/* Tab Navigasi Alur Kerja */}
      <div role="tablist" aria-label="Alur Kerja Mesin Presensi" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: "all", label: "1. Daftar Mesin Presensi (Fisik & ADMS)" },
          { id: "tcp", label: "2. Tarik Data Manual (Koneksi TCP / LAN)" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeTab === item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={`min-h-10 rounded-xl border px-4 py-2 text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === item.id
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-2xs"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
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
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-100/50 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Panduan Solusi</span>
            </button>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Action Toolbar Penarikan TCP */}
      {activeTab === "tcp" && (
        <div className="rounded-2xl p-4 bg-white border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Operasi Penarikan Presensi TCP / Ethernet
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Koneksikan mesin absensi yang terhubung ke jaringan LAN untuk mengunduh log presensi manual.
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Perangkat aktif:{" "}
              <strong className="text-slate-800">
                {activeDevice ? `${activeDevice.name} (${activeDevice.ip})` : "Pilih dari tabel"}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
            {activeDevice?.status === "connected" ? (
              <button
                onClick={handleDisconnect}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 border border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors cursor-pointer"
              >
                <PowerOff className="w-3.5 h-3.5" />
                <span>Putuskan Sambungan</span>
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting || !activeDevice || activeDevice.connectionType === "ADMS"}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isConnecting ? "Menghubungkan..." : "Koneksikan ke Mesin"}</span>
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
        </div>
      )}

      {/* Tabel Mesin Absensi Terdaftar */}
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
            {activeTab === "tcp"
              ? "Pilih mesin fisik untuk menarik data via TCP/IP"
              : "Menampilkan mesin presensi jaringan lokal (Ethernet) dan Cloud ADMS"}
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
            <p className="text-xs text-slate-400 mt-1">Silakan klik Tambah Mesin untuk mendaftarkan perangkat</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">Pilih</th>
                  <th className="py-2.5 px-4">Nama Mesin</th>
                  <th className="py-2.5 px-4">Tipe Koneksi</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Alamat IP / Allowlist</th>
                  <th className="py-2.5 px-4">Serial Number</th>
                  <th className="py-2.5 px-4">Lokasi</th>
                  <th className="py-2.5 px-4">Terakhir Aktif</th>
                  <th className="py-2.5 px-4 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map((device) => {
                  const isSelected = String(device.id) === String(selectedDeviceId);
                  const isAdms = device.connectionType === "ADMS" || Boolean(device.admsRegistered);
                  const isConn = device.status === "connected";
                  const isErr = device.status === "error";

                  return (
                    <tr
                      key={device.id}
                      onClick={() => handleSelectDevice(device.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-emerald-50/40 font-medium" : "hover:bg-slate-50/70"
                      }`}
                    >
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="radio"
                          name="selected_device"
                          checked={isSelected}
                          onChange={() => handleSelectDevice(device.id)}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-4 text-slate-900 font-semibold">
                        <div className="flex items-center gap-2">
                          {isAdms ? (
                            <Server className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Cpu className={`w-4 h-4 ${isConn ? "text-emerald-600" : isErr ? "text-rose-500" : "text-slate-400"}`} />
                          )}
                          <span>{device.name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {isAdms ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Server className="w-3 h-3" />
                            Cloud ADMS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Cpu className="w-3 h-3" />
                            Ethernet (LAN)
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isAdms ? (
                          <StatusBadge
                            icon={dot}
                            variant={!device.admsEnabled ? "slate" : "success"}
                          >
                            {!device.admsEnabled ? "ADMS Dinonaktifkan" : "ADMS Aktif"}
                          </StatusBadge>
                        ) : isConn ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            <span>Terhubung</span>
                            {isSelected && idleSecondsLeft !== null ? (
                              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-200/60 px-1.5 py-0.2 rounded-sm ml-1" title="Sisa waktu idle sebelum otomatis terputus">
                                {formatCountdown(idleSecondsLeft)}
                              </span>
                            ) : null}
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
                        {device.ip ? `${device.ip}:${device.port}` : "-"}
                        {device.allowedNetwork && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Allowlist: {device.allowedNetwork}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
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
                        <div className="flex items-center justify-center gap-1">
                          {isAdms ? (
                            <>
                              {canManage && (
                                <RowActionButton
                                  icon={Settings2}
                                  label="Allowlist ADMS"
                                  title="Ubah nomor seri atau IP allowlist ADMS"
                                  variant="default"
                                  onClick={() => {
                                    const candidate: AdmsCandidateDevice = {
                                      id: Number(device.id),
                                      name: device.name,
                                      serialNumber: device.serialNumber || null,
                                      ip: device.ip,
                                      port: device.port,
                                      connectionType: "ADMS",
                                      isEnabled: true,
                                      admsRegistered: true,
                                      admsEnabled: Boolean(device.admsEnabled),
                                      allowedNetwork: device.allowedNetwork || null,
                                      lastSeenAt: device.lastSyncAt,
                                      lastDataAt: device.lastSyncAt,
                                    };
                                    setEditingAdmsCandidate(candidate);
                                    setIsAdmsAllowlistModalOpen(true);
                                  }}
                                />
                              )}
                              {canManage && (
                                <RowActionButton
                                  icon={Power}
                                  label={device.admsEnabled ? "Nonaktifkan ADMS" : "Aktifkan ADMS"}
                                  title={device.admsEnabled ? "Nonaktifkan penerimaan ADMS" : "Aktifkan penerimaan ADMS"}
                                  variant={device.admsEnabled ? "amber" : "emerald"}
                                  onClick={() => handleToggleAdmsDevice(device)}
                                />
                              )}
                            </>
                          ) : (
                            <>
                              {isConn ? (
                                <RowActionButton
                                  icon={PowerOff}
                                  label="Putuskan Koneksi"
                                  title="Putuskan sambungan ke mesin"
                                  variant="rose"
                                  onClick={handleDisconnect}
                                />
                              ) : (
                                <RowActionButton
                                  icon={Power}
                                  label="Hubungkan Mesin"
                                  title="Hubungkan ke mesin absensi"
                                  variant="emerald"
                                  onClick={handleConnect}
                                />
                              )}
                              {isConn && (
                                <RowActionButton
                                  icon={Download}
                                  label="Download Presensi"
                                  title="Download catatan presensi"
                                  variant="default"
                                  onClick={() => handleOpenDownloadModal(device)}
                                />
                              )}
                            </>
                          )}

                          {canManage && (
                            <RowActionButton
                              icon={Edit3}
                              label="Edit Mesin"
                              title={`Edit Konfigurasi ${device.name}`}
                              variant="default"
                              onClick={() => handleOpenEditModal(device)}
                            />
                          )}

                          {canManage && (
                            <RowActionButton
                              icon={Trash2}
                              label="Hapus Mesin"
                              title={`Hapus ${device.name}`}
                              variant="rose"
                              onClick={() => {
                                setDeletingDevice(device);
                                setIsDeleteModalOpen(true);
                              }}
                            />
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
      </div>

      {/* Modal Download Data Presensi */}
      <ModalShell
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        title="Download Data Presensi Mesin"
        subtitle={`Mengambil catatan presensi dari ${activeDevice?.name} (${activeDevice?.ip})`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800">Status Perangkat:</span>
              <span className="ml-2 font-mono text-emerald-700 font-bold">TERHUBUNG</span>
            </div>
            {idleSecondsLeft !== null && (
              <div className="text-[11px] text-slate-500">
                Auto-disconnect dalam: <strong className="font-mono text-slate-700">{formatCountdown(idleSecondsLeft)}</strong>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Rentang Tanggal Presensi:
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
          </div>

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

          {downloadError && (
            <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Koneksi ke Mesin Gagal</span>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed">{downloadError}</p>
            </div>
          )}

          {downloadCompleted && (
            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Penarikan Data Berhasil!</span>
              </div>
              <p className="text-xs text-emerald-700">
                Total <span className="font-bold">{downloadCount} baris</span> catatan presensi berhasil ditarik dan disimpan ke database.
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDownloadModalOpen(false)}
              disabled={isDownloading}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              Tutup
            </button>
            {!downloadCompleted && (
              <button
                type="button"
                onClick={handleStartDownload}
                disabled={isDownloading}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isDownloading ? "Mengunduh..." : "Mulai Download"}</span>
              </button>
            )}
          </div>
        </div>
      </ModalShell>

      {/* Modal Tambah Mesin (Unified: Ethernet & ADMS) */}
      <ModalShell
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Mesin Absensi"
        subtitle="Daftarkan mesin absensi baru ke dalam sistem GAJIANICH"
      >
        <form onSubmit={handleAddDevice} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setAddConnectionType("Ethernet")}
              className={`py-2 rounded-lg transition-colors cursor-pointer ${
                addConnectionType === "Ethernet"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Mesin Fisik (Ethernet / LAN)
            </button>
            <button
              type="button"
              onClick={() => setAddConnectionType("ADMS")}
              className={`py-2 rounded-lg transition-colors cursor-pointer ${
                addConnectionType === "ADMS"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Mesin Cloud ADMS (Push Port 8081)
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Mesin</label>
              <input
                type="text"
                required
                placeholder={
                  addConnectionType === "Ethernet"
                    ? "Contoh: Solution X900 Lobby Barat"
                    : "Contoh: ADMS Gedung Produksi"
                }
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {addConnectionType === "Ethernet" ? (
              <>
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
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nomor Seri Mesin (SN)</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: B3FT194260021"
                      value={newDeviceSerial}
                      onChange={(e) => setNewDeviceSerial(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">IP Mesin (Opsional)</label>
                    <input
                      type="text"
                      placeholder="192.168.1.100"
                      value={newDeviceIp}
                      onChange={(e) => setNewDeviceIp(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">IP / Subnet Allowlist (CIDR)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 192.168.1.100/32 atau 192.168.1.0/24"
                    value={newDeviceSourceCidr}
                    onChange={(e) => setNewDeviceSourceCidr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Hanya IP atau subnet ini yang diizinkan mengirim log ke port 8081.
                  </p>
                </div>
              </>
            )}

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
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
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
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
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
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Periksa Pengaturan Mesin</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDiagnosticModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDiagnosticModalOpen(false);
                  handleConnect();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
              >
                Uji Ulang Koneksi
              </button>
            </div>
          </div>
        </div>
      </ModalShell>

      {/* Modal Allowlist ADMS Edit */}
      <AdmsRegistrationModal
        isOpen={isAdmsAllowlistModalOpen}
        onClose={() => setIsAdmsAllowlistModalOpen(false)}
        onSuccess={() => {
          setIsAdmsAllowlistModalOpen(false);
          setPageToast("Konfigurasi allowlist ADMS berhasil diperbarui.");
          fetchDevices();
          setTimeout(() => setPageToast(null), 3000);
        }}
        candidates={admsCandidatesList}
        editDevice={editingAdmsCandidate}
        selectedGroupId={selectedGroupId}
      />

      {/* Modal Konfirmasi Hapus Mesin */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteDevice}
        title="Hapus Mesin Absensi?"
        description={`Apakah Anda yakin ingin menghapus mesin "${deletingDevice?.name}" (${deletingDevice?.ip})? Perangkat yang dihapus tidak akan dapat menarik data atau mengirim data presensi ke sistem.`}
      />
    </div>
  );
}
