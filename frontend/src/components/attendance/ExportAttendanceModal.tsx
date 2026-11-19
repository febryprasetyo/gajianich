'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Download,
  Building2,
  Users,
  Search,
  CheckSquare,
  Square,
  ChevronDown,
  Check,
  Calendar,
  X,
} from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import type { EmployeeReport, RecordFilter, MasterItem } from '@/lib/attendance/types';
import { dateLabel } from '@/lib/attendance/domain';

interface ExportAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: MasterItem[];
  reports: EmployeeReport[];
  filter: RecordFilter;
  onExport: (selectedReports: EmployeeReport[]) => void;
}

export function ExportAttendanceModal({
  isOpen,
  onClose,
  departments,
  reports,
  filter,
  onExport,
}: ExportAttendanceModalProps) {
  // Department filter state (set of dept IDs selected for filtering employee list)
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<number>>(() => {
    return new Set(departments.map(d => d.id));
  });

  // Employee selection state (set of employee IDs selected for export)
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<number>>(() => {
    return new Set(reports.map(r => r.employee.id));
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [deptSearchQuery, setDeptSearchQuery] = useState('');
  const deptDropdownRef = useRef<HTMLDivElement>(null);

  // Sync state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedDeptIds(new Set(departments.map(d => d.id)));
      setSelectedEmpIds(new Set(reports.map(r => r.employee.id)));
      setSearchQuery('');
      setDeptSearchQuery('');
      setIsDeptDropdownOpen(false);
    }
  }, [isOpen, departments, reports]);

  // Click outside listener for department dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setIsDeptDropdownOpen(false);
      }
    }
    if (isDeptDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDeptDropdownOpen]);

  // Count employees per department
  const deptCountMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of reports) {
      const deptId = r.employee.departmentId || 0;
      map.set(deptId, (map.get(deptId) || 0) + 1);
    }
    return map;
  }, [reports]);

  // Filtered departments based on dropdown search
  const filteredDepartments = useMemo(() => {
    if (!deptSearchQuery.trim()) return departments;
    const q = deptSearchQuery.toLowerCase();
    return departments.filter(d => d.name.toLowerCase().includes(q));
  }, [departments, deptSearchQuery]);

  // Filtered reports matching department selection and search query
  const visibleReports = useMemo(() => {
    return reports.filter(r => {
      const deptId = r.employee.departmentId || 0;
      // If employee has a dept that is not selected, hide
      if (r.employee.departmentId && !selectedDeptIds.has(deptId)) {
        return false;
      }
      // If department filter has no selections at all, hide
      if (selectedDeptIds.size === 0) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = r.employee.fullName.toLowerCase();
      const code = (r.employee.employeeCode || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [reports, selectedDeptIds, searchQuery]);

  // Toggle single department
  const toggleDepartment = (deptId: number) => {
    setSelectedDeptIds(prev => {
      const next = new Set(prev);
      const isRemoving = next.has(deptId);
      if (isRemoving) {
        next.delete(deptId);
        // Also unselect all employees belonging to this department
        setSelectedEmpIds(empPrev => {
          const empNext = new Set(empPrev);
          for (const r of reports) {
            if (r.employee.departmentId === deptId) {
              empNext.delete(r.employee.id);
            }
          }
          return empNext;
        });
      } else {
        next.add(deptId);
        // Also select all employees belonging to this department
        setSelectedEmpIds(empPrev => {
          const empNext = new Set(empPrev);
          for (const r of reports) {
            if (r.employee.departmentId === deptId) {
              empNext.add(r.employee.id);
            }
          }
          return empNext;
        });
      }
      return next;
    });
  };

  const selectAllDepartments = () => {
    setSelectedDeptIds(new Set(departments.map(d => d.id)));
    setSelectedEmpIds(new Set(reports.map(r => r.employee.id)));
  };

  const deselectAllDepartments = () => {
    setSelectedDeptIds(new Set());
    setSelectedEmpIds(new Set());
  };

  // Toggle single employee
  const toggleEmployee = (empId: number) => {
    setSelectedEmpIds(prev => {
      const next = new Set(prev);
      if (next.has(empId)) {
        next.delete(empId);
      } else {
        next.add(empId);
      }
      return next;
    });
  };

  const selectAllVisibleEmployees = () => {
    setSelectedEmpIds(prev => {
      const next = new Set(prev);
      for (const r of visibleReports) {
        next.add(r.employee.id);
      }
      return next;
    });
  };

  const deselectAllVisibleEmployees = () => {
    setSelectedEmpIds(prev => {
      const next = new Set(prev);
      for (const r of visibleReports) {
        next.delete(r.employee.id);
      }
      return next;
    });
  };

  const handleExport = () => {
    const selected = reports.filter(r => selectedEmpIds.has(r.employee.id));
    if (!selected.length) return;
    onExport(selected);
    onClose();
  };

  const selectedCount = selectedEmpIds.size;
  const totalCount = reports.length;
  const allDeptsSelected = selectedDeptIds.size === departments.length;

  const deptButtonLabel = useMemo(() => {
    if (selectedDeptIds.size === 0) return '0 Divisi Dipilih';
    if (allDeptsSelected) return `Semua Divisi (${departments.length})`;
    return `${selectedDeptIds.size} dari ${departments.length} Divisi`;
  }, [selectedDeptIds.size, allDeptsSelected, departments.length]);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Ekspor Laporan Rekap Absensi"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-800 tabular-nums">{selectedCount}</span> dari {totalCount} karyawan dipilih
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download size={14} />
              <span>Unduh Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3.5 text-xs">
        {/* Info Banner: Periode Cut-Off */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs">
              <Calendar size={14} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Siklus Periode Rekap</span>
              <span className="text-xs font-semibold text-slate-900">
                {dateLabel(filter.startDate)} – {dateLabel(filter.endDate)}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
            Cut-Off 21 – 20
          </span>
        </div>

        {/* Filter Controls Row: Dropdown Divisi + Search + Bulk Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dropdown Multi-Select Divisi */}
          <div className="relative shrink-0" ref={deptDropdownRef}>
            <button
              type="button"
              onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
              className="inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer min-w-[170px]"
              aria-haspopup="true"
              aria-expanded={isDeptDropdownOpen}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Building2 size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{deptButtonLabel}</span>
              </div>
              <ChevronDown
                size={13}
                className="text-slate-400 shrink-0 transition-transform duration-150"
                style={{ transform: isDeptDropdownOpen ? 'rotate(180deg)' : 'none' }}
              />
            </button>

            {isDeptDropdownOpen && (
              <div className="absolute left-0 mt-1.5 z-50 w-72 rounded-xl bg-white border border-slate-200 shadow-xl p-2.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="font-semibold text-slate-800 text-[11px]">Filter Berdasarkan Divisi</span>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={selectAllDepartments}
                      className="text-emerald-600 hover:underline font-medium cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={deselectAllDepartments}
                      className="text-slate-500 hover:underline font-medium cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {departments.length > 5 && (
                  <div className="relative mb-2">
                    <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari divisi..."
                      value={deptSearchQuery}
                      onChange={e => setDeptSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-1 text-[11px] rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
                  {filteredDepartments.map(d => {
                    const isSelected = selectedDeptIds.has(d.id);
                    const count = deptCountMap.get(d.id) || 0;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDepartment(d.id)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected ? 'bg-emerald-50/70 text-emerald-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                          <span className="truncate">{d.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono ml-2 tabular-nums">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Search Karyawan */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama atau NIP karyawan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Hapus pencarian"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Bulk Select Toggles */}
          <div className="flex items-center gap-1.5 shrink-0 text-[11px] ml-auto">
            <button
              type="button"
              onClick={selectAllVisibleEmployees}
              className="px-2 py-1 rounded-md text-emerald-600 hover:bg-emerald-50 font-medium transition-colors cursor-pointer"
            >
              Pilih Semua
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={deselectAllVisibleEmployees}
              className="px-2 py-1 rounded-md text-slate-600 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
            >
              Batalkan
            </button>
          </div>
        </div>

        {/* Scrollable Employee Selection Table / List */}
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {visibleReports.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-1">
                <Users size={24} className="mx-auto text-slate-300" />
                <p className="font-medium text-xs text-slate-600">Tidak ada karyawan yang sesuai</p>
                <p className="text-[11px] text-slate-400">Silakan sesuaikan pilihan divisi atau kata kunci pencarian</p>
              </div>
            ) : (
              visibleReports.map(r => {
                const isSelected = selectedEmpIds.has(r.employee.id);
                const deptName = departments.find(d => d.id === r.employee.departmentId)?.name || 'Tanpa Divisi';

                return (
                  <div
                    key={r.employee.id}
                    onClick={() => toggleEmployee(r.employee.id)}
                    className={`flex items-center justify-between px-3 py-2 hover:bg-slate-50/80 transition-colors cursor-pointer select-none ${
                      isSelected ? 'bg-emerald-50/25' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="shrink-0 text-emerald-600">
                        {isSelected ? (
                          <CheckSquare size={16} className="text-emerald-600 fill-emerald-50" />
                        ) : (
                          <Square size={16} className="text-slate-300 hover:text-slate-400" />
                        )}
                      </div>

                      {/* Avatar initial circle */}
                      <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                        {r.employee.fullName.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 truncate text-xs">
                            {r.employee.fullName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {r.employee.employeeCode || '—'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {deptName}
                        </span>
                      </div>
                    </div>

                    {/* Quick stats pills */}
                    <div className="flex items-center gap-1 shrink-0 text-[10px] tabular-nums">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                        Hadir {r.recordCount}
                      </span>
                      {r.lateMinutes > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
                          Terlambat {r.lateMinutes}m
                        </span>
                      )}
                      {(r.izinCount || 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-medium">
                          Izin {r.izinCount}
                        </span>
                      )}
                      {(r.sakitCount || 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-medium">
                          Sakit {r.sakitCount}
                        </span>
                      )}
                      {(r.cutiCount || 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-medium">
                          Cuti {r.cutiCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Export Details Footnote */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>Format: Microsoft Excel (.xlsx) dengan Sheet Rekap Absensi</span>
          <span>Kompatibel: Excel, Google Sheets, LibreOffice</span>
        </div>
      </div>
    </ModalShell>
  );
}
