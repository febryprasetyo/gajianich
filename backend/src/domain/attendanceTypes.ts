export type AttendanceRole = 'HR_ADMIN' | 'HR_STAFF' | 'REPORT_VIEWER';

export type AttendanceStatus =
  | 'PRESENT'
  | 'DINAS_LUAR'
  | 'IZIN'
  | 'SAKIT'
  | 'CUTI'
  | 'ALPHA'
  | 'UNSPECIFIED';

export type ReviewStatus = 'READY' | 'NEEDS_REVIEW' | 'BLOCKED' | 'SKIPPED';

export interface WorkShift {
  autoApproveIn?: boolean;
  autoApproveOut?: boolean;
  id: number;
  code: string;
  name: string;
  scheduleIn: string;
  scheduleOut: string;
  workDays: 5 | 6;
  saturdayScheduleIn?: string | null;
  saturdayScheduleOut?: string | null;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface ShiftAssignment {
  id: number;
  shiftId: number;
  departmentId?: number | null;
  employeeId?: number | null;
}

export interface MasterItem {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export interface EmployeeSummary {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string | null;
  departmentId: number | null;
  locationId: number | null;
  position: string | null;
  isActive: boolean;
}

export interface Identity {
  id: number;
  sourceId: number;
  externalNoId: string;
  employeeId: number;
}

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  workDate: string;
  shift: string | null;
  scheduleIn: string | null;
  scheduleOut: string | null;
  scanIn: string | null;
  scanOut: string | null;
  rawScanIn: string | null;
  rawScanOut: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  attendanceStatus: AttendanceStatus;
  isDayOff: boolean;
  normalized: boolean;
  revision: number;
  sourceBatchId: number | null;
}

export interface ImportRow {
  id: number;
  externalNoId: string;
  employeeId: number | null;
  workDate: string;
  scanIn: string | null;
  scanOut: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  reviewStatus: ReviewStatus;
  note: string;
  employeeName?: string;
  department?: string;
  employeeCode?: string;
  shift?: string | null;
  scheduleIn?: string | null;
  scheduleOut?: string | null;
  rawScanIn?: string | null;
  rawScanOut?: string | null;
  normalized?: boolean;
  issues?: string[];
  attendanceStatus?: AttendanceStatus;
}

export interface ImportBatch {
  id: number;
  filename: string;
  sourceId: number;
  fileHash?: string | null;
  createdAt: string;
  status: 'DRAFT' | 'COMMITTED' | 'CANCELLED';
  rows: ImportRow[];
  strictIntegrity?: boolean;
  totalRows?: number;
  revision?: number;
}

export interface AttendanceRevision {
  id: number;
  recordId: number;
  reason: string;
  createdAt: string;
  actor: string;
  before: AttendanceRecord;
  after: AttendanceRecord;
}

export interface AttendanceGrant {
  id: number;
  principalKey: string;
  displayName: string;
  role: AttendanceRole;
  isActive: boolean;
}

export interface AttendanceLock {
  workDate: string;
  reason: string;
  createdAt: string;
}

export interface AttendanceDataset {
  schemaVersion: 1;
  meta: {
    defaultDate: string;
    periodStart: string;
    actor: string;
    role: AttendanceRole;
    canManageAccess: boolean;
    strictIntegrity?: boolean;
    sourceFile?: string;
    sourceHash?: string;
    sourceRows?: number;
  };
  departments: MasterItem[];
  locations: MasterItem[];
  sources: MasterItem[];
  employees: EmployeeSummary[];
  identities: Identity[];
  records: AttendanceRecord[];
  batches: ImportBatch[];
  audit: any[]; // Empty array in server workspace; audit uses dedicated GET /api/v1/hr/activities
  revisions: AttendanceRevision[];
  grants: AttendanceGrant[];
  locks: AttendanceLock[];
  shifts: WorkShift[];
  shiftAssignments: ShiftAssignment[];
}
