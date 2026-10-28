'use client';

import React, { useState, useRef } from 'react';
import ModalShell from '@/components/ui/ModalShell';
import { api } from '@/lib/api';
import { computeImportSummaryState, formatDepartmentNotice } from '@/lib/employeeImportUI.mjs';
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Building2,
  XCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

interface EmployeeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PreviewRow {
  rowNumber: number;
  employeeCode: string;
  fullName: string;
  organization?: string | null;
  position?: string | null;
  email: string;
  isValid: boolean;
  errors: string[];
}

interface PreviewResponse {
  valid: boolean;
  summary: {
    totalRows: number;
    validCount: number;
    errorCount: number;
    newDepartmentsCount: number;
    newDepartments: string[];
  };
  errors: Array<{
    rowNumber: number;
    employeeCode?: string;
    field?: string;
    message: string;
  }>;
  previewRows: PreviewRow[];
}

export default function EmployeeImportModal({
  isOpen,
  onClose,
  onSuccess,
}: EmployeeImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setErrorMsg(null);
    setPreviewData(null);
    setIsLoadingPreview(false);
    setIsSubmitting(false);
  };

  const handleModalClose = () => {
    if (isSubmitting || isLoadingPreview) return;
    handleReset();
    onClose();
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMsg(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = e.dataTransfer.files[0];
      if (
        selected.name.endsWith('.xlsx') ||
        selected.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        setFile(selected);
      } else {
        setErrorMsg('Format file tidak didukung. Mohon unggah file format .xlsx');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (
        selected.name.endsWith('.xlsx') ||
        selected.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        setFile(selected);
      } else {
        setErrorMsg('Format file tidak didukung. Mohon unggah file format .xlsx');
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      setErrorMsg(null);
      const blob = await api.download('/employees/import/template');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gajianich-employee-import-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      setErrorMsg(
        (err as Error).message || 'Gagal mengunduh template import karyawan'
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleProcessPreview = async () => {
    if (!file) {
      setErrorMsg('Pilih file Excel terlebih dahulu');
      return;
    }
    try {
      setIsLoadingPreview(true);
      setErrorMsg(null);
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.upload<PreviewResponse>(
        '/employees/import/preview',
        formData
      );
      setPreviewData(res);
      setStep('preview');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Gagal memproses preview file');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmCommit = async () => {
    if (!file || !previewData?.valid) return;
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const formData = new FormData();
      formData.append('file', file);
      await api.upload('/employees/import/commit', formData);
      onSuccess();
      handleModalClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Gagal melakukan import karyawan');
      setIsSubmitting(false);
    }
  };

  const summaryState = computeImportSummaryState(previewData?.summary);
  const deptNotice = formatDepartmentNotice(
    previewData?.summary.newDepartments
  );

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Import Master Data Karyawan"
      subtitle="Unggah data karyawan format Excel kompatibel Talenta (33 Kolom)"
      icon={<FileSpreadsheet className="w-5 h-5 text-emerald-600" />}
      maxWidthClass="max-w-3xl"
      isLoading={isLoadingPreview || isSubmitting}
      footer={
        step === 'upload' ? (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="text-xs font-mono font-medium text-slate-600 hover:text-emerald-600 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {downloadingTemplate ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Unduh Template (.xlsx)</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleModalClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-mono font-medium hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProcessPreview}
                disabled={!file || isLoadingPreview}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menganalisis...</span>
                  </>
                ) : (
                  <>
                    <span>Lanjut ke Preview</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setStep('upload')}
              disabled={isSubmitting}
              className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-mono font-medium hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ganti File</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleModalClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-mono font-medium hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleConfirmCommit}
                disabled={!previewData?.valid || isSubmitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Konfirmasi Import</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )
      }
    >
      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-mono">{errorMsg}</span>
        </div>
      )}

      {step === 'upload' ? (
        <div className="space-y-4">
          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/50'
                : 'border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {file ? file.name : 'Klik untuk memilih file atau seret file ke sini'}
            </p>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {file
                ? `${(file.size / 1024).toFixed(1)} KB — Siap dianalisis`
                : 'Mendukung file Excel format .xlsx hingga 10MB'}
            </p>
          </div>

          {/* Guidelines Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600 space-y-2">
            <p className="font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Ketentuan Import Karyawan:</span>
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px] leading-relaxed">
              <li>
                File harus memuat kolom utama <strong>Employee ID</strong>,{' '}
                <strong>Full Name</strong>, dan <strong>Email</strong>.
              </li>
              <li>
                Jika <strong>Organization</strong> belum terdaftar, departemen
                akan dibuatkan secara otomatis.
              </li>
              <li>
                <strong>Aturan Reject</strong>: Jika terdapat duplikasi NIK di
                file atau sudah ada di database, proses import akan ditolak.
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Bento Summary Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-mono text-slate-400 uppercase">
                Total Baris
              </p>
              <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                {previewData?.summary.totalRows}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-[10px] font-mono text-emerald-600 uppercase">
                Baris Valid
              </p>
              <p className="text-lg font-bold font-mono text-emerald-700 mt-0.5">
                {previewData?.summary.validCount}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl border ${
                (previewData?.summary.errorCount || 0) > 0
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <p
                className={`text-[10px] font-mono uppercase ${
                  (previewData?.summary.errorCount || 0) > 0
                    ? 'text-rose-600 font-bold'
                    : 'text-slate-400'
                }`}
              >
                Error / Konflik
              </p>
              <p
                className={`text-lg font-bold font-mono mt-0.5 ${
                  (previewData?.summary.errorCount || 0) > 0
                    ? 'text-rose-700'
                    : 'text-slate-900'
                }`}
              >
                {previewData?.summary.errorCount}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-[10px] font-mono text-emerald-600 uppercase">
                Dept. Baru
              </p>
              <p className="text-lg font-bold font-mono text-emerald-700 mt-0.5">
                {previewData?.summary.newDepartmentsCount}
              </p>
            </div>
          </div>

          {/* Department Auto-Create Notice */}
          {deptNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-start gap-2.5">
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{deptNotice}</span>
            </div>
          )}

          {/* Error Notice */}
          {!previewData?.valid && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-700">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Import Diblokir: Ditemukan Kesalahan Validasi</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-rose-600 text-[11px] max-h-32 overflow-y-auto">
                {previewData?.errors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>
                    Baris {err.rowNumber}
                    {err.employeeCode ? ` (NIK ${err.employeeCode})` : ''}:{' '}
                    {err.message}
                  </li>
                ))}
                {(previewData?.errors.length || 0) > 5 && (
                  <li className="font-bold">
                    ... dan {(previewData?.errors.length || 0) - 5} kesalahan
                    lainnya.
                  </li>
                )}
              </ul>
              <p className="text-[10px] text-rose-500 italic">
                * Kebijakan Reject: Semua data ditolak secara atomik sampai file
                Excel diperbaiki dan diunggah kembali.
              </p>
            </div>
          )}

          {/* Preview Table (10 Rows) */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-slate-700">
                Preview Data (Menampilkan {previewData?.previewRows.length} baris
                pertama)
              </span>
              <span className="text-slate-400">
                Status: {summaryState.headline}
              </span>
            </div>
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100/70 text-slate-500 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">NIK</th>
                    <th className="py-2 px-3">Nama Lengkap</th>
                    <th className="py-2 px-3">Organisasi</th>
                    <th className="py-2 px-3">Jabatan</th>
                    <th className="py-2 px-3">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewData?.previewRows.map((r, i) => (
                    <tr
                      key={i}
                      className={
                        r.isValid
                          ? 'hover:bg-slate-50/50'
                          : 'bg-rose-50/30 hover:bg-rose-50/60'
                      }
                    >
                      <td className="py-2 px-3">
                        {r.isValid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                        ) : (
                          <span title={r.errors.join(', ')}>
                            <XCircle className="w-4 h-4 text-rose-600 inline cursor-help" />
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {r.employeeCode}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{r.fullName}</td>
                      <td className="py-2 px-3 text-slate-500">
                        {r.organization || '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {r.position || '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{r.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
