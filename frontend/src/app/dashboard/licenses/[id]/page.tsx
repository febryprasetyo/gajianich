'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import LicenseCredentialCard from '@/components/licenses/LicenseCredentialCard';
import SeatUtilizationCard from '@/components/licenses/SeatUtilizationCard';
import LicenseAllocationsTable from '@/components/licenses/LicenseAllocationsTable';
import LicenseFormModal from '@/components/licenses/LicenseFormModal';
import LicenseAllocationModal from '@/components/licenses/LicenseAllocationModal';
import { renderLicenseTypeBadge } from '@/components/licenses/LicenseTable';
import { api } from '@/lib/api';
import {
  ArrowLeft,
  UserPlus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  SoftwareLicenseDetail,
  LicenseAllocation,
  Vendor,
  LocationItem,
  Employee,
  Asset,
} from '@/lib/licenses/types';

export default function LicenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const licenseId = Number(resolvedParams.id);
  const router = useRouter();

  // Data States
  const [license, setLicense] = useState<SoftwareLicenseDetail | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Allocate Seat Modal State
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);

  // Revoke Seat Modal State
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [revokingAllocation, setRevokingAllocation] = useState<LicenseAllocation | null>(null);
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Edit License Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Delete License Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch Data
  const fetchLicenseData = useCallback(async () => {
    if (isNaN(licenseId)) {
      setError('Invalid license ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [licData, vendorsData, locationsData, employeesData, assetsData] =
        await Promise.all([
          api.get<SoftwareLicenseDetail>(`/licenses/${licenseId}`),
          api.get<Vendor[]>('/master/vendors').catch(() => []),
          api.get<LocationItem[]>('/master/locations').catch(() => []),
          api.get<Employee[]>('/employees').catch(() => []),
          api.get<Asset[]>('/assets').catch(() => []),
        ]);

      setLicense(licData);
      setVendors(vendorsData || []);
      setLocations(locationsData || []);
      setEmployees(employeesData || []);
      setAssets(assetsData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load software license detail');
    } finally {
      setLoading(false);
    }
  }, [licenseId]);

  useEffect(() => {
    fetchLicenseData();
  }, [fetchLicenseData]);

  // Handle Revoke Confirmation
  const handleRevokeConfirm = async () => {
    if (!license || !revokingAllocation) return;

    try {
      setRevokeSubmitting(true);
      setRevokeError(null);
      await api.post(`/licenses/${license.id}/revoke`, {
        allocationId: revokingAllocation.id,
      });
      setIsRevokeModalOpen(false);
      setRevokingAllocation(null);
      fetchLicenseData();
    } catch (err: any) {
      setRevokeError(err.message || 'Failed to revoke license allocation');
    } finally {
      setRevokeSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!license) return;
    try {
      setDeleteSubmitting(true);
      setDeleteError(null);
      await api.delete(`/licenses/${license.id}`);
      setIsDeleteModalOpen(false);
      router.push('/dashboard/licenses');
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus software license');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openRevokeModal = (alloc: LicenseAllocation) => {
    setRevokingAllocation(alloc);
    setRevokeError(null);
    setIsRevokeModalOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-24 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
          <p className="mt-3 text-sm text-slate-500 font-mono">Loading License Details...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !license) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">License Not Found</h2>
            <p className="text-xs text-slate-500 mt-1">{error || 'Data could not be retrieved.'}</p>
          </div>
          <Link
            href="/dashboard/licenses"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Catalog</span>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const isFull = license.usedSeats >= license.totalSeats;

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/licenses"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Software Catalog</span>
          </Link>
        </div>

        {/* Workspace Top Header */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {license.name}
                </h1>
                {renderLicenseTypeBadge(license.licenseType)}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                    license.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : license.status === 'Expired'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      license.status === 'Active' ? 'bg-emerald-600 animate-pulse' : 'bg-red-600'
                    }`}
                  />
                  {license.status}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 flex items-center gap-2">
                <span>
                  Vendor:{' '}
                  <span className="font-semibold text-slate-800">
                    {license.vendorName || 'Direct / N/A'}
                  </span>
                </span>
                <span>•</span>
                <span>
                  Registered ID:{' '}
                  <span className="font-semibold text-slate-800">#LIC-{license.id}</span>
                </span>
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setIsAllocateModalOpen(true)}
                disabled={isFull}
                className={`px-4 py-2.5 rounded-xl font-semibold text-xs md:text-sm shadow-md flex items-center gap-2 transition-all cursor-pointer ${
                  isFull
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-[0.98]'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Allocate Seat</span>
              </button>

              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs md:text-sm rounded-xl border border-slate-200 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
                <span>Edit License</span>
              </button>

              <button
                onClick={() => {
                  setDeleteError(null);
                  setIsDeleteModalOpen(true);
                }}
                className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl border border-transparent hover:border-emerald-200 transition-colors cursor-pointer"
                title="Delete License"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Detailed License Bento Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <LicenseCredentialCard license={license} />
          <SeatUtilizationCard
            license={license}
            onAllocate={() => setIsAllocateModalOpen(true)}
          />
        </div>

        {/* Active Seat Allocations Workspace Table */}
        <LicenseAllocationsTable
          allocations={license.allocations}
          isFull={isFull}
          onAllocate={() => setIsAllocateModalOpen(true)}
          onRevoke={openRevokeModal}
        />
      </div>

      {/* Edit License Modal (Shared!) */}
      <LicenseFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchLicenseData}
        initialLicense={license}
        vendors={vendors}
        locations={locations}
      />

      {/* Allocate Seat Modal (Shared!) */}
      <LicenseAllocationModal
        isOpen={isAllocateModalOpen}
        onClose={() => setIsAllocateModalOpen(false)}
        onSuccess={fetchLicenseData}
        license={license}
        employees={employees}
        assets={assets}
      />

      {/* Revoke Seat Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isRevokeModalOpen}
        onClose={() => {
          setIsRevokeModalOpen(false);
          setRevokingAllocation(null);
        }}
        onConfirm={handleRevokeConfirm}
        title="Cabut Alokasi Seat Lisensi"
        description="Apakah Anda yakin ingin mencabut akses kursi software lisensi ini dari pemegang terpilih? Kunci lisensi atau CD/Dongle akan dikembalikan ke status tersedia."
        itemName={
          revokingAllocation
            ? revokingAllocation.employeeId
              ? `${revokingAllocation.employeeName} (${revokingAllocation.employeeCode})`
              : `${revokingAllocation.assetName} (${revokingAllocation.assetCode})`
            : null
        }
        itemDetails={
          revokingAllocation
            ? [
                {
                  label: 'Target Type',
                  value: revokingAllocation.employeeId ? 'Employee' : 'Hardware Asset',
                },
                {
                  label: 'Software',
                  value: license.name,
                },
                {
                  label: 'Tgl Alokasi',
                  value: new Date(revokingAllocation.allocatedAt).toLocaleDateString('id-ID'),
                },
              ]
            : []
        }
        confirmText="Cabut Seat"
        cancelText="Batal"
        variant="warning"
        isLoading={revokeSubmitting}
        error={revokeError}
      />

      {/* Delete License Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Hapus Software License"
        description="Apakah Anda yakin ingin menghapus lisensi ini secara permanen? Seluruh riwayat dan alokasi yang terkait akan ikut terhapus."
        itemName={license.name}
        itemDetails={[
          { label: 'License Type', value: license.licenseType || 'Perpetual' },
          { label: 'Total Allocated', value: `${license.usedSeats} / ${license.totalSeats} Seats` },
          { label: 'Vendor', value: license.vendorName || '—' },
        ]}
        confirmText="Ya, Hapus Lisensi"
        variant="danger"
        isLoading={deleteSubmitting}
        error={deleteError}
      />
    </DashboardLayout>
  );
}
