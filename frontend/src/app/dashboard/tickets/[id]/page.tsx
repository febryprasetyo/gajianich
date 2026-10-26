"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TicketDetail from "@/modules/ticket/components/TicketDetail";
import { TicketDetail as ITicketDetail } from "@/modules/ticket/types";
import { getTicketDetail } from "@/modules/ticket/api";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const ticketId = resolvedParams.id;

  const [ticket, setTicket] = useState<ITicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getTicketDetail(ticketId);
      if (res.success && res.data) {
        setTicket(res.data);
      } else {
        setError("Tiket tidak ditemukan.");
      }
    } catch (err: any) {
      setError(err?.message || "Gagal memuat detail tiket.");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return (
    <DashboardLayout>
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-emerald-600 mb-4"></div>
          <p className="text-xs text-slate-500 font-medium">Memuat detail tiket helpdesk...</p>
        </div>
      ) : error || !ticket ? (
        <div className="bg-white border border-rose-200 rounded-2xl p-8 shadow-sm text-center max-w-lg mx-auto">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h2 className="text-sm font-bold text-slate-900 mb-1">Terjadi Kesalahan</h2>
          <p className="text-xs text-rose-600 mb-4">{error || "Tiket tidak ditemukan."}</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard/tickets"
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
            >
              Kembali ke Daftar
            </Link>
            <button
              type="button"
              onClick={fetchDetail}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      ) : (
        <TicketDetail ticket={ticket} onRefresh={fetchDetail} />
      )}
    </DashboardLayout>
  );
}
