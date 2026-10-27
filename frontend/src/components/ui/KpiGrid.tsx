'use client';

import React from 'react';

export interface KpiCardItem<T extends string = string> {
  id: T;
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  bgColor?: string;
  helper?: string;
}

export interface KpiGridProps<T extends string = string> {
  items: KpiCardItem<T>[];
  loading?: boolean;
  activeFilter?: T | null;
  onSelectFilter?: (id: T) => void;
  skeletonCount?: number;
  className?: string;
}

export default function KpiGrid<T extends string = string>({
  items,
  loading = false,
  activeFilter = null,
  onSelectFilter,
  skeletonCount = 5,
  className = "",
}: KpiGridProps<T>) {
  if (loading) {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 ${className}`}>
        {[...Array(skeletonCount)].map((_, i) => (
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

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 ${className}`}>
      {items.map((item) => {
        const IconComponent = item.icon;
        const isActive = activeFilter === item.id;
        const isClickable = Boolean(onSelectFilter);

        return (
          <button
            key={item.id}
            type="button"
            disabled={!isClickable}
            onClick={() => onSelectFilter?.(item.id)}
            aria-pressed={isActive}
            className={`group text-left rounded-2xl p-4 shadow-xs transition-all duration-200 flex flex-col justify-between focus:outline-none ${
              isClickable ? "cursor-pointer" : "cursor-default"
            } ${
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
                  isActive ? "bg-emerald-100" : item.bgColor || "bg-slate-50"
                }`}
              >
                <IconComponent
                  className={`w-4 h-4 ${isActive ? "text-emerald-700" : item.iconColor || "text-slate-600"}`}
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
                {item.helper && (
                  <div
                    className={`text-[10px] mt-0.5 truncate ${
                      isActive ? "text-emerald-700 font-medium" : "text-slate-400"
                    }`}
                  >
                    {item.helper}
                  </div>
                )}
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
