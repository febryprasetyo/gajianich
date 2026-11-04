import { and, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { employees } from '../db/schema/employees';
import { departments } from '../db/schema/master';
import { attendanceRecords } from '../db/schema/attendance';
import { attendanceSelfLogs } from '../db/schema/attendanceSelfLogs';
import { leaveRequests } from '../db/schema/leaves';
import { attendanceDailyNotes } from '../db/schema/attendanceDailyNotes';
import { departmentReportRosters } from '../db/schema/departmentReportRosters';
import { departmentOrganizationMappings } from '../db/schema/organizations';
import { employeeScopePredicate, requireScopedEmployee } from './hrOrganizationScope';
import type { RequestScope } from '../domain/organizationAccess';
import {
  formatLocationUpdate,
  shouldAutoHighlightEmployee,
} from '../domain/attendanceLocationFormat';
import { minuteValue } from '../domain/attendanceTime';

export interface DailyAttendanceEmployeeRow {
  no: number;
  employeeId: number;
  employeeName: string;
  jobLevel: string | null;
  position: string | null;
  isHighlighted: boolean;
  isCoordinator?: boolean;
  coordinatorId?: number | null;
  sortOrder?: number;
  locationUpdate: string;
  scanIn: string | null;
  isLate: boolean;
  lateMinutes: number;
  keterangan: string;
  attendanceStatus: string;
  sourceType: 'ADMS' | 'MOBILE' | 'LEAVE' | 'MANUAL' | 'NONE';
}

export interface DepartmentRosterItem {
  employeeId: number;
  employeeName: string;
  jobLevel: string | null;
  position: string | null;
  sortOrder: number;
  isCoordinator: boolean;
  coordinatorId: number | null;
}

export interface SaveDepartmentRosterInput {
  departmentId: number;
  items: {
    employeeId: number;
    sortOrder: number;
    isCoordinator: boolean;
    coordinatorId: number | null;
  }[];
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
 * Computes whether an employee is late, honoring shift tolerance minutes.
 * If recordedLateMinutes is present (from attendance_records), it is respected directly.
 * Otherwise, calculates with tolerance: late if scanIn > scheduleIn + tolerance.
 */
export function computeIsLate(params: {
  scanIn?: string | null;
  scheduleIn?: string | null;
  recordedLateMinutes?: number | null;
  lateToleranceMinutes?: number;
}): { isLate: boolean; lateMinutes: number } {
  const { scanIn, scheduleIn, recordedLateMinutes, lateToleranceMinutes = 5 } = params;
  if (!scanIn) {
    return { isLate: false, lateMinutes: 0 };
  }

  // Pre-calculated lateMinutes from database record
  if (typeof recordedLateMinutes === 'number') {
    return {
      isLate: recordedLateMinutes > 0,
      lateMinutes: recordedLateMinutes,
    };
  }

  // Fallback calculation using schedule and tolerance
  const effectiveSchedIn = scheduleIn || '08:00';
  const scanMins = minuteValue(scanIn);
  const schedMins = minuteValue(effectiveSchedIn);
  const tolerance = Math.max(0, lateToleranceMinutes);
  const threshold = schedMins + tolerance;

  const lateMinutes = scanMins > threshold ? scanMins - threshold : 0;
  return {
    isLate: lateMinutes > 0,
    lateMinutes,
  };
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

  // 5b. Query persistent department_report_rosters for ordering & coordinator mapping
  const distinctDeptIds = Array.from(new Set(employeeRows.map((e: any) => e.departmentId).filter(Boolean))) as number[];
  const rosterRecords = distinctDeptIds.length > 0
    ? await runner
        .select()
        .from(departmentReportRosters)
        .where(inArray(departmentReportRosters.departmentId, distinctDeptIds))
    : [];

  const rosterByDeptEmpId = new Map<string, (typeof departmentReportRosters.$inferSelect)>();
  for (const r of rosterRecords) {
    rosterByDeptEmpId.set(`${r.departmentId}:${r.employeeId}`, r);
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
    const roster = rosterByDeptEmpId.get(`${emp.departmentId}:${emp.id}`);
    const isCoordinator = roster ? roster.isCoordinator : false;

    // Auto or Manual Highlight
    let isHighlighted = isCoordinator || shouldAutoHighlightEmployee(emp.position, emp.jobLevel);
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

    // Late calculation with tolerance
    const scheduleIn = record?.scheduleIn || selfLog?.scheduleIn || '08:00';
    const lateCalc = computeIsLate({
      scanIn,
      scheduleIn,
      recordedLateMinutes: record?.lateMinutes,
      lateToleranceMinutes: 5,
    });
    const lateMinutes = lateCalc.lateMinutes;
    const isLate = lateCalc.isLate;

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
      isCoordinator,
      coordinatorId: roster ? roster.coordinatorId : null,
      sortOrder: roster ? roster.sortOrder : 999999,
      locationUpdate,
      scanIn,
      isLate,
      lateMinutes,
      keterangan,
      attendanceStatus,
      sourceType,
    });
  }

  // Sort and renumber within each department according to custom roster order
  for (const group of deptGroupsMap.values()) {
    group.employees.sort((a, b) => {
      const orderA = a.sortOrder ?? 999999;
      const orderB = b.sortOrder ?? 999999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.employeeName.localeCompare(b.employeeName);
    });
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

/**
 * Get current roster ordering and coordinator assignments for a department
 */
export async function getDepartmentRoster(
  scope: RequestScope,
  departmentId: number,
  runner: any = db
): Promise<DepartmentRosterItem[]> {
  if (!departmentId || Number(departmentId) <= 0) {
    throw Object.assign(new Error('departmentId wajib diisi dan valid'), { statusCode: 400 });
  }

  const numDeptId = Number(departmentId);

  // Active employees in this department with scope filtering
  const employeeConditions: any[] = [
    eq(employees.status, 'Active'),
    eq(employees.departmentId, numDeptId),
    employeeScopePredicate(scope, employees.departmentId),
  ];

  const emps = await runner
    .select({
      id: employees.id,
      fullName: employees.fullName,
      position: employees.position,
      jobLevel: employees.jobLevel,
    })
    .from(employees)
    .where(and(...employeeConditions))
    .orderBy(employees.fullName);

  if (!emps.length) {
    return [];
  }

  const empIds = emps.map((e: any) => e.id);
  const rosterRows = await runner
    .select()
    .from(departmentReportRosters)
    .where(
      and(
        eq(departmentReportRosters.departmentId, numDeptId),
        inArray(departmentReportRosters.employeeId, empIds)
      )
    );

  const rosterByEmpId = new Map<number, typeof departmentReportRosters.$inferSelect>();
  for (const r of rosterRows) {
    rosterByEmpId.set(r.employeeId, r);
  }

  const items: DepartmentRosterItem[] = emps.map((emp: any) => {
    const r = rosterByEmpId.get(emp.id);
    const isAutoCoordinator = shouldAutoHighlightEmployee(emp.position, emp.jobLevel);
    return {
      employeeId: emp.id,
      employeeName: emp.fullName,
      jobLevel: emp.jobLevel,
      position: emp.position,
      sortOrder: r ? r.sortOrder : 999999,
      isCoordinator: r ? r.isCoordinator : isAutoCoordinator,
      coordinatorId: r ? r.coordinatorId : null,
    };
  });

  items.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.employeeName.localeCompare(b.employeeName);
  });

  // Re-index sortOrder consecutively 1, 2, 3...
  return items.map((item, idx) => ({
    ...item,
    sortOrder: idx + 1,
  }));
}

