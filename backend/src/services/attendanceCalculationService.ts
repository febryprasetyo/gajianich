import {
  resolveActiveEmployeeShift,
  getWorkingScheduleForDate,
  DEFAULT_OFFICE_SHIFT,
} from "../domain/attendanceSchedule";
import type { WorkShift, ShiftAssignment, WorkHoursTemplate } from "../domain/attendanceTypes";

export interface RawPunchInput {
  id?: number | string;
  pin: string;
  employeeId?: number | null;
  employeeCode?: string;
  employeeName?: string;
  department?: string;
  timestamp: string; // "YYYY-MM-DD HH:mm:ss"
  workDate: string;  // "YYYY-MM-DD"
  verifyMode?: string;
  inOutState?: string;
}

export type AttendanceStatusLabel =
  | "Hadir Tepat Waktu"
  | "Terlambat"
  | "Pulang Cepat"
  | "Belum Scan Pulang"
  | "Tidak Scan Masuk";

export interface CalculatedAttendanceRecord {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  workDate: string;
  shiftCode: string;
  shiftName: string;
  scheduleIn: string;
  scheduleOut: string;
  scanIn: string | null;
  scanOut: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  attendanceStatus: "PRESENT" | "ALPHA" | "LATE" | "EARLY_LEAVE";
  statusLabel: AttendanceStatusLabel;
  rawPunchesCount: number;
}

export interface UnassignedShiftRecord {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  workDate: string;
  scanIn: string | null;
  scanOut: string | null;
  rawPunchesCount: number;
  suggestedShiftCode: string;
}

export interface CalculationResult {
  processedRecords: CalculatedAttendanceRecord[];
  unassignedShiftRecords: UnassignedShiftRecord[];
  totalRawPunches: number;
  totalProcessed: number;
  totalUnassigned: number;
}

