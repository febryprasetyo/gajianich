'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Upload, AlertCircle, Image as ImageIcon, Loader2, Building2 } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import type { OrganizationLogoRow } from '@/types/documentProfile';
import { validateLogoFileClient } from '@/lib/leaves/leaveOrganizationUtils';
import { api } from '@/lib/api';

export interface OrganizationLogoUploadModalProps {
  isOpen: boolean;
  organization: OrganizationLogoRow | null;
  defaultGroupId?: number | null;
  onClose: () => void;
  onSuccess: (organizationName: string, isNew: boolean) => void;
}

export function OrganizationLogoUploadModal({
  isOpen,
  organization,
  defaultGroupId,
  onClose,
  onSuccess,
}: OrganizationLogoUploadModalProps) {
  const isCreateMode = !organization;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(organization?.name || '');
      setCode(organization?.code || '');
      setFile(null);
      setError(null);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      setFile(null);
      setError(null);
      setIsUploading(false);
    }
  }, [isOpen, organization]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = e.target.files?.[0] || null;
    if (!selected) {
      setFile(null);
      return;
    }
    const validationErr = validateLogoFileClient(selected);
    if (validationErr) {
      setError(validationErr);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError('Nama organisasi wajib diisi (minimal 2 karakter).');
      return;
    }

    const requiresFile = isCreateMode || !organization?.logoAssetKey;
    if (requiresFile || file) {
      const validationErr = validateLogoFileClient(file);
      if (validationErr || !file) {
        setError(validationErr || 'Pilih file logo terlebih dahulu.');
        return;
      }
    }

    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', cleanName);
      if (code.trim()) {
        formData.append('code', code.trim().toUpperCase());
      }
      if (file) {
        formData.append('file', file);
      }

      if (isCreateMode) {
        if (defaultGroupId) {
          formData.append('groupId', String(defaultGroupId));
        }
        await api.upload('/hr/organization-logos', formData);
        onSuccess(cleanName, true);
      } else if (organization) {
        await api.upload(`/hr/organization-logos/${organization.organizationId}`, formData);
        onSuccess(cleanName, false);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan organisasi dan logo.');
    } finally {
      setIsUploading(false);
    }
  };

  const requiresFile = isCreateMode || !organization?.logoAssetKey;
  const canSubmit =
    !isUploading &&
    name.trim().length >= 2 &&
    (requiresFile ? Boolean(file) : Boolean(file) || name.trim() !== (organization?.name || '') || code.trim().toUpperCase() !== (organization?.code || ''));

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={isCreateMode ? 'Tambah Organisasi Baru' : 'Kelola Organisasi & Logo'}
      subtitle={
        isCreateMode
          ? 'Tambahkan entitas organisasi baru beserta logo untuk kop formulir permohonan cuti (F4).'
          : `Perbarui identitas atau ganti logo untuk ${organization?.name || ''}`
      }
      icon={isCreateMode ? <Building2 className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
      maxWidthClass="max-w-lg"
      isLoading={isUploading}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            form="org-logo-upload-form"
            disabled={!canSubmit}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>{isCreateMode ? 'Tambah Organisasi' : 'Simpan Perubahan'}</span>
              </>
            )}
          </button>
        </>
      }
    >
      <form id="org-logo-upload-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label
              htmlFor="org-name-input"
              className="block text-xs font-semibold text-slate-700 uppercase font-mono mb-1.5"
            >
              Nama Organisasi <span className="text-rose-500">*</span>
            </label>
            <input
              id="org-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: PT Mitra Global Mandiri"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="org-code-input"
              className="block text-xs font-semibold text-slate-700 uppercase font-mono mb-1.5"
            >
              Kode Singkat
            </label>
            <input
              id="org-code-input"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Otomatis (mis: MGM)"
              maxLength={50}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className={`grid ${isCreateMode ? 'grid-cols-1' : 'grid-cols-2'} gap-3 text-xs`}>
          {!isCreateMode && (
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 min-h-28">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Logo Saat Ini
              </span>
              {organization?.logoAssetKey ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={organization.logoAssetKey}
                  alt={organization.name}
                  className="h-12 w-auto max-w-full object-contain"
                />
              ) : (
                <div className="text-slate-400 flex flex-col items-center gap-1">
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-[11px]">Belum ada logo</span>
                </div>
              )}
            </div>
          )}

          <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col items-center justify-center gap-2 min-h-28">
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-800">
              {isCreateMode ? 'Pratinjau Logo Organisasi' : 'Pratinjau Logo Baru'}
            </span>
            {previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt="Pratinjau logo baru"
                className="h-12 w-auto max-w-full object-contain"
              />
            ) : (
              <span className="text-[11px] text-slate-400 text-center">
                Pilih file gambar untuk melihat pratinjau kop surat
              </span>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="logo-file-input"
            className="block text-xs font-semibold text-slate-700 uppercase font-mono mb-1.5"
          >
            File Logo {requiresFile && <span className="text-rose-500">*</span>}
          </label>
          <input
            ref={fileInputRef}
            id="logo-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
          />
          <p className="text-[11px] text-slate-500 mt-1.5">
            Format yang diizinkan: <strong>PNG, JPG, atau WebP</strong> (maksimal <strong>512 KB</strong>). Permohonan cuti yang sudah dicetak sebelumnya tetap menggunakan logo saat pengajuan dibuat.
          </p>
        </div>
      </form>
    </ModalShell>
  );
}
