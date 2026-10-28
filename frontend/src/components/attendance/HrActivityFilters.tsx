'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Search, RotateCcw, Calendar, User, Tag } from 'lucide-react';
import type { HrActivityFiltersState, HrActivityActor } from '@/lib/hr-activity/types';
import { listActors } from '@/lib/hr-activity/api';

interface HrActivityFiltersProps {
  filters: HrActivityFiltersState;
  onApply: (nextFilters: HrActivityFiltersState) => void;
  onReset: () => void;
  isLoading?: boolean;
}

const ACTION_OPTIONS = [
  { value: '', label: 'Semua Aksi' },
  { value: 'CREATE', label: 'Tambah (CREATE)' },
  { value: 'UPDATE', label: 'Ubah (UPDATE)' },
  { value: 'DELETE', label: 'Hapus (DELETE)' },
  { value: 'IMPORT', label: 'Impor (IMPORT)' },
  { value: 'REVIEW', label: 'Review (REVIEW)' },
  { value: 'LOCK', label: 'Kunci (LOCK)' },
  { value: 'UNLOCK', label: 'Buka Kunci (UNLOCK)' },
  { value: 'ASSIGN', label: 'Tugaskan Shift (ASSIGN)' },
  { value: 'LINK', label: 'Hubungkan Identitas (LINK)' },
];

export function HrActivityFilters({
  filters,
  onApply,
  onReset,
  isLoading,
}: HrActivityFiltersProps) {
  const [actors, setActors] = useState<HrActivityActor[]>([]);
  const [isLoadingActors, setIsLoadingActors] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.q || '');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSearchInput(filters.q || '');
  }, [filters.q]);

  useEffect(() => {
    let active = true;
    setIsLoadingActors(true);
    listActors(undefined, null, 100)
      .then((res) => {
        if (active) setActors(res.items);
      })
      .catch((err) => {
        console.warn('Gagal memuat daftar pelaku audit:', err);
      })
      .finally(() => {
        if (active) setIsLoadingActors(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleFilterChange = (key: keyof HrActivityFiltersState, value: string) => {
    onApply({
      ...filters,
      [key]: value || undefined,
    });
  };

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      onApply({
        ...filters,
        q: val.trim() || undefined,
      });
    }, 400);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
      {/* Bagian 1: Pencarian Cepat */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 tracking-wide uppercase">
          Pencarian Cepat
        </label>
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari berdasarkan objek, ringkasan, atau ID..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Bagian 2: Filter Data & Tombol Reset (Sesuai Log Presensi Mesin) */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Rentang Tanggal */}
          <div
            className="flex items-center gap-1 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl cursor-pointer hover:border-emerald-500 transition-colors"
            onClick={(e) => {
              const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement | null;
              if (input && e.target !== input) {
                input.focus();
                try {
                  input.showPicker?.();
                } catch {}
              }
            }}
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0 pointer-events-none" />
            <input
              type="date"
              value={filters.startDate || ''}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {}
              }}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="bg-transparent text-xs text-slate-700 cursor-pointer focus:outline-none"
            />
            <span className="text-slate-400 text-xs px-1 pointer-events-none">s/d</span>
            <input
              type="date"
              value={filters.endDate || ''}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {}
              }}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="bg-transparent text-xs text-slate-700 cursor-pointer focus:outline-none"
            />
          </div>

          {/* Filter Jenis Aksi */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl">
            <Tag className="w-3.5 h-3.5 text-slate-500 shrink-0 pointer-events-none" />
            <select
              value={filters.action || ''}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="bg-transparent text-xs text-slate-700 cursor-pointer focus:outline-none"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Pelaku */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl">
            <User className="w-3.5 h-3.5 text-slate-500 shrink-0 pointer-events-none" />
            <select
              value={filters.actorId || ''}
              onChange={(e) => handleFilterChange('actorId', e.target.value)}
              disabled={isLoadingActors}
              className="bg-transparent text-xs text-slate-700 cursor-pointer focus:outline-none disabled:text-slate-400"
            >
              <option value="">Semua Pelaku</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name} ({actor.username})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tombol Reset Filter */}
        <button
          type="button"
          onClick={onReset}
          disabled={isLoading}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Filter
        </button>
      </div>
    </div>
  );
}
