'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import KpiGrid, { KpiCardItem } from '@/components/ui/KpiGrid';
import FilterToolbar from '@/components/ui/FilterToolbar';
import TableShell from '@/components/ui/TableShell';
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
  const [selectedDeptId, setSelectedDeptId] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeKpiFilter, setActiveKpiFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT'>('ALL');

  const [reportData, setReportData] = useState<DailyAttendanceReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline note editing state
  const [editingRow, setEditingRow] = useState<{ employeeId: number; text: string } | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);

  // 1. Load departments and default to MARKETING if available
  useEffect(() => {
    async function loadDepts() {
      try {
        const res = await api.get<{ id: number; name: string }[]>('/master/departments');
        const list = Array.isArray(res) ? res : [];
        setDepartments(list);

        const mkt = list.find((d) => d.name.toUpperCase().includes('MARKETING'));
        if (mkt) {
          setSelectedDeptId(mkt.id);
        }
      } catch {
        // Fallback gracefully
      }
    }
    void loadDepts();
  }, []);

  // 2. Fetch daily report from backend
  const fetchReport = useCallback(async () => {
    if (!workDate) return;
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
    void fetchReport();
  }, [fetchReport]);

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
    } catch (err: any) {
      // Revert if failed
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
        helper: 'Seluruh staf di departemen',
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

  // Filtered department groups based on search & KPI filter
  const filteredDepartments = useMemo(() => {
    if (!reportData) return [];

    return reportData.departments
      .map((dept) => {
        const filteredEmployees = dept.employees.filter((emp) => {
          // Search query match
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = emp.employeeName.toLowerCase().includes(q);
            const matchLoc = emp.locationUpdate.toLowerCase().includes(q);
            const matchKet = emp.keterangan.toLowerCase().includes(q);
            if (!matchName && !matchLoc && !matchKet) return false;
          }

          // KPI Card filter match
          if (activeKpiFilter === 'PRESENT') return Boolean(emp.scanIn);
          if (activeKpiFilter === 'LATE') return emp.isLate;
          if (activeKpiFilter === 'ABSENT') return !emp.scanIn;
          return true;
        });

        return {
          ...dept,
          employees: filteredEmployees,
        };
      })
      .filter((dept) => dept.employees.length > 0);
  }, [reportData, searchQuery, activeKpiFilter]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (reportData) {
      exportDailyAttendanceToExcel(reportData);
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

      {/* 3. Filter Toolbar (Hidden during print) */}
      <div className="no-print">
        <FilterToolbar
          search={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Cari nama karyawan atau lokasi..."
          dropdownFilters={
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Date Input */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-slate-500">Tanggal:</span>
                <input
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                />
              </div>

              {/* Department Dropdown */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700">
                <Building className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-slate-500">Departemen:</span>
                <select
                  value={selectedDeptId}
                  onChange={(e) =>
                    setSelectedDeptId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                  }
                  className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">Semua Departemen (Gabungan)</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          }
          hasActiveFilters={selectedDeptId !== 'ALL' || activeKpiFilter !== 'ALL' || Boolean(searchQuery)}
          onResetFilters={() => {
            setSelectedDeptId('ALL');
            setActiveKpiFilter('ALL');
            setSearchQuery('');
          }}
        />
      </div>

      {/* 4. Interactive Table Preview (Hidden during print) */}
      <div className="no-print">
        <TableShell
          loading={loading}
          error={error}
          isEmpty={filteredDepartments.length === 0}
          emptyTitle="Tidak Ada Data Presensi"
          emptyDescription={`Tidak ditemukan data presensi pada tanggal ${reportData?.formattedDate || workDate}.`}
          onRetry={fetchReport}
        >
          <div className="space-y-8 p-4">
            {filteredDepartments.map((dept) => (
              <div key={dept.departmentId} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h2 className="text-sm font-extrabold text-slate-900 tracking-wide uppercase flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full"></span>
                    {dept.departmentName}
                  </h2>
                  <span className="text-xs text-slate-500 font-medium">
                    {dept.employees.length} Karyawan
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 uppercase font-bold text-[11px] border-b border-slate-200">
                        <th className="py-2.5 px-3 w-12 text-center">No</th>
                        <th className="py-2.5 px-4 w-72">Nama Karyawan</th>
                        <th className="py-2.5 px-4 w-64">Lokasi Update</th>
                        <th className="py-2.5 px-3 w-32 text-center">Jam Masuk</th>
                        <th className="py-2.5 px-4">Keterangan</th>
                        <th className="py-2.5 px-3 w-20 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dept.employees.map((row) => {
                        const isEditingThis = editingRow?.employeeId === row.employeeId;

                        return (
                          <tr
                            key={row.employeeId}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              row.isHighlighted ? 'bg-amber-50/70 font-semibold' : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-center text-slate-500 font-medium">
                              {row.no}
                            </td>
                            <td className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                <span className={row.isHighlighted ? 'text-amber-950 font-bold' : 'text-slate-800'}>
                                  {row.employeeName}
                                </span>
                                {row.isHighlighted && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                                    Highlight
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-slate-700">
                              {row.locationUpdate ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-800">
                                  {row.locationUpdate}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {row.scanIn ? (
                                <span
                                  className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs ${
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
                            <td className="py-2 px-4">
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
                                    className="w-full bg-white border border-emerald-500 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-hidden shadow-xs"
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
                            <td className="py-2 px-3 text-center">
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
              </div>
            ))}
          </div>
        </TableShell>
      </div>

      {/* 5. Pure Printable Document Section (Only visible during @media print) */}
      <div className="hidden print:block">
        {reportData && <DailyAttendancePrintDocument data={reportData} />}
      </div>
    </div>
  );
}
