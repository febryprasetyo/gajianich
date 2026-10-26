"use client";

import React from "react";
import { TicketStatsData } from "../types";
import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

export type KpiFilterKey = "open" | "in_progress" | "resolved" | "critical" | "sla_breached";

interface TicketStatsProps {
  stats: TicketStatsData | null;
  loading?: boolean;
  activeKpiFilter?: KpiFilterKey | null;
  onSelectKpiFilter?: (key: KpiFilterKey) => void;
}

export default function TicketStats({
  stats,
  loading,
  activeKpiFilter,
  onSelectKpiFilter,
}: TicketStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs animate-pulse h-24 flex flex-col justify-between"
          >
            <div className="h-3 w-16 bg-slate-200 rounded"></div>
            <div className="h-6 w-12 bg-slate-200 rounded mt-2"></div>
          </div>
        ))}
      </div>
    );
  }

  const items: Array<{
    id: KpiFilterKey;
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    bgColor: string;
    helper: string;
  }> = [
    {
      id: "open",
      title: "Tiket Terbuka",
      value: stats.openCount,
      icon: Inbox,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50",
      helper: "Menunggu penanganan",
    },
    {
      id: "in_progress",
      title: "Sedang Dikerjakan",
      value: stats.inProgressCount,
      icon: Clock,
      iconColor: "text-amber-600",
      bgColor: "bg-amber-50",
      helper: "Dalam proses teknisi",
    },
    {
      id: "resolved",
      title: "Selesai Hari Ini",
      value: stats.resolvedTodayCount,
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
      helper: "Terselesaikan",
    },
    {
      id: "critical",
      title: "Tiket Kritis",
      value: stats.criticalCount,
      icon: AlertTriangle,
      iconColor: "text-rose-600",
      bgColor: "bg-rose-50",
      helper: "Prioritas SLA 1 jam",
    },
    {
      id: "sla_breached",
      title: "Kepatuhan SLA",
      value:
        stats.slaCompliancePercentage > 0
          ? `${stats.slaCompliancePercentage}%`
          : stats.openCount + stats.inProgressCount + stats.resolvedTodayCount > 0
          ? "0%"
          : "-",
      icon: ShieldCheck,
      iconColor: stats.slaCompliancePercentage >= 90 ? "text-emerald-600" : "text-amber-600",
      bgColor: stats.slaCompliancePercentage >= 90 ? "bg-emerald-50" : "bg-amber-50",
      helper: "Filter: SLA terlewat",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {items.map((item) => {
        const IconComponent = item.icon;
        const isActive = activeKpiFilter === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectKpiFilter?.(item.id)}
            aria-pressed={isActive}
            className={`group text-left rounded-2xl p-4 shadow-xs transition-all duration-200 flex flex-col justify-between cursor-pointer focus:outline-none ${
              isActive
                ? "bg-emerald-50/50 border-2 border-emerald-500 ring-2 ring-emerald-500/20"
                : "bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${
                  isActive ? "text-emerald-800" : "text-slate-500 group-hover:text-slate-700"
                }`}
              >
                {item.title}
              </span>
              <div
                className={`p-1.5 rounded-lg transition-transform group-hover:scale-105 ${
                  isActive ? "bg-emerald-100" : item.bgColor
                }`}
              >
                <IconComponent
                  className={`w-4 h-4 ${isActive ? "text-emerald-700" : item.iconColor}`}
                />
              </div>
            </div>

            <div className="mt-2 flex items-baseline justify-between w-full">
              <div>
                <div
                  className={`text-xl font-extrabold tracking-tight ${
                    isActive ? "text-emerald-950" : "text-slate-900"
                  }`}
                >
                  {item.value}
                </div>
                <div
                  className={`text-[10px] mt-0.5 truncate ${
                    isActive ? "text-emerald-700 font-medium" : "text-slate-400"
                  }`}
                >
                  {item.helper}
                </div>
              </div>

              {isActive && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md">
                  Aktif
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