/**
 * Save persistent roster ordering and coordinator assignments for a department
 */
export async function saveDepartmentRoster(
  scope: RequestScope,
  payload: SaveDepartmentRosterInput,
  userId: number,
  runner: any = db
): Promise<{ success: boolean; count: number }> {
  const { departmentId, items } = payload;
  if (!departmentId || Number(departmentId) <= 0) {
    throw Object.assign(new Error('departmentId wajib diisi dan valid'), { statusCode: 400 });
  }
  if (!Array.isArray(items)) {
    throw Object.assign(new Error('items harus berupa array'), { statusCode: 400 });
  }

  const numDeptId = Number(departmentId);

  // Retrieve organizational mapping for this department
  const [deptMapping] = await runner
    .select({
      groupId: departmentOrganizationMappings.groupId,
      organizationId: departmentOrganizationMappings.organizationId,
    })
    .from(departmentOrganizationMappings)
    .where(eq(departmentOrganizationMappings.departmentId, numDeptId))
    .limit(1);

  const groupId = deptMapping?.groupId || null;
  const organizationId = deptMapping?.organizationId || null;

  await runner.transaction(async (tx: any) => {
    for (const item of items) {
      if (!item.employeeId) continue;
      const empId = Number(item.employeeId);

      const existing = await tx
        .select()
        .from(departmentReportRosters)
        .where(
          and(
            eq(departmentReportRosters.departmentId, numDeptId),
            eq(departmentReportRosters.employeeId, empId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(departmentReportRosters)
          .set({
            sortOrder: Number(item.sortOrder) || 0,
            isCoordinator: Boolean(item.isCoordinator),
            coordinatorId: item.coordinatorId ? Number(item.coordinatorId) : null,
            updatedById: userId,
            updatedAt: new Date(),
          })
          .where(eq(departmentReportRosters.id, existing[0].id));
      } else {
        await tx.insert(departmentReportRosters).values({
          groupId,
          organizationId,
          departmentId: numDeptId,
          employeeId: empId,
          sortOrder: Number(item.sortOrder) || 0,
          isCoordinator: Boolean(item.isCoordinator),
          coordinatorId: item.coordinatorId ? Number(item.coordinatorId) : null,
          updatedById: userId,
        });
      }
    }
  });

  return { success: true, count: items.length };
}