export function parseMinutesFromTime(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

export function extractTimeHHmm(timestamp: string): string {
  if (!timestamp) return "";
  const parts = timestamp.split(" ");
  const timePart = parts[1] || parts[0];
  const [h, m] = timePart.split(":");
  return `${(h || "00").padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
}

export function isTimeInWindow(timeHHmm: string, startHHmm?: string | null, endHHmm?: string | null): boolean {
  if (!timeHHmm || !startHHmm || !endHHmm) return false;
  const t = parseMinutesFromTime(timeHHmm);
  const s = parseMinutesFromTime(startHHmm);
  const e = parseMinutesFromTime(endHHmm);
  if (s <= e) {
    return t >= s && t <= e;
  }
  // Cross-midnight window (e.g. 22:00 - 04:00)
  return t >= s || t <= e;
}

export function allocateScansFromPunches(
  punches: RawPunchInput[],
  schedule: {
    scheduleIn: string | null;
    scheduleOut: string | null;
    scanInStart?: string | null;
    scanInEnd?: string | null;
    scanOutStart?: string | null;
    scanOutEnd?: string | null;
  }
): { scanIn: string | null; scanOut: string | null } {
  if (!punches.length) return { scanIn: null, scanOut: null };

  const schedInMins = schedule.scheduleIn ? parseMinutesFromTime(schedule.scheduleIn) : 480; // 08:00
  const schedOutMins = schedule.scheduleOut ? parseMinutesFromTime(schedule.scheduleOut) : 1020; // 17:00
  const midpointMins = Math.round((schedInMins + schedOutMins) / 2);

  // Helper to determine if a punch clearly indicates checkout
  const isCheckoutPunch = (punch: RawPunchInput, timeHHmm: string): boolean => {
    const normState = (punch.inOutState || "").trim().toLowerCase();
    if (normState === "pulang" || normState === "out" || normState === "checkout") {
      return true;
    }
    if (schedule.scanOutStart && schedule.scanOutEnd) {
      if (isTimeInWindow(timeHHmm, schedule.scanOutStart, schedule.scanOutEnd)) {
        return true;
      }
    }
    const mins = parseMinutesFromTime(timeHHmm);
    // If beyond midpoint and after or near scheduleOut, it's checkout
    if (mins >= midpointMins) {
      // If within scanIn window despite being >= midpoint (e.g. wide window), check scanIn
      if (schedule.scanInStart && schedule.scanInEnd && isTimeInWindow(timeHHmm, schedule.scanInStart, schedule.scanInEnd)) {
        return false;
      }
      return true;
    }
    return false;
  };

  const isCheckinPunch = (punch: RawPunchInput, timeHHmm: string): boolean => {
    const normState = (punch.inOutState || "").trim().toLowerCase();
    if (normState === "masuk" || normState === "in" || normState === "checkin") {
      return true;
    }
    if (schedule.scanInStart && schedule.scanInEnd) {
      if (isTimeInWindow(timeHHmm, schedule.scanInStart, schedule.scanInEnd)) {
        return true;
      }
    }
    const mins = parseMinutesFromTime(timeHHmm);
    if (mins < midpointMins) {
      if (schedule.scanOutStart && schedule.scanOutEnd && isTimeInWindow(timeHHmm, schedule.scanOutStart, schedule.scanOutEnd)) {
        return false;
      }
      return true;
    }
    return false;
  };

  // Single punch handling
  if (punches.length === 1) {
    const p = punches[0];
    const timeHHmm = extractTimeHHmm(p.timestamp);
    if (isCheckoutPunch(p, timeHHmm)) {
      return { scanIn: null, scanOut: timeHHmm };
    }
    return { scanIn: timeHHmm, scanOut: null };
  }

  // Multi punches handling: classify into IN and OUT candidates
  const inCandidates: { punch: RawPunchInput; timeHHmm: string }[] = [];
  const outCandidates: { punch: RawPunchInput; timeHHmm: string }[] = [];

  for (const p of punches) {
    const t = extractTimeHHmm(p.timestamp);
    const isOut = isCheckoutPunch(p, t);
    const isIn = isCheckinPunch(p, t);

    if (isOut && !isIn) {
      outCandidates.push({ punch: p, timeHHmm: t });
    } else if (isIn && !isOut) {
      inCandidates.push({ punch: p, timeHHmm: t });
    } else if (isOut && isIn) {
      // Ambiguous: use midpoint
      const mins = parseMinutesFromTime(t);
      if (mins >= midpointMins) {
        outCandidates.push({ punch: p, timeHHmm: t });
      } else {
        inCandidates.push({ punch: p, timeHHmm: t });
      }
    } else {
      // Neither explicitly in window: fallback by midpoint
      const mins = parseMinutesFromTime(t);
      if (mins >= midpointMins) {
        outCandidates.push({ punch: p, timeHHmm: t });
      } else {
        inCandidates.push({ punch: p, timeHHmm: t });
      }
    }
  }

  let finalScanIn: string | null = null;
  let finalScanOut: string | null = null;

  if (inCandidates.length > 0) {
    // First in
    finalScanIn = inCandidates[0].timeHHmm;
  }
  if (outCandidates.length > 0) {
    // Last out
    finalScanOut = outCandidates[outCandidates.length - 1].timeHHmm;
  }

  // If all punches fell into IN candidates, keep scanIn as first and scanOut as null
  // If all punches fell into OUT candidates, keep scanIn as null and scanOut as last
  // If scanIn and scanOut exist and scanIn === scanOut, only keep one based on checkout logic
  if (finalScanIn && finalScanOut && finalScanIn === finalScanOut) {
    const mins = parseMinutesFromTime(finalScanIn);
    if (mins >= midpointMins) {
      finalScanIn = null;
    } else {
      finalScanOut = null;
    }
  }

  return { scanIn: finalScanIn, scanOut: finalScanOut };
}

export function calculateAttendanceFromPunches(
  rawPunches: RawPunchInput[],
  employeesMap: Map<string | number, { id: number; nik: string; fullName: string; departmentName?: string; departmentId?: number | null }>,
  shifts: WorkShift[],
  assignments: ShiftAssignment[],
  options: {
    assignDefaultShiftIfUnassigned?: boolean;
    workHoursMap?: Map<number, WorkHoursTemplate>;
    defaultLateToleranceMinutes?: number;
  } = {}
): CalculationResult {
  // 1. Group punches by employee + workDate
  const groups = new Map<string, RawPunchInput[]>();

  for (const punch of rawPunches) {
    const empKey = punch.employeeId || punch.pin;
    const groupKey = `${empKey}_${punch.workDate}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(punch);
  }

  const processedRecords: CalculatedAttendanceRecord[] = [];
  const unassignedShiftRecords: UnassignedShiftRecord[] = [];

  for (const [, punches] of groups) {
    if (!punches.length) continue;

    // Sort ascending by timestamp
    punches.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const firstPunch = punches[0];
    const workDate = firstPunch.workDate;
    const empKey = firstPunch.employeeId || firstPunch.pin;
    const employee = employeesMap.get(empKey) || {
      id: typeof empKey === "number" ? empKey : 0,
      nik: firstPunch.pin,
      fullName: firstPunch.employeeName || `Karyawan (${firstPunch.pin})`,
      departmentName: firstPunch.department || "Umum",
      departmentId: null,
    };

    // Shift Resolution
    const { shift, hasActiveAssignment } = resolveActiveEmployeeShift(
      { id: employee.id, departmentId: employee.departmentId, fullName: employee.fullName },
      shifts,
      assignments
    );

    // Active or Default Assigned Shift Calculation
    const effectiveShift = shift || DEFAULT_OFFICE_SHIFT;
    const schedule = getWorkingScheduleForDate(workDate, effectiveShift, options.workHoursMap);
    const resolvedScheduleIn = schedule.scheduleIn ?? '';
    const resolvedScheduleOut = schedule.scheduleOut ?? '';

    // Smart scan allocation according to shift windows and inOutState
    const { scanIn, scanOut } = allocateScansFromPunches(punches, {
      scheduleIn: resolvedScheduleIn,
      scheduleOut: resolvedScheduleOut,
      scanInStart: schedule.scanInStart,
      scanInEnd: schedule.scanInEnd,
      scanOutStart: schedule.scanOutStart,
      scanOutEnd: schedule.scanOutEnd,
    });

    if (!hasActiveAssignment && !options.assignDefaultShiftIfUnassigned) {
      // Unassigned Shift Record
      unassignedShiftRecords.push({
        employeeId: employee.id,
        employeeCode: employee.nik,
        employeeName: employee.fullName,
        department: employee.departmentName || "-",
        workDate,
        scanIn,
        scanOut,
        rawPunchesCount: punches.length,
        suggestedShiftCode: shift.code || "OFFICE",
      });
      continue;
    }

    const schedInMins = parseMinutesFromTime(resolvedScheduleIn);
    const lateTolerance = options.defaultLateToleranceMinutes !== undefined
      ? Math.max(0, options.defaultLateToleranceMinutes)
      : Math.max(0, schedule.lateToleranceMinutes ?? 0);
    const lateThreshold = schedInMins + lateTolerance;

    let lateMinutes = 0;
    if (scanIn) {
      const scanInMins = parseMinutesFromTime(scanIn);
      lateMinutes = scanInMins > lateThreshold ? scanInMins - lateThreshold : 0;
    }

    let earlyMinutes = 0;
    if (scanOut) {
      const scanOutMins = parseMinutesFromTime(scanOut);
      const schedOutMins = parseMinutesFromTime(resolvedScheduleOut);
      earlyMinutes = scanOutMins < schedOutMins ? schedOutMins - scanOutMins : 0;
    }

    let statusLabel: AttendanceStatusLabel = "Hadir Tepat Waktu";
    let attendanceStatus: "PRESENT" | "ALPHA" | "LATE" | "EARLY_LEAVE" = "PRESENT";

    if (!scanIn && scanOut) {
      statusLabel = "Tidak Scan Masuk";
      attendanceStatus = earlyMinutes > 0 ? "EARLY_LEAVE" : "PRESENT";
    } else if (scanIn && !scanOut) {
      statusLabel = "Belum Scan Pulang";
      attendanceStatus = lateMinutes > 0 ? "LATE" : "PRESENT";
    } else if (lateMinutes > 0) {
      statusLabel = "Terlambat";
      attendanceStatus = "LATE";
    } else if (earlyMinutes > 0) {
      statusLabel = "Pulang Cepat";
      attendanceStatus = "EARLY_LEAVE";
    }

    processedRecords.push({
      employeeId: employee.id,
      employeeCode: employee.nik,
      employeeName: employee.fullName,
      department: employee.departmentName || "-",
      workDate,
      shiftCode: effectiveShift.code,
      shiftName: effectiveShift.name,
      scheduleIn: resolvedScheduleIn,
      scheduleOut: resolvedScheduleOut,
      scanIn,
      scanOut,
      lateMinutes,
      earlyMinutes,
      attendanceStatus,
      statusLabel,
      rawPunchesCount: punches.length,
    });
  }

  return {
    processedRecords,
    unassignedShiftRecords,
    totalRawPunches: rawPunches.length,
    totalProcessed: processedRecords.length,
    totalUnassigned: unassignedShiftRecords.length,
  };
}

