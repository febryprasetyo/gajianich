'use client';

import React from 'react';
import { Mail, Phone, Pencil, Trash2, Store, Loader2 } from 'lucide-react';

export interface VendorItem {
  id: number;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt?: string;
}

interface VendorTableProps {
  vendors: VendorItem[];
  loading: boolean;
  onEdit: (vendor: VendorItem) => void;
  onDelete: (vendor: VendorItem) => void;
}

export default function VendorTable({
  vendors,
  loading,
  onEdit,
  onDelete,
}: VendorTableProps) {
  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500 font-mono text-xs">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span>Fetching vendor directory...</span>
      </div>
    );
  }

  if (vendors.length === 0) {
    return (
      <div className="p-12 text-center">
        <Store className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-700 font-semibold text-sm">No vendors found</p>
        <p className="text-xs text-slate-500 mt-1">
          Try adjusting your search criteria or register a new equipment supplier.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 font-mono uppercase tracking-wider">
            <th className="py-3.5 px-5 font-semibold">Vendor Company</th>
            <th className="py-3.5 px-5 font-semibold">Contact Person</th>
            <th className="py-3.5 px-5 font-semibold">Contact Details</th>
            <th className="py-3.5 px-5 font-semibold">Office Address</th>
            <th className="py-3.5 px-5 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {vendors.map((vendor) => (
            <tr key={vendor.id} className="hover:bg-emerald-50/30 transition-colors group">
              <td className="py-4 px-5">
                <p className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  {vendor.name}
                </p>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                  ID: #{vendor.id.toString().padStart(3, '0')}
                </p>
              </td>
              <td className="py-4 px-5 font-medium text-slate-700">
                {vendor.contactName || <span className="text-slate-400 italic font-mono">Unspecified</span>}
              </td>
              <td className="py-4 px-5 font-mono text-[11px] text-slate-600 space-y-1">
                {vendor.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{vendor.email}</span>
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{vendor.phone}</span>
                  </div>
                )}
                {!vendor.email && !vendor.phone && (
                  <span className="text-slate-400 italic">No contact info</span>
                )}
              </td>
              <td className="py-4 px-5 text-slate-600 max-w-xs truncate" title={vendor.address || ''}>
                {vendor.address || <span className="text-slate-400 italic font-mono">No address provided</span>}
              </td>
              <td className="py-4 px-5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onEdit(vendor)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                    title="Edit Vendor"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(vendor)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete Vendor"
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
