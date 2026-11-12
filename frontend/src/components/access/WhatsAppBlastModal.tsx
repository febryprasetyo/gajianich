'use client';

import React, { useState, useEffect, useMemo } from 'react';
import ModalShell from '@/components/ui/ModalShell';
import { api } from '@/lib/api';
import {
  UnprovisionedEmployeeItem,
  BulkProvisionBlastResultItem,
  UnprovisionedSummaryResponse,
  BulkProvisionBlastResponse,
} from '@/lib/access/types';
import {
  Send,
  MessageSquare,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  Search,
  Filter,
  Users,
  UserCheck,
  ShieldCheck,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface WhatsAppBlastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WhatsAppBlastModal({
  isOpen,
  onClose,
  onSuccess,
}: WhatsAppBlastModalProps) {
  const [step, setStep] = useState<'preview' | 'result'>('preview');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employees, setEmployees] = useState<UnprovisionedEmployeeItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [results, setResults] = useState<BulkProvisionBlastResultItem[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch unprovisioned summary when modal opens
  const fetchSummary = async () => {
    try {
      setIsLoadingSummary(true);
      setErrorMessage(null);
      const res = await api.get<UnprovisionedSummaryResponse>('/users/unprovisioned-summary');
      if (res && Array.isArray(res.employees)) {
        // Only keep employees who don't have an account
        const unprovisioned = res.employees.filter((e) => !e.hasAccount);
        setEmployees(unprovisioned);
        // Default select all
        setSelectedIds(new Set(unprovisioned.map((e) => e.id)));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat daftar karyawan');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setStep('preview');
      setResults([]);
      setErrorMessage(null);
      fetchSummary();
    }
  }, [isOpen]);

  // Departments list for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered employees in Preview step
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const matchSearch =
        e.fullName.toLowerCase().includes(search.toLowerCase()) ||
        e.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
        (e.phone && e.phone.includes(search));
      const matchDept = selectedDept === 'all' || e.department === selectedDept;
      return matchSearch && matchDept;
    });
  }, [employees, search, selectedDept]);

  // Handle select all toggle
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredEmployees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmployees.map((e) => e.id)));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Submit bulk account generation
  const handleGenerateAccounts = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const payload = {
        employeeIds: Array.from(selectedIds),
        sendWhatsApp: false, // Generate credentials & ready-to-copy WhatsApp messages
      };

      const res = await api.post<BulkProvisionBlastResponse>('/users/bulk-provision-blast', payload);

      if (res && Array.isArray(res.results)) {
        setResults(res.results);
        setStep('result');
        // Instantly refresh user list in parent background so created accounts appear immediately
        onSuccess();
      } else {
        setErrorMessage('Format respons dari server tidak sesuai');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses pembuatan akun massal');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy single WhatsApp message to clipboard
  const handleCopySingle = async (item: BulkProvisionBlastResultItem) => {
    if (!item.whatsappMessage) return;
    try {
      await navigator.clipboard.writeText(item.whatsappMessage);
      setCopiedId(item.employeeId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = item.whatsappMessage;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(item.employeeId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Copy all WhatsApp messages at once with clean separators
  const handleCopyAll = async () => {
    if (results.length === 0) return;
    const combined = results
      .map((r, idx) => `=== [${idx + 1}/${results.length}] ${r.fullName} (${r.phone || 'No Phone'}) ===\n${r.whatsappMessage || ''}\n`)
      .join('\n----------------------------------------\n\n');

    try {
      await navigator.clipboard.writeText(combined);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = combined;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  };

  // Download CSV export
  const handleDownloadCsv = () => {
    if (results.length === 0) return;

    const headers = ['Nama Karyawan', 'No WhatsApp', 'Username', 'Link Aktivasi Akun', 'Pesan Siap Kirim WA', 'Link Chat WA'];
    const rows = results.map((r) => [
      `"${r.fullName.replace(/"/g, '""')}"`,
      `"${(r.normalizedPhone || r.phone || '').replace(/"/g, '""')}"`,
      `"${r.username.replace(/"/g, '""')}"`,
      `"${(r.activationUrl || '').replace(/"/g, '""')}"`,
      `"${(r.whatsappMessage || '').replace(/"/g, '""')}"`,
      `"${(r.whatsappLink || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rekap_aktivasi_akun_wa_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={step === 'result' ? handleFinish : onClose}
      title={
        step === 'preview'
          ? 'Pendaftaran Akun Otomatis'
          : 'Hasil Pendaftaran Akun Otomatis'
      }
      subtitle={
        step === 'preview'
          ? 'Sistem membuatkan akun pengguna secara otomatis untuk seluruh karyawan aktif yang belum terdaftar.'
          : `Berhasil mendaftarkan ${results.length} akun pengguna baru. Kredensial dan tautan aktivasi akun siap didistribusikan.`
      }
      icon={<UserCheck className="w-5 h-5 text-emerald-600" />}
      maxWidthClass="max-w-4xl"
      footer={
        step === 'preview' ? (
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-500">
              Terpilih:{' '}
              <span className="font-bold text-slate-900">{selectedIds.size}</span> dari{' '}
              {employees.length} karyawan
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleGenerateAccounts}
                disabled={isSubmitting || selectedIds.size === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mendaftarkan Akun...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Daftarkan {selectedIds.size} Akun</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyAll}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copiedAll ? 'Semua Pesan Disalin!' : 'Salin Semua Pesan'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Rekap CSV</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleFinish}
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Selesai & Muat Ulang Tabel
            </button>
          </div>
        )
      }
    >
      {errorMessage && (
        <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {step === 'preview' ? (
        <div className="space-y-4">
          {/* Information Banner */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 space-y-1">
              <p className="font-semibold text-emerald-900">
                Aturan Pembuatan Username Otomatis:
              </p>
              <p className="text-slate-600 leading-relaxed">
                Username akan dibuat secara otomatis menggunakan <strong>nama depan</strong> karyawan.
              </p>
            </div>
          </div>

          {/* Search & Department Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, NIK, atau nomor HP..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            {departments.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="all">Semua Departemen ({departments.length})</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Employees Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
            {isLoadingSummary ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span className="text-xs">Memeriksa status akun karyawan...</span>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-slate-700 text-xs">
                  Semua karyawan aktif sudah memiliki akun!
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tidak ada karyawan yang membutuhkan pembuatan akun massal saat ini.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={
                          filteredEmployees.length > 0 &&
                          selectedIds.size === filteredEmployees.length
                        }
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">Karyawan</th>
                    <th className="py-2.5 px-3">Departemen</th>
                    <th className="py-2.5 px-3">Nomor WhatsApp</th>
                    <th className="py-2.5 px-3 text-right">Status No. HP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const isSelected = selectedIds.has(emp.id);
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => handleToggleSelect(emp.id)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isSelected ? 'bg-emerald-50/30' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(emp.id)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-900">{emp.fullName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            NIK: {emp.employeeCode}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {emp.department || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                          {emp.phone || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {emp.hasValidPhone ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Siap Kirim WA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              No. HP Kosong
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Results View */
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  {results.length} Akun Karyawan Berhasil Didaftarkan!
                </p>
                <p className="text-[11px] text-emerald-800">
                  Akun telah aktif di sistem. Kredensial dan tautan aktivasi siap didistribusikan langsung atau melalui WhatsApp.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Karyawan</th>
                  <th className="py-2.5 px-3">Username Baru</th>
                  <th className="py-2.5 px-3">Metode Aktivasi</th>
                  <th className="py-2.5 px-3">No. WhatsApp</th>
                  <th className="py-2.5 px-3 text-right">Aksi Copas / Kirim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r) => {
                  const isCopied = copiedId === r.employeeId;
                  return (
                    <tr key={r.employeeId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-900">{r.fullName}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                          {r.username}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          <span>Magic Link (48 Jam)</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {r.normalizedPhone || r.phone || (
                          <span className="text-amber-600 italic">Belum ada</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Copy Message Button */}
                          <button
                            type="button"
                            onClick={() => handleCopySingle(r)}
                            title="Salin Teks Pesan WhatsApp"
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700">Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-500" />
                                <span>Salin Pesan</span>
                              </>
                            )}
                          </button>

                          {/* Open WhatsApp Chat Link */}
                          {r.whatsappLink ? (
                            <a
                              href={r.whatsappLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Buka Chat WhatsApp Web/App dengan pesan terisi"
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Buka WA</span>
                            </a>
                          ) : (
                            <button
                              disabled
                              title="Nomor HP tidak tersedia"
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-400 bg-slate-100 rounded-lg opacity-60 cursor-not-allowed"
                            >
                              <span>No WA Kosong</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

