import type { WorkShift, ShiftAssignment } from './attendanceTypes';

export const DEFAULT_OFFICE_SHIFT: WorkShift = {
  id: 1,
  code: 'OFFICE',
  name: 'Office Reguler (Default)',
  scheduleIn: '08:00',
  scheduleOut: '17:00',
  workDays: 5,
  isDefault: true,
  isActive: true,
};

export const DEFAULT_PRODUCTION_SHIFT: WorkShift = {
  id: 2,
  code: 'PROD_6D',
  name: 'Produksi Reguler (6 Hari)',
  scheduleIn: '08:00',
  scheduleOut: '16:00',
  workDays: 6,
  saturdayScheduleIn: '08:00',
  saturdayScheduleOut: '14:00',
  description: 'Senin-Jumat 08:00-16:00, Sabtu 08:00-14:00',
  isDefault: false,
  isActive: true,
};

export function getWorkingScheduleForDate(workDate: string, shift: WorkShift) {
  const saturday = new Date(`${workDate}T12:00:00Z`).getUTCDay() === 6 && shift.workDays === 6;
  return {
    scheduleIn: saturday ? shift.saturdayScheduleIn || shift.scheduleIn : shift.scheduleIn,
    scheduleOut: saturday ? shift.saturdayScheduleOut || '14:00' : shift.scheduleOut,
  };
}

export function resolveActiveEmployeeShift(
  employee: { id?: number; departmentId?: number | null; fullName?: string },
  shifts?: WorkShift[] | null,
  assignments?: ShiftAssignment[] | null
): { shift: WorkShift; hasActiveAssignment: boolean } {
  const activeShifts = (shifts || []).filter((s) => s.isActive);
  const activeAssignments = assignments || [];

  if (employee.id) {
    const direct = activeAssignments.find((a) => a.employeeId === employee.id);
    if (direct) {
      const match = activeShifts.find((s) => s.id === direct.shiftId);
      if (match) return { shift: match, hasActiveAssignment: true };
    }
  }

  if (employee.departmentId) {
    const dept = activeAssignments.find((a) => a.departmentId === employee.departmentId);
    if (dept) {
      const match = activeShifts.find((s) => s.id === dept.shiftId);
      if (match) return { shift: match, hasActiveAssignment: true };
    }
  }

  const explicitDefault = activeShifts.find((s) => s.isDefault);
  if (explicitDefault) return { shift: explicitDefault, hasActiveAssignment: false };

  const fallbackOffice = activeShifts.find((s) => s.code === "OFFICE");
  if (fallbackOffice) return { shift: fallbackOffice, hasActiveAssignment: false };

  return { shift: activeShifts[0] || DEFAULT_OFFICE_SHIFT, hasActiveAssignment: false };
}

export function resolveEmployeeShift(
  employee: { id?: number; departmentId?: number | null; fullName?: string },
  shifts?: WorkShift[] | null,
  assignments?: ShiftAssignment[] | null
): WorkShift {
  return resolveActiveEmployeeShift(employee, shifts, assignments).shift;
}

function _legacyResolveShift(
  employee: { id?: number; departmentId?: number | null; fullName?: string },
  shifts?: WorkShift[] | null,
  assignments?: ShiftAssignment[] | null
): WorkShift {
  const activeShifts = (shifts || []).filter((s) => s.isActive);
  const activeAssignments = assignments || [];

  if (employee.id) {
    const direct = activeAssignments.find((a) => a.employeeId === employee.id);
    if (direct) {
      const match = activeShifts.find((s) => s.id === direct.shiftId);
      if (match) return match;
    }
  }

  if (employee.departmentId) {
    const dept = activeAssignments.find((a) => a.departmentId === employee.departmentId);
    if (dept) {
      const match = activeShifts.find((s) => s.id === dept.shiftId);
      if (match) return match;
    }
  }

  const explicitDefault = activeShifts.find((s) => s.isDefault);
  if (explicitDefault) return explicitDefault;

  const fallbackOffice = activeShifts.find((s) => s.code === 'OFFICE');
  if (fallbackOffice) return fallbackOffice;

  return activeShifts[0] || DEFAULT_OFFICE_SHIFT;
}
