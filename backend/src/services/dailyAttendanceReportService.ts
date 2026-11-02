import { and, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { employees } from '../db/schema/employees';
import { departments } from '../db/schema/master';
import { attendanceRecords } from '../db/schema/attendance';
import { attendanceSelfLogs } from '../db/schema/attendanceSelfLogs';
import { leaveRequests } from '../db/schema/leaves';
import { attendanceDailyNotes } from '../db/schema/attendanceDailyNotes';
import { employeeScopePredicate, requireScopedEmployee } from './hrOrganizationScope';
import type { RequestScope } from '../domain/organizationAccess';
import {
  formatLocationUpdate,
  shouldAutoHighlightEmployee,
} from '../domain/attendanceLocationFormat';

export interface DailyAttendanceEmployeeRow {
  no: number;
  employeeId: number;
  employeeName: string;
  jobLevel: string | null;
  position: string | null;
  isHighlighted: boolean;
  locationUpdate: string;
  scanIn: string | null;
  isLate: boolean;
  lateMinutes: number;
  keterangan: string;
  attendanceStatus: string;
  sourceType: 'ADMS' | 'MOBILE' | 'LEAVE' | 'MANUAL' | 'NONE';
}

export interface DailyAttendanceDepartmentGroup {
  departmentId: number;
  departmentName: string;
  employees: DailyAttendanceEmployeeRow[];
}

export interface DailyAttendanceReportResponse {
  workDate: string;
  formattedDate: string;
  departments: DailyAttendanceDepartmentGroup[];
  summary: {
    totalEmployees: number;
    present: number;
    late: number;
    absent: number;
  };
}

export interface UpsertDailyNoteInput {
  workDate: string;
  employeeId: number;
  isHighlighted?: boolean;
  manualNote?: string;
}

/**
 * Formats YYYY-MM-DD into "30-Oct-26" standard print header
 */
export function formatDateHeader(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(month, 10) - 1;
  const shortMonth = monthNames[monthIdx] || month;
  const shortYear = year.slice(-2);
  return `${day.padStart(2, '0')}-${shortMonth}-${shortYear}`;
}

/**
 * Truncates HH:mm:ss to HH:mm
 */
export function formatTimeOnly(timeStr?: string | null): string | null {
  if (!timeStr) return null;
  return timeStr.slice(0, 5);
}

/**
 * Determines sourceType based on records present
 */
export function determineAttendanceSource(params: {
  hasSelfLog: boolean;
  hasRecordScan: boolean;
  hasLeave: boolean;
}): 'ADMS' | 'MOBILE' | 'LEAVE' | 'NONE' {
  if (params.hasSelfLog) return 'MOBILE';
  if (params.hasRecordScan) return 'ADMS';
  if (params.hasLeave) return 'LEAVE';
  return 'NONE';
}

/**
 * Resolves keterangan text following priority hierarchy:
 * 1. manualNote from HR (persisted in attendance_daily_notes)
 * 2. leaveReason from leave_requests
 * 3. attendanceStatus from attendance_records ('CUTI', 'SAKIT', 'IZIN', 'DINAS_LUAR', 'LIBUR')
 * 4. isDayOff ('LIBUR')
 * 5. !hasScanIn ('TDK ADA ABSEN')
 * 6. hasScanIn ('')
 */
export function resolveKeterangan(params: {
  manualNote?: string | null;
  leaveReason?: string | null;
  attendanceStatus?: string | null;
  isDayOff?: boolean;
  hasScanIn: boolean;
}): string {
  if (params.manualNote !== undefined && params.manualNote !== null && params.manualNote.trim() !== '') {
    return params.manualNote.trim();
  }
  if (params.leaveReason && params.leaveReason.trim() !== '') {
    return params.leaveReason.trim();
  }
  const status = (params.attendanceStatus || '').toUpperCase();
  if (status === 'CUTI') {
    return 'CUTI';
  }
  if (status === 'SAKIT') {
    return 'SAKIT';
  }
  if (status === 'IZIN') {
    return 'IZIN';
  }
  if (status === 'LIBUR' || params.isDayOff) {
    return 'LIBUR';
  }
  if (!params.hasScanIn) {
    return 'TDK ADA ABSEN';
  }
  return '';
}

/**
 * Main Query Service for Daily Attendance Landscape Report
 */
export async function getDailyAttendanceReport(
  scope: RequestScope,
  query: { workDate: string; departmentId?: number; highlightOnly?: boolean },
  runner: any = db
): Promise<DailyAttendanceReportResponse> {
  const { workDate, departmentId, highlightOnly } = query;

  if (!workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    throw Object.assign(new Error('Format tanggal harus YYYY-MM-DD'), { statusCode: 400 });
  }

  // 1. Fetch active employees within scope
  const employeeConditions = [
    eq(employees.status, 'Active'),
    employeeScopePredicate(scope, employees.departmentId),
  ];

  if (departmentId && Number(departmentId) > 0) {
    employeeConditions.push(eq(employees.departmentId, Number(departmentId)));
  }

  const employeeRows = await runner
    .select({
      id: employees.id,
      fullName: employees.fullName,
      position: employees.position,
      jobLevel: employees.jobLevel,
      departmentId: employees.departmentId,
      departmentName: departments.name,
    })
    .from(employees)
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .where(and(...employeeConditions))
    .orderBy(departments.name, employees.fullName);

  if (!employeeRows.length) {
    return {
      workDate,
      formattedDate: formatDateHeader(workDate),
      departments: [],
      summary: { totalEmployees: 0, present: 0, late: 0, absent: 0 },
    };
  }

  const empIds = employeeRows.map((e: { id: number }) => e.id);

  // 2. Query attendance_records for workDate
  const records = await runner
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workDate, workDate), inArray(attendanceRecords.employeeId, empIds)));

  const recordsByEmpId = new Map<number, (typeof attendanceRecords.$inferSelect)>();
  for (const r of records) {
    recordsByEmpId.set(r.employeeId, r);
  }

  // 3. Query attendance_self_logs for workDate (mobile scans)
  const selfLogs = await runner
    .select()
    .from(attendanceSelfLogs)
    .where(
      and(
        eq(attendanceSelfLogs.workDate, workDate),
        eq(attendanceSelfLogs.eventType, 'IN'),
        inArray(attendanceSelfLogs.employeeId, empIds)
      )
    );

  const selfLogsByEmpId = new Map<number, (typeof attendanceSelfLogs.$inferSelect)>();
  for (const log of selfLogs) {
    selfLogsByEmpId.set(log.employeeId, log);
  }

  // 4. Query leave_requests covering workDate
  const leaves = await runner
    .select()
    .from(leaveRequests)
    .where(
      and(
        inArray(leaveRequests.employeeId, empIds),
        sql`${leaveRequests.startDate} <= ${workDate}::date`,
        sql`${leaveRequests.endDate} >= ${workDate}::date`,
        or(eq(leaveRequests.status, 'APPROVED'), eq(leaveRequests.status, 'approved'))
      )
    );

  const leavesByEmpId = new Map<number, (typeof leaveRequests.$inferSelect)>();
  for (const lv of leaves) {
    leavesByEmpId.set(lv.employeeId, lv);
  }

  // 5. Query persistent attendance_daily_notes for workDate
  const dailyNotes = await runner
    .select()
    .from(attendanceDailyNotes)
    .where(
      and(
        eq(attendanceDailyNotes.workDate, workDate),
        inArray(attendanceDailyNotes.employeeId, empIds)
      )
    );

  const notesByEmpId = new Map<number, (typeof attendanceDailyNotes.$inferSelect)>();
  for (const n of dailyNotes) {
    notesByEmpId.set(n.employeeId, n);
  }

  // 6. Aggregate into rows and group by department
  const deptGroupsMap = new Map<number, DailyAttendanceDepartmentGroup>();
  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;

  for (const emp of employeeRows) {
    const record = recordsByEmpId.get(emp.id);
    const selfLog = selfLogsByEmpId.get(emp.id);
    const leave = leavesByEmpId.get(emp.id);
    const dailyNote = notesByEmpId.get(emp.id);

    // Auto or Manual Highlight
    let isHighlighted = shouldAutoHighlightEmployee(emp.position, emp.jobLevel);
    if (dailyNote && typeof dailyNote.isHighlighted === 'boolean') {
      isHighlighted = dailyNote.isHighlighted;
    }

    if (highlightOnly && !isHighlighted) {
      continue;
    }

    const rawStatus = (record?.attendanceStatus || '').toUpperCase();
    const hasSelfLog = Boolean(selfLog);
    const hasRecordScan = Boolean(record?.scanIn);
    const hasLeave = Boolean(leave) || rawStatus === 'CUTI' || rawStatus === 'SAKIT' || rawStatus === 'IZIN';

    const sourceType = determineAttendanceSource({ hasSelfLog, hasRecordScan, hasLeave });

    // Location
    const locationUpdate = formatLocationUpdate({
      sourceType,
      rawAddress: selfLog?.address,
      latitude: selfLog?.latitude,
      longitude: selfLog?.longitude,
    });

    // Scan In Time
    const rawScanIn = record?.scanIn || selfLog?.scanTime || null;
    const scanIn = formatTimeOnly(rawScanIn);

    // Late calculation
    const lateMinutes = record?.lateMinutes || 0;
    const scheduleIn = record?.scheduleIn || selfLog?.scheduleIn || '08:00';
    const isLate = lateMinutes > 0 || Boolean(scanIn && scanIn > scheduleIn);

    // Keterangan
    let leaveReason: string | null = null;
    if (leave) {
      const type = (leave.leaveType || '').toUpperCase();
      const spec = leave.specialLeaveReason ? ` (${leave.specialLeaveReason})` : '';
      const base = type === 'ANNUAL' ? 'CUTI TAHUNAN' : type === 'SPECIAL' ? `CUTI KHUSUS${spec}` : type || 'CUTI';
      leaveReason = base;
    }

    const keterangan = resolveKeterangan({
      manualNote: dailyNote?.manualNote,
      leaveReason,
      attendanceStatus: record?.attendanceStatus,
      isDayOff: record?.isDayOff,
      hasScanIn: Boolean(scanIn),
    });

    const attendanceStatus = record?.attendanceStatus || (scanIn ? 'PRESENT' : leave ? 'CUTI' : 'ALPHA');

    if (scanIn) {
      totalPresent++;
      if (isLate) totalLate++;
    } else {
      totalAbsent++;
    }

    const deptId = emp.departmentId || 0;
    const deptName = emp.departmentName || 'UMUM';

    if (!deptGroupsMap.has(deptId)) {
      deptGroupsMap.set(deptId, {
        departmentId: deptId,
        departmentName: deptName,
        employees: [],
      });
    }

    const group = deptGroupsMap.get(deptId)!;
    group.employees.push({
      no: group.employees.length + 1,
      employeeId: emp.id,
      employeeName: emp.fullName,
      jobLevel: emp.jobLevel,
      position: emp.position,
      isHighlighted,
      locationUpdate,
      scanIn,
      isLate,
      lateMinutes,
      keterangan,
      attendanceStatus,
      sourceType,
    });
  }

  // Renumber within each department
  for (const group of deptGroupsMap.values()) {
    group.employees.forEach((e, idx) => {
      e.no = idx + 1;
    });
  }

  return {
    workDate,
    formattedDate: formatDateHeader(workDate),
    departments: Array.from(deptGroupsMap.values()),
    summary: {
      totalEmployees: employeeRows.length,
      present: totalPresent,
      late: totalLate,
      absent: totalAbsent,
    },
  };
}

