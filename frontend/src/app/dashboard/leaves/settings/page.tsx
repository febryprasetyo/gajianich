'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';
import { AnnualLeaveConfig } from '@/types/leaves';
import AnnualLeaveConfigCard from '@/components/leaves/AnnualLeaveConfigCard';

export default function LeaveSettingsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [config, setConfig] = useState<AnnualLeaveConfig | null>(null);

  const fetchConfig = useCallback(async (year: number) => {
    setIsLoadingConfig(true);
    setPageError(null);
    try {
      const data = await api.get<AnnualLeaveConfig>(`/leaves/master/config?year=${year}`);
      setConfig(data);
    } catch (err: unknown) {
      console.error('Failed to load leave config:', err);
      const msg = err instanceof Error ? err.message : 'Gagal memuat pengaturan cuti tahunan.';
      setPageError(msg);
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig(selectedYear);
  }, [selectedYear, fetchConfig]);

  const handleSaveConfig = async (payload: AnnualLeaveConfig) => {
    try {
      const res = await api.post<{ success: boolean; message: string; config: AnnualLeaveConfig; syncedCount?: number }>(
        '/leaves/master/config',
        payload
      );
      if (payload.year !== selectedYear) {
        setSelectedYear(payload.year);
      } else {
        await fetchConfig(payload.year);
      }
      setToastMessage({
        type: 'success',
        text: res.message || `Kebijakan cuti tahun ${payload.year} berhasil disimpan & disinkronkan.`,
      });
      return {
        success: true,
        message: res.message || `Kebijakan cuti tahun ${payload.year} berhasil disimpan.`,
        syncedCount: res.syncedCount,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan konfigurasi.';
      return {
        success: false,
        message: msg,
      };
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header (Template Standard) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Pengaturan Cuti
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Konfigurasi hak kuota cuti tahunan dasar dan potongan cuti bersama pemerintah.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 shadow-sm">
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              aria-label="Pilih Tahun Kalender"
              className="bg-transparent font-bold outline-none cursor-pointer"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>
          </div>


        </div>
      </div>

      {/* Global Toast Banner */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {pageError && (
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <p className="text-sm font-semibold">Gagal Mengambil Data</p>
            <p className="text-xs mt-0.5">{pageError}</p>
          </div>
        </div>
      )}

      {/* Form Kebijakan Cuti Tahunan */}
      <AnnualLeaveConfigCard
        initialConfig={config}
        onSave={handleSaveConfig}
        isLoading={isLoadingConfig}
      />
    </div>
  );
}
