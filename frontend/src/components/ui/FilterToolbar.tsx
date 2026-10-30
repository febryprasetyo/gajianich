'use client';

import React from 'react';
import { Search, RotateCcw } from 'lucide-react';

export interface ScopeOption<T extends string = string> {
  label: string;
  value: T;
  activeColor?: string;
}

export interface FilterToolbarProps<T extends string = string> {
  search?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  scopeOptions?: ScopeOption<T>[];
  activeScope?: T;
  onScopeChange?: (val: T) => void;
  dropdownFilters?: React.ReactNode;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  className?: string;
}

export default function FilterToolbar<T extends string = string>({
  search,
  onSearchChange,
  searchPlaceholder = "Cari data...",
  scopeOptions,
  activeScope,
  onScopeChange,
  dropdownFilters,
  hasActiveFilters = false,
  onResetFilters,
  className = "",
}: FilterToolbarProps<T>) {
  const hasTopRow = Boolean(onSearchChange || (scopeOptions && scopeOptions.length > 0));

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-xs mb-6 space-y-3 ${className}`}>
      {hasTopRow && (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {onSearchChange && (
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          )}

          {scopeOptions && scopeOptions.length > 0 && onScopeChange && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start md:self-auto shrink-0">
              {scopeOptions.map((opt) => {
                const isSelected = activeScope === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onScopeChange(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? opt.activeColor || "bg-white text-slate-900 shadow-xs font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {(dropdownFilters || (hasActiveFilters && onResetFilters)) && (
        <div className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 items-center ${hasTopRow ? 'pt-2 border-t border-slate-100' : ''}`}>
          {dropdownFilters}
          {hasActiveFilters && onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-rose-200 transition-all font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
