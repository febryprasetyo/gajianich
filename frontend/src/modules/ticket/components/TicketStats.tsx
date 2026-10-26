"use client";

import React from "react";
import { TicketStatsData } from "../types";
import { formatDelayMinutes } from "../constants";
import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  TimerReset,
} from "lucide-react";

interface TicketStatsProps {
  stats: TicketStatsData | null;
  loading?: boolean;
}

export default function TicketStats({ stats, loading }: TicketStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-pulse h-24 flex flex-col justify-between"
          >
            <div className="h-3 w-16 bg-slate-200 rounded"></div>
            <div className="h-6 w-12 bg-slate-200 rounded mt-2"></div>
          </div>
        ))}
      </div>
    );
  }

  const items = [
    {
      title: "Tiket Terbuka",
      value: stats.openCount,
      icon: Inbox,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50",
      helper: "Menunggu penanganan",
    },
    {
      title: "Sedang Dikerjakan",
      value: stats.inProgressCount,
      icon: Clock,
      iconColor: "text-amber-600",
      bgColor: "bg-amber-50",
      helper: "Dalam proses teknisi",
    },
    {
      title: "Selesai Hari Ini",
      value: stats.resolvedTodayCount,
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
      helper: "Terselesaikan",
    },
    {
      title: "Tiket Kritis",
      value: stats.criticalCount,
      icon: AlertTriangle,
      iconColor: "text-rose-600",
      bgColor: "bg-rose-50",
      helper: "Prioritas SLA 1 jam",
    },
    {
      title: "Kepatuhan SLA",
      value: stats.slaCompliancePercentage > 0 ? `${stats.slaCompliancePercentage}%` : (stats.openCount + stats.inProgressCount + stats.resolvedTodayCount > 0 ? "0%" : "-"),
      icon: ShieldCheck,
      iconColor: stats.slaCompliancePercentage >= 90 ? "text-emerald-600" : "text-amber-600",
      bgColor: stats.slaCompliancePercentage >= 90 ? "bg-emerald-50" : "bg-amber-50",
      helper: "Sesuai target respon",
    },
    {
      title: "Rata-rata Delay",
      value: stats.avgDelayMinutes > 0 ? formatDelayMinutes(stats.avgDelayMinutes) : (stats.openCount + stats.inProgressCount + stats.resolvedTodayCount > 0 ? "0 mnt" : "-"),
      icon: TimerReset,
      iconColor: stats.avgDelayMinutes <= 15 ? "text-slate-600" : "text-amber-600",
      bgColor: stats.avgDelayMinutes <= 15 ? "bg-slate-50" : "bg-amber-50",
      helper: "Lapor vs Pencatatan",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {items.map((item, idx) => {
        const IconComponent = item.icon;
        return (
          <div
            key={idx}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                {item.title}
              </span>
              <div className={`p-1.5 rounded-lg ${item.bgColor}`}>
                <IconComponent className={`w-4 h-4 ${item.iconColor}`} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl font-extrabold text-slate-900 tracking-tight">
                {item.value}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                {item.helper}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
