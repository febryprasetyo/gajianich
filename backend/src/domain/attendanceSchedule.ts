import type { WorkShift, WorkHoursTemplate, ShiftAssignment } from './attendanceTypes';

// ---------------------------------------------------------------------------
// DEFAULT_OFFICE_SHIFT — fallback jika tidak ada assignment shift
// Senin-Jumat 08:00-17:00 (tanpa Sabtu/Minggu)
// ---------------------------------------------------------------------------
export const DEFAULT_OFFICE_SHIFT: WorkShift = {
  id: 1,
  code: 'OFFICE',
  name: 'Office Reguler (Default)',
  description: 'Senin-Jumat 08:00-17:00',
  // Senin-Jumat menggunakan template inline (tanpa FK — fallback saja)
  mondayWorkHoursId: null,
  tuesdayWorkHoursId: null,
  wednesdayWorkHoursId: null,
  thursdayWorkHoursId: null,
  fridayWorkHoursId: null,
  saturdayWorkHoursId: null,
  sundayWorkHoursId: null,
  isDefault: true,
  isActive: true,
};

// Template jam kerja default untuk fallback tanpa database (e.g. unit tests)
export const DEFAULT_OFFICE_WORK_HOURS: WorkHoursTemplate = {
  id: -1,
  name: 'Office Reguler',
  scheduleIn: '08:00',
  scheduleOut: '17:00',
  scanInStart: '06:00',
  scanInEnd: '10:00',
  scanOutStart: '15:00',
  scanOutEnd: '20:00',
  lateToleranceMinutes: 5,
  earlyLeaveToleranceMinutes: 5,
  requireCheckIn: true,
  requireCheckOut: true,
  isActive: true,
};

// ---------------------------------------------------------------------------
// Peta hari → properti FK di WorkShift
// 0=Minggu, 1=Senin, ..., 6=Sabtu
// ---------------------------------------------------------------------------
const DAY_TO_WORK_HOURS_KEY: Record<number, keyof WorkShift> = {
  0: 'sundayWorkHoursId',
  1: 'mondayWorkHoursId',
  2: 'tuesdayWorkHoursId',
  3: 'wednesdayWorkHoursId',
  4: 'thursdayWorkHoursId',
  5: 'fridayWorkHoursId',
  6: 'saturdayWorkHoursId',
};

/**
 * Resolusi jadwal untuk tanggal tertentu berdasarkan shift dan kumpulan template jam kerja.
 *
 * Aturan hari Minggu (sundayWorkHoursId):
 *   - Ada template + ada tap   → isDayOff: false, hitung normal
 *   - Ada template + tidak tap → isDayOff: true  (LIBUR, bukan ALPHA)
 *   - Tidak ada template (null) → isDayOff: true (LIBUR, bukan ALPHA)
 *
 * Aturan Senin-Sabtu:
 *   - Ada template + tidak tap → ALPHA (ditangani di lapisan atas)
 *   - Tidak ada template (null) → isDayOff: true
 */
export function getWorkingScheduleForDate(
  workDate: string,
  shift: WorkShift,
  workHoursMap: Map<number, WorkHoursTemplate> = new Map(),
  options?: { hasTapRecord?: boolean }
): {
  isDayOff: boolean;
  isSundayOptional: boolean;
  scheduleIn: string | null;
  scheduleOut: string | null;
  scanInStart: string | null;
  scanInEnd: string | null;
  scanOutStart: string | null;
  scanOutEnd: string | null;
  lateToleranceMinutes: number;
  earlyLeaveToleranceMinutes: number;
} {
  const dayOfWeek = new Date(`${workDate}T12:00:00Z`).getUTCDay();
  const isSunday = dayOfWeek === 0;
  const key = DAY_TO_WORK_HOURS_KEY[dayOfWeek];
  const workHoursId = shift[key] as number | null | undefined;

  // Cari template dasar (Senin) atau fallback untuk base hours
  const baseWorkHoursId = shift.mondayWorkHoursId;
  const baseWh = baseWorkHoursId ? workHoursMap.get(baseWorkHoursId) : undefined;
  const baseScheduleIn = baseWh?.scheduleIn || (shift as any).scheduleIn || '08:00';
  const baseScheduleOut = baseWh?.scheduleOut || (shift as any).scheduleOut || '17:00';

  // Legacy fallback jika shift belum dikonfigurasi per-hari tapi punya scheduleIn
  if (!workHoursId && (shift as any).scheduleIn) {
    const legacy = shift as any;
    const isSaturday = dayOfWeek === 6;
    const isWorkDay = (dayOfWeek >= 1 && dayOfWeek <= 5) || (isSaturday && legacy.workDays === 6);
    const inTime = isSaturday && legacy.saturdayScheduleIn ? legacy.saturdayScheduleIn : legacy.scheduleIn;
    const outTime = isSaturday && legacy.saturdayScheduleOut ? legacy.saturdayScheduleOut : legacy.scheduleOut;

    return {
      isDayOff: !isWorkDay,
      isSundayOptional: isSunday,
      scheduleIn: inTime,
      scheduleOut: outTime,
      scanInStart: null,
      scanInEnd: null,
      scanOutStart: null,
      scanOutEnd: null,
      lateToleranceMinutes: 5,
      earlyLeaveToleranceMinutes: 5,
    };
  }

  // Hari tanpa template → libur, tapi tetap bawa base hours untuk keperluan display/Dinas Luar
  if (!workHoursId) {
    return {
      isDayOff: true,
      isSundayOptional: isSunday,
      scheduleIn: baseScheduleIn,
      scheduleOut: baseScheduleOut,
      scanInStart: null,
      scanInEnd: null,
      scanOutStart: null,
      scanOutEnd: null,
      lateToleranceMinutes: 0,
      earlyLeaveToleranceMinutes: 0,
    };
  }

  const wh = workHoursMap.get(workHoursId);
  const activeWh = wh || {
    ...DEFAULT_OFFICE_WORK_HOURS,
    scheduleIn: baseScheduleIn,
    scheduleOut: baseScheduleOut,
  };

  // Minggu dengan template → opsional (tap-driven)
  // Jika tidak ada tap, dihitung libur (bukan ALPHA)
  if (isSunday && !options?.hasTapRecord) {
    return {
      isDayOff: true,
      isSundayOptional: true,
      scheduleIn: activeWh.scheduleIn,
      scheduleOut: activeWh.scheduleOut,
      scanInStart: activeWh.scanInStart,
      scanInEnd: activeWh.scanInEnd,
      scanOutStart: activeWh.scanOutStart,
      scanOutEnd: activeWh.scanOutEnd,
      lateToleranceMinutes: activeWh.lateToleranceMinutes,
      earlyLeaveToleranceMinutes: activeWh.earlyLeaveToleranceMinutes,
    };
  }

  return {
    isDayOff: false,
    isSundayOptional: false,
    scheduleIn: activeWh.scheduleIn,
    scheduleOut: activeWh.scheduleOut,
    scanInStart: activeWh.scanInStart,
    scanInEnd: activeWh.scanInEnd,
    scanOutStart: activeWh.scanOutStart,
    scanOutEnd: activeWh.scanOutEnd,
    lateToleranceMinutes: activeWh.lateToleranceMinutes,
    earlyLeaveToleranceMinutes: activeWh.earlyLeaveToleranceMinutes,
  };
}

