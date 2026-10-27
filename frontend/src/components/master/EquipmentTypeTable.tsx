'use client';

import React from 'react';
import { Shapes, Pencil, Trash2, Loader2, Calendar } from 'lucide-react';

export interface EquipmentTypeItem {
  id: number;
  name: string;
  codePrefix: string;
  createdAt?: string;
}

interface EquipmentTypeTableProps {
  equipmentTypes: EquipmentTypeItem[];
  loading: boolean;
  canManage: boolean;
  onEdit: (item: EquipmentTypeItem) => void;
  onDelete: (item: EquipmentTypeItem) => void;
}

export default function EquipmentTypeTable({
  equipmentTypes,
  loading,
  canManage,
  onEdit,
  onDelete,
}: EquipmentTypeTableProps) {
  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500 font-mono text-xs">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span>Fetching equipment catalog...</span>
      </div>
    );
  }

  if (equipmentTypes.length === 0) {
    return (
      <div className="p-12 text-center">
        <Shapes className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-700 font-semibold text-sm">No equipment types found</p>
        <p className="text-xs text-slate-500 mt-1">
          Register hardware categories to configure automated tag generation.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 font-mono uppercase tracking-wider">
            <th className="py-3.5 px-5 font-semibold">Prefix Tag</th>
            <th className="py-3.5 px-5 font-semibold">Equipment Type Name</th>
            <th className="py-3.5 px-5 font-semibold">Created Date</th>
            {canManage && <th className="py-3.5 px-5 font-semibold text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {equipmentTypes.map((type) => (
            <tr key={type.id} className="hover:bg-emerald-50/30 transition-colors group">
              <td className="py-4 px-5 font-mono">
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  {type.codePrefix}
                </span>
              </td>
              <td className="py-4 px-5">
                <p className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  {type.name}
                </p>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">Type ID: #{type.id}</p>
              </td>
              <td className="py-4 px-5 font-mono text-[11px] text-slate-500">
                {type.createdAt ? (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(type.createdAt).toLocaleDateString('id-ID')}</span>
                  </div>
                ) : (
                  '—'
                )}
              </td>
              {canManage && (
                <td className="py-4 px-5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(type)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                      title="Edit Category"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(type)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
