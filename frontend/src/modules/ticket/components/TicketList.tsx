"use client";

import React from "react";
import Link from "next/link";
import { TicketSummary } from "../types";
import {
  getStatusBadgeConfig,
  getPriorityBadgeConfig,
  formatDelayMinutes,
} from "../constants";
import {
  Clock,
  User,
  ShieldAlert,
  ChevronRight,
  Inbox,
  AlertCircle,
  HardDrive,
  Calendar,
} from "lucide-react";

interface TicketListProps {
  tickets: TicketSummary[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  onRetry: () => void;
}

export default function TicketList({
  tickets,
  loading,
  error,
  total,
  page,
  limit,
  onPageChange,
  onRetry,
}: TicketListProps) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-emerald-600 mb-4"></div>
        <p className="text-xs text-slate-500 font-medium">Memuat daftar tiket helpdesk...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 shadow-sm text-center">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-900 mb-1">Gagal Memuat Data</h3>
        <p className="text-xs text-rose-600 mb-4">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center">
        <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-900 mb-1">Tidak Ada Tiket</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Belum ada tiket yang sesuai dengan filter pencarian yang Anda pilih.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit) || 1;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateDelayMinutes = (reportedAt: string, createdAt: string) => {
    if (!reportedAt || !createdAt) return 0;
    const diffMs = new Date(createdAt).getTime() - new Date(reportedAt).getTime();
    return Math.max(0, Math.round(diffMs / 60000));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-200">
              <th className="py-3 px-4 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                Tiket & Waktu
              </th>
              <th className="py-3 px-4 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                3 Identitas (Pelapor / Pencatat / Petugas)
              </th>
              <th className="py-3 px-4 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                Masalah & Kategori
              </th>
              <th className="py-3 px-4 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider text-center">
                Prioritas
              </th>
              <th className="py-3 px-4 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider text-center">
                Status
              </th>
              <th className="py-3 px-4 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {tickets.map((t) => {
              const statusCfg = getStatusBadgeConfig(t.status);
              const priorityCfg = getPriorityBadgeConfig(t.priority);
              const delayMins = calculateDelayMinutes(t.reportedAt, t.createdAt);

              return (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  {/* Tiket & Waktu */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900">
                        {t.ticketNumber}
                      </span>
                      {t.isInternal && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                          Internal IT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{formatDate(t.reportedAt)}</span>
                    </div>
                    {delayMins > 0 && (
                      <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                        Dicatat: +{formatDelayMinutes(delayMins)} kemudian
                      </div>
                    )}
                  </td>

                  {/* 3 Identitas */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-1">
                      {/* Pelapor */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono uppercase text-slate-400 w-14">
                          Pelapor:
                        </span>
                        <span className="font-semibold text-slate-900 truncate max-w-[160px]">
                          {t.requesterName || t.requester?.nameSnapshot || (t.requesterEmployeeId ? "Karyawan #" + t.requesterEmployeeId : "Karyawan Pelapor")}
                        </span>
                        {t.requesterDepartment && (
                          <span className="text-[10px] text-slate-400">
                            ({t.requesterDepartment})
                          </span>
                        )}
                      </div>
                      {/* Dicatat Oleh */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono uppercase text-slate-400 w-14">
                          Pencatat:
                        </span>
                        <span className="text-slate-600 truncate max-w-[160px]">
                          {t.createdByName || "Staf IT"}
                        </span>
                      </div>
                      {/* Petugas */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono uppercase text-slate-400 w-14">
                          Petugas:
                        </span>
                        <span
                          className={`truncate max-w-[160px] ${
                            t.assignedToName
                              ? "text-emerald-700 font-medium"
                              : "text-slate-400 italic"
                          }`}
                        >
                          {t.assignedToName || "Belum ditugaskan"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Masalah & Kategori */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="font-bold text-slate-900 truncate">{t.title}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {t.description}
                    </div>
                    <div className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      {t.category} • {t.origin}
                    </div>
                  </td>

                  {/* Prioritas */}
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold border ${priorityCfg.bgClass} ${priorityCfg.textClass}`}
                    >
                      {priorityCfg.label}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.bgClass} ${statusCfg.textClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClass}`}></span>
                      {statusCfg.label}
                    </span>
                  </td>

                  {/* Aksi */}
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/dashboard/tickets/${t.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:text-emerald-700 text-xs font-semibold transition-all shadow-2xs"
                    >
                      Detail
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="block lg:hidden divide-y divide-slate-100">
        {tickets.map((t) => {
          const statusCfg = getStatusBadgeConfig(t.status);
          const priorityCfg = getPriorityBadgeConfig(t.priority);
          const delayMins = calculateDelayMinutes(t.reportedAt, t.createdAt);

          return (
            <div key={t.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {t.ticketNumber}
                    </span>
                    {t.isInternal && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                        Internal
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {formatDate(t.reportedAt)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusCfg.bgClass} ${statusCfg.textClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClass}`}></span>
                    {statusCfg.label}
                  </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold border ${priorityCfg.bgClass} ${priorityCfg.textClass}`}
                  >
                    {priorityCfg.label}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs">{t.title}</h4>
                <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                  {t.description}
                </p>
              </div>

              {/* 3 Identitas Mobile */}
              <div className="bg-slate-50 p-2.5 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Pelapor:</span>
                  <span className="font-medium text-slate-900">
                    {t.requesterName || t.requester?.nameSnapshot || (t.requesterEmployeeId ? "Karyawan #" + t.requesterEmployeeId : "Karyawan Pelapor")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pencatat:</span>
                  <span className="text-slate-700">{t.createdByName || "Staf IT"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Petugas:</span>
                  <span className={t.assignedToName ? "text-emerald-700 font-medium" : "text-slate-400 italic"}>
                    {t.assignedToName || "Belum ditugaskan"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500 font-mono">
                  {t.category} • {t.origin}
                </span>
                <Link
                  href={`/dashboard/tickets/${t.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:text-emerald-600"
                >
                  Lihat Detail
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="bg-slate-50/75 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-600">
          <div>
            Menampilkan{" "}
            <span className="font-semibold text-slate-900">
              {(page - 1) * limit + 1}
            </span>{" "}
            sampai{" "}
            <span className="font-semibold text-slate-900">
              {Math.min(page * limit, total)}
            </span>{" "}
            dari <span className="font-semibold text-slate-900">{total}</span> tiket
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium text-xs transition-all shadow-2xs"
            >
              Sebelumnya
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-500">
              Hal {page} dari {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium text-xs transition-all shadow-2xs"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
