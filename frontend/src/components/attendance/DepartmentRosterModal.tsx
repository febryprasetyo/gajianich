'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ModalShell from '@/components/ui/ModalShell';
import { api } from '@/lib/api';
import type { DepartmentRosterItem, SaveDepartmentRosterPayload } from '@/types/dailyAttendance';
import {
  Users,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  CornerDownRight,
  UserCheck,
} from 'lucide-react';

export interface DepartmentRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentId: number;
  departmentName: string;
  onSaved?: () => void;
}

export default function DepartmentRosterModal({
  isOpen,
  onClose,
  departmentId,
  departmentName,
  onSaved,
}: DepartmentRosterModalProps) {
  const [items, setItems] = useState<DepartmentRosterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Fetch roster items
  const loadRoster = useCallback(async () => {
    if (!departmentId || !isOpen) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.get<{ success: boolean; data: DepartmentRosterItem[] }>(
        `/attendance/daily-report/roster?departmentId=${departmentId}`
      );
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat susunan roster departemen');
    } finally {
      setLoading(false);
    }
  }, [departmentId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      void loadRoster();
    }
  }, [isOpen, loadRoster]);

  // List of active coordinators in this department
  const coordinators = useMemo(() => {
    return items.filter((it) => it.isCoordinator);
  }, [items]);

  // 2. Move row Up
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index - 1];
      copy[index - 1] = temp;
      return copy.map((item, idx) => ({ ...item, sortOrder: idx + 1 }));
    });
  };

  // 3. Move row Down
  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index + 1];
      copy[index + 1] = temp;
      return copy.map((item, idx) => ({ ...item, sortOrder: idx + 1 }));
    });
  };

  // 4. Toggle Coordinator status
  const handleToggleCoordinator = (index: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const current = copy[index];
      const willBeCoord = !current.isCoordinator;
      copy[index] = {
        ...current,
        isCoordinator: willBeCoord,
        coordinatorId: willBeCoord ? null : current.coordinatorId,
      };
      return copy;
    });
  };

  // 5. Move employee directly into target coordinator's team
  const handleMoveToCoordinator = (itemIndex: number, targetCoordinatorId: number) => {
    if (!targetCoordinatorId) return;

    setItems((prev) => {
      const copy = [...prev];
      const [movingItem] = copy.splice(itemIndex, 1);
      movingItem.coordinatorId = targetCoordinatorId;

      // Find index of target coordinator
      const coordIndex = copy.findIndex((it) => it.employeeId === targetCoordinatorId);
      if (coordIndex === -1) {
        copy.push(movingItem);
      } else {
        // Find last consecutive member under this coordinator
        let insertIndex = coordIndex + 1;
        while (
          insertIndex < copy.length &&
          !copy[insertIndex].isCoordinator &&
          copy[insertIndex].coordinatorId === targetCoordinatorId
        ) {
          insertIndex++;
        }
        copy.splice(insertIndex, 0, movingItem);
      }

      return copy.map((item, idx) => ({ ...item, sortOrder: idx + 1 }));
    });
  };

  // 6. Reset to alphabetical order
  const handleResetAlphabetical = () => {
    setItems((prev) => {
      const copy = [...prev];
      copy.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
      return copy.map((item, idx) => ({ ...item, sortOrder: idx + 1 }));
    });
  };

  // 7. Save roster configuration to database
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const payload: SaveDepartmentRosterPayload = {
        departmentId,
        items: items.map((it, idx) => ({
          employeeId: it.employeeId,
          sortOrder: idx + 1,
          isCoordinator: it.isCoordinator,
          coordinatorId: it.coordinatorId,
        })),
      };

      await api.put('/attendance/daily-report/roster', payload);
      setSuccessMsg('Format susunan daftar karyawan berhasil disimpan!');
      if (onSaved) {
        onSaved();
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan format susunan roster');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClass="max-w-4xl"
      title={`Atur Format Susunan Tim - ${departmentName}`}
      subtitle="Susun urutan baris karyawan dan kelompok koordinator. Susunan ini akan tersimpan permanen sebagai format baku laporan harian & cetak."
      icon={<Users className="w-5 h-5 text-emerald-600" />}
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={handleResetAlphabetical}
            disabled={saving || loading || items.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            title="Kembalikan urutan sesuai abjad nama"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Abjad
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || items.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>Menyimpan...</>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan Format Susunan
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Alerts */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Petunjuk Penggunaan Singkat */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-950 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-900">
              Petunjuk Penyusunan Hierarki Koordinator:
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Tandai staf sebagai <strong>Koordinator</strong> (akan otomatis berstabilo kuning). Gunakan tombol <strong>▲ / ▼</strong> untuk menaikkan atau menurunkan posisi baris, atau pilih dropdown <strong>Pindah Tim</strong> untuk menempatkan staf langsung di bawah kelompok koordinator tujuan.
            </p>
          </div>
        </div>

        {/* Tabel Susunan Karyawan */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Memuat data staf departemen...
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Tidak ada staf aktif terdaftar pada departemen ini.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center border-r border-slate-200">No</th>
                  <th className="py-2.5 px-3 w-28 text-center border-r border-slate-200">Urutan</th>
                  <th className="py-2.5 px-4 border-r border-slate-200">Nama Karyawan & Jabatan</th>
                  <th className="py-2.5 px-3 w-36 text-center border-r border-slate-200">Role Tim</th>
                  <th className="py-2.5 px-3 w-48 text-left">Pindah ke Tim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((row, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === items.length - 1;

                  return (
                    <tr
                      key={row.employeeId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        row.isCoordinator ? 'bg-amber-50/70 font-semibold' : ''
                      }`}
                    >
                      {/* 1. No urut baris */}
                      <td className="py-2 px-3 text-center text-slate-500 font-medium border-r border-slate-100">
                        {idx + 1}
                      </td>

                      {/* 2. Tombol Naik / Turun */}
                      <td className="py-2 px-2 text-center border-r border-slate-100">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(idx)}
                            disabled={isFirst}
                            title="Pindah ke Atas (▲)"
                            className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-slate-700"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(idx)}
                            disabled={isLast}
                            title="Pindah ke Bawah (▼)"
                            className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-slate-700"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* 3. Nama & Jabatan */}
                      <td className="py-2 px-4 border-r border-slate-100">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                row.isCoordinator
                                  ? 'text-amber-950 font-bold'
                                  : 'text-slate-900 font-medium'
                              }
                            >
                              {row.employeeName}
                            </span>
                            {row.isCoordinator && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                                <Sparkles className="w-2.5 h-2.5" />
                                Koordinator
                              </span>
                            )}
                          </div>
                          {(row.position || row.jobLevel) && (
                            <span className="text-[10px] text-slate-500">
                              {[row.position, row.jobLevel].filter(Boolean).join(' • ')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Switch Koordinator / Anggota */}
                      <td className="py-2 px-3 text-center border-r border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleToggleCoordinator(idx)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                            row.isCoordinator
                              ? 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <UserCheck className="w-3 h-3" />
                          {row.isCoordinator ? 'Koordinator' : 'Anggota'}
                        </button>
                      </td>

                      {/* 5. Dropdown Pindah ke Tim Koordinator */}
                      <td className="py-2 px-3">
                        {!row.isCoordinator ? (
                          <div className="flex items-center gap-1">
                            <CornerDownRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <select
                              value={row.coordinatorId || ''}
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : 0;
                                if (val > 0) {
                                  handleMoveToCoordinator(idx, val);
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            >
                              <option value="">-- Gabung ke Tim --</option>
                              {coordinators.map((c) => (
                                <option key={c.employeeId} value={c.employeeId}>
                                  Tim {c.employeeName}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-700 font-medium italic">
                            (Pimpinan Tim)
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
    </ModalShell>
  );
}

