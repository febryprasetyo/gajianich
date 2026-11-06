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
  compact?: boolean;
}

export default function TablePagination({
  page,
  limit,
  total,
  onPageChange,
  itemName = 'data',
  className = '',
  compact = false,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (total <= 0) return null;

  return (
    <div className={`bg-slate-50/75 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-600 font-mono ${className}`}>
      <div>
        {!compact && 'Menampilkan '}<span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span>{compact ? '–' : ' sampai '}
        <span className="font-semibold text-slate-900">{Math.min(page * limit, total)}</span> dari{' '}
        <span className="font-semibold text-slate-900">{total}</span> {itemName}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={compact ? 'Halaman sebelumnya' : undefined}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={`${compact ? 'min-h-11 min-w-11 justify-center' : ''} px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium text-xs transition-all shadow-2xs flex items-center gap-1 cursor-pointer`}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {!compact && <span>Sebelumnya</span>}
        </button>
        <span className="px-2 font-mono text-[11px] text-slate-500">
          {compact ? `${page} / ${totalPages}` : `Hal ${page} dari ${totalPages}`}
        </span>
        <button
          type="button"
          aria-label={compact ? 'Halaman selanjutnya' : undefined}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={`${compact ? 'min-h-11 min-w-11 justify-center' : ''} px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium text-xs transition-all shadow-2xs flex items-center gap-1 cursor-pointer`}
        >
          {!compact && <span>Selanjutnya</span>}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
