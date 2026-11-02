'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { Vendor, LocationItem } from '@/lib/licenses/types';

export interface LicenseFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  selectedVendor: string;
  onVendorChange: (value: string) => void;
  selectedLocation: string;
  onLocationChange: (value: string) => void;
  vendors: Vendor[];
  locations: LocationItem[];
}

export default function LicenseFilters({
  search,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedStatus,
  onStatusChange,
  selectedVendor,
  onVendorChange,
  selectedLocation,
  onLocationChange,
  vendors,
  locations,
}: LicenseFiltersProps) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-5 shadow-2xs space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search Input */}
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama software, kunci lisensi, vendor..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans text-slate-800"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* License Type Filter */}
        <div>
          <select
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700 cursor-pointer"
          >
            <option value="">Semua Tipe Lisensi</option>
            <option value="CD / Dongle">CD / Dongle</option>
            <option value="OEM Bundled">OEM Bundled</option>
            <option value="Subscription">Langganan (Subscription)</option>
            <option value="Perpetual">Permanen (Perpetual)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700 cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="Active">Aktif</option>
            <option value="Expired">Kedaluwarsa</option>
            <option value="Deactivated">Dinonaktifkan</option>
          </select>
        </div>

        {/* Vendor Filter */}
        <div>
          <select
            value={selectedVendor}
            onChange={(e) => onVendorChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700 cursor-pointer"
          >
            <option value="">Semua Vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {/* Office Location / PT Filter */}
        <div>
          <select
            value={selectedLocation}
            onChange={(e) => onLocationChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700 cursor-pointer"
          >
            <option value="">Semua Lokasi / Entitas</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.code} - {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
