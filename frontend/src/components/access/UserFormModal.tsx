'use client';

import React, { useState, useEffect, useMemo, useRef } from "react";
import ModalShell from "@/components/ui/ModalShell";
import {useOrganizationScope} from '@/context/OrganizationScopeContext';
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
  Shield,
} from "lucide-react";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: UserFormData) => Promise<void>;
  roles: RoleItem[];
  employees?: any[];
  initialData?: UserItem | null;
  isLoading?: boolean;
  isHrd?: boolean;
}

export default function UserFormModal({
  isOpen,
  onClose,
  onSubmit,
  roles,
  employees = [],
  initialData = null,
  isLoading = false,
  isHrd = false,
}: UserFormModalProps) {
  const isEdit = Boolean(initialData);
  const {availableGroups,selectedGroupId}=useOrganizationScope();
  const [groupIds,setGroupIds]=useState<number[]>(initialData?.groupIds??(selectedGroupId===null?[]:[selectedGroupId]));

  const defaultEmployeeRole = useMemo(() => {
    return (
      roles.find(
        (r) => r.code === "employee" || r.name.toLowerCase() === "employee"
      ) || roles[0]
    );
  }, [roles]);

  const availableRoles = useMemo(() => {
    if (isHrd && defaultEmployeeRole) {
      return [defaultEmployeeRole];
    }
    return roles;
  }, [isHrd, defaultEmployeeRole, roles]);

  const [username, setUsername] = useState("");
  const [roleId, setRoleId] = useState<number>(defaultEmployeeRole?.id || 1);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [error, setError] = useState<string | null>(null);

  // Employee picker state with searchable filter
  const [isEmployeePickerOpen, setIsEmployeePickerOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialData) {
      setGroupIds(initialData.groupIds??[]);
      setUsername(initialData.username);
      setRoleId(initialData.roleId || defaultEmployeeRole?.id || roles[0]?.id || 1);
      setEmployeeId(initialData.employeeId || null);
      setStatus(initialData.status);
    } else {
      setGroupIds(selectedGroupId===null?[]:[selectedGroupId]);
      setUsername("");
      setRoleId(defaultEmployeeRole?.id || roles[0]?.id || 1);
      setEmployeeId(null);
      setStatus("active");
    }
    setError(null);
    setIsEmployeePickerOpen(false);
    setEmployeeSearchQuery("");
  }, [initialData, roles, defaultEmployeeRole, isOpen,selectedGroupId]);

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

    // Auto-fill clean username if blank
    if (!username.trim()) {
      const autoUser = (emp.fullName || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ".")
        .replace(/\.+/g, ".")
        .replace(/^\.|\.$/g, "");
      setUsername(autoUser);
    }

    // Default to Employee role on create
    if (!isEdit && defaultEmployeeRole) {
      setRoleId(defaultEmployeeRole.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("Username wajib ditentukan");
      return;
    }

    try {
      await onSubmit({
        username: username.trim(),
        roleId: Number(roleId),
        employeeId: employeeId ? Number(employeeId) : null,
        status,
        groupIds,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || (isEdit ? "Gagal memperbarui user" : "Gagal membuat user"));
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Pengguna" : "Registrasi Pengguna Baru"}
      subtitle={
        isEdit
          ? "Perbarui konfigurasi akun dan profil karyawan"
          : "Daftarkan akun login baru yang terintegrasi dengan data master karyawan"
      }
      icon={
        isEdit ? (
          <UserCog className="w-5 h-5 text-emerald-600" />
        ) : (
          <UserPlus className="w-5 h-5 text-emerald-600" />
        )
      }
      maxWidthClass="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isEdit ? "Simpan Perubahan" : "Daftarkan Pengguna"}</span>
          </button>
        </div>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-700">Cakupan akun</legend>
          {availableGroups.map(group=><label key={group.id} className="flex items-center gap-2 text-xs text-slate-800">
            <input type="checkbox" checked={groupIds.includes(group.id)} onChange={event=>setGroupIds(ids=>event.target.checked?[...ids,group.id]:ids.filter(id=>id!==group.id))} className="h-4 w-4 accent-emerald-700" />{group.code}
          </label>)}
          <p className="text-xs text-slate-600">Keanggotaan kelompok tidak menambah permission peran.</p>
        </fieldset>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* 1. Pilih Profil Karyawan (Master Data) */}
        <div ref={pickerRef} className="relative">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Data Karyawan (Master Data){" "}
            <span className="text-slate-400 font-normal">(Rekomendasi)</span>
          </label>

          <button
            type="button"
            onClick={() => setIsEmployeePickerOpen((prev) => !prev)}
            className="w-full px-3.5 py-2.5 text-xs text-left bg-white border border-slate-200 rounded-xl hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition flex items-center justify-between cursor-pointer"
          >
            {selectedEmployee ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                  {selectedEmployee.fullName?.[0]?.toUpperCase() || "K"}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {selectedEmployee.fullName}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate font-mono">
                    NIK: {selectedEmployee.employeeCode}{" "}
                    {selectedEmployee.departmentName
                      ? `• ${selectedEmployee.departmentName}`
                      : ""}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <Search className="w-3.5 h-3.5" />
                <span>Pilih karyawan dari master data...</span>
              </div>
            )}
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          </button>

          {/* Autocomplete Dropdown Panel */}
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
                {/* Opsi tanpa tautan karyawan (khusus akun sistem jika admin) */}
                {!isHrd && (
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
                          Tanpa Tautan Karyawan (Akun Sistem Mandiri)
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Akun independen tanpa integrasi master data
                        </p>
                      </div>
                    </div>
                    {!employeeId && <Check className="w-4 h-4 text-emerald-600" />}
                  </button>
                )}

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

        {/* 2. Menentukan Username */}
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

        {/* Info Temporary Password Otomatis */}
        {!isEdit && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-emerald-950 text-xs flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-semibold text-emerald-900">
                Temporary Password Otomatis:
              </span>{" "}
              Sistem akan otomatis membuatkan password temporary acak yang aman. Password akan ditampilkan setelah akun dibuat untuk disalin.
            </div>
          </div>
        )}

        {/* 3. Role Assignment (Default: Employee) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
            <span>
              Peran Akun (Role) <span className="text-red-500">*</span>
            </span>
            {isHrd && (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium flex items-center gap-1 border border-emerald-200">
                <Shield className="w-3 h-3" />
                Khusus Karyawan
              </span>
            )}
          </label>
          <select
            value={roleId}
            disabled={isHrd}
            onChange={(e) => setRoleId(Number(e.target.value))}
            className={`w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white ${
              isHrd ? "opacity-90 bg-slate-50 cursor-not-allowed" : ""
            }`}
          >
            {availableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code}) {r.isSystem ? "• System" : ""}
              </option>
            ))}
          </select>
          {isHrd ? (
            <p className="text-[10px] text-slate-400 mt-1">
              Sebagai HRD, Anda hanya berwenang mendaftarkan dan mengelola akun dengan role Employee.
            </p>
          ) : (
            <p className="text-[10px] text-slate-400 mt-1">
              Default peran untuk pengguna reguler adalah Employee.
            </p>
          )}
        </div>

        {/* 4. Status Akun (Default: Active) */}
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
              Aktif (Active)
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
              Nonaktif (Inactive)
            </label>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