/**
 * Upsert persistent note / highlight for a specific employee and date
 */
export async function upsertDailyAttendanceNote(
  scope: RequestScope,
  payload: UpsertDailyNoteInput,
  userId: number,
  runner: any = db
) {
  const { workDate, employeeId, isHighlighted, manualNote } = payload;

  if (!workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    throw Object.assign(new Error('Format tanggal harus YYYY-MM-DD'), { statusCode: 400 });
  }

  // Ensure employee is within user scope
  const scopedEmp = await requireScopedEmployee(scope, employeeId, runner);

  const existing = await runner
    .select()
    .from(attendanceDailyNotes)
    .where(
      and(
        eq(attendanceDailyNotes.employeeId, employeeId),
        eq(attendanceDailyNotes.workDate, workDate)
      )
    );

  const updateValues: Record<string, any> = {
    updatedById: userId,
    updatedAt: new Date(),
  };

  if (isHighlighted !== undefined) {
    updateValues.isHighlighted = Boolean(isHighlighted);
  }
  if (manualNote !== undefined) {
    updateValues.manualNote = manualNote.trim();
  }

  if (existing.length > 0) {
    await runner
      .update(attendanceDailyNotes)
      .set(updateValues)
      .where(
        and(
          eq(attendanceDailyNotes.employeeId, employeeId),
          eq(attendanceDailyNotes.workDate, workDate)
        )
      );
  } else {
    await runner.insert(attendanceDailyNotes).values({
      groupId: scopedEmp.groupId,
      organizationId: scopedEmp.organizationId,
      workDate,
      employeeId,
      isHighlighted: isHighlighted ?? false,
      manualNote: manualNote ?? null,
      updatedById: userId,
    });
  }

  return {
    employeeId,
    workDate,
    isHighlighted: updateValues.isHighlighted,
    manualNote: updateValues.manualNote,
  };
}

