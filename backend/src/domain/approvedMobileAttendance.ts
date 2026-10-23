import type { attendanceRecords } from '../db/schema/attendance';
import type { attendanceSelfLogs } from '../db/schema/attendanceSelfLogs';
type RecordRow = typeof attendanceRecords.$inferSelect;
type LogRow = typeof attendanceSelfLogs.$inferSelect;
export function approvedMobileRecord(record: RecordRow, logs: LogRow[]): RecordRow | null {
  const entry = logs.find(log => log.employeeId === record.employeeId && log.workDate === record.workDate && log.eventType === 'IN');
  // The old mobile writer created recap and IN log together, without incrementing revision.
  // Preserve imported records and independent/manual corrections whose provenance differs.
  if (!entry || record.sourceBatchId !== null || record.revision !== 1 || record.normalized || record.isDayOff
    || !['PRESENT','DINAS_LUAR'].includes(record.attendanceStatus)
    || record.scanIn !== entry.scanTime || record.rawScanIn !== entry.scanTime
    || Math.abs(record.createdAt.getTime() - entry.createdAt.getTime()) > 2000) return record;
  if (entry.approvalStatus !== 'APPROVED') return null;
  const exit = logs.find(log => log.employeeId === record.employeeId && log.workDate === record.workDate && log.eventType === 'OUT');
  if (exit && exit.approvalStatus !== 'APPROVED' && record.scanOut === exit.scanTime) {
    return { ...record, scanOut: null, rawScanOut: null, earlyMinutes: 0, overtimeMinutes: 0 };
  }
  return record;
}
