"use client";

import React from "react";
import { TicketFilterParams } from "../types";
import { CATEGORIES, ORIGINS, PRIORITIES, STATUSES } from "../constants";
import { Search, RotateCcw, Filter } from "lucide-react";

interface TicketFiltersProps {
  filters: TicketFilterParams;
  onFilterChange: (newFilters: TicketFilterParams) => void;
  onReset: () => void;
}

export default function TicketFilters({
  filters,
  onFilterChange,
  onReset,
}: TicketFiltersProps) {
  const handleChange = (key: keyof TicketFilterParams, value: any) => {
    onFilterChange({
      ...filters,
      [key]: value,
      page: 1, // reset page to 1 on filter change
    });
  };

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.priority ||
      filters.category ||
      filters.origin ||
      (filters.isInternal && filters.isInternal !== "all")
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-6">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nomor tiket, judul masalah, atau nama pelapor..."
            value={filters.search || ""}
            onChange={(e) => handleChange("search", e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Scope selector: All / Pelayanan Karyawan / Temuan Internal IT */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
          <button
            type="button"
            onClick={() => handleChange("isInternal", "all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              !filters.isInternal || filters.isInternal === "all"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => handleChange("isInternal", "false")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filters.isInternal === "false"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Aduan Karyawan
          </button>
          <button
            type="button"
            onClick={() => handleChange("isInternal", "true")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filters.isInternal === "true"
                ? "bg-emerald-600 text-white shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Temuan Internal IT
          </button>
        </div>
      </div>

      {/* Dropdown Filters row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 pt-2 border-t border-slate-100 items-center">
        {/* Status */}
        <select
          value={filters.status || ""}
          onChange={(e) => handleChange("status", e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        >
          <option value="">Semua Status</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Priority */}
        <select
          value={filters.priority || ""}
          onChange={(e) => handleChange("priority", e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        >
          <option value="">Semua Prioritas</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Category */}
        <select
          value={filters.category || ""}
          onChange={(e) => handleChange("category", e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        >
          <option value="">Semua Kategori</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Origin */}
        <select
          value={filters.origin || ""}
          onChange={(e) => handleChange("origin", e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        >
          <option value="">Semua Saluran</option>
          {ORIGINS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Reset button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-rose-200 bg-white transition-all font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filter
          </button>
        )}
      </div>
    </div>
  );
}
