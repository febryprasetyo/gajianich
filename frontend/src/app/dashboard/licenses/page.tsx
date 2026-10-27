'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import LicenseStats from '@/components/licenses/LicenseStats';
import LicenseFilters from '@/components/licenses/LicenseFilters';
import LicenseTable from '@/components/licenses/LicenseTable';
import LicenseFormModal from '@/components/licenses/LicenseFormModal';
import LicenseAllocationModal from '@/components/licenses/LicenseAllocationModal';
import { api } from '@/lib/api';
import { Key, Plus, AlertCircle } from 'lucide-react';
import {
  SoftwareLicense,
  Vendor,
  Employee,
  Asset,
  LocationItem,
} from '@/lib/licenses/types';

export default function LicensesPage() {
  // Data States
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Create/Edit Modal State
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<SoftwareLicense | null>(null);

  // Quick Allocate Modal State
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [allocatingLicense, setAllocatingLicense] = useState<SoftwareLicense | null>(null);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingLicense, setDeletingLicense] = useState<SoftwareLicense | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch Data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string for licenses
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedType) params.append('licenseType', selectedType);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedVendor) params.append('vendorId', selectedVendor);
      if (selectedLocation) params.append('locationId', selectedLocation);

      const queryString = params.toString() ? `?${params.toString()}` : '';

      const [licensesData, vendorsData, employeesData, assetsData, locationsData] =
        await Promise.all([
          api.get<SoftwareLicense[]>(`/licenses${queryString}`),
          api.get<Vendor[]>('/master/vendors').catch(() => []),
          api.get<Employee[]>('/employees').catch(() => []),
          api.get<Asset[]>('/assets').catch(() => []),
          api.get<LocationItem[]>('/master/locations').catch(() => []),
        ]);

      setLicenses(licensesData || []);
      setVendors(vendorsData || []);
      setEmployees(employeesData || []);
      setAssets(assetsData || []);
      setLocations(locationsData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load software licenses');
    } finally {
      setLoading(false);
    }
  }, [search, selectedType, selectedStatus, selectedVendor, selectedLocation]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingLicense(null);
    setIsLicenseModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (lic: SoftwareLicense) => {
    setEditingLicense(lic);
    setIsLicenseModalOpen(true);
  };

  // Open Allocate Modal
  const openAllocateModal = (lic: SoftwareLicense) => {
    setAllocatingLicense(lic);
    setIsAllocateModalOpen(true);
  };

  // Open Delete Modal
  const openDeleteModal = (lic: SoftwareLicense) => {
    setDeletingLicense(lic);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deletingLicense) return;
    try {
      setDeleteSubmitting(true);
      setDeleteError(null);
      await api.delete(`/licenses/${deletingLicense.id}`);
      setIsDeleteModalOpen(false);
      setDeletingLicense(null);
      fetchData();
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus lisensi');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
                <Key className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Software License Catalog
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage software keys, CD/Dongle hardware keys, OEM OS bundles, subscriptions, and seat allocations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Software License</span>
            </button>
          </div>
        </div>

        {/* Top 4 KPI Metrics */}
        <LicenseStats licenses={licenses} />

        {/* Filter & Search Toolbar */}
        <LicenseFilters
          search={search}
          onSearchChange={setSearch}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          selectedVendor={selectedVendor}
          onVendorChange={setSelectedVendor}
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
          vendors={vendors}
          locations={locations}
        />

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="flex-1">{error}</span>
            <button
              onClick={fetchData}
              className="underline hover:text-rose-800 cursor-pointer font-bold"
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Main Software Catalog Table */}
        <LicenseTable
          licenses={licenses}
          loading={loading}
          search={search}
          selectedType={selectedType}
          selectedStatus={selectedStatus}
          selectedVendor={selectedVendor}
          onAllocate={openAllocateModal}
          onEdit={openEditModal}
          onDelete={openDeleteModal}
        />
      </div>

      {/* License Create/Edit Modal */}
      <LicenseFormModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        onSuccess={fetchData}
        initialLicense={editingLicense}
        vendors={vendors}
        locations={locations}
      />

      {/* Quick Allocate Modal */}
      <LicenseAllocationModal
        isOpen={isAllocateModalOpen}
        onClose={() => setIsAllocateModalOpen(false)}
        onSuccess={fetchData}
        license={allocatingLicense}
        employees={employees}
        assets={assets}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteSubmitting}
        error={deleteError}
        title="Hapus Software License"
        description="Apakah Anda yakin ingin menghapus lisensi ini dari katalog? Seluruh alokasi seat yang masih aktif akan terputus."
        itemName={deletingLicense ? deletingLicense.name : null}
        itemDetails={
          deletingLicense
            ? [
                { label: 'License Type', value: deletingLicense.licenseType || 'Perpetual' },
                {
                  label: 'Allocated Seats',
                  value: `${deletingLicense.usedSeats} / ${deletingLicense.totalSeats} Seats`,
                },
                { label: 'Vendor', value: deletingLicense.vendorName || '—' },
              ]
            : undefined
        }
        confirmText="Ya, Hapus Lisensi"
        variant="danger"
      />
    </DashboardLayout>
  );
}
