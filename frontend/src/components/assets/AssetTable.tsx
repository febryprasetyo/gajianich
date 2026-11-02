'use client';

import React from 'react';
import Link from 'next/link';
import {
  HardDrive,
  Plus,
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Edit,
  Trash2,
} from 'lucide-react';
import { VerificationBadge } from '@/components/custodians/VerificationBadge';
import { isComputerCategoryName } from '@/lib/assetForm';
import { AssetItem } from '@/lib/assets/types';

export interface AssetTableProps {
  assets: AssetItem[];
  loading: boolean;
  error: string | null;
  canManage: boolean;
  canLifecycle: boolean;
  page: number;
  limit: number;
  totalCount: number;
  onPageChange: (newPage: number) => void;
  onAssign: (asset: AssetItem) => void;
  onReturn: (asset: AssetItem) => void;
  onEdit: (asset: AssetItem) => void;
  onDelete: (asset: AssetItem) => void;
  onRegisterFirst: () => void;
}

export const getAssetStatusBadge = (status: string) => {
  switch (status) {
    case 'Available':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Assigned':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Maintenance':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Disposed':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

export const getAssetConditionBadge = (cond: string) => {
  switch (cond) {
    case 'Good':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Fair':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Poor':
    case 'Damaged':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

export default function AssetTable({
  assets,
  loading,
  error,
  canManage,
  canLifecycle,
  page,
  limit,
  totalCount,
  onPageChange,
  onAssign,
  onReturn,
  onEdit,
  onDelete,
  onRegisterFirst,
}: AssetTableProps) {
  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="glass-panel rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-500 font-mono text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span>Memuat data inventaris aset...</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 text-xs font-mono space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
          <p>{error}</p>
        </div>
      ) : assets.length === 0 ? (
        <div className="p-16 text-center text-slate-400 font-mono text-xs space-y-3">
          <HardDrive className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-slate-600 font-bold">Tidak ada aset yang sesuai dengan kriteria filter.</p>
          {canManage && (
            <button
              onClick={onRegisterFirst}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold inline-flex items-center gap-2 text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Daftarkan Aset Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-4 py-3.5 font-bold">Label Aset</th>
                <th className="px-4 py-3.5 font-bold">Perangkat & Spesifikasi</th>
                <th className="px-4 py-3.5 font-bold">Kategori</th>
                <th className="px-4 py-3.5 font-bold">Lokasi</th>
                <th className="px-4 py-3.5 font-bold">Penanggung Jawab</th>
                <th className="px-4 py-3.5 font-bold">Kondisi</th>
                <th className="px-4 py-3.5 font-bold">Status</th>
                <th className="px-4 py-3.5 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {assets.map((asset) => {
                const isComputer = isComputerCategoryName(asset.categoryName);
                return (
                  <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600 whitespace-nowrap">
                      <Link
                        href={`/dashboard/assets/${asset.id}`}
                        className="hover:underline flex items-center gap-1.5"
                      >
                        <span>{asset.assetCode}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" />
                      </Link>
                    </td>

                    <td className="px-4 py-3 min-w-[220px]">
                      <div className="font-bold text-slate-900 leading-tight">{asset.name}</div>
                      {isComputer && asset.computerSpecs ? (
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span>{asset.computerSpecs.cpuName}</span>
                          <span>•</span>
                          <span>{asset.computerSpecs.ramSizeGb}GB RAM</span>
                          <span>•</span>
                          <span>{asset.computerSpecs.disk1SizeGb}GB</span>
                          {asset.accessories && asset.accessories.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              +{asset.accessories.length} Acc
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {asset.serialNumber ? `S/N: ${asset.serialNumber}` : 'Standard Asset'}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px]">
                        {asset.categoryName || 'IT Asset'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {asset.locationName || 'Unassigned Facility'}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {asset.currentCustodian ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <div className="font-bold text-slate-900 text-xs">
                              {asset.currentCustodian.displayName}
                            </div>
                            <VerificationBadge
                              status={asset.currentCustodian.verificationStatus}
                            />
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {asset.currentCustodian.employeeCode ||
                              asset.currentCustodian.unitText ||
                              'Manual holder'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Available in Stock</span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${getAssetConditionBadge(
                          asset.condition
                        )}`}
                      >
                        {asset.condition}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${getAssetStatusBadge(
                          asset.status
                        )}`}
                      >
                        {asset.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* Detail Link */}
                        <Link
                          href={`/dashboard/assets/${asset.id}`}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>

                        {/* Lifecycle Quick Actions */}
                        {canLifecycle && (
                          <>
                            {asset.status === 'Available' ? (
                              <button
                                onClick={() => onAssign(asset)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Assign to holder"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            ) : asset.status === 'Assigned' ? (
                              <button
                                onClick={() => onReturn(asset)}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="Return Asset to Stock"
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                            ) : null}
                          </>
                        )}

                        {/* Edit / Delete Admin Actions */}
                        {canManage && (
                          <>
                            <button
                              onClick={() => onEdit(asset)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Asset"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDelete(asset)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Asset"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalCount > limit && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
          <span>
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of{' '}
            {totalCount} assets
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="font-bold text-slate-800">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
