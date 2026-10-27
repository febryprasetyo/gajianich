'use client';

import React from 'react';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';

export interface TableShellProps {
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}

export default function TableShell({
  children,
  loading = false,
  error = null,
  isEmpty = false,
  emptyTitle = "Tidak Ada Data",
  emptyDescription = "Belum ada data yang tercatat dalam sistem atau sesuai filter yang dipilih.",
  emptyAction,
  onRetry,
  className = "",
}: TableShellProps) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden ${className}`}>
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-xs font-medium">Memuat data dari server...</span>
        </div>
      ) : error ? (
        <div className="py-16 px-4 text-center">
          <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-600 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-rose-700">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              Coba Lagi
            </button>
          )}
        </div>
      ) : isEmpty ? (
        <div className="py-16 px-4 text-center">
          <div className="inline-flex p-3 rounded-full bg-slate-50 text-slate-400 mb-3">
            <Inbox className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">{emptyTitle}</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{emptyDescription}</p>
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          {children}
        </div>
      )}
    </div>
  );
}
