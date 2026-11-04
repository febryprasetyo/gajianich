'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { Building2, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import type { LeaveDocumentOrganizationOption } from '@/types/documentProfile';
import { stepOrganizationSelectionByKey } from '@/lib/leaves/leaveOrganizationUtils';

export interface LeaveOrganizationPickerProps {
  options: LeaveDocumentOrganizationOption[];
  value: number | null;
  onChange: (organizationId: number) => void;
  loading?: boolean;
  error?: string | null;
}

export function LeaveOrganizationPicker({
  options,
  value,
  onChange,
  loading = false,
  error = null,
}: LeaveOrganizationPickerProps) {
  const cardRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentId: number) => {
    const nextId = stepOrganizationSelectionByKey(options, currentId, e.key);
    if (nextId !== null) {
      e.preventDefault();
      onChange(nextId);
      cardRefs.current.get(nextId)?.focus();
    }
  };

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Memuat daftar organisasi">
        <span className="block text-xs font-semibold text-slate-700 uppercase font-mono">
          Organisasi Penerbit Form Cuti
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2].map((idx) => (
            <div
              key={idx}
              className="h-18 rounded-xl border border-slate-200 bg-slate-50 animate-pulse p-3.5 flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-lg bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-slate-200" />
                <div className="h-2.5 w-20 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <span className="block text-xs font-semibold text-slate-700 uppercase font-mono">
          Organisasi Penerbit Form Cuti
        </span>
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{error}</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Formulir tetap dapat disimpan menggunakan organisasi bawaan karyawan.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="block text-xs font-semibold text-slate-700 uppercase font-mono">
            Organisasi Penerbit Form Cuti
          </span>
          <Link
            href="/dashboard/master/organization-logos"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah / Kelola Organisasi</span>
          </Link>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-xs flex items-center gap-2.5">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Belum ada profil dokumen cuti aktif — form memakai organisasi karyawan.</span>
        </div>
      </div>
    );
  }

  if (options.length === 1) {
    const only = options[0];
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="block text-xs font-semibold text-slate-700 uppercase font-mono">
            Organisasi Penerbit Form Cuti
          </span>
          <Link
            href="/dashboard/master/organization-logos"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah / Kelola Organisasi</span>
          </Link>
        </div>
        <div className="max-w-md p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={only.logoAssetKey}
              alt={only.name}
              className="h-10 w-10 object-contain rounded-lg bg-white border border-slate-200 p-1 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{only.name}</p>
              <p className="text-[11px] text-slate-500">Logo kop cetakan F4 mengikuti organisasi ini</p>
            </div>
          </div>
          {only.isEmployeeDefault && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
              Default
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span
          id="leave-org-picker-label"
          className="block text-xs font-semibold text-slate-700 uppercase font-mono"
        >
          Organisasi Penerbit Form Cuti
        </span>
        <Link
          href="/dashboard/master/organization-logos"
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah / Kelola Organisasi</span>
        </Link>
      </div>

      <div
        role="radiogroup"
        aria-labelledby="leave-org-picker-label"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        {options.map((opt) => {
          const isSelected = value === opt.organizationId;
          return (
            <button
              key={opt.organizationId}
              ref={(el) => {
                if (el) cardRefs.current.set(opt.organizationId, el);
                else cardRefs.current.delete(opt.organizationId);
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected || (value === null && opt.isEmployeeDefault) ? 0 : -1}
              onClick={() => onChange(opt.organizationId)}
              onKeyDown={(e) => handleKeyDown(e, opt.organizationId)}
              className={`min-h-14 text-left rounded-xl p-3.5 transition-all flex items-center justify-between gap-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                isSelected
                  ? 'bg-emerald-50/50 border-2 border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'bg-white border border-slate-200 hover:border-emerald-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={opt.logoAssetKey}
                  alt={opt.name}
                  className="h-10 w-10 object-contain rounded-lg bg-white border border-slate-200 p-1 shrink-0"
                />
                <div className="min-w-0">
                  <p
                    className={`text-xs font-bold truncate ${
                      isSelected ? 'text-emerald-950' : 'text-slate-900'
                    }`}
                  >
                    {opt.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {opt.isEmployeeDefault && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}
                    {isSelected && (
                      <span className="text-[10px] font-medium text-emerald-700">Dipilih</span>
                    )}
                  </div>
                </div>
              </div>

              <CheckCircle2
                className={`w-4 h-4 shrink-0 transition-opacity ${
                  isSelected ? 'text-emerald-600 opacity-100' : 'text-slate-300 opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

