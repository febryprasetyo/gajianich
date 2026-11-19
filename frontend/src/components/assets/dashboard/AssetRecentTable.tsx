'use client';

import React from 'react';
import Link from 'next/link';
import {
  HardDrive,
  ExternalLink,
  ShieldCheck,
  User,
  Building,
} from 'lucide-react';

export interface RecentAssetItem {
  id: number;
  assetCode: string;
  name: string;
  categoryName: string;
  assignedTo: string | null;
  departmentName: string | null;
  status: string;
  condition: string;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
}

export interface AssetRecentTableProps {
  data: RecentAssetItem[];
}

function getStatusBadge(status: string) {
  const norm = status.toLowerCase();
  if (norm === 'assigned') {
    return {
      label: 'Digunakan',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (norm === 'available') {
    return {
      label: 'Tersedia',
      className: 'bg-teal-50 text-teal-700 border-teal-200',
    };
  }
  if (norm === 'maintenance') {
    return {
      label: 'Perbaikan',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  if (norm === 'damaged') {
    return {
      label: 'Rusak',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }
  return {
    label: status,
    className: 'bg-slate-50 text-slate-700 border-slate-200',
  };
}

export default function AssetRecentTable({ data }: AssetRecentTableProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Aset Aktif Terkini
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Daftar perangkat terbaru yang baru saja didaftarkan ke sistem
          </p>
        </div>

        <Link
          href="/dashboard/assets"
          className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-2 rounded-xl border border-emerald-200 transition-colors w-fit"
        >
          <span>Buka Inventaris Lengkap</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {data.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2 border border-dashed border-slate-200 rounded-xl">
          <HardDrive className="w-8 h-8 text-slate-300" />
          <p className="text-xs">Belum ada aset terdata</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="pb-3 font-semibold">Kode & Perangkat</th>
                <th className="pb-3 font-semibold">Kategori</th>
                <th className="pb-3 font-semibold">Pemegang & Divisi</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-right">Garansi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {data.map((asset) => {
                const statusBadge = getStatusBadge(asset.status);
                const hasWarranty = !!asset.warrantyExpiry;
                const warrantyDate = hasWarranty
                  ? new Date(asset.warrantyExpiry!).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : null;

                return (
                  <tr key={asset.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-3.5 pr-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {asset.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {asset.assetCode}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 pr-4">
                      <span className="font-medium text-slate-600">
                        {asset.categoryName}
                      </span>
                    </td>

                    <td className="py-3.5 pr-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {asset.assignedTo || "Belum Ditetapkan"}
                          </span>
                        </div>
                        {asset.departmentName && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Building className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[140px]">{asset.departmentName}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-2 text-center">
                      <span
                        className={`inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.className}`}
                      >
                        {statusBadge.label}
                      </span>
                    </td>

                    <td className="py-3.5 pl-4 text-right">
                      {hasWarranty ? (
                        <div className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                          <ShieldCheck className="w-3 h-3" />
                          <span>{warrantyDate}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400">
                          <span>-</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
