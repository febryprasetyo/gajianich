'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  AlertCircle,
  ShieldAlert,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { MasterLeaveBalanceItem, UpdateLeaveBalancePayload } from '@/types/leaves';
import {
  calculateCleanQuota,
  calculateTotalEntitlement,
  calculateRemainingQuota,
  getLeaveBalanceStatus,
} from '@/lib/leaves/masterLeaveUtils';

interface LeaveBalanceEditModalProps {
  balance: MasterLeaveBalanceItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (balanceId: number, payload: UpdateLeaveBalancePayload) => Promise<{ success: boolean; message?: string }>;
}

export default function LeaveBalanceEditModal({
  balance,
  isOpen,
  onClose,
  onSave,
}: LeaveBalanceEditModalProps) {
  const [baseQuota, setBaseQuota] = useState<number>(12);
  const [carriedOverQuota, setCarriedOverQuota] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (balance) {
      setBaseQuota(balance.baseQuota);
      setCarriedOverQuota(balance.carriedOverQuota ?? 0);
      setErrorMessage(null);
    }
  }, [balance]);

  if (!isOpen || !balance) return null;

  const targetId = balance.balanceId ?? balance.employeeId;
  const previewCleanQuota = calculateCleanQuota(baseQuota, balance.collectiveLeaveDeduction);
  const previewTotalEntitlement = calculateTotalEntitlement(previewCleanQuota, carriedOverQuota);
  const previewRemaining = calculateRemainingQuota(previewTotalEntitlement, balance.usedQuota);
  const previewStatus = getLeaveBalanceStatus(previewRemaining);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await onSave(targetId, {
        baseQuota,
        carriedOverQuota,
      });

      if (res.success) {
        onClose();
      } else {
        setErrorMessage(res.message || 'Gagal menyimpan penyesuaian saldo.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Penyesuaian Saldo Karyawan
            </h3>
            <p className="text-xs text-slate-500">
              Ubah hak dasar kuota cuti tahunan staf untuk tahun {balance.year}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Employee Summary Banner */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">
              {balance.fullName}
            </p>
            <p className="text-xs text-slate-500">
              {balance.employeeCode} • {balance.department} ({balance.position})
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
              Cuti Bersama
            </span>
            <span className="text-xs font-bold text-amber-600">
              {balance.collectiveLeaveDeduction} Hari
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl text-xs bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 font-mono">
                Hak Kuota Dasar Cuti
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={baseQuota}
                  onChange={(e) => setBaseQuota(Number(e.target.value))}
                  disabled={isSubmitting}
                  className="w-full pl-3.5 pr-14 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-semibold transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  required
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-slate-400 pointer-events-none">
                  Hari
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Default: 12 hari</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 font-mono">
                Sisa Cuti Tahun Lalu (Akumulasi)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={carriedOverQuota}
                  onChange={(e) => setCarriedOverQuota(Number(e.target.value))}
                  disabled={isSubmitting}
                  className="w-full pl-3.5 pr-14 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-semibold transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  required
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-slate-400 pointer-events-none">
                  Hari
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Saldo bawaan / carry over</p>
            </div>
          </div>

          {/* Pratinjau Kalkulasi Instan */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-950">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                Kalkulasi Pratinjau Saldo:
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  previewStatus === 'SAFE'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : previewStatus === 'WARNING'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                Status: {previewStatus === 'SAFE' ? 'Aman' : previewStatus === 'WARNING' ? 'Menipis' : 'Habis'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-emerald-200 text-center">
              <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-sm">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold font-mono">Hak Bersih</span>
                <span className="text-xs font-bold text-slate-800">{previewCleanQuota} Hari</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-sm">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold font-mono">Total Hak</span>
                <span className="text-xs font-bold text-slate-800">{previewTotalEntitlement} Hari</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-sm">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold font-mono">Sisa Saldo</span>
                <span className="text-xs font-bold text-emerald-700">{previewRemaining} Hari</span>
              </div>
            </div>
          </div>

          {/* Info proteksi custom */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <p>
              Penyesuaian manual akan menandai karyawan ini memiliki <strong>kuota khusus</strong>, sehingga tidak tertimpa saat sinkronisasi kebijakan cuti massal.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Simpan Penyesuaian
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
