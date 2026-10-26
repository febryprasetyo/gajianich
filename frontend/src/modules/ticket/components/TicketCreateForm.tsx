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
  AlertCircle,
  Upload,
  CheckCircle2,
  Search,
  X,
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
      setError("Pilih karyawan pelapor.");
      return;
    }

    if (!title.trim() || title.trim().length < 3) {
      setError("Judul tiket minimal 3 karakter.");
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
      setError(err?.message || "Gagal membuat tiket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-3xl">
      <div className="border-b border-slate-100 pb-3 mb-5 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          Buat Tiket Baru
        </h2>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Pelapor & Dicatat Oleh */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pelapor (Autocomplete search) */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pelapor <span className="text-rose-500">*</span>
            </label>
            {requester ? (
              <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs">
                <div>
                  <div className="font-semibold text-slate-900">{requester.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {requester.department || "Tanpa Departemen"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRequester(null);
                    setEmployeeSearch("");
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama karyawan..."
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
                  className="w-full pl-8.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                {isSearchingEmployees && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                    Memuat...
                  </div>
                )}
              </div>
            )}

            {/* Dropdown search results */}
            {showEmployeeDropdown && !requester && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-100">
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
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex flex-col group"
                    >
                      <span className="font-semibold text-xs text-slate-900 group-hover:text-emerald-700">
                        {emp.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {emp.department || "Tanpa Departemen"}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-500">
                    {isSearchingEmployees ? "Memuat..." : "Tidak ada karyawan ditemukan"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dicatat Oleh */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dicatat Oleh
            </label>
            <div className="px-3 py-2 bg-slate-100/75 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-900 truncate">
                {user?.fullName || user?.username || "Staf IT"}
              </span>
              <span className="text-slate-400 text-[11px]">
                ({user?.roleName || "IT"})
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Waktu, Saluran, Kategori, Prioritas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Waktu Laporan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Waktu Laporan <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={reportedAtLocal}
              max={getNowLocal()}
              onChange={(e) => setReportedAtLocal(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Saluran */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Saluran <span className="text-rose-500">*</span>
            </label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value as TicketOrigin)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {ORIGINS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kategori <span className="text-rose-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Prioritas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Prioritas <span className="text-rose-500">*</span>
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Toggle Temuan Internal */}
        <div>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span className="text-xs font-medium text-slate-700">
              Temuan Internal Tim IT
            </span>
          </label>
        </div>

        {/* Judul Masalah */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Judul Tiket <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Ringkasan singkat kendala atau permintaan..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Deskripsi */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Deskripsi Masalah <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            placeholder="Rincian kendala yang dialami..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Upload Lampiran */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Lampiran Berkas (Opsional)
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
              className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-700 shadow-2xs transition-colors"
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

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Menyimpan...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Simpan Tiket
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
