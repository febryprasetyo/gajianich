'use client';

import React, { useState, useEffect } from 'react';
import ModalShell from '@/components/ui/ModalShell';
import { api } from '@/lib/api';
import type {
  EmployeeItem,
  EmployeeTransferCandidateGroup,
  LocationOption,
} from '@/lib/employeeTypes';
import { ArrowRightLeft, Building2, Calendar, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeItem | null;
  onSuccess: () => void;
}

export default function EmployeeTransferModal({ isOpen, onClose, employee, onSuccess }: Props) {
  const [candidateGroups, setCandidateGroups] = useState<EmployeeTransferCandidateGroup[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [targetGroupId, setTargetGroupId] = useState<number | ''>('');
  const [targetDepartmentId, setTargetDepartmentId] = useState<number | ''>('');
  const [targetLocationId, setTargetLocationId] = useState<number | ''>('');
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Determine current group of employee
  const currentGroup = candidateGroups.find((g) =>
    g.departments.some((d) => d.id === employee?.departmentId)
  );

  useEffect(() => {
    if (!isOpen) {
      setTargetGroupId('');
      setTargetDepartmentId('');
      setTargetLocationId('');
      setReason('');
      setError(null);
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [candidates, locs] = await Promise.all([
          api.get<EmployeeTransferCandidateGroup[]>('/employees/transfer-candidates'),
          api.get<LocationOption[]>('/master/locations'),
        ]);
        setCandidateGroups(candidates);
        setLocations(locs);

        // Pre-select the other group if current group is found
        if (employee?.departmentId) {
          const empGroup = candidates.find((g) =>
            g.departments.some((d) => d.id === employee.departmentId)
          );
          const otherGroup = candidates.find((g) => g.id !== empGroup?.id);
          if (otherGroup) {
            setTargetGroupId(otherGroup.id);
            if (otherGroup.departments.length > 0) {
              setTargetDepartmentId(otherGroup.departments[0].id);
            }
          }
        }
      } catch (err: unknown) {
        setError((err as Error).message || 'Gagal memuat kandidat organisasi transfer');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, employee]);

  const handleGroupChange = (newGroupId: number) => {
    setTargetGroupId(newGroupId);
    const grp = candidateGroups.find((g) => g.id === newGroupId);
    if (grp && grp.departments.length > 0) {
      setTargetDepartmentId(grp.departments[0].id);
    } else {
      setTargetDepartmentId('');
    }
  };

  const selectedGroup = candidateGroups.find((g) => g.id === targetGroupId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    if (!targetGroupId) {
      setError('Pilih kelompok organisasi tujuan');
      return;
    }
    if (!targetDepartmentId) {
      setError('Pilih departemen tujuan');
      return;
    }
    if (!reason.trim()) {
      setError('Alasan transfer wajib diisi');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await api.post(`/employees/${employee.id}/transfer`, {
        targetGroupId: Number(targetGroupId),
        targetDepartmentId: Number(targetDepartmentId),
        targetLocationId: targetLocationId ? Number(targetLocationId) : null,
        effectiveDate,
        reason: reason.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Gagal melakukan transfer karyawan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer Karyawan Antar Organisasi"
      subtitle="Mutasi karyawan ke unit / kelompok organisasi lain (CMC ↔ MGM) beserta penyesuaian hak akses."
      icon={<ArrowRightLeft className="w-5 h-5 text-emerald-600" />}
      maxWidthClass="max-w-xl"
      isLoading={isSubmitting || isLoading}
    >
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span>Memuat data organisasi dan departemen...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Employee Info Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Karyawan</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{employee?.fullName}</p>
              <p className="text-xs text-slate-500 font-mono">NIK: {employee?.employeeCode}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Organisasi Saat Ini</p>
              <div className="flex items-center gap-1.5 justify-end mt-1">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">
                  {currentGroup?.code || '—'}
                </span>
                <span className="text-xs text-slate-600">({employee?.departmentName || 'Tanpa Dept'})</span>
              </div>
            </div>
          </div>

          {/* Target Group Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Kelompok Organisasi Tujuan <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {candidateGroups.map((grp) => {
                const isCurrent = currentGroup?.id === grp.id;
                const isSelected = targetGroupId === grp.id;
                return (
                  <button
                    key={grp.id}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => handleGroupChange(grp.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : isCurrent
                        ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-900">{grp.code}</span>
                      {isCurrent && (
                        <span className="text-[10px] font-medium bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                          Saat Ini
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{grp.name}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Department Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Departemen Tujuan <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={targetDepartmentId}
                onChange={(e) => setTargetDepartmentId(e.target.value ? Number(e.target.value) : '')}
                required
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all cursor-pointer"
              >
                <option value="">Pilih Departemen di {selectedGroup?.code || 'Organisasi Tujuan'}...</option>
                {selectedGroup?.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} – {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Location Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Lokasi Penempatan Baru (Opsional)
            </label>
            <select
              value={targetLocationId}
              onChange={(e) => setTargetLocationId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all cursor-pointer"
            >
              <option value="">Pertahankan lokasi saat ini ({employee?.locationName || 'Belum diatur'})</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} – {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Effective Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tanggal Efektif Transfer <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          {/* Transfer Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Alasan Mutasi / Catatan SK Transfer <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Rotasi penugasan operasional ke kantor CMC sesuai SK Direksi..."
              required
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !targetGroupId || !targetDepartmentId || !reason.trim()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memindahkan Organisasi & Menyinkronkan Akses...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Konfirmasi Transfer Karyawan</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

