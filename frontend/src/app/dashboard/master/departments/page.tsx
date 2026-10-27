'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import DepartmentTable, { type DepartmentItem } from '@/components/master/DepartmentTable';
import DepartmentFormModal from '@/components/master/DepartmentFormModal';
import { api } from '@/lib/api';
import {
  Building2,
  Plus,
  Search,
  AlertCircle,
  Layers,
} from 'lucide-react';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [search, setSearch] = useState('');
  const [deletingDept, setDeletingDept] = useState<DepartmentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<DepartmentItem[]>('/master/departments');
      setDepartments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const openCreateModal = () => {
    setEditingDept(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dept: DepartmentItem) => {
    setEditingDept(dept);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingDept) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete('/master/departments/' + deletingDept.id);
      setDeletingDept(null);
      fetchDepartments();
    } catch (err: unknown) {
      setDeleteError((err as Error).message || 'Gagal menghapus departemen');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-xs">
                <Building2 className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Departments & Divisions
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Corporate organizational units, cost centers, and branch functional divisions.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>New Department</span>
          </button>
        </div>

        {/* Bento Stat Header Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 bg-white border border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-mono">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Total Divisions</p>
              <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">{departments.length}</p>
            </div>
          </div>
          <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 bg-white border border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-mono">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Active Cost Centers</p>
              <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">{departments.length}</p>
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
              placeholder="Search department code or title..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono"
            />
          </div>
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Showing <strong className="text-slate-900">{filtered.length}</strong> of {departments.length}
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
          <DepartmentTable
            departments={filtered}
            loading={loading}
            onEdit={openEditModal}
            onDelete={(dept) => {
              setDeletingDept(dept);
              setDeleteError(null);
            }}
          />
        </div>
      </div>

      {/* Create / Edit Department Modal */}
      <DepartmentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        department={editingDept}
        onSuccess={fetchDepartments}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingDept)}
        onClose={() => {
          setDeletingDept(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Hapus Departemen"
        description="Apakah Anda yakin ingin menghapus departemen ini dari struktur organisasi?"
        itemName={deletingDept?.name}
        itemDetails={
          deletingDept
            ? [
                { label: 'Kode Departemen', value: deletingDept.code },
                { label: 'Nama Divisi', value: deletingDept.name },
              ]
            : []
        }
        confirmText="Hapus Departemen"
        variant="danger"
        isLoading={isDeleting}
        error={deleteError}
      />
    </DashboardLayout>
  );
}
