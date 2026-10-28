'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  Building2,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Briefcase,
  Calendar,
  Layers,
} from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { useAttendance } from '../AttendanceWorkspace';
import { Heading } from '../shared';
import type { WorkShift, ShiftAssignment } from '@/lib/attendance/scheduleShift';

export default function ShiftManagementPage() {
  const { data, execute, canWrite } = useAttendance();

  const shifts: WorkShift[] = data.shifts || [];

  const assignments: ShiftAssignment[] = data.shiftAssignments || [];

  const [activeTab, setActiveTab] = useState<'shifts' | 'assignments'>('shifts');
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [isCreatingShift, setIsCreatingShift] = useState(false);
  const [isAssigningEmployee, setIsAssigningEmployee] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Form states for creating/editing shift
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formScheduleIn, setFormScheduleIn] = useState('08:00');
  const [formScheduleOut, setFormScheduleOut] = useState('17:00');
  const [formWorkDays, setFormWorkDays] = useState<5 | 6>(5);
  const [formSatIn, setFormSatIn] = useState('08:00');
  const [formSatOut, setFormSatOut] = useState('14:00');
  const [formDesc, setFormDesc] = useState('');
  const [formError, setFormError] = useState('');

  // Form states for employee override assignment
  const [selectedEmpId, setSelectedEmpId] = useState<number>(0);
  const [selectedShiftId, setSelectedShiftId] = useState<number>(shifts[0]?.id || 1);

  const openCreateModal = () => {
    setFormCode('');
    setFormName('');
    setFormScheduleIn('08:00');
    setFormScheduleOut('17:00');
    setFormWorkDays(5);
    setFormSatIn('08:00');
    setFormSatOut('14:00');
    setFormDesc('');
    setFormError('');
    setIsCreatingShift(true);
  };

  const openEditModal = (s: WorkShift) => {
    setEditingShift(s);
    setFormCode(s.code);
    setFormName(s.name);
    setFormScheduleIn(s.scheduleIn);
    setFormScheduleOut(s.scheduleOut);
    setFormWorkDays(s.workDays);
    setFormSatIn(s.saturdayScheduleIn || '08:00');
    setFormSatOut(s.saturdayScheduleOut || '14:00');
    setFormDesc(s.description || '');
    setFormError('');
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCode.trim() || !formName.trim()) {
      setFormError('Kode dan nama shift wajib diisi.');
      return;
    }

    try {
      if (editingShift) {
        await execute({
          type: 'shift',
          action: 'update',
          shift: {
            ...editingShift,
            code: formCode.trim().toUpperCase(),
            name: formName.trim(),
            scheduleIn: formScheduleIn,
            scheduleOut: formScheduleOut,
            workDays: formWorkDays,
            saturdayScheduleIn: formWorkDays === 6 ? formSatIn : null,
            saturdayScheduleOut: formWorkDays === 6 ? formSatOut : null,
            description: formDesc.trim() || undefined,
          },
        });
        setNotice(`Shift ${formName} berhasil diperbarui.`);
        setEditingShift(null);
      } else {
        await execute({
          type: 'shift',
          action: 'create',
          shift: {
            id: 0,
            code: formCode.trim().toUpperCase(),
            name: formName.trim(),
            scheduleIn: formScheduleIn,
            scheduleOut: formScheduleOut,
            workDays: formWorkDays,
            saturdayScheduleIn: formWorkDays === 6 ? formSatIn : null,
            saturdayScheduleOut: formWorkDays === 6 ? formSatOut : null,
            description: formDesc.trim() || undefined,
            isDefault: shifts.length === 0,
            isActive: true,
          },
        });
        setNotice(`Shift ${formName} berhasil ditambahkan.`);
        setIsCreatingShift(false);
      }
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan shift.');
    }
  };

  const handleDeleteShift = async (s: WorkShift) => {
    if (!confirm(`Hapus shift "${s.name}"? Penugasan yang menggunakan shift ini akan direset.`)) return;
    try {
      await execute({
        type: 'shift',
        action: 'delete',
        shift: s,
      });
      setNotice(`Shift ${s.name} berhasil dihapus.`);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus shift.');
    }
  };

  const handleAssignDepartment = async (departmentId: number, shiftId: number) => {
    try {
      await execute({
        type: 'assign_shift',
        assignment: {
          id: 0,
          shiftId,
          departmentId,
          employeeId: null,
        },
      });
      setNotice('Penugasan shift departemen berhasil disimpan.');
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan penugasan departemen.');
    }
  };

  const handleAssignEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !selectedShiftId) return;

    try {
      await execute({
        type: 'assign_shift',
        assignment: {
          id: 0,
          shiftId: selectedShiftId,
          employeeId: selectedEmpId,
          departmentId: null,
        },
      });
      setNotice('Penugasan shift karyawan berhasil disimpan.');
      setIsAssigningEmployee(false);
      setSelectedEmpId(0);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan penugasan karyawan.');
    }
  };

  const handleRemoveEmployeeAssignment = async (employeeId: number) => {
    const emp = data.employees.find(e => e.id === employeeId);
    if (!confirm(`Kembalikan shift ${emp?.fullName || 'karyawan'} ke default departemennya?`)) return;

    // To remove employee override, we reassign employeeId to 0 or department shift
    const deptId = emp?.departmentId;
    const deptAssignment = assignments.find(a => a.departmentId === deptId && !a.employeeId);
    const targetShiftId = deptAssignment ? deptAssignment.shiftId : (shifts.find(s => s.isDefault)?.id || 1);

    try {
      await execute({
        type: 'assign_shift',
        assignment: {
          id: 0,
          shiftId: targetShiftId,
          employeeId,
          departmentId: null,
        },
      });
      setNotice('Override shift karyawan berhasil dihapus.');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus override shift.');
    }
  };

  // Employees with specific overrides
  const employeeAssignments = assignments
    .filter(a => a.employeeId && a.employeeId > 0)
    .map(a => {
      const emp = data.employees.find(e => e.id === a.employeeId);
      const shift = shifts.find(s => s.id === a.shiftId);
      const dept = data.departments.find(d => d.id === emp?.departmentId);
      return {
        assignmentId: a.id,
        employeeId: a.employeeId!,
        employeeName: emp?.fullName || 'Karyawan',
        employeeCode: emp?.employeeCode || '-',
        departmentName: dept?.name || '-',
        shiftName: shift?.name || 'Shift Dihapus',
        shiftCode: shift?.code || '-',
        scheduleText: shift ? `${shift.scheduleIn} - ${shift.scheduleOut} (${shift.workDays} Hari)` : '-',
      };
    });

  return (
    <div className="space-y-6">
      <Heading
        title="Pengaturan Shift & Jam Kerja"
        description="Kelola master jam kerja reguler dan shift khusus, serta tetapkan jadwal per departemen atau per karyawan."
      >
        {canWrite && activeTab === 'shifts' && (
          <button className="hr-btn-primary" onClick={openCreateModal}>
            <Plus size={15} />
            Tambah Shift Baru
          </button>
        )}
        {canWrite && activeTab === 'assignments' && (
          <button className="hr-btn-primary" onClick={() => { setIsAssigningEmployee(true); }}>
            <Plus size={15} />
            Tugaskan Karyawan
          </button>
        )}
      </Heading>

      {/* Tabs Navigasi */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('shifts')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px ${
            activeTab === 'shifts'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock size={16} />
          <span>Master Jam Kerja & Shift ({shifts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assignments')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px ${
            activeTab === 'assignments'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers size={16} />
          <span>Penugasan Shift (Departemen & Karyawan)</span>
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">
            ×
          </button>
        </div>
      )}

      {/* TAB 1: MASTER SHIFT */}
      {activeTab === 'shifts' && (
        <div className="hr-panel">
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Kode Shift</th>
                  <th>Nama Shift</th>
                  <th>Jam Masuk & Pulang</th>
                  <th>Pola Kerja</th>
                  <th>Jam Khusus Sabtu</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono font-bold text-slate-800">
                      {s.code}
                    </td>
                    <td>
                      <div>
                        <span className="font-semibold text-slate-900 block">{s.name}</span>
                        {s.description && (
                          <span className="text-[11px] text-slate-500">{s.description}</span>
                        )}
                      </div>
                    </td>
                    <td className="font-mono font-semibold text-slate-800">
                      {s.scheduleIn} – {s.scheduleOut}
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        s.workDays === 6
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {s.workDays === 6 ? 'Senin - Sabtu (6 Hari)' : 'Senin - Jumat (5 Hari)'}
                      </span>
                    </td>
                    <td className="font-mono text-slate-600">
                      {s.workDays === 6 ? `${s.saturdayScheduleIn || '08:00'} – ${s.saturdayScheduleOut || '14:00'}` : '— (Libur)'}
                    </td>
                    <td>
                      {s.isDefault ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Default Kantor
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                          Khusus
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {canWrite && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(s)}
                              className="hr-btn"
                              title="Edit shift"
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>
                            {!s.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleDeleteShift(s)}
                                className="hr-btn text-rose-700 hover:bg-rose-50 border-rose-200"
                                title="Hapus shift"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PENUGASAN SHIFT */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          {/* Sub-bagian 1: Penugasan per Departemen */}
          <div className="hr-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Jadwal Default per Departemen
                  </h2>
                  <p className="text-xs text-slate-500">
                    Semua karyawan dalam departemen ini otomatis menggunakan shift yang dipilih, kecuali diberi penugasan khusus.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {data.departments.map(d => {
                const assigned = assignments.find(a => a.departmentId === d.id && !a.employeeId);
                const currentShiftId = assigned?.shiftId ?? '';

                return (
                  <div key={d.id} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">{d.name}</span>
                      <span className="text-[11px] text-slate-500 block">Kode: {d.code}</span>
                      <span className="text-[11px] text-slate-500 block">{assigned ? 'Penugasan tersimpan' : 'Mengikuti default global; belum ada penugasan departemen'}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        aria-label={`Pilih shift untuk ${d.name}`}
                        className="hr-input text-xs font-semibold"
                        value={currentShiftId}
                        disabled={!canWrite || shifts.length === 0}
                        onChange={e => handleAssignDepartment(d.id, Number(e.target.value))}
                      >
                        <option value="" disabled>{shifts.length ? 'Default global (belum ditetapkan)' : 'Belum ada shift tersimpan'}</option>
                        {shifts.filter(s => s.isActive).map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.scheduleIn}-{s.scheduleOut})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-bagian 2: Penugasan Khusus per Karyawan (Override) */}
          <div className="hr-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Penugasan Khusus Karyawan (Override)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Daftar karyawan yang memiliki jadwal shift berbeda dari departemen asalnya (misal operator shift malam/siang).
                  </p>
                </div>
              </div>

              {canWrite && (
                <button
                  type="button"
                  onClick={() => setIsAssigningEmployee(true)}
                  className="hr-btn"
                >
                  <Plus size={14} />
                  <span>Tugaskan Karyawan</span>
                </button>
              )}
            </div>

            {employeeAssignments.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Belum ada penugasan khusus karyawan. Semua karyawan saat ini mengikuti jadwal default departemennya.
              </div>
            ) : (
              <div className="hr-table-wrap">
                <table className="hr-table">
                  <thead>
                    <tr>
                      <th>Karyawan</th>
                      <th>Departemen</th>
                      <th>Shift Ditugaskan</th>
                      <th>Jadwal Kerja</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeAssignments.map(ea => (
                      <tr key={ea.employeeId}>
                        <td>
                          <div>
                            <span className="font-semibold text-slate-900 block">{ea.employeeName}</span>
                            <span className="text-[11px] text-slate-500">{ea.employeeCode}</span>
                          </div>
                        </td>
                        <td>{ea.departmentName}</td>
                        <td className="font-semibold text-emerald-800">{ea.shiftName}</td>
                        <td className="font-mono text-xs">{ea.scheduleText}</td>
                        <td>
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEmployeeAssignment(ea.employeeId)}
                              className="hr-btn text-rose-700 hover:bg-rose-50 border-rose-200"
                              title="Kembalikan ke default departemen"
                            >
                              Reset ke Dept
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL BUAT / EDIT SHIFT */}
      {(isCreatingShift || editingShift) && (
        <ModalShell
          isOpen
          onClose={() => { setIsCreatingShift(false); setEditingShift(null); }}
          title={editingShift ? 'Edit Shift Kerja' : 'Tambah Shift Kerja Baru'}
          subtitle="Tentukan jadwal masuk, jam pulang, dan pola hari kerja."
          maxWidthClass="max-w-lg"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <button
                type="button"
                className="hr-btn"
                onClick={() => { setIsCreatingShift(false); setEditingShift(null); }}
              >
                Batal
              </button>
              <button
                type="button"
                className="hr-btn-primary"
                onClick={handleSaveShift}
              >
                Simpan Shift
              </button>
            </div>
          }
        >
          <form onSubmit={handleSaveShift} className="space-y-4 text-xs">
            {formError && (
              <div className="p-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="font-bold text-slate-700">Kode Shift</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. PROD_SIANG"
                  value={formCode}
                  onChange={e => setFormCode(e.target.value)}
                  className="hr-input w-full font-mono uppercase"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-slate-700">Nama Shift</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Produksi Shift Siang"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="hr-input w-full"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="font-bold text-slate-700">Jam Masuk (Senin-Jumat)</span>
                <input
                  type="time"
                  required
                  value={formScheduleIn}
                  onChange={e => setFormScheduleIn(e.target.value)}
                  className="hr-input w-full"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-slate-700">Jam Pulang (Senin-Jumat)</span>
                <input
                  type="time"
                  required
                  value={formScheduleOut}
                  onChange={e => setFormScheduleOut(e.target.value)}
                  className="hr-input w-full"
                />
              </label>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-slate-700 block">Pola Hari Kerja</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="workDays"
                    checked={formWorkDays === 5}
                    onChange={() => setFormWorkDays(5)}
                  />
                  <span>5 Hari Kerja (Senin–Jumat, Sabtu-Minggu Libur)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="workDays"
                    checked={formWorkDays === 6}
                    onChange={() => setFormWorkDays(6)}
                  />
                  <span>6 Hari Kerja (Senin–Sabtu Aktif)</span>
                </label>
              </div>
            </div>

            {formWorkDays === 6 && (
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-3">
                <span className="text-xs font-bold text-amber-900 block">
                  Jadwal Khusus Hari Sabtu
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 block">
                    <span className="font-semibold text-slate-700">Jam Masuk Sabtu</span>
                    <input
                      type="time"
                      value={formSatIn}
                      onChange={e => setFormSatIn(e.target.value)}
                      className="hr-input w-full bg-white"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="font-semibold text-slate-700">Jam Pulang Sabtu</span>
                    <input
                      type="time"
                      value={formSatOut}
                      onChange={e => setFormSatOut(e.target.value)}
                      className="hr-input w-full bg-white"
                    />
                  </label>
                </div>
              </div>
            )}

            <label className="space-y-1 block">
              <span className="font-semibold text-slate-700">Keterangan / Deskripsi (Opsional)</span>
              <textarea
                rows={2}
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Catatan tambahan untuk shift ini..."
                className="hr-input w-full"
              />
            </label>
          </form>
        </ModalShell>
      )}

      {/* MODAL TUGASKAN KARYAWAN */}
      {isAssigningEmployee && (
        <ModalShell
          isOpen
          onClose={() => setIsAssigningEmployee(false)}
          title="Tugaskan Shift Khusus Karyawan"
          subtitle="Pilih karyawan dan shift kerja khusus yang akan diterapkan."
          maxWidthClass="max-w-md"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <button
                type="button"
                className="hr-btn"
                onClick={() => setIsAssigningEmployee(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="hr-btn-primary"
                onClick={handleAssignEmployee}
                disabled={!selectedEmpId || !selectedShiftId}
              >
                Simpan Penugasan
              </button>
            </div>
          }
        >
          <form onSubmit={handleAssignEmployee} className="space-y-4 text-xs">
            <label className="space-y-1 block">
              <span className="font-bold text-slate-700">Pilih Karyawan</span>
              <select
                className="hr-input w-full"
                value={selectedEmpId}
                onChange={e => setSelectedEmpId(Number(e.target.value))}
                required
              >
                <option value={0}>-- Pilih Karyawan --</option>
                {data.employees
                  .filter(e => e.isActive)
                  .map(e => {
                    const deptName = data.departments.find(d => d.id === e.departmentId)?.name || '';
                    return (
                      <option key={e.id} value={e.id}>
                        {e.fullName} ({e.employeeCode}) - {deptName}
                      </option>
                    );
                  })}
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="font-bold text-slate-700">Pilih Shift Kerja</span>
              <select
                className="hr-input w-full"
                value={selectedShiftId}
                onChange={e => setSelectedShiftId(Number(e.target.value))}
                required
              >
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.scheduleIn}-{s.scheduleOut}, {s.workDays} Hari)
                  </option>
                ))}
              </select>
            </label>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
