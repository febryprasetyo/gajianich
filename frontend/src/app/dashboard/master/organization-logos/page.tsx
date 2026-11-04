'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Building2, Upload, Plus, Edit, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import FilterToolbar from '@/components/ui/FilterToolbar';
import TableShell from '@/components/ui/TableShell';
import TablePagination from '@/components/ui/TablePagination';
import RowActionButton from '@/components/ui/RowActionButton';
import StatusBadge from '@/components/ui/StatusBadge';
import { OrganizationLogoUploadModal } from '@/components/leaves/OrganizationLogoUploadModal';
import type { OrganizationLogoRow } from '@/types/documentProfile';
import { api } from '@/lib/api';

export default function OrganizationLogosPage() {
  const [rows, setRows] = useState<OrganizationLogoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationLogoRow | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadLogos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: OrganizationLogoRow[] }>('/hr/organization-logos');
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat daftar logo organisasi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogos();
  }, [loadLogos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.code || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page]);

  const formatTimestamp = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const handleOpenCreate = () => {
    setSelectedOrg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (org: OrganizationLogoRow) => {
    setSelectedOrg(org);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logo Organisasi"
        subtitle="Kelola daftar organisasi dan identitas logo kop cetakan formulir permohonan cuti (F4)."
        icon={Building2}
        actions={
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Organisasi</span>
          </button>
        }
      />

      {toast && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari nama atau kode organisasi..."
        hasActiveFilters={Boolean(search.trim())}
        onResetFilters={() => setSearch('')}
      />

      <TableShell
        loading={loading}
        error={error}
        isEmpty={!loading && !error && filtered.length === 0}
        emptyTitle="Tidak Ada Organisasi"
        emptyDescription="Belum ada organisasi yang sesuai pencarian, atau tambahkan organisasi baru menggunakan tombol Tambah Organisasi."
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
              <th className="py-3 px-4">Logo</th>
              <th className="py-3 px-4">Organisasi</th>
              <th className="py-3 px-4 text-center">Status Profil Cuti</th>
              <th className="py-3 px-4 text-center">Versi</th>
              <th className="py-3 px-4">Diperbarui</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.map((item) => (
              <tr
                key={item.organizationId}
                className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors text-xs text-slate-700"
              >
                <td className="py-3 px-4">
                  <div className="h-11 w-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-1 overflow-hidden">
                    {item.logoAssetKey ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.logoAssetKey}
                        alt={item.name}
                        className="max-h-9 w-auto object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-xs font-bold text-slate-900">{item.name}</div>
                  {item.code && (
                    <div className="text-[11px] text-slate-400 font-mono">{item.code}</div>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {item.logoAssetKey ? (
                    <StatusBadge
                      variant="success"
                      icon={<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
                    >
                      Aktif
                    </StatusBadge>
                  ) : (
                    <StatusBadge
                      variant="slate"
                      icon={<span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />}
                    >
                      Belum Diatur
                    </StatusBadge>
                  )}
                </td>
                <td className="py-3 px-4 text-center font-mono">
                  {item.version ? `v${item.version}` : '—'}
                </td>
                <td className="py-3 px-4 text-[11px] text-slate-500">
                  {formatTimestamp(item.updatedAt)}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <RowActionButton
                      icon={Edit}
                      label={`Edit organisasi ${item.name}`}
                      title="Edit Nama / Kode & Logo"
                      variant="default"
                      onClick={() => handleOpenEdit(item)}
                    />
                    <RowActionButton
                      icon={Upload}
                      label={`Unggah logo ${item.name}`}
                      title="Unggah / Ganti Logo"
                      variant="emerald"
                      onClick={() => handleOpenEdit(item)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <TablePagination
            page={page}
            limit={limit}
            total={filtered.length}
            onPageChange={setPage}
          />
        )}
      </TableShell>

      <OrganizationLogoUploadModal
        isOpen={isModalOpen}
        organization={selectedOrg}
        defaultGroupId={rows[0]?.groupId ?? null}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrg(null);
        }}
        onSuccess={(orgName, isNew) => {
          setToast({
            type: 'success',
            message: isNew
              ? `Organisasi "${orgName}" beserta logo berhasil ditambahkan dan siap dipilih pada Form Cuti.`
              : `Identitas dan logo organisasi "${orgName}" berhasil diperbarui.`,
          });
          loadLogos();
        }}
      />
    </div>
  );
}
