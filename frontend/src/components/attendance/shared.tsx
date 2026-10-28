'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Search, Clock, type LucideIcon } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { durationLabel, statusLabels } from '@/lib/attendance/domain';
import type { AttendanceStatus, Employee } from '@/lib/attendance/types';

export function Heading({ 
  title, 
  description, 
  icon: Icon = Clock,
  children 
}: { 
  title: string; 
  description: string; 
  icon?: LucideIcon;
  children?: React.ReactNode 
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

export function Empty({ text = 'Tidak ada data untuk filter ini.' }: { text?: string }) {
  return <div className="px-6 py-14 text-center text-sm text-slate-500" role="status">{text}</div>;
}

export function SearchInput({ value, onChange, placeholder = 'Cari nama atau ID karyawan' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="relative block w-full sm:w-72">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      <input
        className="hr-input hr-search-input !pl-10 text-slate-800 placeholder:text-slate-400"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  );
}

export function Status({ status, dayOff = false }: { status: AttendanceStatus; dayOff?: boolean }) {
  const color = dayOff ? 'bg-slate-100 text-slate-600' : status === 'PRESENT' || status === 'DINAS_LUAR' ? 'bg-emerald-50 text-emerald-800' : status === 'ALPHA' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-900';
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-medium ${color}`}>{dayOff ? 'Libur' : statusLabels[status]}</span>;
}

export function EmployeeName({ employee, detail }: { employee: Employee; detail?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600" aria-hidden="true">
        {employee.fullName.split(' ').slice(0, 2).map(n => n[0]).join('')}
      </span>
      <div>
        <Link className="font-semibold text-slate-800 hover:text-red-700 hover:underline" href={`/dashboard/attendance/employees/${employee.id}`}>
          {employee.fullName}
        </Link>
        <p className="mt-1 text-[10px] text-slate-500">
          {employee.employeeCode ? `No. ID: ${employee.employeeCode}` : 'Tanpa No. ID'}
          {detail ? ` · ${detail}` : ''}
        </p>
      </div>
    </div>
  );
}

export function Pagination({ total, page, onChange, pageSize = 10 }: { total: number; page: number; onChange: (p: number) => void; pageSize?: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
      <span>{total ? (page - 1) * pageSize + 1 : 0}–{Math.min(total, page * pageSize)} dari {total} data</span>
      <div className="flex items-center gap-2">
        <button className="hr-btn !px-2.5" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={16} />
        </button>
        <span className="font-medium text-slate-600">Halaman {page} / {pages}</span>
        <button className="hr-btn !px-2.5" aria-label="Halaman berikutnya" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export interface Field {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'time' | 'textarea' | 'select';
  value?: string | number;
  required?: boolean;
  options?: { value: string | number; label: string }[];
  disabled?: boolean;
  hint?: string;
}

export function FormDialog({ title, description, fields, onClose, onSubmit, submitLabel = 'Simpan perubahan' }: { title: string; description?: string; fields: Field[]; onClose: () => void; onSubmit: (values: FormData) => Promise<void>; submitLabel?: string }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <ModalShell isOpen onClose={onClose} title={title} subtitle={description} isLoading={busy} footer={<><button className="hr-btn" onClick={onClose} disabled={busy}>Batal</button><button type="submit" form="attendance-form" className="hr-btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : submitLabel}</button></>}>
      <form id="attendance-form" className="space-y-4" onSubmit={async event => { event.preventDefault(); const values = new FormData(event.currentTarget); setBusy(true); setError(''); try { await onSubmit(values); onClose(); } catch (err) { setError(err instanceof Error ? err.message : 'Perubahan gagal disimpan.'); } finally { setBusy(false); } }}>
        {fields.map(field => (
          <label className="block space-y-1.5 text-xs font-medium text-slate-700" key={field.name}>
            <span>{field.label}{field.required ? ' *' : ''}</span>
            {field.type === 'select' ? (
              <select className="hr-input" name={field.name} defaultValue={field.value ?? ''} required={field.required} disabled={field.disabled || busy}>
                {field.options?.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea rows={3} className="hr-input" name={field.name} defaultValue={field.value} required={field.required} disabled={busy} />
            ) : (
              <input
                className="hr-input"
                name={field.name}
                type={field.type ?? 'text'}
                defaultValue={field.value}
                required={field.required}
                disabled={field.disabled || busy}
                min={field.type === 'number' ? 0 : undefined}
                step={field.type === 'number' ? 1 : undefined}
                onClick={
                  field.type === 'time' || field.type === 'date'
                    ? e => {
                        try {
                          if (typeof e.currentTarget.showPicker === 'function') {
                            e.currentTarget.showPicker();
                          }
                        } catch {
                          // ignore if showPicker is unsupported or already active
                        }
                      }
                    : undefined
                }
              />
            )}
            {field.hint && <span className="block font-normal text-slate-500">{field.hint}</span>}
          </label>
        ))}
        {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      </form>
    </ModalShell>
  );
}

export function Totals({
  late,
  overtime,
  count,
  sakit = 0,
  izin = 0,
  cuti = 0,
  absent = 0,
}: {
  late: number;
  overtime: number;
  count: number;
  sakit?: number;
  izin?: number;
  cuti?: number;
  absent?: number;
}) {
  const items = [
    { label: 'Hadir', value: String(count) },
    { label: 'Keterlambatan', value: durationLabel(late) },
    { label: 'Lembur', value: durationLabel(overtime) },
    { label: 'Izin', value: String(izin) },
    { label: 'Cuti', value: String(cuti) },
    { label: 'Sakit', value: String(sakit) },
    { label: 'Tidak Hadir', value: String(absent) },
  ];

  return (
    <div className="hr-panel overflow-x-auto">
      <div className="grid min-w-[800px] grid-cols-7 divide-x divide-slate-200">
        {items.map(item => (
          <div className="px-4 py-3.5 text-left" key={item.label}>
            <span className="block text-base font-bold tabular-nums text-slate-900">
              {item.value}
            </span>
            <span className="mt-0.5 block text-[10px] font-medium leading-4 text-slate-600 truncate">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
