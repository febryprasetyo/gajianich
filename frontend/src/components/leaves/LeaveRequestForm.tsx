'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  CalendarCheck,
  AlertCircle,
  CheckCircle2,
  Save,
  Loader2,
  Lock,
} from "lucide-react";
import type { LeaveBalanceSummary, FullLeaveDocumentData } from "@/types/leaves";
import type { LeaveDocumentOrganizationOption } from "@/types/documentProfile";
import LeaveEmployeePicker, { LeaveEmployeeItem } from "@/components/leaves/LeaveEmployeePicker";
import { LeaveOrganizationPicker } from "@/components/leaves/LeaveOrganizationPicker";
import {
  canSelectLeaveOrganization,
  resolveDefaultLeaveOrganizationId,
} from "@/lib/leaves/leaveOrganizationUtils";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export interface LeaveRequestFormProps {
  mode?: "create" | "edit";
  requestId?: number;
  initialData?: FullLeaveDocumentData;
}

export function LeaveRequestForm({ mode = "create", requestId, initialData }: LeaveRequestFormProps) {
  const currentYear = new Date().getFullYear();
  const router = useRouter();
  const { user } = useAuth();
  const canPickOrganization = canSelectLeaveOrganization(user);

  // State Karyawan - Default KOSONG (null), diisi jika edit
  const [selectedEmployee, setSelectedEmployee] = useState<LeaveEmployeeItem | null>(() => {
    if (initialData?.employee) {
      return {
        id: initialData.employee.id,
        fullName: initialData.employee.fullName,
        employeeCode: initialData.employee.employeeCode,
        position: initialData.employee.position,
        departmentName: initialData.employee.department,
      };
    }
    return null;
  });

  const [organizationOptions, setOrganizationOptions] = useState<LeaveDocumentOrganizationOption[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(
    initialData?.organizationId ?? initialData?.documentProfileSnapshot?.organizationId ?? null
  );
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  const [organizationsError, setOrganizationsError] = useState<string | null>(null);

  const [balanceSummary, setBalanceSummary] = useState<LeaveBalanceSummary | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Form Fields - diinisialisasi dari initialData jika edit
  const [leaveType, setLeaveType] = useState<"ANNUAL" | "SPECIAL">(
    initialData?.leaveType || "ANNUAL"
  );
  const [specialReason, setSpecialReason] = useState<string>(
    initialData?.specialLeaveReason || "Menikah"
  );
  const [reason, setReason] = useState(initialData?.reason || "");
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [endDate, setEndDate] = useState(initialData?.endDate || "");

  // Jumlah cuti yang diambil (Input Manual)
  const [manualDurationDays, setManualDurationDays] = useState<number | "">(
    initialData?.leaveDaysRequested ?? ""
  );
  const [manualResumeWorkDate, setManualResumeWorkDate] = useState<string>(
    initialData?.resumeWorkDate || ""
  );
  const [emergencyPhone, setEmergencyPhone] = useState(
    initialData?.handover?.emergencyPhone || ""
  );

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch data saldo rill saat karyawan dipilih atau startDate berubah
  useEffect(() => {
    if (!selectedEmployee) {
      setBalanceSummary(null);
      return;
    }

    async function loadBalance() {
      setIsLoadingBalance(true);
      try {
        const year = startDate ? Number(startDate.split("-")[0]) : new Date().getFullYear();
        if (!selectedEmployee) return;
        const data = await api.get<LeaveBalanceSummary>(`/leaves/balance-summary?employeeId=${selectedEmployee.id}&year=${year}`);
        setBalanceSummary(data);
      } catch (err) {
        console.error("Failed to load balance summary:", err);
      } finally {
        setIsLoadingBalance(false);
      }
    }
    loadBalance();
  }, [selectedEmployee, startDate ? startDate.split("-")[0] : null]);

  // Fetch daftar organisasi penerbit saat karyawan dipilih (khusus HR/Admin)
  useEffect(() => {
    if (!canPickOrganization || !selectedEmployee) {
      setOrganizationOptions([]);
      setOrganizationsError(null);
      if (!selectedEmployee) {
        setSelectedOrganizationId(null);
      }
      return;
    }

    let cancelled = false;
    async function loadDocumentOrganizations() {
      setIsLoadingOrganizations(true);
      setOrganizationsError(null);
      try {
        if (!selectedEmployee) return;
        const res = await api.get<{ data: LeaveDocumentOrganizationOption[] }>(
          `/leaves/document-organizations?employeeId=${selectedEmployee.id}`
        );
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setOrganizationOptions(list);
        const preferredId =
          mode === "edit"
            ? initialData?.organizationId ?? initialData?.documentProfileSnapshot?.organizationId ?? null
            : null;
        setSelectedOrganizationId((prev) =>
          prev && list.some((o) => o.organizationId === prev)
            ? prev
            : resolveDefaultLeaveOrganizationId(list, preferredId)
        );
      } catch (err: any) {
        if (cancelled) return;
        setOrganizationsError(err?.message || "Gagal memuat pilihan organisasi penerbit.");
      } finally {
        if (!cancelled) {
          setIsLoadingOrganizations(false);
        }
      }
    }
    loadDocumentOrganizations();
    return () => {
      cancelled = true;
    };
  }, [canPickOrganization, selectedEmployee, mode, initialData?.organizationId, initialData?.documentProfileSnapshot?.organizationId]);

  // Hitung estimasi hari kerja otomatis saat tanggal dipilih (hanya pada mode create jika belum diisi)
  useEffect(() => {
    if (mode === "create" && startDate && endDate && manualDurationDays === "") {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end >= start) {
          let count = 0;
          const cur = new Date(start);
          while (cur <= end) {
            const day = cur.getDay();
            if (day !== 0 && day !== 6) {
              count++;
            }
            cur.setDate(cur.getDate() + 1);
          }
          if (count > 0) {
            setManualDurationDays(count);
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }, [mode, startDate, endDate, manualDurationDays]);

  // Rekomendasi otomatis tanggal kembali bekerja saat tanggal selesai berubah
  useEffect(() => {
    if (endDate && !manualResumeWorkDate) {
      try {
        const [y, m, d] = endDate.split("-").map(Number);
        const next = new Date(Date.UTC(y, m - 1, d));
        next.setUTCDate(next.getUTCDate() + 1);
        if (next.getUTCDay() === 6) {
          next.setUTCDate(next.getUTCDate() + 2);
        } else if (next.getUTCDay() === 0) {
          next.setUTCDate(next.getUTCDate() + 1);
        }
        const yStr = next.getUTCFullYear();
        const mStr = String(next.getUTCMonth() + 1).padStart(2, "0");
        const dStr = String(next.getUTCDate()).padStart(2, "0");
        setManualResumeWorkDate(`${yStr}-${mStr}-${dStr}`);
      } catch (e) {
        // ignore
      }
    }
  }, [endDate, manualResumeWorkDate]);

  // Saldo cuti tahunan efektif yang tersedia (memperhitungkan kuota lama jika sedang edit)
  const oldHeldQuota =
    mode === "edit" && initialData?.leaveType === "ANNUAL"
      ? (initialData.leaveDaysRequested || 0)
      : 0;
  const effectiveAvailableBalance = (balanceSummary?.availableBalance ?? 0) + oldHeldQuota;

  // Handle Submit Form (Create / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!selectedEmployee) {
      setErrorMessage("Silakan cari dan pilih nama karyawan terlebih dahulu.");
      return;
    }
    if (!startDate || !endDate) {
      setErrorMessage("Tentukan rentang Dari Tanggal dan s/d Tanggal cuti.");
      return;
    }

    const startYear = Number(startDate.split("-")[0]);
    const endYear = Number(endDate.split("-")[0]);

    if (startYear < currentYear) {
      setErrorMessage(`Permohonan cuti tidak dapat diajukan untuk tahun lampau (${startYear}). Saldo cuti tahun lampau sudah ditutup.`);
      return;
    }

    if (startYear !== endYear) {
      setErrorMessage(`Periode cuti harus berada dalam tahun kalender yang sama (${startYear}). Jika melewati pergantian tahun, silakan ajukan permohonan terpisah untuk masing-masing tahun.`);
      return;
    }
    if (!manualDurationDays || Number(manualDurationDays) <= 0) {
      setErrorMessage("Jumlah cuti yang diambil harus diisi (minimal 1 hari).");
      return;
    }
    if (!reason.trim()) {
      setErrorMessage("Alasan permohonan cuti wajib diisi.");
      return;
    }

    const durationNum = Number(manualDurationDays);

    if (leaveType === "ANNUAL" && balanceSummary) {
      if (durationNum > effectiveAvailableBalance) {
        setErrorMessage(
          `Saldo cuti tahunan tidak mencukupi. Sisa saldo tersedia: ${effectiveAvailableBalance} hari, jumlah cuti yang diajukan: ${durationNum} hari.`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === "edit" && requestId) {
        // Mode Edit: PUT /api/v1/leaves/requests/:id
        await api.put(`/leaves/requests/${requestId}`, {
          ...(canPickOrganization && selectedOrganizationId ? { organizationId: selectedOrganizationId } : {}),
          leaveType,
          specialLeaveReason: leaveType === "SPECIAL" ? specialReason : undefined,
          reason,
          startDate,
          endDate,
          durationDays: durationNum,
          resumeWorkDate: manualResumeWorkDate || undefined,
          emergencyPhone: emergencyPhone || undefined,
        });

        setSuccessMessage("Perubahan permohonan cuti berhasil disimpan!");
        setTimeout(() => {
          router.replace(`/dashboard/leaves/${requestId}/print`);
        }, 400);
      } else {
        // Mode Create: POST /api/v1/leaves/requests
        const resData = await api.post<{ message?: string; data?: { id: number } }>("/leaves/requests", {
          employeeId: Number(selectedEmployee.id),
          ...(canPickOrganization && selectedOrganizationId ? { organizationId: selectedOrganizationId } : {}),
          leaveType,
          specialLeaveReason: leaveType === "SPECIAL" ? specialReason : undefined,
          reason,
          startDate,
          endDate,
          durationDays: durationNum,
          resumeWorkDate: manualResumeWorkDate || undefined,
          emergencyPhone: emergencyPhone || undefined,
        });

        setSuccessMessage("Permohonan cuti berhasil disimpan!");
        if (resData?.data?.id) {
          setTimeout(() => {
            // Gunakan router.replace agar saat tombol back ditekan di view/print, kembali ke list tabel cuti
            router.replace(`/dashboard/leaves/${resData.data!.id}/print`);
          }, 400);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat memproses data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Estimasi realtime sisa saldo berdasarkan input manual
  const durationNum = typeof manualDurationDays === "number" ? manualDurationDays : 0;
  const remainingAfterEstimate =
    balanceSummary && leaveType === "ANNUAL"
      ? Math.max(0, effectiveAvailableBalance - durationNum)
      : balanceSummary?.availableBalance ?? 0;

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-8">
      {/* Alert Error */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Perhatian</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Alert Sukses */}
      {successMessage && (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Sukses</p>
            <p>{successMessage} Membuka dokumen formulir F4...</p>
          </div>
        </div>
      )}

      {/* === 1. Data Pemohon (Searchable Picker atau Locked Card saat Edit) === */}
      <section>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
          <h2 className="text-sm font-bold text-slate-700">
            1. Data Pemohon
          </h2>
          {mode === "edit" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200">
              <Lock className="w-3 h-3 text-slate-500" />
              Pemohon Terkunci
            </span>
          )}
        </div>

        <div className="space-y-4">
          {mode === "create" ? (
            <div className="max-w-xl">
              <LeaveEmployeePicker
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                required
                label="Pilih Karyawan"
              />
            </div>
          ) : (
            selectedEmployee && (
              <div className="max-w-xl p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">{selectedEmployee.fullName}</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    NIK: {selectedEmployee.employeeCode} • {selectedEmployee.position || "—"} • {selectedEmployee.departmentName || "—"}
                  </p>
                </div>
              </div>
            )
          )}

          {selectedEmployee && balanceSummary && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 text-[11px] uppercase tracking-wider block font-mono">Departemen</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">{balanceSummary.employee.department}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] uppercase tracking-wider block font-mono">Jabatan</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">{balanceSummary.employee.position}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] uppercase tracking-wider block font-mono">NIK / Absen</span>
                <span className="font-semibold text-slate-800 font-mono mt-0.5 block">{balanceSummary.employee.employeeCode}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] uppercase tracking-wider block font-mono">Tanggal Bergabung</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">{balanceSummary.employee.joinDate || "—"}</span>
              </div>
            </div>
          )}

          {isLoadingBalance && (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Memuat data saldo cuti rill karyawan...</span>
            </div>
          )}

          {canPickOrganization && selectedEmployee && (
            <div className="pt-2">
              <LeaveOrganizationPicker
                options={organizationOptions}
                value={selectedOrganizationId}
                onChange={setSelectedOrganizationId}
                loading={isLoadingOrganizations}
                error={organizationsError}
              />
            </div>
          )}
        </div>
      </section>

      {/* === 2. Hak dan Sisa Cuti Karyawan (Terintegrasi Pengaturan Cuti Rill) === */}
      {selectedEmployee && balanceSummary && (
        <section>
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-600" />
              <span>2. Hak dan Sisa Cuti Karyawan</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Tahun Kalender {balanceSummary.year}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-medium text-slate-500 block font-mono uppercase">Hak Cuti Dasar</span>
              <p className="text-lg font-extrabold text-slate-800 mt-1 font-mono">{balanceSummary.baseQuota} <span className="text-xs font-normal text-slate-500">Hari</span></p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-medium text-slate-500 block font-mono uppercase">Cuti Bersama</span>
              <p className="text-lg font-extrabold text-slate-700 mt-1 font-mono">{balanceSummary.collectiveLeaveDays} <span className="text-xs font-normal text-slate-500">Hari</span></p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-medium text-slate-500 block font-mono uppercase">Hak Cuti Bersih</span>
              <p className="text-lg font-extrabold text-slate-800 mt-1 font-mono">{balanceSummary.cleanAnnualQuota} <span className="text-xs font-normal text-slate-500">Hari</span></p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-medium text-slate-500 block font-mono uppercase">Cuti Terpakai</span>
              <p className="text-lg font-extrabold text-amber-700 mt-1 font-mono">{balanceSummary.usedQuota} <span className="text-xs font-normal text-slate-500">Hari</span></p>
            </div>

            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-emerald-800 block font-mono uppercase">Sisa Hak Cuti</span>
              <p className="text-lg font-extrabold text-emerald-700 mt-1 font-mono">
                {effectiveAvailableBalance}{" "}
                <span className="text-xs font-normal text-emerald-600">Hari</span>
              </p>
              {durationNum > 0 && leaveType === "ANNUAL" && (
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  Setelah diajukan: <strong className="font-mono">{remainingAfterEstimate} Hari</strong>
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* === 3. Rincian Pengajuan Cuti === */}
      <section>
        <h2 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-600" />
          <span>3. Rincian Permohonan Cuti</span>
        </h2>

        <div className="space-y-5">
          {/* Radio Jenis Cuti */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-2 font-mono">
              Jenis Cuti <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  leaveType === "ANNUAL"
                    ? "border-emerald-500 bg-emerald-50/40 text-emerald-950 ring-1 ring-emerald-400"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="leaveType"
                  value="ANNUAL"
                  checked={leaveType === "ANNUAL"}
                  onChange={() => setLeaveType("ANNUAL")}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-xs block">Cuti Tahunan</span>
                  <span className="text-[11px] text-slate-500">Memotong kuota hak cuti tahunan berjalan.</span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  leaveType === "SPECIAL"
                    ? "border-emerald-500 bg-emerald-50/40 text-emerald-950 ring-1 ring-emerald-400"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="leaveType"
                  value="SPECIAL"
                  checked={leaveType === "SPECIAL"}
                  onChange={() => setLeaveType("SPECIAL")}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-xs block">Cuti Khusus / Ijin Resmi</span>
                  <span className="text-[11px] text-slate-500">Menikah, melahirkan, kematian, dsb. (Tidak potong saldo tahunan).</span>
                </div>
              </label>
            </div>
          </div>

          {/* Opsi Cuti Khusus */}
          {leaveType === "SPECIAL" && (
            <div className="max-w-xl p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
              <label className="block text-xs font-semibold text-amber-900 uppercase font-mono">
                Kategori Cuti Khusus <span className="text-rose-500">*</span>
              </label>
              <select
                value={specialReason}
                onChange={(e) => setSpecialReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-slate-900 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-300 font-medium"
              >
                <option value="Menikah">Pernikahan Karyawan (3 Hari)</option>
                <option value="Menikahkan Anak">Menikahkan Anak (2 Hari)</option>
                <option value="Melahirkan">Istri Melahirkan / Keguguran (2 Hari)</option>
                <option value="Kematian Suami/Istri/Anak/Ortu/Mertua">Keluarga Inti Meninggal (2 Hari)</option>
                <option value="Kematian Anggota Serumah">Anggota Serumah Meninggal (1 Hari)</option>
                <option value="Khitanan / Baptis Anak">Khitanan / Baptis Anak (2 Hari)</option>
                <option value="Lain-lain">Lain-lain (Ijin Khusus)</option>
              </select>
            </div>
          )}

          {/* Grid Tanggal Cuti & Durasi */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5 font-mono">
                Dari Tanggal <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300/30 transition-all font-medium cursor-pointer"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5 font-mono">
                s/d Tanggal <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300/30 transition-all font-medium cursor-pointer"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5 font-mono">
                Jumlah Cuti (Hari) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={manualDurationDays}
                onChange={(e) => setManualDurationDays(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Jumlah hari"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300/30 transition-all font-mono font-bold"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Dapat disesuaikan jika ada hari libur/shift.
              </p>
            </div>
          </div>

          {/* Grid Tanggal Kembali & Telp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5 font-mono">
                Kembali Bekerja Tanggal
              </label>
              <input
                type="date"
                value={manualResumeWorkDate}
                onChange={(e) => setManualResumeWorkDate(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300/30 transition-all font-medium cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">Hari pertama masuk kerja setelah cuti selesai.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5 font-mono">
                Nomor Telp Darurat (Selama Cuti)
              </label>
              <input
                type="text"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="Contoh: 0812-3456-7890"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300/30 transition-all font-medium"
              />
            </div>
          </div>

          {/* Alasan Cuti */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5 font-mono">
              Alasan Cuti <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Keperluan Keluarga"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300/30 transition-all resize-none placeholder:text-slate-400"
              required
            />
          </div>
        </div>
      </section>

      {/* === Footer Actions (Matching EmployeeFormPage standard) === */}
      <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5">
        <Link
          href="/dashboard/leaves"
          className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Batal
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer shadow-sm transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {mode === "edit" ? "Simpan Perubahan" : "Simpan"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
