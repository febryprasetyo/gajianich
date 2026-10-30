'use client';

import { useState } from 'react';
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
  Star,
  Check,
  Info,
} from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';
import { useAttendance } from '../AttendanceWorkspace';
import { Heading } from '../shared';
import type { WorkShift, ShiftAssignment, WorkHoursTemplate } from '@/lib/attendance/types';

export default function ShiftManagementPage() {
  const { data, execute, canWrite } = useAttendance();

  const shifts: WorkShift[] = data.shifts || [];
  const assignments: ShiftAssignment[] = data.shiftAssignments || [];
  const workHoursList: WorkHoursTemplate[] = data.workHours || [];

  const [activeTab, setActiveTab] = useState<'work_hours' | 'shifts' | 'assignments'>('shifts');
  const [notice, setNotice] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // STATE: Master Jam Kerja (Work Hours Template)
  // ---------------------------------------------------------------------------
  const [editingWorkHours, setEditingWorkHours] = useState<WorkHoursTemplate | null>(null);
  const [isCreatingWorkHours, setIsCreatingWorkHours] = useState(false);
  const [deletingWorkHours, setDeletingWorkHours] = useState<WorkHoursTemplate | null>(null);

  const [whName, setWhName] = useState('');
  const [whColor, setWhColor] = useState('#2563eb');
  const [whScheduleIn, setWhScheduleIn] = useState('08:00');
  const [whScheduleOut, setWhScheduleOut] = useState('16:00');
  const [whScanInStart, setWhScanInStart] = useState('06:00');
  const [whScanInEnd, setWhScanInEnd] = useState('10:30');
  const [whScanOutStart, setWhScanOutStart] = useState('14:00');
  const [whScanOutEnd, setWhScanOutEnd] = useState('20:00');
  const [whLateTol, setWhLateTol] = useState(5);
  const [whEarlyTol, setWhEarlyTol] = useState(5);
  const [whReqIn, setWhReqIn] = useState(true);
  const [whReqOut, setWhReqOut] = useState(true);
  const [whError, setWhError] = useState('');

  const openCreateWorkHours = () => {
    setWhName('');
    setWhColor('#2563eb');
    setWhScheduleIn('08:00');
    setWhScheduleOut('16:00');
    setWhScanInStart('06:00');
    setWhScanInEnd('10:30');
    setWhScanOutStart('14:00');
    setWhScanOutEnd('20:00');
    setWhLateTol(5);
    setWhEarlyTol(5);
    setWhReqIn(true);
    setWhReqOut(true);
    setWhError('');
    setIsCreatingWorkHours(true);
  };

  const openEditWorkHours = (wh: WorkHoursTemplate) => {
    setEditingWorkHours(wh);
    setWhName(wh.name);
    setWhColor(wh.color || '#2563eb');
    setWhScheduleIn(wh.scheduleIn);
    setWhScheduleOut(wh.scheduleOut);
    setWhScanInStart(wh.scanInStart);
    setWhScanInEnd(wh.scanInEnd);
    setWhScanOutStart(wh.scanOutStart);
    setWhScanOutEnd(wh.scanOutEnd);
    setWhLateTol(wh.lateToleranceMinutes);
    setWhEarlyTol(wh.earlyLeaveToleranceMinutes);
    setWhReqIn(wh.requireCheckIn);
    setWhReqOut(wh.requireCheckOut);
    setWhError('');
  };

  const handleSaveWorkHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setWhError('');

    if (!whName.trim()) {
      setWhError('Nama jam kerja wajib diisi.');
      return;
    }

    try {
      if (editingWorkHours) {
        await execute({
          type: 'work_hours',
          action: 'update',
          workHours: {
            ...editingWorkHours,
            name: whName.trim(),
            color: whColor,
            scheduleIn: whScheduleIn,
            scheduleOut: whScheduleOut,
            scanInStart: whScanInStart,
            scanInEnd: whScanInEnd,
            scanOutStart: whScanOutStart,
            scanOutEnd: whScanOutEnd,
            lateToleranceMinutes: whLateTol,
            earlyLeaveToleranceMinutes: whEarlyTol,
            requireCheckIn: whReqIn,
            requireCheckOut: whReqOut,
            isActive: true,
          },
        });
        setNotice(`Jam kerja "${whName}" berhasil diperbarui.`);
        setEditingWorkHours(null);
      } else {
        await execute({
          type: 'work_hours',
          action: 'create',
          workHours: {
            id: 0,
            name: whName.trim(),
            color: whColor,
            scheduleIn: whScheduleIn,
            scheduleOut: whScheduleOut,
            scanInStart: whScanInStart,
            scanInEnd: whScanInEnd,
            scanOutStart: whScanOutStart,
            scanOutEnd: whScanOutEnd,
            lateToleranceMinutes: whLateTol,
            earlyLeaveToleranceMinutes: whEarlyTol,
            requireCheckIn: whReqIn,
            requireCheckOut: whReqOut,
            isActive: true,
          },
        });
        setNotice(`Jam kerja "${whName}" berhasil ditambahkan.`);
        setIsCreatingWorkHours(false);
      }
    } catch (err: any) {
      setWhError(err.message || 'Gagal menyimpan jam kerja.');
    }
  };

  const handleDeleteWorkHours = async () => {
    if (!deletingWorkHours) return;
    try {
      await execute({
        type: 'work_hours',
        action: 'delete',
        workHours: deletingWorkHours,
      });
      setNotice(`Jam kerja "${deletingWorkHours.name}" berhasil dihapus.`);
      setDeletingWorkHours(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus jam kerja.');
    }
  };

  // ---------------------------------------------------------------------------
  // STATE: Master Shift (Mapping 7 Hari)
  // ---------------------------------------------------------------------------
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [isCreatingShift, setIsCreatingShift] = useState(false);
  const [deletingShift, setDeletingShift] = useState<WorkShift | null>(null);

  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMonWh, setFormMonWh] = useState<number | null>(null);
  const [formTueWh, setFormTueWh] = useState<number | null>(null);
  const [formWedWh, setFormWedWh] = useState<number | null>(null);
  const [formThuWh, setFormThuWh] = useState<number | null>(null);
  const [formFriWh, setFormFriWh] = useState<number | null>(null);
  const [formSatWh, setFormSatWh] = useState<number | null>(null);
  const [formSunWh, setFormSunWh] = useState<number | null>(null);
  const [formError, setFormError] = useState('');

  const openCreateShiftModal = () => {
    const defaultWhId = workHoursList[0]?.id || null;
    setFormCode('');
    setFormName('');
    setFormDesc('');
    setFormMonWh(defaultWhId);
    setFormTueWh(defaultWhId);
    setFormWedWh(defaultWhId);
    setFormThuWh(defaultWhId);
    setFormFriWh(defaultWhId);
    setFormSatWh(null);
    setFormSunWh(null);
    setFormError('');
    setIsCreatingShift(true);
  };

  const openEditShiftModal = (s: WorkShift) => {
    setEditingShift(s);
    setFormCode(s.code);
    setFormName(s.name);
    setFormDesc(s.description || '');
    setFormMonWh(s.mondayWorkHoursId ?? null);
    setFormTueWh(s.tuesdayWorkHoursId ?? null);
    setFormWedWh(s.wednesdayWorkHoursId ?? null);
    setFormThuWh(s.thursdayWorkHoursId ?? null);
    setFormFriWh(s.fridayWorkHoursId ?? null);
    setFormSatWh(s.saturdayWorkHoursId ?? null);
    setFormSunWh(s.sundayWorkHoursId ?? null);
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
            description: formDesc.trim() || undefined,
            mondayWorkHoursId: formMonWh,
            tuesdayWorkHoursId: formTueWh,
            wednesdayWorkHoursId: formWedWh,
            thursdayWorkHoursId: formThuWh,
            fridayWorkHoursId: formFriWh,
            saturdayWorkHoursId: formSatWh,
            sundayWorkHoursId: formSunWh,
          },
        });
        setNotice(`Shift "${formName}" berhasil diperbarui.`);
        setEditingShift(null);
      } else {
        await execute({
          type: 'shift',
          action: 'create',
          shift: {
            id: 0,
            code: formCode.trim().toUpperCase(),
            name: formName.trim(),
            description: formDesc.trim() || undefined,
            mondayWorkHoursId: formMonWh,
            tuesdayWorkHoursId: formTueWh,
            wednesdayWorkHoursId: formWedWh,
            thursdayWorkHoursId: formThuWh,
            fridayWorkHoursId: formFriWh,
            saturdayWorkHoursId: formSatWh,
            sundayWorkHoursId: formSunWh,
            isDefault: shifts.length === 0,
            isActive: true,
          },
        });
        setNotice(`Shift "${formName}" berhasil ditambahkan.`);
        setIsCreatingShift(false);
      }
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan shift.');
    }
  };

  const handleDeleteShift = async () => {
    if (!deletingShift) return;
    try {
      await execute({
        type: 'shift',
        action: 'delete',
        shift: deletingShift,
      });
      setNotice(`Shift "${deletingShift.name}" berhasil dihapus.`);
      setDeletingShift(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus shift.');
    }
  };

  // ---------------------------------------------------------------------------
  // STATE: Penugasan Shift (Departemen Multiple & Karyawan Override)
  // ---------------------------------------------------------------------------
  const [isAssigningDept, setIsAssigningDept] = useState<{ departmentId: number; departmentName: string } | null>(null);
  const [selectedDeptShiftId, setSelectedDeptShiftId] = useState<number>(shifts[0]?.id || 1);
  const [selectedDeptIsDefault, setSelectedDeptIsDefault] = useState<boolean>(false);

  const [isAssigningEmployee, setIsAssigningEmployee] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<number>(0);
  const [selectedShiftId, setSelectedShiftId] = useState<number>(shifts[0]?.id || 1);

  const handleAddDeptShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAssigningDept || !selectedDeptShiftId) return;

    try {
      await execute({
        type: 'assign_shift',
        action: 'assign',
        assignment: {
          id: 0,
          shiftId: selectedDeptShiftId,
          departmentId: isAssigningDept.departmentId,
          employeeId: null,
          isDefault: selectedDeptIsDefault,
        },
      });
      setNotice(`Shift berhasil ditambahkan ke departemen ${isAssigningDept.departmentName}.`);
      setIsAssigningDept(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menugaskan shift departemen.');
    }
  };

  const handleSetDefaultDeptShift = async (departmentId: number, shiftId: number) => {
    try {
      await execute({
        type: 'assign_shift',
        action: 'set_default',
        assignment: {
          id: 0,
          shiftId,
          departmentId,
          employeeId: null,
          isDefault: true,
        },
      });
      setNotice('Shift default departemen berhasil diperbarui.');
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah shift default.');
    }
  };

  const handleRemoveDeptShift = async (departmentId: number, shiftId: number, shiftName: string) => {
    if (!confirm(`Hapus shift "${shiftName}" dari departemen ini?`)) return;
    try {
      await execute({
        type: 'assign_shift',
        action: 'remove',
        assignment: {
          id: 0,
          shiftId,
          departmentId,
          employeeId: null,
        },
      });
      setNotice('Shift departemen berhasil dicabut.');
    } catch (err: any) {
      alert(err.message || 'Gagal mencabut shift departemen.');
    }
  };

  const handleAssignEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !selectedShiftId) return;

    try {
      await execute({
        type: 'assign_shift',
        action: 'assign',
        assignment: {
          id: 0,
          shiftId: selectedShiftId,
          employeeId: selectedEmpId,
          departmentId: null,
        },
      });
      setNotice('Penugasan shift khusus karyawan berhasil disimpan.');
      setIsAssigningEmployee(false);
      setSelectedEmpId(0);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan penugasan karyawan.');
    }
  };

  const handleRemoveEmployeeAssignment = async (employeeId: number) => {
    const emp = data.employees.find(e => e.id === employeeId);
    if (!confirm(`Kembalikan shift ${emp?.fullName || 'karyawan'} ke jadwal departemennya?`)) return;

    try {
      await execute({
        type: 'assign_shift',
        action: 'remove',
        assignment: {
          id: 0,
          shiftId: 0,
          employeeId,
          departmentId: null,
        },
      });
      setNotice('Override shift karyawan berhasil dihapus.');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus override shift.');
    }
  };

  // Karyawan dengan penugasan khusus
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
      };
    });

  const getWorkHoursLabel = (id: number | null | undefined) => {
    if (!id) return null;
    return workHoursList.find(wh => wh.id === id);
  };

  const dayList = [
    { label: 'Senin', state: formMonWh, setter: setFormMonWh },
    { label: 'Selasa', state: formTueWh, setter: setFormTueWh },
    { label: 'Rabu', state: formWedWh, setter: setFormWedWh },
    { label: 'Kamis', state: formThuWh, setter: setFormThuWh },
    { label: 'Jumat', state: formFriWh, setter: setFormFriWh },
    { label: 'Sabtu', state: formSatWh, setter: setFormSatWh },
    { label: 'Minggu', state: formSunWh, setter: setFormSunWh, isSunday: true },
  ];

  return (
    <div className="space-y-6">
      <Heading
        title="Pengaturan Shift & Jam Kerja"
        description="Kelola master jam kerja (time table), jadwal pola shift per-hari, dan penugasan multiple shift per departemen."
      >
        {canWrite && activeTab === 'work_hours' && (
          <button className="hr-btn-primary" onClick={openCreateWorkHours}>
            <Plus size={15} />
            Tambah Jam Kerja Baru
          </button>
        )}
        {canWrite && activeTab === 'shifts' && (
          <button className="hr-btn-primary" onClick={openCreateShiftModal}>
            <Plus size={15} />
            Tambah Shift Baru
          </button>
        )}
        {canWrite && activeTab === 'assignments' && (
          <button className="hr-btn-primary" onClick={() => setIsAssigningEmployee(true)}>
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
          <Calendar size={16} />
          <span>Daftar Shift Mingguan ({shifts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('work_hours')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px ${
            activeTab === 'work_hours'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock size={16} />
          <span>Master Jam Kerja ({workHoursList.length})</span>
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
          <span>Penugasan Departemen & Karyawan</span>
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: DAFTAR SHIFT MINGGUAN */}
      {/* =================================================================== */}
      {activeTab === 'shifts' && (
        <div className="space-y-4">
          <div className="hr-panel">
            <div className="hr-table-wrap">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Shift</th>
                    <th>Jadwal Kerja Per-Hari</th>
                    <th>Jadwal Minggu</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((s) => {
                    const mon = getWorkHoursLabel(s.mondayWorkHoursId);
                    const sat = getWorkHoursLabel(s.saturdayWorkHoursId);
                    const sun = getWorkHoursLabel(s.sundayWorkHoursId);

                    return (
                      <tr key={s.id}>
                        <td className="font-mono font-bold text-slate-800">{s.code}</td>
                        <td>
                          <div>
                            <span className="font-semibold text-slate-900 block">{s.name}</span>
                            {s.description && (
                              <span className="text-[11px] text-slate-500">{s.description}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-slate-500 text-[11px] w-20">Sen–Jum:</span>
                              <span className="font-semibold text-slate-800">
                                {mon ? `${mon.scheduleIn} - ${mon.scheduleOut} (${mon.name})` : 'Libur'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-slate-500 text-[11px] w-20">Sabtu:</span>
                              <span className="text-slate-700">
                                {sat ? `${sat.scheduleIn} - ${sat.scheduleOut} (${sat.name})` : '— (Libur)'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {sun ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                <span>{sun.scheduleIn} - {sun.scheduleOut}</span>
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                Opsional (masuk dihitung, tdk hadir libur)
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">— (Libur)</span>
                          )}
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
                                  onClick={() => openEditShiftModal(s)}
                                  className="hr-btn"
                                  title="Edit shift"
                                >
                                  <Edit2 size={13} />
                                  <span>Edit</span>
                                </button>
                                {!s.isDefault && (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingShift(s)}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: MASTER JAM KERJA (TIME TABLE TEMPLATES) */}
      {/* =================================================================== */}
      {activeTab === 'work_hours' && (
        <div className="space-y-4">
          <div className="hr-panel">
            <div className="hr-table-wrap">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Warna</th>
                    <th>Nama Jam Kerja</th>
                    <th>Jam Masuk & Pulang</th>
                    <th>Mulai C/In – Akhir C/In</th>
                    <th>Mulai C/Out – Akhir C/Out</th>
                    <th>Toleransi</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {workHoursList.map((wh) => (
                    <tr key={wh.id}>
                      <td>
                        <span
                          className="w-4 h-4 rounded-full inline-block border border-slate-300"
                          style={{ backgroundColor: wh.color || '#2563eb' }}
                        />
                      </td>
                      <td>
                        <span className="font-semibold text-slate-900 block">{wh.name}</span>
                      </td>
                      <td className="font-mono font-bold text-slate-800">
                        {wh.scheduleIn} – {wh.scheduleOut}
                      </td>
                      <td className="font-mono text-slate-600">
                        {wh.scanInStart} – {wh.scanInEnd}
                      </td>
                      <td className="font-mono text-slate-600">
                        {wh.scanOutStart} – {wh.scanOutEnd}
                      </td>
                      <td className="text-xs text-slate-600">
                        Terlambat: {wh.lateToleranceMinutes}m | Cepat: {wh.earlyLeaveToleranceMinutes}m
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {canWrite && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditWorkHours(wh)}
                                className="hr-btn"
                                title="Edit jam kerja"
                              >
                                <Edit2 size={13} />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingWorkHours(wh)}
                                className="hr-btn text-rose-700 hover:bg-rose-50 border-rose-200"
                                title="Hapus jam kerja"
                              >
                                <Trash2 size={13} />
                              </button>
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
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: PENUGASAN SHIFT (DEPARTEMEN MULTIPLE & KARYAWAN) */}
      {/* =================================================================== */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          {/* Sub-bagian 1: Penugasan Multiple Shift per Departemen */}
          <div className="hr-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Penugasan Multiple Shift per Departemen
                  </h2>
                  <p className="text-xs text-slate-500">
                    Setiap departemen dapat memiliki lebih dari satu shift terdaftar (misal Shift Reguler dan Shift Lembur Minggu). Shift utama ditandai sebagai Default.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.departments.map((d) => {
                const deptAssignments = assignments.filter((a) => a.departmentId === d.id && !a.employeeId);

                return (
                  <div
                    key={d.id}
                    className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs text-slate-900 block">{d.name}</span>
                        <span className="text-[11px] text-slate-500 block">Kode: {d.code}</span>
                      </div>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDeptShiftId(shifts[0]?.id || 1);
                            setSelectedDeptIsDefault(deptAssignments.length === 0);
                            setIsAssigningDept({ departmentId: d.id, departmentName: d.name });
                          }}
                          className="hr-btn text-[11px] py-1 px-2.5"
                        >
                          <Plus size={12} />
                          <span>Tambah Shift</span>
                        </button>
                      )}
                    </div>

                    {deptAssignments.length === 0 ? (
                      <div className="p-2.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] border border-amber-200">
                        Belum ada shift terdaftar. Mengikuti shift default sistem kantor.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {deptAssignments.map((da) => {
                          const shift = shifts.find((s) => s.id === da.shiftId);
                          if (!shift) return null;

                          return (
                            <div
                              key={da.id}
                              className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold text-slate-900 truncate">
                                  {shift.name}
                                </span>
                                {da.isDefault && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                    <Star size={10} className="fill-emerald-700" />
                                    Default
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {canWrite && !da.isDefault && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetDefaultDeptShift(d.id, shift.id)}
                                    className="hr-btn text-[10px] py-0.5 px-2 text-slate-600 hover:text-emerald-700"
                                    title="Jadikan shift utama departemen"
                                  >
                                    Set Default
                                  </button>
                                )}
                                {canWrite && deptAssignments.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDeptShift(d.id, shift.id, shift.name)}
                                    className="hr-btn text-rose-700 hover:bg-rose-50 border-rose-200 py-0.5 px-1.5"
                                    title="Hapus dari departemen"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
                    Penugasan Khusus Karyawan (Override Langsung)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Karyawan yang memiliki jadwal khusus personal di luar departemen asalnya.
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
                Belum ada penugasan khusus karyawan. Semua karyawan saat ini mengikuti jadwal shift departemennya.
              </div>
            ) : (
              <div className="hr-table-wrap">
                <table className="hr-table">
                  <thead>
                    <tr>
                      <th>Karyawan</th>
                      <th>Departemen</th>
                      <th>Shift Ditugaskan</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeAssignments.map((ea) => (
                      <tr key={ea.employeeId}>
                        <td>
                          <div>
                            <span className="font-semibold text-slate-900 block">{ea.employeeName}</span>
                            <span className="text-[11px] text-slate-500">{ea.employeeCode}</span>
                          </div>
                        </td>
                        <td>{ea.departmentName}</td>
                        <td className="font-semibold text-emerald-800">{ea.shiftName}</td>
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

      {/* =================================================================== */}
      {/* MODAL 1: FORM JAM KERJA (MASTER JAM KERJA / TEMPLATE) */}
      {/* =================================================================== */}
      {(isCreatingWorkHours || editingWorkHours) && (
        <ModalShell
          isOpen
          onClose={() => {
            setIsCreatingWorkHours(false);
            setEditingWorkHours(null);
          }}
          title={editingWorkHours ? 'Edit Jam Kerja' : 'Tambah Jam Kerja Baru'}
          subtitle="Konfigurasi waktu masuk, jam pulang, window scan masuk/pulang, dan toleransi."
          maxWidthClass="max-w-xl"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <button
                type="button"
                className="hr-btn"
                onClick={() => {
                  setIsCreatingWorkHours(false);
                  setEditingWorkHours(null);
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className="hr-btn-primary"
                onClick={handleSaveWorkHours}
              >
                Simpan Jam Kerja
              </button>
            </div>
          }
        >
          <form onSubmit={handleSaveWorkHours} className="space-y-4 text-xs">
            {whError && (
              <div className="p-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200">
                {whError}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <label className="col-span-2 space-y-1 block">
                <span className="font-bold text-slate-700">Nama Jam Kerja</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daytime / Produksi Reguler"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className="hr-input w-full"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-slate-700">Warna Tampilan</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={whColor}
                    onChange={(e) => setWhColor(e.target.value)}
                    className="w-10 h-8 p-0.5 rounded border border-slate-300 cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-slate-600 uppercase">{whColor}</span>
                </div>
              </label>
            </div>

            {/* Jam Masuk & Jam Pulang */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
              <label className="space-y-1 block">
                <span className="font-bold text-slate-800">Jam Masuk Resmi</span>
                <input
                  type="time"
                  required
                  value={whScheduleIn}
                  onChange={(e) => setWhScheduleIn(e.target.value)}
                  className="hr-input w-full bg-white font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-slate-800">Jam Pulang Resmi</span>
                <input
                  type="time"
                  required
                  value={whScheduleOut}
                  onChange={(e) => setWhScheduleOut(e.target.value)}
                  className="hr-input w-full bg-white font-mono"
                />
              </label>
            </div>

            {/* Toleransi */}
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="font-semibold text-slate-700">Toleransi Terlambat (menit)</span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={whLateTol}
                  onChange={(e) => setWhLateTol(Number(e.target.value))}
                  className="hr-input w-full"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-semibold text-slate-700">Toleransi Pulang Cepat (menit)</span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={whEarlyTol}
                  onChange={(e) => setWhEarlyTol(Number(e.target.value))}
                  className="hr-input w-full"
                />
              </label>
            </div>

            {/* Window Scan Masuk */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-200/60">
              <label className="space-y-1 block">
                <span className="font-semibold text-blue-900">Jam Mulai Scan Masuk</span>
                <input
                  type="time"
                  required
                  value={whScanInStart}
                  onChange={(e) => setWhScanInStart(e.target.value)}
                  className="hr-input w-full bg-white font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-semibold text-blue-900">Jam Akhir Scan Masuk</span>
                <input
                  type="time"
                  required
                  value={whScanInEnd}
                  onChange={(e) => setWhScanInEnd(e.target.value)}
                  className="hr-input w-full bg-white font-mono"
                />
              </label>
            </div>

            {/* Window Scan Pulang */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-200/60">
              <label className="space-y-1 block">
                <span className="font-semibold text-purple-900">Jam Mulai Scan Pulang</span>
                <input
                  type="time"
                  required
                  value={whScanOutStart}
                  onChange={(e) => setWhScanOutStart(e.target.value)}
                  className="hr-input w-full bg-white font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-semibold text-purple-900">Jam Akhir Scan Pulang</span>
                <input
                  type="time"
                  required
                  value={whScanOutEnd}
                  onChange={(e) => setWhScanOutEnd(e.target.value)}
                  className="hr-input w-full bg-white font-mono"
                />
              </label>
            </div>

            {/* Flags */}
            <div className="flex gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whReqIn}
                  onChange={(e) => setWhReqIn(e.target.checked)}
                />
                <span className="text-slate-700">Harus C/In (Absen Masuk)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whReqOut}
                  onChange={(e) => setWhReqOut(e.target.checked)}
                />
                <span className="text-slate-700">Harus C/Out (Absen Pulang)</span>
              </label>
            </div>
          </form>
        </ModalShell>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: FORM SHIFT MINGGUAN (MAPPING 7 HARI) */}
      {/* =================================================================== */}
      {(isCreatingShift || editingShift) && (
        <ModalShell
          isOpen
          onClose={() => {
            setIsCreatingShift(false);
            setEditingShift(null);
          }}
          title={editingShift ? 'Edit Shift Mingguan' : 'Tambah Shift Mingguan Baru'}
          subtitle="Tentukan mapping jam kerja untuk setiap hari dalam seminggu."
          maxWidthClass="max-w-xl"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <button
                type="button"
                className="hr-btn"
                onClick={() => {
                  setIsCreatingShift(false);
                  setEditingShift(null);
                }}
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
                  placeholder="e.g. PROD_REGULER"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="hr-input w-full font-mono uppercase"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-slate-700">Nama Shift</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shift Produksi Mingguan"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="hr-input w-full"
                />
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="font-semibold text-slate-700">Keterangan / Deskripsi (Opsional)</span>
              <input
                type="text"
                placeholder="Catatan tambahan..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="hr-input w-full"
              />
            </label>

            {/* TABEL MAPPING HARI KE MASTER JAM KERJA */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-800 block">
                Pola Hari Kerja (Mapping ke Jam Kerja)
              </span>

              <div className="space-y-2">
                {dayList.map((day) => {
                  const selectedWh = getWorkHoursLabel(day.state);

                  return (
                    <div
                      key={day.label}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                        day.isSunday
                          ? 'bg-amber-50/40 border-amber-200'
                          : 'bg-slate-50/60 border-slate-200/80'
                      }`}
                    >
                      <div className="w-24 shrink-0">
                        <span className="font-bold text-slate-900 block">{day.label}</span>
                        {day.isSunday && (
                          <span className="text-[10px] text-amber-800 font-semibold">Opsional</span>
                        )}
                      </div>

                      <select
                        aria-label={`Pilih jam kerja untuk ${day.label}`}
                        className="hr-input flex-1 font-semibold text-xs"
                        value={day.state || ''}
                        onChange={(e) => day.setter(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">— Libur (Tidak Ada Jam Kerja) —</option>
                        {workHoursList.map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.name} ({wh.scheduleIn} - {wh.scheduleOut})
                          </option>
                        ))}
                      </select>

                      <div className="w-28 text-right shrink-0">
                        {selectedWh ? (
                          <span className="font-mono text-xs font-semibold text-emerald-700">
                            {selectedWh.scheduleIn}–{selectedWh.scheduleOut}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Libur</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Catatan Hari Minggu */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-[11px] flex gap-2">
                <Info size={16} className="shrink-0 text-blue-600 mt-0.5" />
                <span>
                  <strong>Aturan Hari Minggu:</strong> Jika di-assign jam kerja, kehadiran di hari Minggu dihitung sesuai jadwal tersebut (08:00 - 16:00). Jika karyawan tidak hadir/tidak tap di hari Minggu, otomatis dihitung <strong>LIBUR</strong> (bukan ALPHA).
                </span>
              </div>
            </div>
          </form>
        </ModalShell>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: TAMBAH SHIFT KE DEPARTEMEN */}
      {/* =================================================================== */}
      {isAssigningDept && (
        <ModalShell
          isOpen
          onClose={() => setIsAssigningDept(null)}
          title={`Tambah Shift ke Departemen ${isAssigningDept.departmentName}`}
          subtitle="Departemen dapat memiliki beberapa shift alternatif sekaligus."
          maxWidthClass="max-w-md"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <button
                type="button"
                className="hr-btn"
                onClick={() => setIsAssigningDept(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="hr-btn-primary"
                onClick={handleAddDeptShift}
              >
                Simpan Penugasan
              </button>
            </div>
          }
        >
          <form onSubmit={handleAddDeptShift} className="space-y-4 text-xs">
            <label className="space-y-1 block">
              <span className="font-bold text-slate-700">Pilih Shift</span>
              <select
                className="hr-input w-full font-semibold"
                value={selectedDeptShiftId}
                onChange={(e) => setSelectedDeptShiftId(Number(e.target.value))}
                required
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={selectedDeptIsDefault}
                onChange={(e) => setSelectedDeptIsDefault(e.target.checked)}
              />
              <span className="font-semibold text-slate-800">
                Jadikan sebagai shift utama (Default) untuk departemen ini
              </span>
            </label>
          </form>
        </ModalShell>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: TUGASKAN KARYAWAN (OVERRIDE) */}
      {/* =================================================================== */}
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
                onChange={(e) => setSelectedEmpId(Number(e.target.value))}
                required
              >
                <option value={0}>-- Pilih Karyawan --</option>
                {data.employees
                  .filter((e) => e.isActive)
                  .map((e) => {
                    const deptName = data.departments.find((d) => d.id === e.departmentId)?.name || '';
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
                onChange={(e) => setSelectedShiftId(Number(e.target.value))}
                required
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </label>
          </form>
        </ModalShell>
      )}

      {/* CONFIRM DELETE MODALS */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingShift)}
        title="Hapus Shift"
        description="Shift ini akan dihapus. Penugasan terkait akan direset."
        itemName={deletingShift?.name}
        onClose={() => setDeletingShift(null)}
        onConfirm={handleDeleteShift}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deletingWorkHours)}
        title="Hapus Master Jam Kerja"
        description="Jam kerja ini akan dihapus dari template master."
        itemName={deletingWorkHours?.name}
        onClose={() => setDeletingWorkHours(null)}
        onConfirm={handleDeleteWorkHours}
      />
    </div>
  );
}
