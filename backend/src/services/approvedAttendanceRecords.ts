import { and, desc, gte, inArray, lte } from 'drizzle-orm';
import { attendanceSelfLogs } from '../db/schema/attendanceSelfLogs';
import type { attendanceRecords } from '../db/schema/attendance';
import { approvedMobileRecord } from '../domain/approvedMobileAttendance';
export async function approvedAttendanceRecords(records: (typeof attendanceRecords.$inferSelect)[], targetDb: any) {
  if (!records.length) return records;
  const dates = records.map(record => record.workDate).sort();
  const logs = await targetDb.select().from(attendanceSelfLogs).where(and(
    inArray(attendanceSelfLogs.employeeId, [...new Set(records.map(record => record.employeeId))]),
    gte(attendanceSelfLogs.workDate, dates[0]), lte(attendanceSelfLogs.workDate, dates[dates.length - 1]),
  )).orderBy(desc(attendanceSelfLogs.id));
  const groups = new Map<string, typeof logs>();
  for (const log of logs) { const key = `${log.employeeId}:${log.workDate}`; const group = groups.get(key) || []; group.push(log); groups.set(key,group); }
  return records.map(record => approvedMobileRecord(record, groups.get(`${record.employeeId}:${record.workDate}`) || [])).filter((record): record is typeof attendanceRecords.$inferSelect => record !== null);
}
