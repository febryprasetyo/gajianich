'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  MasterLeaveBalanceItem,
  MasterLeaveBalancesResponse,
  UpdateLeaveBalancePayload,
} from '@/types/leaves';
import AnnualLeaveStatsCards from '@/components/leaves/AnnualLeaveStatsCards';
import MasterLeaveBalancesTable from '@/components/leaves/MasterLeaveBalancesTable';
import LeaveBalanceEditModal from '@/components/leaves/LeaveBalanceEditModal';

export default function LeaveBalancesPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [balances, setBalances] = useState<MasterLeaveBalanceItem[]>([]);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    averageRemainingDays: 0,
    totalUsedDays: 0,
    totalAllocatedQuota: 0,
  });

  const [editingBalance, setEditingBalance] = useState<MasterLeaveBalanceItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  const fetchBalancesAndStats = useCallback(async (year: number) => {
    setIsLoading(true);
    setPageError(null);
    try {
      const data = await api.get<MasterLeaveBalancesResponse>(`/leaves/master/balances?year=${year}`);
      if (data) {
        setBalances(data.balances || []);
        setStats({
          totalEmployees: data.totalEmployees || 0,
          averageRemainingDays: data.averageRemainingDays || 0,
          totalUsedDays: data.totalUsedDays || 0,
          totalAllocatedQuota: data.totalAllocatedQuota || 0,
        });
      }
    } catch (err: unknown) {
      console.error('Failed to load leave balances:', err);
      const msg = err instanceof Error ? err.message : 'Gagal memuat rekapitulasi saldo cuti.';
      setPageError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalancesAndStats(selectedYear);
  }, [selectedYear, fetchBalancesAndStats]);

  const handleOpenEditModal = (item: MasterLeaveBalanceItem) => {
    setEditingBalance(item);
    setIsEditModalOpen(true);
  };

  const handleSaveBalance = async (balanceId: number, payload: UpdateLeaveBalancePayload) => {
    try {
      const res = await api.put<{ success: boolean; message: string; balance: unknown }>(
        `/leaves/master/balances/${balanceId}`,
        payload
      );
      await fetchBalancesAndStats(selectedYear);
      setToastMessage({
        type: 'success',
        text: res.message || 'Saldo cuti karyawan berhasil diperbarui.',
      });
      return { success: true, message: res.message };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui saldo cuti.';
      return { success: false, message: msg };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Rekap Saldo Cuti
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Rekapitulasi kuota dan penggunaan cuti karyawan untuk proses operasional.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 shadow-sm">
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent font-bold outline-none cursor-pointer"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>
          </div>



          <Link
            href="/dashboard/leaves/new"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Ajukan Cuti
          </Link>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-medium ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 ml-2 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {pageError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <span>{pageError}</span>
        </div>
      )}

      {/* Stats Cards */}
      <AnnualLeaveStatsCards
        totalEmployees={stats.totalEmployees}
        averageRemainingDays={stats.averageRemainingDays}
        totalUsedDays={stats.totalUsedDays}
        totalAllocatedQuota={stats.totalAllocatedQuota}
        isLoading={isLoading}
      />

      {/* Master Leave Balances Table */}
      <MasterLeaveBalancesTable
        balances={balances}
        isLoading={isLoading}
        onEditBalance={handleOpenEditModal}
        year={selectedYear}
      />

      {/* Modal Edit Saldo */}
      <LeaveBalanceEditModal
        balance={editingBalance}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveBalance}
      />
    </div>
  );
}
