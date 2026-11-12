'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Pencil,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { MasterLeaveBalanceItem } from '@/types/leaves';
import {
  getLeaveBalanceStatus,
  filterMasterLeaveBalances,
} from '@/lib/leaves/masterLeaveUtils';

interface MasterLeaveBalancesTableProps {
  balances: MasterLeaveBalanceItem[];
  isLoading?: boolean;
  onEditBalance: (balance: MasterLeaveBalanceItem) => void;
  year: number;
}

export default function MasterLeaveBalancesTable({
  balances,
  isLoading = false,
  onEditBalance,
  year,
}: MasterLeaveBalancesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SAFE' | 'WARNING' | 'EXHAUSTED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const departments = useMemo(() => {
    const set = new Set<string>();
    balances.forEach((b) => {
      if (b.department) set.add(b.department);
    });
    return Array.from(set).sort();
  }, [balances]);

  const filteredBalances = useMemo(() => {
    const list = filterMasterLeaveBalances(balances, {
      search: searchTerm,
      status: statusFilter,
    });
    if (departmentFilter === 'ALL') return list;
    return list.filter((b) => b.department === departmentFilter);
  }, [balances, searchTerm, departmentFilter, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, departmentFilter, statusFilter, pageSize]);

  const totalItems = filteredBalances.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedBalances = filteredBalances.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      {/* Search + Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama karyawan atau Employee ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Filter Departemen"
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-400 transition-all cursor-pointer"
          >
            <option value="ALL">Semua Departemen</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            aria-label="Filter Kondisi Saldo"
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-400 transition-all cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="SAFE">Saldo Aman (&ge; 4 Hari)</option>
            <option value="WARNING">Saldo Menipis (1 - 3 Hari)</option>
            <option value="EXHAUSTED">Saldo Habis (0 Hari)</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 ml-auto hidden sm:inline">
          Menampilkan <strong className="text-slate-900">{filteredBalances.length}</strong> dari {balances.length} karyawan
        </span>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center gap-3 text-slate-500 text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> Memuat data saldo cuti...
          </div>
        ) : filteredBalances.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-semibold text-sm">Tidak ada saldo karyawan ditemukan</p>
            <p className="text-xs text-slate-400 mt-1">Coba ubah filter atau sinkronkan kebijakan di Pengaturan Cuti.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider font-mono">
                  <th className="py-3.5 px-4">NIK</th>
                  <th className="py-3.5 px-4">Nama & Jabatan</th>
                  <th className="py-3.5 px-4">Departemen</th>
                  <th className="py-3.5 px-4 text-center">Hak Dasar</th>
                  <th className="py-3.5 px-4 text-center">Cuti Bersama</th>
                  <th className="py-3.5 px-4 text-center">Hak Bersih</th>
                  <th className="py-3.5 px-4 text-center">Terpakai</th>
                  <th className="py-3.5 px-4 text-center">Sisa Saldo</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedBalances.map((item) => {
                  const status = getLeaveBalanceStatus(item.remainingQuota);
                  return (
                    <tr key={item.employeeId} className="hover:bg-emerald-50/30 transition-colors group">
                      {/* NIK */}
                      <td className="py-3.5 px-4 font-mono">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[11px]">
                          {item.employeeCode}
                        </span>
                      </td>

                      {/* Nama & Jabatan */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {item.fullName}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.position || '—'}</p>
                      </td>

                      {/* Departemen */}
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-700">{item.department || '—'}</p>
                        {item.isAccumulationActive ? (
                          <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                            Akumulasi Cuti
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
                            Reset Tahunan
                          </span>
                        )}
                      </td>

                      {/* Hak Dasar */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                        {item.baseQuota} Hari
                        {item.isCustomQuota && (
                          <span className="block text-[10px] text-emerald-600 font-normal">Khusus</span>
                        )}
                      </td>

                      {/* Cuti Bersama */}
                      <td className="py-3.5 px-4 text-center font-semibold text-amber-600">
                        {item.collectiveLeaveDeduction} Hari
                      </td>

                      {/* Hak Bersih */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                        {item.cleanAnnualQuota} Hari
                      </td>

                      {/* Terpakai */}
                      <td className="py-3.5 px-4 text-center text-slate-600">
                        {item.usedQuota} Hari
                      </td>

                      {/* Sisa Saldo Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            status === 'SAFE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : status === 'WARNING'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              status === 'SAFE'
                                ? 'bg-emerald-500'
                                : status === 'WARNING'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                          />
                          {item.remainingQuota} Hari
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onEditBalance(item)}
                            className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all cursor-pointer"
                            title="Edit Saldo"
                          >
                            <Pencil className="w-4 h-4" />
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

        {/* Pagination Bar */}
        {!isLoading && totalItems > 0 && (
          <div className="p-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>Baris per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="py-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>
                (Menampilkan {startIndex + 1} - {endIndex} dari {totalItems})
              </span>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 py-1 text-xs font-bold text-slate-900">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
