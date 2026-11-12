'use client';

import React, { useState, useEffect } from 'react';
import {
  Save,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Sliders,
  Layers,
} from 'lucide-react';
import { AnnualLeaveConfig } from '@/types/leaves';
import { calculateCleanQuota } from '@/lib/leaves/masterLeaveUtils';

export interface DepartmentOption {
  id: number;
  name: string;
  code?: string;
}

interface AnnualLeaveConfigCardProps {
  initialConfig?: AnnualLeaveConfig | null;
  departments?: DepartmentOption[];
  onSave: (config: AnnualLeaveConfig) => Promise<{ success: boolean; message?: string; syncedCount?: number }>;
  isLoading?: boolean;
}

export default function AnnualLeaveConfigCard({
  initialConfig,
  departments = [],
  onSave,
  isLoading = false,
}: AnnualLeaveConfigCardProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(initialConfig?.year || currentYear);
  const [baseQuota, setBaseQuota] = useState<number>(initialConfig?.baseQuota ?? 12);
  const [collectiveLeaveDays, setCollectiveLeaveDays] = useState<number>(
    initialConfig?.collectiveLeaveDays ?? 0
  );
  const [notes, setNotes] = useState<string>(initialConfig?.notes || '');
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>(
    initialConfig?.accumulatedDepartmentIds || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      setYear(initialConfig.year);
      setBaseQuota(initialConfig.baseQuota);
      setCollectiveLeaveDays(initialConfig.collectiveLeaveDays);
      setNotes(initialConfig.notes || '');
      setSelectedDeptIds(initialConfig.accumulatedDepartmentIds || []);
    }
  }, [initialConfig]);

  const cleanQuotaPreview = calculateCleanQuota(baseQuota, collectiveLeaveDays);

  const toggleDept = (deptId: number) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const selectAllDepts = () => {
    setSelectedDeptIds(departments.map((d) => d.id));
  };

  const clearAllDepts = () => {
    setSelectedDeptIds([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setIsSubmitting(true);
    setShowConfirmModal(false);
    try {
      await onSave({
        year,
        baseQuota,
        collectiveLeaveDays,
        allowCarryForward: false,
        maxCarryForwardDays: 0,
        notes: notes.trim() || null,
        accumulatedDepartmentIds: selectedDeptIds,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-emerald-50 border-emerald-100 text-emerald-600">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Pengaturan Kebijakan Cuti Tahunan
            </h2>
            <p className="text-xs text-slate-500">
              Konfigurasi hak kuota dasar & potongan cuti bersama untuk tahun kalender {year}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tahun Kalender */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 font-mono">
              Tahun Kalender
            </label>
            <div className="relative">
              <input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                disabled={isLoading || isSubmitting}
                className="w-full pl-3.5 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50 transition-all font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Tahun periode berlakunya kebijakan</p>
          </div>

          {/* Hak Dasar Cuti Tahunan */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 font-mono">
              Hak Dasar Cuti Tahunan
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={60}
                value={baseQuota}
                onChange={(e) => setBaseQuota(Number(e.target.value))}
                disabled={isLoading || isSubmitting}
                className="w-full pl-3.5 pr-14 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50 transition-all font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                required
              />
              <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-slate-400 pointer-events-none">
                Hari
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Standar perusahaan umum: 12 hari</p>
          </div>

          {/* Cuti Bersama Tahunan */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 font-mono">
              Potongan Cuti Bersama
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={30}
                value={collectiveLeaveDays}
                onChange={(e) => setCollectiveLeaveDays(Number(e.target.value))}
                disabled={isLoading || isSubmitting}
                className="w-full pl-3.5 pr-14 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50 transition-all font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                required
              />
              <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-slate-400 pointer-events-none">
                Hari
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Mengurangi langsung dari hak dasar</p>
          </div>
        </div>

        {/* Live Quota Formula Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <HelpCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <div>
              <span>Kalkulasi Hak Cuti Bersih Default Karyawan: </span>
              <span className="font-mono text-emerald-800">
                {baseQuota} (Dasar) - {collectiveLeaveDays} (Cuti Bersama)
              </span>
            </div>
          </div>
          <div className="px-4 py-1.5 rounded-lg bg-white border border-emerald-200 text-sm font-bold text-emerald-700 shadow-sm self-start sm:self-auto">
            {cleanQuotaPreview} Hari Bersih
          </div>
        </div>

        {/* Kebijakan Cuti Akumulasi Khusus Departemen (Unlimited Roll-Over) */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                  Akumulasi Cuti Khusus Departemen (Unlimited Roll-Over)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Cuti karyawan di departemen terpilih akan terus terakumulasi tanpa batas sejak masuk kerja. Departemen lain otomatis di-reset setiap tahun baru.
                </p>
              </div>
            </div>
            {departments.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={selectAllDepts}
                  disabled={isLoading || isSubmitting}
                  className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                >
                  Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={clearAllDepts}
                  disabled={isLoading || isSubmitting}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                >
                  Reset Pilihan
                </button>
              </div>
            )}
          </div>

          {departments.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">Memuat daftar departemen...</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
              {departments.map((dept) => {
                const isChecked = selectedDeptIds.includes(dept.id);
                return (
                  <label
                    key={dept.id}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-semibold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleDept(dept.id)}
                      disabled={isLoading || isSubmitting}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
                    />
                    <span className="truncate" title={dept.name}>
                      {dept.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Catatan Kebijakan HR */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 font-mono">
            Catatan Kebijakan HR (Opsional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isLoading || isSubmitting}
            placeholder="Contoh: Berdasarkan SKB 3 Menteri dan Keputusan Direksi tentang Libur & Cuti Bersama 2026."
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50 transition-all"
          />
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={isLoading || isSubmitting}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Menyimpan Kebijakan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Simpan & Terapkan Kebijakan
              </>
            )}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-emerald-600 mb-4">
              <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-emerald-50 border-emerald-100 text-emerald-600">
                <AlertCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Terapkan Kebijakan Cuti {year}?
              </h3>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Menyimpan kebijakan ini akan memperbarui potongan <strong>Cuti Bersama ({collectiveLeaveDays} Hari)</strong> dan menghitung ulang hak bersih untuk <strong>seluruh staf aktif</strong> di tahun {year}.
            </p>

            <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600 mb-6 space-y-2 border border-slate-200">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  {selectedDeptIds.length} Departemen dipilih untuk cuti akumulasi (unlimited).
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                Departemen lainnya otomatis di-reset menjadi 0 pada pergantian tahun.
              </div>
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                Karyawan dengan penyesuaian kuota khusus manual tidak akan tertimpa.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                Ya, Terapkan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
