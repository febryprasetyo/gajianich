"use client";

import React from "react";
import { TicketAuditItem } from "../types";
import { formatAuditAction } from "../constants";
import { History, ShieldCheck, ArrowRight, User } from "lucide-react";

interface TicketAuditTrailProps {
  auditTrail: TicketAuditItem[];
}

export default function TicketAuditTrail({ auditTrail }: TicketAuditTrailProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Audit Trail Append-Only</strong>: Setiap mutasi status, penugasan, dan perubahan data
            dicatat permanen dan dilindungi trigger basis data (tidak dapat diubah atau dihapus).
          </span>
        </div>
      </div>

      {auditTrail.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
          <History className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs text-slate-500">Belum ada riwayat perubahan yang tercatat.</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200">
                <th className="py-2.5 px-3 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Waktu (WIB)
                </th>
                <th className="py-2.5 px-3 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Aktor
                </th>
                <th className="py-2.5 px-3 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Tindakan
                </th>
                <th className="py-2.5 px-3 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Perubahan Nilai
                </th>
                <th className="py-2.5 px-3 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Alasan / Keterangan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {auditTrail.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{item.actorName || `User #${item.actorUserId}`}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-slate-800">
                      {formatAuditAction(item.action, item.fieldName, item.oldValue, item.newValue)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {item.oldValue || item.newValue ? (
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-slate-500 line-through">{item.oldValue || "-"}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-emerald-700 font-semibold">{item.newValue || "-"}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {item.reason || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
