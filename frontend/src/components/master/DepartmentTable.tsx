'use client';

import React from 'react';
import { Building2, Pencil, Trash2, Loader2, Calendar } from 'lucide-react';

export interface DepartmentItem {
  id: number;
  code: string;
  name: string;
  createdAt?: string;
}

interface DepartmentTableProps {
  departments: DepartmentItem[];
  loading: boolean;
  onEdit: (dept: DepartmentItem) => void;
  onDelete: (dept: DepartmentItem) => void;
}

export default function DepartmentTable({
  departments,
  loading,
  onEdit,
  onDelete,
}: DepartmentTableProps) {
  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500 font-mono text-xs">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span>Fetching organizational departments...</span>
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="p-12 text-center">
        <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-700 font-semibold text-sm">No departments found</p>
        <p className="text-xs text-slate-500 mt-1">
          Register company divisions and cost centers to classify employee assets.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 font-mono uppercase tracking-wider">
            <th className="py-3.5 px-5 font-semibold">Dept Code</th>
            <th className="py-3.5 px-5 font-semibold">Department Name</th>
            <th className="py-3.5 px-5 font-semibold">Created Date</th>
            <th className="py-3.5 px-5 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {departments.map((dept) => (
            <tr key={dept.id} className="hover:bg-emerald-50/30 transition-colors group">
              <td className="py-4 px-5 font-mono">
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  {dept.code}
                </span>
              </td>
              <td className="py-4 px-5">
                <p className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  {dept.name}
                </p>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">ID: #{dept.id}</p>
              </td>
              <td className="py-4 px-5 font-mono text-[11px] text-slate-500">
                {dept.createdAt ? (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(dept.createdAt).toLocaleDateString('id-ID')}</span>
                  </div>
                ) : (
                  '—'
                )}
              </td>
              <td className="py-4 px-5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onEdit(dept)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                    title="Edit Department"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(dept)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete Department"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
