import type { AttendanceRecord } from './types';
import type { CalendarDayRow } from './scheduleShift';

export interface TalentaKpiSummary {
  // Segment 1: Exceptions / Scan deviations
  late: number;
  earlyClockOut: number;
  noClockOut: number;
  noClockIn: number;
  invalid: number;

  // Segment 2: Absences & Off Days
  absent: number;
  dayOff: number;
  timeOff: number;

  // Segment 3: Upcoming work days
  nextWorkdays: number;
}

export interface TalentaFormattedRow {
  date: string;
  dateDisplay: string;
  dayName: string;
  shiftCode: string;
  isDayOff: boolean;
  scheduleIn: string;
  scheduleOut: string;
  clockIn: string;
  clockOut: string;
  attendanceCode: string;
  timeOffCode: string;
  late: string;
  overtime: string;
  record?: AttendanceRecord | null;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats YYYY-MM-DD into "Wed, 23 Sep 2026" Talenta format
 */
export function formatTalentaDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const dayName = DAYS_SHORT[dateObj.getUTCDay()];
  const monthName = MONTHS_SHORT[m - 1];
  return `${dayName}, ${d} ${monthName} ${y}`;
}

/**
 * Format duration minutes into "HH:mm" (e.g. 90 -> "01:30")
 */
export function formatOvertimeDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Map raw calendar day row into Talenta-aligned row structure
 */
export function formatTalentaRow(row: CalendarDayRow): TalentaFormattedRow {
  const r = row.record;
  const isDayOff = !!row.isDayOff;

  // Shift display
  const shiftCode = isDayOff ? 'dayoff' : (row.shiftName && row.shiftName.includes('Shift') ? row.shiftName : 'O');

  // Schedule display
  const scheduleIn = isDayOff ? '00:00' : (row.scheduleIn || '08:00');
  const scheduleOut = isDayOff ? '00:00' : (row.scheduleOut || '17:00');

  // Clock in & out
  const clockIn = r?.scanIn || '-';
  const clockOut = r?.scanOut || '-';

  // Attendance code (H, S, I, C, -)
  let attendanceCode = '-';
  let timeOffCode = '-';

  if (r) {
    if (['PRESENT', 'LATE', 'EARLY_LEAVE'].includes(r.attendanceStatus)) {
      attendanceCode = 'H';
    } else if (r.attendanceStatus === 'DINAS_LUAR') {
      attendanceCode = 'DL';
    } else if (r.attendanceStatus === 'SAKIT') {
      attendanceCode = 'S';
      timeOffCode = 'S';
    } else if (r.attendanceStatus === 'CUTI') {
      attendanceCode = 'C';
      timeOffCode = 'Cuti';
    } else if (r.attendanceStatus === 'IZIN') {
      attendanceCode = 'I';
      timeOffCode = 'Izin';
    }
  }

  return {
    date: row.date,
    dateDisplay: formatTalentaDate(row.date),
    dayName: row.dayName,
    shiftCode,
    isDayOff,
    scheduleIn,
    scheduleOut,
    clockIn,
    clockOut,
    attendanceCode,
    timeOffCode,
    late: isDayOff || r?.attendanceStatus === 'DINAS_LUAR' ? '-' : formatOvertimeDuration(r?.lateMinutes),
    overtime: r?.attendanceStatus === 'DINAS_LUAR' ? '-' : formatOvertimeDuration(r?.overtimeMinutes),
    record: r,
  };
}

/**
 * Calculate the 3-segment Talenta KPI summary
 */
