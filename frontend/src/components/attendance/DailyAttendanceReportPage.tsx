'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import KpiGrid, { KpiCardItem } from '@/components/ui/KpiGrid';
import FilterToolbar from '@/components/ui/FilterToolbar';
import TableShell from '@/components/ui/TableShell';
import DepartmentRosterModal from './DepartmentRosterModal';
import { DailyAttendancePrintDocument } from './DailyAttendancePrintDocument';
import { exportDailyAttendanceToExcel } from '@/lib/attendance/dailyReportExport';
import type {
  DailyAttendanceReportData,
  DailyAttendanceEmployeeRow,
} from '@/types/dailyAttendance';
import {
  Printer,
  Download,
  Calendar,
  Users,
  UserCheck,
  Clock,
  UserX,
  Sparkles,
  Edit2,
  Check,
  X,
  Building,
  ListOrdered,
} from 'lucide-react';

export default function DailyAttendanceReportPage() {
  const getTodayJakarta = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  };

  const [workDate, setWorkDate] = useState<string>(getTodayJakarta());
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  // Start with null until initial department resolution completes to avoid race conditions
  const [selectedDeptId, setSelectedDeptId] = useState<number | 'ALL' | null>(null);
  const [deptInitialized, setDeptInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeKpiFilter, setActiveKpiFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT'>('ALL');
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);

  const [reportData, setReportData] = useState<DailyAttendanceReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline note editing state
  const [editingRow, setEditingRow] = useState<{ employeeId: number; text: string } | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);

  // 1. Load departments and default to MARKETING if available
  useEffect(() => {
    let active = true;
    async function loadDepts() {
      try {
        const res = await api.get<{ id: number; name: string }[]>('/master/departments');
        const list = Array.isArray(res) ? res : [];
        if (!active) return;
        setDepartments(list);

        const mkt = list.find((d) => d.name.toUpperCase().includes('MARKETING'));
        if (mkt) {
          setSelectedDeptId(mkt.id);
        } else if (list.length > 0) {
          setSelectedDeptId(list[0].id);
        } else {
          // Fallback to Marketing department id 6
          setSelectedDeptId(6);
        }
      } catch (err) {
        console.error('Failed to load departments:', err);
        if (active) {
          setSelectedDeptId(6);
        }
      } finally {
        if (active) {
          setDeptInitialized(true);
        }
      }
    }
    void loadDepts();
    return () => {
      active = false;
    };
  }, []);

  // 2. Fetch daily report from backend
  const fetchReport = useCallback(async () => {
    if (!workDate || selectedDeptId === null) return;
    setLoading(true);
    setError(null);
    try {
      const deptParam = selectedDeptId === 'ALL' ? '' : `&departmentId=${selectedDeptId}`;
      const res = await api.get<{ success: boolean; data: DailyAttendanceReportData }>(
        `/attendance/daily-report?date=${workDate}${deptParam}`
      );
      setReportData(res.data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat laporan absensi harian');
    } finally {
      setLoading(false);
    }
  }, [workDate, selectedDeptId]);

  useEffect(() => {
    if (deptInitialized && selectedDeptId !== null) {
      void fetchReport();
    }
  }, [deptInitialized, selectedDeptId, fetchReport]);

  // Selected department label
  const selectedDepartmentName = useMemo(() => {
    if (selectedDeptId === 'ALL') return 'Semua Departemen (Gabungan)';
    const dept = departments.find((d) => d.id === selectedDeptId);
    if (dept) return dept.name;
    if (selectedDeptId === 6) return 'MARKETING';
    return 'Departemen';
  }, [selectedDeptId, departments]);

  // Toggle yellow highlight on employee
  const handleToggleHighlight = async (emp: DailyAttendanceEmployeeRow) => {
    if (!reportData) return;
    const newHighlight = !emp.isHighlighted;

    // Optimistic UI update
    setReportData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        departments: prev.departments.map((dept) => ({
          ...dept,
          employees: dept.employees.map((e) =>
            e.employeeId === emp.employeeId ? { ...e, isHighlighted: newHighlight } : e
          ),
        })),
      };
    });

    try {
      await api.post('/attendance/daily-report/note', {
        workDate,
        employeeId: emp.employeeId,
        isHighlighted: newHighlight,
      });
    } catch {
      fetchReport();
    }
  };

  // Save manual note/keterangan
  const handleSaveNote = async (employeeId: number, newNote: string) => {
    setSavingNoteId(employeeId);
    try {
      await api.post('/attendance/daily-report/note', {
        workDate,
        employeeId,
        manualNote: newNote,
      });

      setReportData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          departments: prev.departments.map((dept) => ({
            ...dept,
            employees: dept.employees.map((e) =>
              e.employeeId === employeeId ? { ...e, keterangan: newNote.trim() } : e
            ),
          })),
        };
      });
      setEditingRow(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan catatan');
    } finally {
      setSavingNoteId(null);
    }
  };

  // KPI cards
  const kpiItems = useMemo<KpiCardItem<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT'>[]>(() => {
    const s = reportData?.summary || { totalEmployees: 0, present: 0, late: 0, absent: 0 };
    return [
      {
        id: 'ALL',
        title: 'Total Karyawan',
        value: s.totalEmployees,
        icon: Users,
        iconColor: 'text-slate-600',
        bgColor: 'bg-slate-50',
        helper: 'Seluruh staf pada filter',
      },
      {
        id: 'PRESENT',
        title: 'Hadir',
        value: s.present,
        icon: UserCheck,
        iconColor: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        helper: 'Presensi tercatat',
      },
      {
        id: 'LATE',
        title: 'Terlambat',
        value: s.late,
        icon: Clock,
        iconColor: 'text-amber-600',
        bgColor: 'bg-amber-50',
        helper: 'Scan melewati jam shift',
      },
      {
        id: 'ABSENT',
        title: 'Tidak Hadir / Izin',
        value: s.absent,
        icon: UserX,
        iconColor: 'text-rose-600',
        bgColor: 'bg-rose-50',
        helper: 'Tanpa scan / sakit / cuti',
      },
    ];
  }, [reportData?.summary]);

  // Flattened employees into a SINGLE unified list
  const unifiedEmployees = useMemo(() => {
    if (!reportData) return [];

    const all = reportData.departments.flatMap((dept) =>
      dept.employees.map((emp) => ({
        ...emp,
        departmentName: dept.departmentName,
      }))
    );

    const filtered = all.filter((emp) => {
      // Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = emp.employeeName.toLowerCase().includes(q);
        const matchLoc = emp.locationUpdate.toLowerCase().includes(q);
        const matchKet = emp.keterangan.toLowerCase().includes(q);
        const matchDept = emp.departmentName.toLowerCase().includes(q);
        if (!matchName && !matchLoc && !matchKet && !matchDept) return false;
      }

      // KPI Card filter match
      if (activeKpiFilter === 'PRESENT') return Boolean(emp.scanIn);
      if (activeKpiFilter === 'LATE') return emp.isLate;
      if (activeKpiFilter === 'ABSENT') return !emp.scanIn;
      return true;
    });

    // Re-index row numbers continuously
    return filtered.map((emp, idx) => ({
      ...emp,
      no: idx + 1,
    }));
  }, [reportData, searchQuery, activeKpiFilter]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (reportData) {
      exportDailyAttendanceToExcel(reportData, selectedDepartmentName);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header (Hidden during print) */}
      <div className="no-print">
        <PageHeader
          title="Laporan Absensi Harian"
          subtitle="Rekapitulasi kehadiran harian per departemen dengan format landscape siap cetak"
          icon={Printer}
          actions={
            <div className="flex items-center gap-2">
              {selectedDeptId !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setIsRosterModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  title={`Atur urutan dan susunan tim ${selectedDepartmentName}`}
                >
                  <ListOrdered className="w-4 h-4 text-amber-700" />
                  Atur Susunan Tim
                </button>
              )}
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={!reportData || loading}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-slate-500" />
                Export Excel
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={!reportData || loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                Cetak Landscape
              </button>
            </div>
          }
        />
      </div>

      {/* 2. Interactive KPI Cards (Hidden during print) */}
      <div className="no-print">
        <KpiGrid
          items={kpiItems}
          loading={loading}
          activeFilter={activeKpiFilter}
          onSelectFilter={(id) => setActiveKpiFilter(id)}
        />
      </div>

      {/* 3. Filter Toolbar Rapi & Proporsional (Hidden during print) */}
      <div className="no-print">
        <FilterToolbar
          search={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Cari nama karyawan, departemen, atau lokasi..."
          dropdownFilters={
            <>
              {/* Filter 1: Tanggal */}
              <label className="space-y-1 text-xs text-slate-600 block">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Tanggal Presensi
                </span>
                <input
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                />
              </label>

              {/* Filter 2: Departemen */}
              <label className="space-y-1 text-xs text-slate-600 block">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-emerald-600" />
                  Departemen
                </span>
                <select
                  value={selectedDeptId ?? ''}
                  onChange={(e) =>
                    setSelectedDeptId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ALL">Semua Departemen (Gabungan)</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                  {!departments.some((d) => d.id === 6 || d.name.toUpperCase().includes('MARKETING')) && (
                    <option value={6}>MARKETING</option>
                  )}
                </select>
              </label>
            </>
          }
          hasActiveFilters={
            (selectedDeptId !== null &&
              selectedDeptId !==
                (departments.find((d) => d.name.toUpperCase().includes('MARKETING'))?.id || 6)) ||
            activeKpiFilter !== 'ALL' ||
            Boolean(searchQuery)
          }
          onResetFilters={() => {
            const mkt = departments.find((d) => d.name.toUpperCase().includes('MARKETING'));
            setSelectedDeptId(mkt ? mkt.id : 6);
            setActiveKpiFilter('ALL');
            setSearchQuery('');
          }}
        />
      </div>

      {/* 4. Satu Tabel Tunggal Baku (Hidden during print) */}
      <div className="no-print">
        <TableShell
          loading={loading}
          error={error}
          isEmpty={unifiedEmployees.length === 0}
          emptyTitle="Tidak Ada Data Presensi"
          emptyDescription={`Tidak ditemukan data presensi pada tanggal ${reportData?.formattedDate || workDate} untuk filter yang dipilih.`}
          onRetry={fetchReport}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
                  <th className="py-3 px-3 w-12 text-center border-r border-slate-200">No</th>
                  <th className="py-3 px-4 w-72 border-r border-slate-200">
                    {selectedDeptId !== 'ALL' ? selectedDepartmentName.toUpperCase() : 'NAMA KARYAWAN'}
                  </th>
                  <th className="py-3 px-4 w-64 border-r border-slate-200">Lokasi Update</th>
                  <th className="py-3 px-3 w-32 text-center border-r border-slate-200">Jam Masuk</th>
                  <th className="py-3 px-4 border-r border-slate-200">Keterangan</th>
                  <th className="py-3 px-3 w-20 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unifiedEmployees.map((row) => {
                  const isEditingThis = editingRow?.employeeId === row.employeeId;

                  return (
                    <tr
                      key={row.employeeId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        row.isHighlighted ? 'bg-amber-50/80 font-semibold' : ''
                      }`}
                    >
                      {/* Kolom 1: No */}
                      <td className="py-2.5 px-3 text-center text-slate-500 font-medium border-r border-slate-100">
                        {row.no}
                      </td>

                      {/* Kolom 2: Nama Karyawan (Stabilo Kuning jika Koordinator/Direktur/Manual) */}
                      <td className="py-2.5 px-4 border-r border-slate-100">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className={row.isHighlighted ? 'text-amber-950 font-bold' : 'text-slate-900'}>
                              {row.employeeName}
                            </span>
                            {row.isHighlighted && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                                Highlight
                              </span>
                            )}
                          </div>
                          {selectedDeptId === 'ALL' && (
                            <span className="text-[10px] text-slate-500 font-normal">
                              {row.departmentName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Kolom 3: Lokasi Update */}
                      <td className="py-2.5 px-4 text-slate-700 border-r border-slate-100">
                        {row.locationUpdate ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-800">
                            {row.locationUpdate}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Kolom 4: Jam Masuk (Merah Muda jika Terlambat) */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-100">
                        {row.scanIn ? (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded font-mono font-bold text-xs ${
                              row.isLate
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {row.scanIn}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </td>

                      {/* Kolom 5: Keterangan (Inline Edit) */}
                      <td className="py-2.5 px-4 border-r border-slate-100">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingRow.text}
                              onChange={(e) =>
                                setEditingRow({ employeeId: row.employeeId, text: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveNote(row.employeeId, editingRow.text);
                                } else if (e.key === 'Escape') {
                                  setEditingRow(null);
                                }
                              }}
                              autoFocus
                              placeholder="Ketik keterangan memo..."
                              className="w-full bg-white border border-emerald-500 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none shadow-xs"
                            />
                            <button
                              type="button"
                              disabled={savingNoteId === row.employeeId}
                              onClick={() => handleSaveNote(row.employeeId, editingRow.text)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                              title="Simpan"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRow(null)}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg cursor-pointer"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() =>
                              setEditingRow({ employeeId: row.employeeId, text: row.keterangan })
                            }
                            className="group flex items-center justify-between gap-2 p-1 rounded hover:bg-white hover:border hover:border-slate-200 cursor-pointer transition-colors"
                            title="Klik untuk edit keterangan"
                          >
                            <span
                              className={`text-xs ${
                                row.keterangan === 'TDK ADA ABSEN'
                                  ? 'text-rose-600 font-semibold'
                                  : row.keterangan
                                  ? 'text-slate-800 font-medium'
                                  : 'text-slate-400 italic'
                              }`}
                            >
                              {row.keterangan || 'Klik untuk isi catatan...'}
                            </span>
                            <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        )}
                      </td>

                      {/* Kolom 6: Aksi (Toggle Highlight) */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleHighlight(row)}
                          title={row.isHighlighted ? 'Hapus stabilo kuning' : 'Beri stabilo kuning'}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            row.isHighlighted
                              ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'
                              : 'bg-white border-slate-200 text-slate-400 hover:text-amber-600 hover:bg-slate-50'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TableShell>
      </div>

      {/* 5. Pure Printable Document Section (Only visible during @media print) */}
      <div className="hidden print:block">
        {reportData && (
          <DailyAttendancePrintDocument
            data={reportData}
            departmentName={selectedDepartmentName}
          />
        )}
      </div>
      {/* 6. Modal Pengaturan Format Susunan Roster Departemen */}
      {selectedDeptId !== 'ALL' && (
        <DepartmentRosterModal
          isOpen={isRosterModalOpen}
          onClose={() => setIsRosterModalOpen(false)}
          departmentId={Number(selectedDeptId)}
          departmentName={selectedDepartmentName}
          onSaved={fetchReport}
        />
      )}
    </div>
  );
}
