"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  CreateTicketInput,
  EmployeeLookupItem,
  TicketCategory,
  TicketOrigin,
  TicketPriority,
} from "../types";
import { CATEGORIES, ORIGINS, PRIORITIES } from "../constants";
import {
  createTicket,
  getEmployeeLookups,
  uploadTicketAttachment,
} from "../api";
import {
  User,
  Calendar,
  AlertCircle,
  Upload,
  CheckCircle2,
  Search,
  X,
  HelpCircle,
} from "lucide-react";

interface TicketCreateFormProps {
  onSuccess?: (ticketId: number) => void;
  onCancel?: () => void;
}

export default function TicketCreateForm({
  onSuccess,
  onCancel,
}: TicketCreateFormProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Form State
  const [requester, setRequester] = useState<EmployeeLookupItem | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeList, setEmployeeList] = useState<EmployeeLookupItem[]>([]);
  const [initialEmployeeList, setInitialEmployeeList] = useState<EmployeeLookupItem[]>([]);
  const [isSearchingEmployees, setIsSearchingEmployees] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Default reportedAt to current local time in YYYY-MM-DDTHH:mm format
  const getNowLocal = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const local = new Date(now.getTime() - offset);
    return local.toISOString().slice(0, 16);
  };

  const [reportedAtLocal, setReportedAtLocal] = useState<string>(getNowLocal());
  const [isInternal, setIsInternal] = useState<boolean>(false);
  const [category, setCategory] = useState<TicketCategory>("HARDWARE");
  const [origin, setOrigin] = useState<TicketOrigin>("WHATSAPP");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search debounce
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Preload initial employees on mount
  useEffect(() => {
    let active = true;
    async function loadInitialEmployees() {
      try {
        setIsSearchingEmployees(true);
        const res = await getEmployeeLookups();
        if (active && res.success && res.data) {
          setInitialEmployeeList(res.data);
          setEmployeeList(res.data);
        }
      } catch (err) {
        console.error("Gagal memuat daftar awal karyawan:", err);
      } finally {
        if (active) setIsSearchingEmployees(false);
      }
    }
    loadInitialEmployees();
    return () => {
      active = false;
    };
  }, []);

  // Filter or search employees when input changes
  useEffect(() => {
    if (!employeeSearch.trim()) {
      setEmployeeList(initialEmployeeList);
      return;
    }

    if (requester?.name === employeeSearch) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingEmployees(true);
        const res = await getEmployeeLookups(employeeSearch);
        if (res.success && res.data) {
          setEmployeeList(res.data);
          setShowEmployeeDropdown(true);
        }
      } catch (err) {
        console.error("Gagal mencari karyawan:", err);
        // Fallback local filter
        const term = employeeSearch.toLowerCase();
        const localFiltered = initialEmployeeList.filter(
          (emp) =>
            emp.name.toLowerCase().includes(term) ||
            (emp.department && emp.department.toLowerCase().includes(term))
        );
        setEmployeeList(localFiltered);
        setShowEmployeeDropdown(true);
      } finally {
        setIsSearchingEmployees(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [employeeSearch, requester, initialEmployeeList]);

  // Click outside to close employee dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowEmployeeDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!requester) {
      setError("Pilih karyawan pelapor terlebih dahulu.");
      return;
    }

    if (!title.trim() || title.trim().length < 3) {
      setError("Judul masalah minimal 3 karakter.");
      return;
    }

    if (!description.trim() || description.trim().length < 5) {
      setError("Deskripsi masalah minimal 5 karakter.");
      return;
    }

    try {
      setSubmitting(true);
      const reportedAtIso = reportedAtLocal
        ? new Date(reportedAtLocal).toISOString()
        : new Date().toISOString();

      const input: CreateTicketInput = {
        requesterEmployeeId: requester.id,
        reportedAt: reportedAtIso,
        category,
        origin,
        priority,
        title: title.trim(),
        description: description.trim(),
        isInternal,
      };

      const res = await createTicket(input);

      if (res.success && res.data) {
        const ticketId = res.data.id;
        // If file attachment exists, upload it
        if (attachment) {
          try {
            await uploadTicketAttachment(ticketId, attachment);
          } catch (uploadErr) {
            console.error("Gagal upload lampiran:", uploadErr);
          }
        }

        if (onSuccess) {
          onSuccess(ticketId);
        } else {
          router.push(`/dashboard/tickets/${ticketId}`);
        }
      }
    } catch (err: any) {
      setError(err?.message || "Gagal membuat tiket helpdesk.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4 mb-6">
        <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
          Buat Tiket Helpdesk IT Baru
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Catat insiden, keluhan, atau permintaan dukungan IT dengan tiga identitas pencatatan yang terverifikasi.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-700 font-medium">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Identitas & Waktu */}
        <div className="bg-slate-50/75 border border-slate-200 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-600">
            1. Identitas Pencatatan & Waktu Laporan
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pelapor (Autocomplete search) */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Karyawan Pelapor <span className="text-rose-500">*</span>
              </label>
              {requester ? (
                <div className="flex items-center justify-between p-2.5 bg-white border border-emerald-500 rounded-xl text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{requester.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {requester.department || "Tanpa Departemen"} • {requester.email || "-"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRequester(null);
                      setEmployeeSearch("");
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Ketik nama atau departemen karyawan..."
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                    }}
                    onFocus={() => {
                      setShowEmployeeDropdown(true);
                      if (employeeList.length === 0 && initialEmployeeList.length > 0) {
                        setEmployeeList(initialEmployeeList);
                      }
                    }}
                    onClick={() => setShowEmployeeDropdown(true)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {isSearchingEmployees && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 flex items-center gap-1">
                      <div className="w-2.5 h-2.5 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin"></div>
                      Memuat...
                    </div>
                  )}
                </div>
              )}

              {/* Dropdown search results */}
              {showEmployeeDropdown && !requester && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {employeeList.length > 0 ? (
                    employeeList.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          setRequester(emp);
                          setEmployeeSearch(emp.name);
                          setShowEmployeeDropdown(false);
                        }}
                        className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex flex-col group"
                      >
                        <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700">
                          {emp.name}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {emp.department || "Tanpa Departemen"} • {emp.email || "-"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      {isSearchingEmployees
                        ? "Mencari daftar karyawan..."
                        : "Tidak ada data karyawan yang cocok."}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dicatat Oleh (Read-only) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dicatat Oleh (Sesi Saat Ini)
              </label>
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-slate-900">
                    {user?.fullName || user?.username || "Staf IT"}
                  </span>{" "}
                  <span className="text-slate-500">
                    ({user?.roleName || "IT Staff"})
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Identitas pencatat diverifikasi otomatis dari sesi JWT, tidak dapat dipalsukan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Waktu Laporan (reported_at) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Waktu Pelapor Mengadu (Reported At) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={reportedAtLocal}
                  max={getNowLocal()}
                  onChange={(e) => setReportedAtLocal(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Default: saat ini. Ubah jika karyawan mengadu sebelumnya (misal via WhatsApp 30 menit lalu).
              </p>
            </div>

            {/* Toggle Temuan Internal IT */}
            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2.5 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900">
                    Temuan Internal Tim IT
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Centang jika masalah ditemukan saat inspeksi rutin (tidak dihitung dalam rekap aduan karyawan).
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Detail Masalah & Klasifikasi */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-600">
            2. Klasifikasi & Rincian Masalah
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Kategori */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategori Masalah <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Saluran Laporan (Origin) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Saluran Aduan (Origin) <span className="text-rose-500">*</span>
              </label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value as TicketOrigin)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {ORIGINS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Prioritas */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prioritas & Target SLA <span className="text-rose-500">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} (Target SLA: {p.sla})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Judul Masalah */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Judul Masalah / Ringkasan <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Contoh: Layar monitor berkedip garis-garis di PC GA"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Deskripsi Lengkap */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deskripsi Masalah Lengkap <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Jelaskan detail kronologi, gejala, langkah yang sudah dicoba, dan dampak terhadap operasional..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Upload Lampiran */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Lampiran Foto / Screenshot (Opsional, Max 10MB)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                id="ticket-file-input"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setAttachment(e.target.files[0]);
                  }
                }}
                className="hidden"
                accept="image/*,application/pdf"
              />
              <label
                htmlFor="ticket-file-input"
                className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-700 shadow-2xs transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                Pilih Berkas
              </label>
              {attachment && (
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="truncate max-w-xs">{attachment.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Menyimpan Tiket...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Simpan & Buat Tiket
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
