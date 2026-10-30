import {
  resolveActiveEmployeeShift,
  getWorkingScheduleForDate,
  DEFAULT_OFFICE_SHIFT,
} from "../domain/attendanceSchedule";
import type { WorkShift, ShiftAssignment } from "../domain/attendanceTypes";

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
  statusLabel: "Hadir Tepat Waktu" | "Terlambat" | "Pulang Cepat" | "Belum Scan Pulang";
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

export function calculateAttendanceFromPunches(
  rawPunches: RawPunchInput[],
  employeesMap: Map<string | number, { id: number; nik: string; fullName: string; departmentName?: string; departmentId?: number | null }>,
  shifts: WorkShift[],
  assignments: ShiftAssignment[],
  options: { assignDefaultShiftIfUnassigned?: boolean } = {}
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

    // FIFO: First-In, Last-Out
    const scanInFull = firstPunch.timestamp;
    const scanOutFull = punches.length > 1 ? punches[punches.length - 1].timestamp : null;

    const scanIn = extractTimeHHmm(scanInFull);
    const scanOut = scanOutFull ? extractTimeHHmm(scanOutFull) : null;

    // Shift Resolution
    const { shift, hasActiveAssignment } = resolveActiveEmployeeShift(
      { id: employee.id, departmentId: employee.departmentId, fullName: employee.fullName },
      shifts,
      assignments
    );

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

    // Active or Default Assigned Shift Calculation
    const effectiveShift = shift || DEFAULT_OFFICE_SHIFT;
    const schedule = getWorkingScheduleForDate(workDate, effectiveShift);

    const scanInMins = parseMinutesFromTime(scanIn);
    const schedInMins = parseMinutesFromTime(schedule.scheduleIn);

    const lateMinutes = scanInMins > schedInMins ? scanInMins - schedInMins : 0;

    let earlyMinutes = 0;
    if (scanOut) {
      const scanOutMins = parseMinutesFromTime(scanOut);
      const schedOutMins = parseMinutesFromTime(schedule.scheduleOut);
      earlyMinutes = scanOutMins < schedOutMins ? schedOutMins - scanOutMins : 0;
    }

    let statusLabel: "Hadir Tepat Waktu" | "Terlambat" | "Pulang Cepat" | "Belum Scan Pulang" = "Hadir Tepat Waktu";
    let attendanceStatus: "PRESENT" | "ALPHA" | "LATE" | "EARLY_LEAVE" = "PRESENT";

    if (!scanOut) {
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
      scheduleIn: schedule.scheduleIn,
      scheduleOut: schedule.scheduleOut,
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
  calculated: { scanIn?: string | null; scanOut?: string | null; scheduleIn?: string | null; scheduleOut?: string | null; attendanceStatus?: string | null }
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
    }
  }

  const scanInMins = finalScanIn ? parseMinutesFromTime(finalScanIn) : 0;
  const schedInMins = parseMinutesFromTime(effectiveScheduleIn);
  const lateMinutes = scanInMins > schedInMins ? scanInMins - schedInMins : 0;

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
