'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TablePaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (newPage: number) => void;
  itemName?: string;
  className?: string;
}

export default function TablePagination({
  page,
  limit,
  total,
  onPageChange,
  itemName = 'data',
  className = '',
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (total <= 0) return null;

  return (
    <div className={`bg-slate-50/75 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-600 font-mono ${className}`}>
      <div>
        Menampilkan <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span> sampai{' '}
        <span className="font-semibold text-slate-900">{Math.min(page * limit, total)}</span> dari{' '}
        <span className="font-semibold text-slate-900">{total}</span> {itemName}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium text-xs transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Sebelumnya</span>
        </button>
        <span className="px-2 font-mono text-[11px] text-slate-500">
          Hal {page} dari {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium text-xs transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
        >
          <span>Selanjutnya</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
