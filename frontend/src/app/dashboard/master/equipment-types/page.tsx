'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import EquipmentTypeTable, {
  type EquipmentTypeItem,
} from '@/components/master/EquipmentTypeTable';
import EquipmentTypeFormModal from '@/components/master/EquipmentTypeFormModal';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  AlertCircle,
  Plus,
  Search,
  Shapes,
} from 'lucide-react';

export default function EquipmentTypesPage() {
  const { user } = useAuth();
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentTypeItem[]>([]);
  const [search, setSearch] = useState('');
  const [deletingType, setDeletingType] = useState<EquipmentTypeItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<EquipmentTypeItem | null>(null);

  const normalizedRole = (user?.roleName || '').toLowerCase().replace(/_/g, '');
  const canManage = normalizedRole === 'superadmin' || normalizedRole === 'itadmin';

  const fetchEquipmentTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<EquipmentTypeItem[]>('/assets/categories');
      setEquipmentTypes(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? (err as Error).message : 'Failed to load IT equipment types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipmentTypes();
  }, []);

  const openCreateModal = () => {
    setEditingType(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: EquipmentTypeItem) => {
    setEditingType(item);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingType) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete('/assets/categories/' + deletingType.id);
      setDeletingType(null);
      fetchEquipmentTypes();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? (err as Error).message : 'Failed to delete equipment type');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return equipmentTypes.filter(
      (type) =>
        type.name.toLowerCase().includes(q) ||
        type.codePrefix.toLowerCase().includes(q)
    );
  }, [equipmentTypes, search]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
                <Shapes className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                IT Equipment Types
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Standard categories that dictate inventory numbering prefixes, audit specs, and default accessories.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer w-fit"
            >
              <Plus className="w-4 h-4" />
              <span>New Equipment Type</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl bg-white p-3.5 shadow-sm border border-slate-200">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by prefix code or type name..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 font-mono text-xs text-slate-900 placeholder-slate-400 transition-all focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>
          <span className="hidden font-mono text-xs text-slate-500 sm:inline">
            Showing <strong className="text-slate-900">{filtered.length}</strong> of {equipmentTypes.length}
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
          <EquipmentTypeTable
            equipmentTypes={filtered}
            loading={loading}
            canManage={canManage}
            onEdit={openEditModal}
            onDelete={(type) => {
              setDeletingType(type);
              setDeleteError(null);
            }}
          />
        </div>
      </div>

      <EquipmentTypeFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        equipmentType={editingType}
        onSuccess={fetchEquipmentTypes}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deletingType)}
        onClose={() => {
          setDeletingType(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Hapus Kategori Hardware"
        description="Apakah Anda yakin ingin menghapus kategori hardware ini? Tag prefix tidak akan dapat digunakan lagi untuk aset baru."
        itemName={deletingType?.name}
        itemDetails={
          deletingType
            ? [
                { label: 'Prefix Tag', value: deletingType.codePrefix },
                { label: 'Nama Kategori', value: deletingType.name },
              ]
            : []
        }
        confirmText="Hapus Kategori"
        variant="danger"
        isLoading={isDeleting}
        error={deleteError}
      />
    </DashboardLayout>
  );
}