export function calculateTalentaKpi(
  calendarRows: CalendarDayRow[],
  todayDateStr?: string
): TalentaKpiSummary {
  const today = todayDateStr || new Date().toISOString().slice(0, 10);

  let late = 0;
  let earlyClockOut = 0;
  let noClockOut = 0;
  let noClockIn = 0;
  let invalid = 0;
  let absent = 0;
  let dayOff = 0;
  let timeOff = 0;
  let nextWorkdays = 0;

  for (const row of calendarRows) {
    const isPastOrToday = row.date <= today;
    const isFuture = row.date > today;
    const r = row.record;

    // Segment 2: Day off count (total day off in period)
    if (row.isDayOff) {
      dayOff++;
      continue;
    }

    if (r) {
      if (['PRESENT', 'LATE', 'EARLY_LEAVE'].includes(r.attendanceStatus)) {
        if ((r.lateMinutes || 0) > 0 || r.attendanceStatus === 'LATE') {
          late++;
        }
        // Early clock out
        if ((r.earlyMinutes || 0) > 0 || r.attendanceStatus === 'EARLY_LEAVE') {
          earlyClockOut++;
        }
        // Missing scan out
        if (r.scanIn && !r.scanOut) {
          noClockOut++;
        }
        // Missing scan in
        if (!r.scanIn && r.scanOut) {
          noClockIn++;
        }
      } else if (r.attendanceStatus === 'DINAS_LUAR') {
        // Dinas luar counts as a worked day without scan exceptions.
      } else if (['SAKIT', 'CUTI', 'IZIN'].includes(r.attendanceStatus)) {
        timeOff++;
      } else if (r.attendanceStatus === 'ALPHA') {
        absent++;
      } else if ((r.attendanceStatus as string) === 'INVALID') {
        invalid++;
      }
    } else {
      // Unrecorded days
      if (!row.isDayOff) {
        if (isPastOrToday) {
          absent++;
        } else if (isFuture) {
          nextWorkdays++;
        }
      }
    }
  }

  return {
    late,
    earlyClockOut,
    noClockOut,
    noClockIn,
    invalid,
    absent,
    dayOff,
    timeOff,
    nextWorkdays,
  };
}

export type TalentaKpiFilterKey =
  | 'ALL'
  | 'LATE'
  | 'EARLY_CLOCK_OUT'
  | 'NO_CLOCK_OUT'
  | 'NO_CLOCK_IN'
  | 'INVALID'
  | 'ABSENT'
  | 'DAY_OFF'
  | 'TIME_OFF'
  | 'NEXT_WORKDAYS';

/**
 * Filter calendar day rows based on active Talenta KPI card selection
 */
export function filterTalentaRows(
  rows: CalendarDayRow[],
  filterKey: TalentaKpiFilterKey,
  todayDateStr?: string
): CalendarDayRow[] {
  if (!filterKey || filterKey === 'ALL') return rows;
  const today = todayDateStr || new Date().toISOString().slice(0, 10);

  return rows.filter((row) => {
    const isFuture = row.date > today;
    const r = row.record;
    if (row.isDayOff && filterKey !== 'DAY_OFF') return false;

    switch (filterKey) {
      case 'LATE':
        return ['PRESENT', 'LATE', 'EARLY_LEAVE'].includes(r?.attendanceStatus || '') && (((r?.lateMinutes || 0) > 0) || r?.attendanceStatus === 'LATE');
      case 'EARLY_CLOCK_OUT':
        return ['PRESENT', 'LATE', 'EARLY_LEAVE'].includes(r?.attendanceStatus || '') && (((r?.earlyMinutes || 0) > 0) || r?.attendanceStatus === 'EARLY_LEAVE');
      case 'NO_CLOCK_OUT':
        return ['PRESENT', 'LATE', 'EARLY_LEAVE'].includes(r?.attendanceStatus || '') && !!r?.scanIn && !r?.scanOut;
      case 'NO_CLOCK_IN':
        return ['PRESENT', 'LATE', 'EARLY_LEAVE'].includes(r?.attendanceStatus || '') && !r?.scanIn && !!r?.scanOut;
      case 'INVALID':
        return (r?.attendanceStatus as string) === 'INVALID';
      case 'ABSENT':
        if (r?.attendanceStatus === 'ALPHA') return true;
        return !r && !row.isDayOff && row.date <= today;
      case 'DAY_OFF':
        return !!row.isDayOff;
      case 'TIME_OFF':
        return !!r && ['SAKIT', 'CUTI', 'IZIN'].includes(r.attendanceStatus);
      case 'NEXT_WORKDAYS':
        return !r && !row.isDayOff && isFuture;
      default:
        return true;
    }
  });
}
