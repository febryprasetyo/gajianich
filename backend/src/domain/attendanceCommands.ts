import type {
  AttendanceRecord,
  AttendanceGrant,
  AttendanceStatus,
  ImportRow,
  Identity,
  WorkShift,
  WorkHoursTemplate,
  ShiftAssignment,
  MasterItem,
} from './attendanceTypes';

export type ServerAttendanceCommand =
  | {
      type: 'correct';
      recordId: number;
      expectedRevision: number;
      values: Pick<
        AttendanceRecord,
        'scanIn' | 'scanOut' | 'lateMinutes' | 'overtimeMinutes' | 'attendanceStatus'
      > & { isDayOff?: boolean };
      reason: string;
    }
  | { type: 'identity'; value: Identity }
  | { type: 'delete_identity'; id: number }
  | { type: 'grant'; value: AttendanceGrant; action?: 'save' | 'delete' }
  | { type: 'delete_grant'; id: number }
  | { type: 'lock'; workDate: string; locked: boolean; reason: string }
  | {
      type: 'import';
      filename: string;
      sourceId?: number;
      fileHash?: string;
      rows: ImportRow[];
    }
  | {
      type: 'review';
      batchId: number;
      rowId: number;
      employeeId: number | null;
      attendanceStatus?: AttendanceStatus;
      skipped: boolean;
      reason: string;
      values?: {
        scanIn?: string | null;
        scanOut?: string | null;
        lateMinutes?: number;
        overtimeMinutes?: number;
      };
    }
  | {
      type: 'batch';
      batchId: number;
      action: 'commit' | 'cancel' | 'reopen' | 'delete';
      strictIntegrity?: boolean;
    }
  | { type: 'delete_batch'; batchId: number }
  | { type: 'toggle_strict_integrity'; batchId: number; enabled: boolean }
  | { type: 'set_strict_integrity'; enabled: boolean }
  | {
      type: 'record_attendance';
      employeeId: number;
      workDate: string;
      attendanceStatus: AttendanceStatus;
      shiftId?: number;
      isDayOff?: boolean;
      scanIn?: string | null;
      scanOut?: string | null;
      reason?: string;
    }
  | { type: 'shift'; action: 'create' | 'update' | 'delete'; shift: WorkShift }
  | { type: 'work_hours'; action: 'create' | 'update' | 'delete'; workHours: WorkHoursTemplate }
  | { type: 'assign_shift'; action?: 'assign' | 'remove' | 'set_default'; assignment: ShiftAssignment }
  | { type: 'source'; action: 'create' | 'update' | 'delete'; source: MasterItem };
