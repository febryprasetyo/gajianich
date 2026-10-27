'use client';

import React from 'react';
import Link from 'next/link';
import {
  Key,
  Eye,
  UserPlus,
  Pencil,
  Trash2,
  Building2,
  AlertTriangle,
  Clock,
  Loader2,
  Disc,
  Laptop,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { SoftwareLicense } from '@/lib/licenses/types';

export interface LicenseTableProps {
  licenses: SoftwareLicense[];
  loading: boolean;
  search: string;
  selectedType: string;
  selectedStatus: string;
  selectedVendor: string;
  onAllocate: (license: SoftwareLicense) => void;
  onEdit: (license: SoftwareLicense) => void;
  onDelete: (license: SoftwareLicense) => void;
}

export const renderLicenseTypeBadge = (type?: string | null) => {
  switch (type) {
    case 'CD / Dongle':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold font-mono bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
          <Disc className="w-3.5 h-3.5" />
          <span>CD / Dongle</span>
        </span>
      );
    case 'OEM Bundled':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
          <Laptop className="w-3.5 h-3.5" />
          <span>OEM Bundled</span>
        </span>
      );
    case 'Subscription':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold font-mono bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
          <CreditCard className="w-3.5 h-3.5" />
          <span>Subscription</span>
        </span>
      );
    case 'Perpetual':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Perpetual</span>
        </span>
      );
  }
};

export const maskLicenseKey = (key?: string | null) => {
  if (!key) return '—';
  if (key.length <= 8) return '••••' + key.slice(-4);
  return '••••-••••-••••-' + key.slice(-4);
};

export default function LicenseTable({
  licenses,
  loading,
  search,
  selectedType,
  selectedStatus,
  selectedVendor,
  onAllocate,
  onEdit,
  onDelete,
}: LicenseTableProps) {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-3.5 px-5">Software Name & Details</th>
              <th className="py-3.5 px-4">Type</th>
              <th className="py-3.5 px-4">Seat Utilization</th>
              <th className="py-3.5 px-4">Expiration Date</th>
              <th className="py-3.5 px-4">Vendor</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-sans">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                    <span className="font-mono text-xs text-slate-500">
                      Loading Software Catalog...
                    </span>
                  </div>
                </td>
              </tr>
            ) : licenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <div className="max-w-xs mx-auto text-slate-400 space-y-2">
                    <Key className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">No software licenses found</p>
                    <p className="text-xs text-slate-500">
                      {search || selectedType || selectedStatus || selectedVendor
                        ? 'Try adjusting your filters or search query.'
                        : 'Click "Add Software License" to register your first license.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              licenses.map((lic) => {
                const percentUsed = Math.min(
                  100,
                  Math.round(((lic.usedSeats || 0) / (lic.totalSeats || 1)) * 100)
                );
                const isFull = lic.usedSeats >= lic.totalSeats;

                // Expiration calculation
                let expText = 'No Expiry (Perpetual)';
                let isExpiringSoon = false;
                let isExpired = lic.status === 'Expired';
                if (lic.expirationDate) {
                  const expDate = new Date(lic.expirationDate);
                  expText = expDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                  if (expDate <= thirtyDaysFromNow && expDate > now) {
                    isExpiringSoon = true;
                  } else if (expDate <= now) {
                    isExpired = true;
                  }
                }

                return (
                  <tr key={lic.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Software Name & Key */}
                    <td className="py-4 px-5">
                      <div className="space-y-1">
                        <Link
                          href={`/dashboard/licenses/${lic.id}`}
                          className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>{lic.name}</span>
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60 inline-flex items-center gap-1">
                            <span className="text-slate-400 font-medium">Key:</span>{' '}
                            {maskLicenseKey(lic.licenseKey)}
                          </span>
                          <span className="text-[11px] font-sans text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 inline-flex items-center gap-1.5 font-medium">
                            <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="text-slate-400 font-normal">Location:</span>
                            <span
                              className="font-semibold text-slate-800"
                              title={
                                lic.locationName
                                  ? `${lic.locationCode || ''} - ${lic.locationName}`
                                  : lic.notes || 'Unassigned Location'
                              }
                            >
                              {lic.locationName
                                ? lic.locationCode
                                  ? `${lic.locationCode} - ${lic.locationName}`
                                  : lic.locationName
                                : lic.notes || '—'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* License Type Badge */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {renderLicenseTypeBadge(lic.licenseType)}
                    </td>

                    {/* Seat Utilization */}
                    <td className="py-4 px-4 min-w-[160px]">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-semibold text-slate-700">
                            {lic.usedSeats} / {lic.totalSeats} Seats
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              isFull ? 'text-red-600' : 'text-slate-500'
                            }`}
                          >
                            {percentUsed}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              isFull
                                ? 'bg-red-600'
                                : percentUsed >= 80
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percentUsed}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Expiration Date */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium text-slate-800">{expText}</div>
                        {isExpired && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" /> Expired
                          </span>
                        )}
                        {isExpiringSoon && !isExpired && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Clock className="w-3 h-3" /> Expiring Soon
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Vendor */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {lic.vendorName || 'Direct / N/A'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono ${
                          lic.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : lic.status === 'Expired'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            lic.status === 'Active'
                              ? 'bg-emerald-600 animate-pulse'
                              : lic.status === 'Expired'
                              ? 'bg-red-600'
                              : 'bg-slate-400'
                          }`}
                        />
                        {lic.status || 'Active'}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-4 px-5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Detail */}
                        <Link
                          href={`/dashboard/licenses/${lic.id}`}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="View License Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>

                        {/* Allocate Seat */}
                        <button
                          onClick={() => onAllocate(lic)}
                          disabled={isFull}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isFull
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={isFull ? 'No seats available' : 'Quick Allocate Seat'}
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => onEdit(lic)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit License"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => onDelete(lic)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete License"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
