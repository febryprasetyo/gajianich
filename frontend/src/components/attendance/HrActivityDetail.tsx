'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, Clock, User, ShieldCheck, Database, Layers, ChevronDown } from 'lucide-react';
import type { HrActivitySummary, HrActivityDetail as DetailType, HrActivityTargetSummary } from '@/lib/hr-activity/types';
import { getActivity, listTargets } from '@/lib/hr-activity/api';
import { formatWibDateTime } from '@/lib/hr-activity/filters';

interface HrActivityDetailProps {
  event: HrActivitySummary | null;
  onClose: () => void;
}

export function HrActivityDetail({ event, onClose }: HrActivityDetailProps) {
  const [detail, setDetail] = useState<DetailType | null>(null);
  const [targets, setTargets] = useState<HrActivityTargetSummary[]>([]);
  const [nextTargetCursor, setNextTargetCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (!event) {
      setDetail(null);
      setTargets([]);
      setNextTargetCursor(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    getActivity(event.id)
      .then((res) => {
        if (active) {
          setDetail(res);
          setTargets(res.targets || []);
          setNextTargetCursor(res.nextTargetCursor);
        }
      })
      .catch((err) => {
        console.error('Gagal memuat detail aktivitas:', err);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [event]);

  if (!event) return null;

  const handleLoadMoreTargets = async () => {
    if (!nextTargetCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await listTargets(event.id, nextTargetCursor, 50);
      setTargets((prev) => [...prev, ...res.targets]);
      setNextTargetCursor(res.nextCursor);
    } catch (err) {
      console.error('Gagal memuat target lanjutan:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Berhasil (SUCCESS)
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Sebagian (PARTIAL)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Gagal (FAILED)
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-800 text-white tracking-wider">
                {event.action}
              </span>
              {getOutcomeBadge(event.outcome)}
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1.5">{event.entityLabel}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs text-slate-700">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Waktu Pelaksanaan (WIB)
              </div>
              <div className="font-semibold text-slate-900">{formatWibDateTime(event.occurredAt)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{event.occurredAt}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Pelaku (Identitas Akun Server)
              </div>
              <div className="font-semibold text-slate-900">{event.actor.name}</div>
              <div className="text-slate-500">Username: @{event.actor.username} (ID: {event.actor.id})</div>
            </div>
          </div>

          {/* Ringkasan */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Ringkasan Operasi
            </h4>
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-slate-800 leading-relaxed">
              {event.summary}
            </div>
          </div>

          {/* Target Terdampak (Cascade) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                Target Objek Terdampak ({targets.length} {nextTargetCursor ? '+' : ''})
              </h4>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-slate-400 font-medium">Memuat target detail...</div>
            ) : targets.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
                Tidak ada target cascade tambahan untuk event ini.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Tipe</th>
                        <th className="py-2 px-3">ID / Kunci</th>
                        <th className="py-2 px-3">Keterangan</th>
                        <th className="py-2 px-3">Perubahan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {targets.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-mono text-slate-500">{t.entityType}</td>
                          <td className="py-2 px-3 font-mono font-medium text-slate-800">{t.entityId}</td>
                          <td className="py-2 px-3 text-slate-700 max-w-[180px] truncate">{t.entityLabel}</td>
                          <td className="py-2 px-3">
                            {t.changedFields && t.changedFields.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {t.changedFields.map((f) => (
                                  <span key={f} className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 font-mono">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {nextTargetCursor && (
                  <div className="p-2 bg-slate-50 border-t border-slate-200 text-center">
                    <button
                      type="button"
                      onClick={handleLoadMoreTargets}
                      disabled={isLoadingMore}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      {isLoadingMore ? 'Memuat...' : 'Muat Target Berikutnya'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Technical Traceability */}
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex flex-wrap items-center justify-between gap-2 font-mono">
            <span>Event ID: #{event.id}</span>
            <span>Operation ID: {event.operationId}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