export function mergeAttendanceScans(
  previous: { scanIn?: string | null; scanOut?: string | null; scheduleIn?: string | null; scheduleOut?: string | null; attendanceStatus?: string | null } | null | undefined,
  calculated: { scanIn?: string | null; scanOut?: string | null; scheduleIn?: string | null; scheduleOut?: string | null; attendanceStatus?: string | null },
  options: { lateToleranceMinutes?: number } = {}
): {
  scanIn: string | null;
  scanOut: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  attendanceStatus: string;
} {
  let finalScanIn = calculated.scanIn || null;
  let finalScanOut = calculated.scanOut || null;
  const effectiveScheduleIn = previous?.scheduleIn || calculated.scheduleIn || '08:00';
  const effectiveScheduleOut = previous?.scheduleOut || calculated.scheduleOut || '17:00';

  if (previous?.scanIn) {
    if (!calculated.scanOut && calculated.scanIn) {
      if (calculated.scanIn > previous.scanIn) {
        finalScanIn = previous.scanIn;
        finalScanOut = calculated.scanIn;
      } else {
        finalScanIn = calculated.scanIn;
        finalScanOut = previous.scanOut || (previous.scanIn !== calculated.scanIn ? previous.scanIn : null);
      }
    } else if (calculated.scanIn && calculated.scanOut) {
      finalScanIn = calculated.scanIn < previous.scanIn ? calculated.scanIn : previous.scanIn;
      finalScanOut = previous.scanOut && previous.scanOut > calculated.scanOut ? previous.scanOut : calculated.scanOut;
    } else if (!calculated.scanIn && calculated.scanOut) {
      finalScanIn = previous.scanIn;
      finalScanOut = previous.scanOut && previous.scanOut > calculated.scanOut ? previous.scanOut : calculated.scanOut;
    } else if (!calculated.scanIn && !calculated.scanOut) {
      finalScanIn = previous.scanIn;
      finalScanOut = previous.scanOut || null;
    }
  } else if (previous?.scanOut) {
    if (calculated.scanIn) {
      if (calculated.scanIn < previous.scanOut) {
        finalScanIn = calculated.scanIn;
        finalScanOut = previous.scanOut;
      } else {
        finalScanOut = calculated.scanIn;
      }
    } else if (calculated.scanOut) {
      finalScanOut = calculated.scanOut > previous.scanOut ? calculated.scanOut : previous.scanOut;
    }
  }

  const scanInMins = finalScanIn ? parseMinutesFromTime(finalScanIn) : 0;
  const schedInMins = parseMinutesFromTime(effectiveScheduleIn);
  const lateTolerance = Math.max(0, options.lateToleranceMinutes ?? 0);
  const lateThreshold = schedInMins + lateTolerance;
  const lateMinutes = scanInMins > lateThreshold ? scanInMins - lateThreshold : 0;

  let earlyMinutes = 0;
  if (finalScanOut) {
    const scanOutMins = parseMinutesFromTime(finalScanOut);
    const schedOutMins = parseMinutesFromTime(effectiveScheduleOut);
    earlyMinutes = scanOutMins < schedOutMins ? schedOutMins - scanOutMins : 0;
  }

  const attendanceStatus = (previous?.attendanceStatus === 'DINAS_LUAR' ? 'DINAS_LUAR' : calculated.attendanceStatus) || 'PRESENT';

  return {
    scanIn: finalScanIn,
    scanOut: finalScanOut,
    lateMinutes,
    earlyMinutes,
    attendanceStatus,
  };
}
