'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import VendorTable, { type VendorItem } from '@/components/master/VendorTable';
import VendorFormModal from '@/components/master/VendorFormModal';
import { api } from '@/lib/api';
import {
  Store,
  Plus,
  Search,
  AlertCircle,
  Building2,
  UserCheck,
} from 'lucide-react';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [search, setSearch] = useState('');
  const [deletingVendor, setDeletingVendor] = useState<VendorItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<VendorItem[]>('/master/vendors');
      setVendors(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const openCreateModal = () => {
    setEditingVendor(null);
    setIsModalOpen(true);
  };

  const openEditModal = (vendor: VendorItem) => {
    setEditingVendor(vendor);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingVendor) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete('/master/vendors/' + deletingVendor.id);
      setDeletingVendor(null);
      fetchVendors();
    } catch (err: unknown) {
      setDeleteError((err as Error).message || 'Gagal menghapus vendor');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.contactName && v.contactName.toLowerCase().includes(search.toLowerCase())) ||
      (v.email && v.email.toLowerCase().includes(search.toLowerCase())) ||
      (v.address && v.address.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
                <Store className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Vendor Directory
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Authorized equipment manufacturers, system integrators, and software license distributors.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>New Vendor</span>
          </button>
        </div>

        {/* Bento Stat Header Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 bg-white border border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-mono">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Registered Vendors</p>
              <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">{vendors.length}</p>
            </div>
          </div>
          <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 bg-white border border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-mono">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">With Contact Person</p>
              <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                {vendors.filter((v) => Boolean(v.contactName)).length}
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="glass-panel p-3.5 rounded-2xl flex items-center justify-between gap-4 bg-white border border-slate-200">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor company, contact person, email, address..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono"
            />
          </div>
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Showing <strong className="text-slate-900">{filtered.length}</strong> of {vendors.length}
          </span>
        </div>

        {/* Error Alert Display */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Glass Table */}
        <div className="glass-panel rounded-2xl overflow-hidden shadow-sm bg-white border border-slate-200">
          <VendorTable
            vendors={filtered}
            loading={loading}
            onEdit={openEditModal}
            onDelete={(vendor) => {
              setDeletingVendor(vendor);
              setDeleteError(null);
            }}
          />
        </div>
      </div>

      {/* Create / Edit Vendor Modal */}
      <VendorFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        vendor={editingVendor}
        onSuccess={fetchVendors}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingVendor)}
        onClose={() => {
          setDeletingVendor(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Hapus Vendor"
        description="Apakah Anda yakin ingin menghapus vendor ini dari direktori? Tindakan ini tidak dapat dibatalkan."
        itemName={deletingVendor?.name}
        itemDetails={
          deletingVendor
            ? [
                { label: 'Nama Vendor', value: deletingVendor.name },
                ...(deletingVendor.contactName ? [{ label: 'Kontak', value: deletingVendor.contactName }] : []),
                ...(deletingVendor.email ? [{ label: 'Email', value: deletingVendor.email }] : []),
              ]
            : []
        }
        confirmText="Hapus Vendor"
        variant="danger"
        isLoading={isDeleting}
        error={deleteError}
      />
    </DashboardLayout>
  );
}
