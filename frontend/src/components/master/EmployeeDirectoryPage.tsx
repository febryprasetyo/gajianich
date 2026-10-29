'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import EmployeeImportModal from '@/components/master/EmployeeImportModal';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import { api } from '@/lib/api';
import type { EmployeeItem, DepartmentOption, LocationOption } from '@/lib/employeeTypes';
import { filterEmployees } from '@/lib/employeeDirectory';
import {
  Users, Plus, Search, Building2, MapPin, UserCheck,
  Download, Upload, Loader2, Eye, Pencil, Trash2, Filter,
} from 'lucide-react';

interface Props {
  basePath?: string;
}

export default function EmployeeDirectoryPage({ basePath = '/dashboard/attendance/master/employees' }: Props) {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [deletingEmp, setDeletingEmp] = useState<EmployeeItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true); setError(null);
      const [empData, deptData, locData] = await Promise.all([
        api.get<EmployeeItem[]>('/employees'),
        api.get<DepartmentOption[]>('/master/departments'),
        api.get<LocationOption[]>('/master/locations'),
      ]);
      setEmployees(empData); setDepartments(deptData); setLocations(locData);
    } catch (err: unknown) {
      setError((err as Error).message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const blob = await api.download('/employees/export');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `karyawan-${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingEmp) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      await api.delete(`/employees/${deletingEmp.id}`);
      setDeletingEmp(null); fetchData();
    } catch (err: unknown) {
      setDeleteError((err as Error).message || 'Gagal menghapus karyawan');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = filterEmployees(employees, { tab, employeeIdQuery: search, departmentId: filterDept, archiveStatus: filterStatus as 'Inactive' | 'Resigned' | undefined });

  const activeCount = employees.filter(e => (e.status || '').toLowerCase() === 'active').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Users className="w-6 h-6 text-emerald-600" />
              <span>Data Karyawan</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">Direktori master data karyawan untuk proses absensi.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={handleExport} disabled={isExporting || employees.length === 0}
              className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-50 rounded-xl text-xs font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-emerald-600" />}
              Export Excel
            </button>
            <button onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer">
              <Upload className="w-4 h-4 text-emerald-600" /> Import Excel
            </button>
            <Link href={`${basePath}/new`}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
              <Plus className="w-4 h-4" /> Tambah Karyawan
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: <UserCheck className="w-5 h-5" />, label: 'Karyawan Aktif', value: activeCount, tone: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
            { icon: <Building2 className="w-5 h-5" />, label: 'Departemen', value: departments.length, tone: 'bg-amber-50 border-amber-100 text-amber-600' },
            { icon: <MapPin className="w-5 h-5" />, label: 'Lokasi', value: locations.length, tone: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-2xl flex items-center gap-4 bg-white border border-slate-200 shadow-sm`}>
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${s.tone}`}>{s.icon}</div>
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">{s.label}</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-b border-slate-200" role="tablist" aria-label="Status data karyawan">
          <button role="tab" aria-selected={tab === 'active'} onClick={() => { setTab('active'); setFilterStatus(''); }} className={`border-b-2 px-4 py-3 text-sm font-semibold cursor-pointer ${tab === 'active' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Karyawan Aktif</button>
          <button role="tab" aria-selected={tab === 'archive'} onClick={() => setTab('archive')} className={`border-b-2 px-4 py-3 text-sm font-semibold cursor-pointer ${tab === 'archive' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Nonaktif & Resign</button>
        </div>

        {/* Search + Filter */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center gap-3 shadow-sm">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama karyawan atau Employee ID..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-400 transition-all cursor-pointer">
              <option value="">Semua Departemen</option>
              {departments.map(d => <option key={d.id} value={String(d.id)}>{d.code} – {d.name}</option>)}
            </select>
            {tab === 'archive' && <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-400 transition-all cursor-pointer">
              <option value="">Semua Status</option>
              <option value="Inactive">Nonaktif</option>
              <option value="Resigned">Resign</option>
            </select>}
          </div>
          <span className="text-xs text-slate-500 ml-auto hidden sm:inline">
            Menampilkan <strong className="text-slate-900">{filtered.length}</strong> dari {employees.length} karyawan
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 flex items-center justify-center gap-3 text-slate-500 text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> Memuat data karyawan...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-semibold text-sm">Tidak ada karyawan ditemukan</p>
              <p className="text-xs text-slate-400 mt-1">Coba ubah filter atau tambah karyawan baru.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider font-mono">
                    <th className="py-3.5 px-4">NIK</th>
                    <th className="py-3.5 px-4">Nama & Jabatan</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Departemen</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(emp => {
                    const isActive = (emp.status || '').toLowerCase() === 'active';
                    return (
                      <tr key={emp.id} className="hover:bg-emerald-50/30 transition-colors group">
                        <td className="py-3.5 px-4 font-mono">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[11px]">
                            {emp.employeeCode}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">{emp.fullName}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{emp.position || emp.jobLevel || '—'}</p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-[11px]">{emp.email || '—'}</td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-slate-700">{emp.departmentName || '—'}</p>
                          <p className="text-[11px] text-slate-400">{emp.locationName || 'Lokasi belum diatur'}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {isActive ? 'Aktif' : emp.status === 'Resigned' ? 'Resign' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`${basePath}/${emp.id}`}
                              className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all" title="Lihat Detail">
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link href={`${basePath}/${emp.id}/edit`}
                              className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <button onClick={() => { setDeletingEmp(emp); setDeleteError(null); }}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer" title="Hapus">
                              <Trash2 className="w-4 h-4" />
                            </button>
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
      </div>

      <EmployeeImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onSuccess={fetchData} />
      <ConfirmDeleteModal
        isOpen={!!deletingEmp} onClose={() => { setDeletingEmp(null); setDeleteError(null); }}
        onConfirm={handleDelete} title="Hapus Karyawan"
        description="Data karyawan ini akan dihapus permanen hanya bila riwayat absensi dapat diverifikasi kosong."
        itemName={deletingEmp?.fullName}
        itemDetails={deletingEmp ? [
          { label: 'NIK', value: deletingEmp.employeeCode },
          { label: 'Email', value: deletingEmp.email },
          { label: 'Departemen', value: deletingEmp.departmentName || '—' },
        ] : []}
        confirmText="Hapus Karyawan" variant="danger" isLoading={isDeleting} error={deleteError}
      />
    </DashboardLayout>
  );
}
