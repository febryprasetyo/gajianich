'use client';

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Calendar,
  Cpu,
  Server,
  Calculator,
  Download,
  Filter,
  ListFilter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { RawAttendanceLog, AttendanceDevice } from "./attendanceMachineStore";

export default function AttendanceRawLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<RawAttendanceLog[]>([]);
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [selectedState, setSelectedState] = useState<"all" | "Masuk" | "Pulang" | "Scan Antara">("all");
  const [selectedSource, setSelectedSource] = useState<"all" | "ADMS" | "TCP_SYNC">("all");
  const [isCalculating, setIsCalculating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchDevices = async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: AttendanceDevice[] }>("/attendance/devices");
      if (res.success && res.data) {
        setDevices(res.data);
      }
    } catch (err) {
      console.warn("Gagal memuat daftar perangkat:", err);
    }
  };

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (selectedDevice !== "all") params.set("deviceId", selectedDevice);
      params.set("limit", "1000");

      const res = await apiFetch<{ success: boolean; data: any[] }>(`/attendance/devices/raw-logs/query?${params.toString()}`);
      if (res.success && res.data) {
        const formatted: RawAttendanceLog[] = res.data.map((r) => {
          let timeStr = "";
          if (typeof r.timestamp === "string") {
            timeStr = r.timestamp.replace("T", " ").replace(/\.\d+Z?$/, "").replace("Z", "");
          } else if (r.timestamp) {
            const d = new Date(r.timestamp);
            const pad = (n: number) => String(n).padStart(2, "0");
            timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          }
          return {
            id: r.id,
            deviceIp: r.deviceId ? String(r.deviceId) : "-",
            deviceName: r.deviceName || "Mesin Absensi",
            deviceLocation: r.deviceLocation,
            pin: r.pin,
            employeeCode: r.employeeNik || r.pin,
            employeeName: r.employeeName || `Karyawan (${r.pin})`,
            department: r.department || "-",
            timestamp: timeStr,
            verifyMode: r.verifyMode,
            inOutState: r.inOutState,
            workDate: r.workDate,
            source: r.rawSource === "ADMS" ? "ADMS" : "TCP_SYNC",
          };
        });
        setLogs(formatted);
      }
    } catch (err: any) {
      console.error("Gagal memuat log presensi:", err);
      setToastMessage("Gagal memuat data presensi dari server.");
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedDevice]);

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setSelectedDevice("all");
    setSelectedState("all");
    setSelectedSource("all");
    setCurrentPage(1);
  };

  // Filtered raw logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (startDate && log.workDate < startDate) return false;
      if (endDate && log.workDate > endDate) return false;
      if (selectedDevice !== "all" && String(log.deviceIp) !== selectedDevice) return false;
      if (selectedState !== "all" && log.inOutState !== selectedState) return false;
      if (selectedSource !== "all" && log.source !== selectedSource) return false;
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
  }, [logs, startDate, endDate, selectedDevice, selectedState, selectedSource, searchQuery]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      const res = await apiFetch<{ success: boolean; message: string; data: any }>("/attendance/devices/calculate", {
        method: "POST",
        body: JSON.stringify({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          deviceId: selectedDevice !== "all" ? parseInt(selectedDevice, 10) : undefined,
          saveToDatabase: true,
        }),
      });

      if (res.success) {
        setToastMessage(res.message);
        router.push("/dashboard/attendance/transactions");
      }
    } catch (err: any) {
      setToastMessage(`Gagal menghitung kalkulasi: ${err.message}`);
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <AlertCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">{toastMessage}</p>
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
            <ListFilter className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Data Log Presensi Mesin
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Daftar seluruh riwayat tap masuk dan pulang yang ditarik langsung dari mesin absensi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/attendance/devices"
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Tarik Log dari Mesin</span>
          </Link>
          <button
            type="button"
            onClick={handleCalculate}
            disabled={isCalculating || logs.length === 0}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isCalculating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4" />
            )}
            <span>{isCalculating ? "Mengkalkulasi..." : "Kalkulasi ke Laporan Presensi"}</span>
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
            <div
              className="flex items-center gap-1 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl cursor-pointer hover:border-emerald-500 transition-colors"
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
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onClick={(e) => {
                  try {
                    (e.currentTarget as HTMLInputElement).showPicker?.();
                  } catch {}
                }}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs text-slate-700 cursor-pointer focus:outline-none"
              />
              <span className="text-slate-400 text-xs px-1 pointer-events-none">s/d</span>
              <input
                type="date"
                value={endDate}
                onClick={(e) => {
                  try {
                    (e.currentTarget as HTMLInputElement).showPicker?.();
                  } catch {}
                }}
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
                {devices.map((d) => (
                  <option key={d.id} value={String(d.id)}>
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

            {/* Filter Sumber Data */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedSource}
                onChange={(e) => {
                  setSelectedSource(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value="all">Semua Sumber Log</option>
                <option value="ADMS">Cloud ADMS (Push)</option>
                <option value="TCP_SYNC">Tarik Mesin (TCP)</option>
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
                <th className="py-2.5 px-3">Sumber Log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Memuat data log mentah dari server...</p>
                  </td>
                </tr>
              ) : paginatedLogs.length > 0 ? (
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                        {log.verifyMode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {log.inOutState === "Masuk" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Masuk
                        </span>
                      )}
                      {log.inOutState === "Pulang" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          Pulang
                        </span>
                      )}
                      {log.inOutState === "Scan Antara" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          Scan Antara
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {log.source === "ADMS" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                          Cloud ADMS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Tarik Mesin
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
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
              Menampilkan {filteredLogs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{" "}
              {Math.min(currentPage * pageSize, filteredLogs.length)} dari {filteredLogs.length} data
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Halaman Selanjutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
