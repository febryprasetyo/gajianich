import type { AttendanceRecord, WorkShift, ShiftAssignment, WorkHoursTemplate } from './types';

export type { WorkShift, ShiftAssignment, WorkHoursTemplate };

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

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const DAY_NAMES_ID = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
];

export function getPayrollCyclePeriod(year: number, month: number): {
  startDate: string;
  endDate: string;
  label: string;
  year: number;
  month: number;
} {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const startMonthStr = String(month).padStart(2, '0');
  const endMonthStr = String(nextMonth).padStart(2, '0');

  const startDate = `${year}-${startMonthStr}-21`;
  const endDate = `${nextYear}-${endMonthStr}-20`;
  const label = `${MONTH_NAMES_ID[month - 1]} ${year}`;

  return { startDate, endDate, label, year, month };
}

export function resolveEmployeeShift(
  employee: { id?: number; departmentId?: number | null; fullName?: string },
  shifts?: WorkShift[] | null,
  assignments?: ShiftAssignment[] | null
): WorkShift {
  const shiftList = shifts && shifts.length > 0 ? shifts : [DEFAULT_OFFICE_SHIFT];
  const assignmentList = assignments || [];

  if (employee?.id) {
    const directAssign = assignmentList.find(a => a.employeeId === employee.id);
    if (directAssign) {
      const found = shiftList.find(s => s.id === directAssign.shiftId && s.isActive);
      if (found) return found;
    }
  }

  if (employee?.departmentId) {
    const deptAssigns = assignmentList.filter(a => a.departmentId === employee.departmentId && !a.employeeId);
    if (deptAssigns.length > 0) {
      const defaultOne = deptAssigns.find(a => a.isDefault) || deptAssigns[0];
      const found = shiftList.find(s => s.id === defaultOne.shiftId && s.isActive);
      if (found) return found;
    }
  }

  const defaultShift = shiftList.find(s => s.isDefault && s.isActive);
  return defaultShift || shiftList[0] || DEFAULT_OFFICE_SHIFT;
}

export function isWorkDayForShift(dateStr: string, shift: WorkShift): boolean {
  const dateObj = new Date(`${dateStr}T12:00:00Z`);
  const day = dateObj.getUTCDay();

  if (day === 0) return false;
  if (day >= 1 && day <= 5) return true;
  if (day === 6) return shift.workDays === 6;
  return false;
}

export function getScheduleForDate(dateStr: string, shift: WorkShift): {
  scheduleIn: string;
  scheduleOut: string;
  isDayOff: boolean;
} {
  const dateObj = new Date(`${dateStr}T12:00:00Z`);
  const day = dateObj.getUTCDay();

  if (day === 0) {
    return { scheduleIn: '00:00', scheduleOut: '00:00', isDayOff: true };
  }

  if (day === 6) {
    if (shift.workDays === 6) {
      return {
        scheduleIn: shift.saturdayScheduleIn || shift.scheduleIn || '08:00',
        scheduleOut: shift.saturdayScheduleOut || '14:00',
        isDayOff: false,
      };
    }
    return { scheduleIn: '00:00', scheduleOut: '00:00', isDayOff: true };
  }

  return {
    scheduleIn: shift.scheduleIn || '08:00',
    scheduleOut: shift.scheduleOut || '17:00',
    isDayOff: false,
  };
}

export function getWorkingScheduleForDate(dateStr: string, shift: WorkShift): {
  scheduleIn: string;
  scheduleOut: string;
} {
  const schedule = getScheduleForDate(dateStr, shift);
  if (!schedule.isDayOff) {
    return { scheduleIn: schedule.scheduleIn, scheduleOut: schedule.scheduleOut };
  }
  return {
    scheduleIn: shift.scheduleIn || '08:00',
    scheduleOut: shift.scheduleOut || '17:00',
  };
}

export interface CalendarDayRow {
  date: string;
  dayName: string;
  shiftName: string;
  scheduleIn: string;
  scheduleOut: string;
  isDayOff: boolean;
  record: AttendanceRecord | null;
}

export function generateFullCalendarGrid(
  startDate: string,
  endDate: string,
  shift: WorkShift,
  records: AttendanceRecord[]
): CalendarDayRow[] {
  const recordMap = new Map<string, AttendanceRecord>();
  for (const r of records) {
    if (r.workDate) {
      recordMap.set(r.workDate, r);
    }
  }

  const results: CalendarDayRow[] = [];
  const current = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const dayOfWeek = current.getUTCDay();
    const dayName = DAY_NAMES_ID[dayOfWeek];
    const schedule = getScheduleForDate(dateStr, shift);
    const matchedRecord = recordMap.get(dateStr) || null;

    results.push({
      date: dateStr,
      dayName,
      shiftName: schedule.isDayOff ? 'dayoff' : shift.name,
      scheduleIn: matchedRecord?.scheduleIn || schedule.scheduleIn,
      scheduleOut: matchedRecord?.scheduleOut || schedule.scheduleOut,
      isDayOff: matchedRecord ? matchedRecord.isDayOff : schedule.isDayOff,
      record: matchedRecord,
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return results;
}
