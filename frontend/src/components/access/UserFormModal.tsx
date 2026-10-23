'use client';

import React, { useState, useEffect, useMemo, useRef } from "react";
import ModalShell from "@/components/ui/ModalShell";
import { UserItem, RoleItem, UserFormData } from "@/lib/access/types";
import {
  UserPlus,
  UserCog,
  KeyRound,
  Loader2,
  Search,
  Check,
  ChevronDown,
  UserX,
} from "lucide-react";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: UserFormData) => Promise<void>;
  roles: RoleItem[];
  employees?: any[];
  initialData?: UserItem | null;
  isLoading?: boolean;
}

export default function UserFormModal({
  isOpen,
  onClose,
  onSubmit,
  roles,
  employees = [],
  initialData = null,
  isLoading = false,
}: UserFormModalProps) {
  const isEdit = Boolean(initialData);

  const [username, setUsername] = useState("");
  const [roleId, setRoleId] = useState<number>(roles[0]?.id || 1);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [error, setError] = useState<string | null>(null);

  // Employee picker state with searchable filter
  const [isEmployeePickerOpen, setIsEmployeePickerOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialData) {
      setUsername(initialData.username);
      setRoleId(initialData.roleId || roles[0]?.id || 1);
      setEmployeeId(initialData.employeeId || null);
      setStatus(initialData.status);
    } else {
      setUsername("");
      setRoleId(roles[0]?.id || 1);
      setEmployeeId(null);
      setStatus("active");
    }
    setError(null);
    setIsEmployeePickerOpen(false);
    setEmployeeSearchQuery("");
  }, [initialData, roles, isOpen]);

  // Close employee picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsEmployeePickerOpen(false);
      }
    };
    if (isEmployeePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEmployeePickerOpen]);

  const selectedEmployee = useMemo(() => {
    if (!employeeId) return null;
    return employees.find((emp) => emp.id === employeeId) || null;
  }, [employeeId, employees]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const name = (emp.fullName || "").toLowerCase();
      const code = (emp.employeeCode || "").toLowerCase();
      const dept = (emp.departmentName || "").toLowerCase();
      return name.includes(q) || code.includes(q) || dept.includes(q);
    });
  }, [employees, employeeSearchQuery]);

  const handleSelectEmployee = (emp: any | null) => {
    if (!emp) {
      setEmployeeId(null);
      setIsEmployeePickerOpen(false);
      return;
    }

    setEmployeeId(emp.id);
    setIsEmployeePickerOpen(false);

    // Auto-fill username if blank
    if (!username.trim()) {
      const autoUser = (emp.fullName || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ".")
        .replace(/\.+/g, ".")
        .replace(/^\.|\.$/g, "");
      setUsername(autoUser);
    }

    // Auto-select "Employee" role if creating and role is not yet customized
    if (!isEdit) {
      const employeeRole = roles.find(
        (r) => r.code === "employee" || r.name.toLowerCase() === "employee"
      );
      if (employeeRole) {
        setRoleId(employeeRole.id);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("Username wajib diisi");
      return;
    }

    try {
      await onSubmit({
        username: username.trim(),
        email: initialData?.email || "",
        roleId: Number(roleId),
        employeeId: employeeId ? Number(employeeId) : null,
        status,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan akun pengguna");
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Akun Pengguna" : "Tambah Akun Pengguna Baru"}
      subtitle={
        isEdit
          ? "Perbarui detail akun, penetapan role, dan tautan karyawan"
          : "Lengkapi kredensial akun dan tautkan ke karyawan"
      }
      icon={
        isEdit ? (
          <UserCog className="w-5 h-5 text-emerald-600" />
        ) : (
          <UserPlus className="w-5 h-5 text-emerald-600" />
        )
      }
      maxWidthClass="max-w-lg"
      isLoading={isLoading}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isEdit ? "Simpan Perubahan" : "Buat Akun Pengguna"}</span>
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">
            {error}
          </div>
        )}

        {/* Linked Employee Picker with Live Filter */}
        <div className="relative" ref={pickerRef}>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700">
              Tautkan Karyawan <span className="text-slate-400 font-normal">(Opsional / Presensi Mobile)</span>
            </label>
            {selectedEmployee && (
              <button
                type="button"
                onClick={() => handleSelectEmployee(null)}
                className="text-[11px] text-rose-600 hover:text-rose-700 font-medium transition cursor-pointer"
              >
                Hapus Tautan
              </button>
            )}
          </div>

          {selectedEmployee ? (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-300">
                  {selectedEmployee.fullName?.[0]?.toUpperCase() || "K"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {selectedEmployee.fullName}
                  </p>
                  <p className="text-[11px] text-slate-600 truncate font-mono">
                    NIK: {selectedEmployee.employeeCode}{" "}
                    {selectedEmployee.departmentName
                      ? `• ${selectedEmployee.departmentName}`
                      : ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsEmployeePickerOpen(true);
                  setEmployeeSearchQuery("");
                }}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-200 rounded-lg shadow-2xs hover:bg-emerald-50 transition cursor-pointer shrink-0"
              >
                Ganti
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsEmployeePickerOpen(!isEmployeePickerOpen);
                setEmployeeSearchQuery("");
              }}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white text-left flex items-center justify-between text-slate-500 hover:border-slate-300 transition cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Pilih atau ketik nama karyawan / NIK...</span>
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          )}

          {/* Dropdown with Search Filter */}
          {isEmployeePickerOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
              <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={employeeSearchQuery}
                    onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                    placeholder="Ketik nama karyawan atau NIK..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 p-1">
                {/* Option to clear link */}
                <button
                  type="button"
                  onClick={() => handleSelectEmployee(null)}
                  className={`w-full px-3 py-2 text-left text-xs rounded-lg transition flex items-center justify-between cursor-pointer ${
                    !employeeId
                      ? "bg-slate-100 text-slate-900 font-bold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserX className="w-3.5 h-3.5 text-slate-400" />
                    <div>
                      <p className="font-semibold text-slate-800">
                        Tanpa Tautan Karyawan (Akun Sistem / Mandiri)
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Akun independen tanpa integrasi presensi mobile
                      </p>
                    </div>
                  </div>
                  {!employeeId && <Check className="w-4 h-4 text-emerald-600" />}
                </button>

                {/* Filtered employee list */}
                {filteredEmployees.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Tidak ada karyawan yang cocok dengan "{employeeSearchQuery}"
                  </div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected = emp.id === employeeId;
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => handleSelectEmployee(emp)}
                        className={`w-full px-3 py-2 text-left text-xs rounded-lg transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-emerald-50 text-emerald-900 font-bold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                              isSelected
                                ? "bg-emerald-200 text-emerald-900"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {emp.fullName?.[0]?.toUpperCase() || "K"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">
                              {emp.fullName}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate font-mono">
                              NIK: {emp.employeeCode}{" "}
                              {emp.departmentName ? `• ${emp.departmentName}` : ""}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-1">
            Menghubungkan akun login dengan profil karyawan untuk presensi mobile mandiri.
          </p>
        </div>

        {/* Username */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Username <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="contoh: budi.santoso"
            className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Digunakan sebagai ID login untuk masuk ke aplikasi.
          </p>
        </div>

        {/* Automatic Temporary Password Info (only on create) */}
        {!isEdit && (
          <div className="p-3 bg-red-50/70 border border-red-200/80 rounded-xl text-red-900 text-xs flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-semibold text-red-800">
                Temporary Password Otomatis:
              </span>{" "}
              Sistem akan otomatis membuatkan password temporary acak yang aman (huruf, angka & simbol). Password tersebut akan ditampilkan setelah akun dibuat untuk disalin.
            </div>
          </div>
        )}

        {/* Role Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Role Assignment <span className="text-red-500">*</span>
          </label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(Number(e.target.value))}
            className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code}) {r.isSystem ? "• System" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Status Akun
          </label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
              <input
                type="radio"
                name="user-status"
                value="active"
                checked={status === "active"}
                onChange={() => setStatus("active")}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              Aktif
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
              <input
                type="radio"
                name="user-status"
                value="inactive"
                checked={status === "inactive"}
                onChange={() => setStatus("inactive")}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              Nonaktif
            </label>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
