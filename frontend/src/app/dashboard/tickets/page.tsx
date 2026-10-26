"use client";

import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TicketStats from "@/modules/ticket/components/TicketStats";
import TicketFilters from "@/modules/ticket/components/TicketFilters";
import TicketList from "@/modules/ticket/components/TicketList";
import TicketCreateForm from "@/modules/ticket/components/TicketCreateForm";
import {
  TicketSummary,
  TicketStatsData,
  TicketFilterParams,
} from "@/modules/ticket/types";
import { listTickets, getTicketStats } from "@/modules/ticket/api";
import { Ticket, Plus, X, RefreshCw } from "lucide-react";

export default function TicketsPage() {
  // Stats state
  const [stats, setStats] = useState<TicketStatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Tickets list state
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [filters, setFilters] = useState<TicketFilterParams>({
    isInternal: "all",
    page: 1,
  });

  // Modal create state
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await getTicketStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error("Gagal memuat statistik helpdesk:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await listTickets({
        ...filters,
        page,
        limit,
      });
      if (res?.success || res?.data || (res as any)?.items) {
        setTickets(res?.data || (res as any)?.items || []);
        setTotal(res?.total ?? (res as any)?.totalCount ?? 0);
      }
    } catch (err: any) {
      setError(err?.message || "Gagal memuat data tiket.");
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleFilterChange = (newFilters: TicketFilterParams) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters({ isInternal: "all", page: 1 });
    setPage(1);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
                <Ticket className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Sistem Tiket Helpdesk IT
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Layanan pelaporan insiden & permintaan dukungan IT dengan SLA terukur dan audit append-only.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                fetchStats();
                fetchTickets();
              }}
              className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 shadow-2xs transition-all"
              title="Muat Ulang Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              Buat Tiket Baru
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <TicketStats stats={stats} loading={statsLoading} />

        {/* Filters */}
        <TicketFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {/* Ticket List */}
        <TicketList
          tickets={tickets}
          loading={loading}
          error={error}
          total={total}
          page={page}
          limit={limit}
          onPageChange={(p) => setPage(p)}
          onRetry={fetchTickets}
        />

        {/* Modal Buat Tiket */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden my-8">
              <div className="absolute top-4 right-4 z-10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <TicketCreateForm
                onCancel={() => setShowCreateModal(false)}
                onSuccess={() => {
                  setShowCreateModal(false);
                  fetchStats();
                  fetchTickets();
                }}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