/**
 * Resolve shift aktif untuk karyawan berdasarkan prioritas:
 * 1. Penugasan langsung karyawan (employeeId)
 * 2. Shift default departemen (isDefault: true dari assignment departemen)
 * 3. Shift departemen pertama (fallback jika tidak ada isDefault)
 * 4. Shift default sistem (isDefault: true di shift)
 * 5. Shift OFFICE (code === 'OFFICE')
 * 6. DEFAULT_OFFICE_SHIFT (fallback keras)
 */
export function resolveActiveEmployeeShift(
  employee: { id?: number; departmentId?: number | null; fullName?: string },
  shifts?: WorkShift[] | null,
  assignments?: ShiftAssignment[] | null
): { shift: WorkShift; hasActiveAssignment: boolean } {
  const activeShifts = (shifts || []).filter((s) => s.isActive);
  const activeAssignments = assignments || [];

  // Prioritas 1: penugasan langsung per karyawan
  if (employee.id) {
    const direct = activeAssignments.find((a) => a.employeeId === employee.id);
    if (direct) {
      const match = activeShifts.find((s) => s.id === direct.shiftId);
      if (match) return { shift: match, hasActiveAssignment: true };
    }
  }

  // Prioritas 2 & 3: penugasan departemen
  if (employee.departmentId) {
    const deptAssignments = activeAssignments.filter(
      (a) => a.departmentId === employee.departmentId && !a.employeeId
    );
    if (deptAssignments.length > 0) {
      // Cari yang isDefault: true dulu
      const defaultAssign = deptAssignments.find((a) => a.isDefault);
      const chosen = defaultAssign || deptAssignments[0];
      const match = activeShifts.find((s) => s.id === chosen.shiftId);
      if (match) return { shift: match, hasActiveAssignment: true };
    }
  }

  // Prioritas 4: shift default sistem
  const explicitDefault = activeShifts.find((s) => s.isDefault);
  if (explicitDefault) return { shift: explicitDefault, hasActiveAssignment: false };

  // Prioritas 5: fallback shift OFFICE
  const fallbackOffice = activeShifts.find((s) => s.code === 'OFFICE');
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

/**
 * Snapshot jadwal kerja untuk disimpan ke attendance_records.
 * Backward-compatible: tetap return { shift, scheduleIn, scheduleOut }
 * Untuk lapisan service yang belum migrate ke getWorkingScheduleForDate.
 */
export function getAttendanceSchedule(
  employee: { id?: number; departmentId?: number | null },
  workDate: string,
  shifts: WorkShift[],
  assignments: ShiftAssignment[],
  shiftId?: number,
  workHoursMap?: Map<number, WorkHoursTemplate>,
  options?: { hasTapRecord?: boolean }
) {
  const shift =
    shifts.find((s) => s.id === shiftId && s.isActive) ??
    resolveEmployeeShift(employee, shifts, assignments);

  const sched = getWorkingScheduleForDate(workDate, shift, workHoursMap, options);
  return {
    shift: shift.name,
    scheduleIn: sched.scheduleIn ?? '',
    scheduleOut: sched.scheduleOut ?? '',
    isDayOff: sched.isDayOff,
    isSundayOptional: sched.isSundayOptional,
  };
}
