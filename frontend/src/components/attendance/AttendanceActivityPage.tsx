'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  History,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Inbox,
} from 'lucide-react';
import type { HrActivitySummary, HrActivityFiltersState } from '@/lib/hr-activity/types';
import { listActivities } from '@/lib/hr-activity/api';
import { createInitialFilters, formatWibDateTime } from '@/lib/hr-activity/filters';
import { HrActivityFilters } from './HrActivityFilters';
import { HrActivityDetail } from './HrActivityDetail';

export default function AttendanceActivityPage() {
  const [filters, setFilters] = useState<HrActivityFiltersState>(() => createInitialFilters());
  const [items, setItems] = useState<HrActivitySummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HrActivitySummary | null>(null);

  const currentCursor = cursorHistory[pageIndex] || null;

  const fetchActivities = useCallback(
    async (activeFilters: HrActivityFiltersState, cursor: string | null, signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await listActivities(activeFilters, cursor, 25, signal);
        setItems(res.items);
        setNextCursor(res.nextCursor);
      } catch (err: any) {
        if (signal?.aborted) return;
        setError(err.message || 'Gagal memuat riwayat aktivitas HR.');
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchActivities(filters, currentCursor, controller.signal);
    return () => controller.abort();
  }, [filters, currentCursor, fetchActivities]);

  const handleApplyFilters = (nextFilters: HrActivityFiltersState) => {
    setFilters(nextFilters);
    setCursorHistory([null]);
    setPageIndex(0);
  };

  const handleResetFilters = () => {
    const defaults = createInitialFilters();
    setFilters(defaults);
    setCursorHistory([null]);
    setPageIndex(0);
  };

  const handleNextPage = () => {
    if (!nextCursor || isLoading) return;
    setCursorHistory((prev) => [...prev.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    if (pageIndex === 0 || isLoading) return;
    setPageIndex((prev) => prev - 1);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">CREATE</span>;
      case 'UPDATE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">UPDATE</span>;
      case 'DELETE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">DELETE</span>;
      case 'LOCK':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">LOCK</span>;
      case 'UNLOCK':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">UNLOCK</span>;
      case 'IMPORT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">IMPORT</span>;
      case 'REVIEW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">REVIEW</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{action}</span>;
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'SUCCESS':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline mr-1" />;
      case 'PARTIAL':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-600 inline mr-1" />;
      default:
        return <XCircle className="w-3.5 h-3.5 text-rose-600 inline mr-1" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            Riwayat Aktivitas HR
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Audit trail server append-only: jejak perubahan data absensi, cuti, shift, impor, dan master HR.
          </p>
        </div>
      </div>

      {/* Filter Component */}
      <HrActivityFilters
        filters={filters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        isLoading={isLoading}
      />

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchActivities(filters, currentCursor)}
            className="px-3 py-1 bg-white border border-rose-300 rounded-md font-semibold text-rose-700 hover:bg-rose-100 transition-colors shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Activity Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Waktu (WIB)</th>
                <th className="py-3 px-4">Pelaku</th>
                <th className="py-3 px-4">Aksi</th>
                <th className="py-3 px-4">Objek</th>
                <th className="py-3 px-4">Hasil</th>
                <th className="py-3 px-4 min-w-[200px]">Ringkasan</th>
                <th className="py-3 px-4 text-right">Opsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                    Memuat riwayat aktivitas...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">Tidak ada riwayat aktivitas ditemukan</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {filters.q || filters.action || filters.actorId
                        ? 'Coba sesuaikan kata kunci atau ubah rentang tanggal filter Anda.'
                        : 'Belum ada aktivitas mutasi data HR yang tercatat pada rentang tanggal ini.'}
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-800 font-medium">
                      {formatWibDateTime(item.occurredAt)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{item.actor.name}</div>
                      <div className="text-[10px] text-slate-400">@{item.actor.username}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{getActionBadge(item.action)}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 max-w-[220px] truncate">{item.entityLabel}</div>
                      <div className="text-[10px] font-mono text-slate-400">{item.entityType}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-[11px] font-semibold">
                      {getOutcomeIcon(item.outcome)}
                      {item.outcome}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-[11px] leading-relaxed max-w-md">
                      {item.summary}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Keyset Cursor Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/80 bg-slate-50/50 text-xs text-slate-600">
          <div>
            <span>Halaman {pageIndex + 1}</span>
            {items.length > 0 && <span className="text-slate-400 ml-1">({items.length} data)</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={pageIndex === 0 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={!nextCursor || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
            >
              Berikutnya
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal / Drawer */}
      <HrActivityDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
