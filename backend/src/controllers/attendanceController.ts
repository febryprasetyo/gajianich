import {historicalScopePredicate,requireHrScope,requireScopedEmployee} from '../services/hrOrganizationScope';
import { approvedAttendanceRecords } from '../services/approvedAttendanceRecords';
import { Request, Response } from 'express';
import { db } from '../db';
import { attendanceBatches, attendanceRecords } from '../db/schema/attendance';
import { auditLogs } from '../db/schema/system';
import { users } from '../db/schema/users';
import { employees } from '../db/schema/employees';
import { eq, and, gte, lte, desc, sql, ne } from 'drizzle-orm';

export interface AttendanceRecordInput {
  employeeId: number;
  workDate: string;
  shift?: string | null;
  scheduleIn?: string | null;
  scheduleOut?: string | null;
  scanIn?: string | null;
  scanOut?: string | null;
  rawScanIn?: string | null;
  rawScanOut?: string | null;
  lateMinutes?: number;
  earlyMinutes?: number;
  overtimeMinutes?: number;
  attendanceStatus?: string;
  isDayOff?: boolean;
  normalized?: boolean;
}

export function normalizeAttendanceRecordPayload(input: any): AttendanceRecordInput & {
  lateMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  attendanceStatus: string;
  isDayOff: boolean;
  normalized: boolean;
} {
  const employeeId = Number(input.employeeId);
  if (!employeeId || isNaN(employeeId)) {
    throw new Error('employeeId is required and must be a valid number');
  }

  const workDate = String(input.workDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    throw new Error('Invalid workDate format. Must be YYYY-MM-DD');
  }

  const attendanceStatus = String(input.attendanceStatus || (input.scanIn ? 'PRESENT' : 'ALPHA')).toUpperCase();
  const isFieldDuty = attendanceStatus === 'DINAS_LUAR';
  const scheduleIn = input.scheduleIn ? String(input.scheduleIn) : null;
  const scheduleOut = input.scheduleOut ? String(input.scheduleOut) : null;
  if (isFieldDuty && (!scheduleIn || !scheduleOut)) {
    throw new Error('Dinas luar requires scheduleIn and scheduleOut');
  }

  return {
    employeeId,
    workDate,
    shift: input.shift ? String(input.shift) : null,
    scheduleIn,
    scheduleOut,
    scanIn: isFieldDuty ? scheduleIn : (input.scanIn ? String(input.scanIn) : null),
    scanOut: isFieldDuty ? scheduleOut : (input.scanOut ? String(input.scanOut) : null),
    rawScanIn: input.rawScanIn !== undefined ? (input.rawScanIn ? String(input.rawScanIn) : null) : input.scanIn ? String(input.scanIn) : null,
    rawScanOut: input.rawScanOut !== undefined ? (input.rawScanOut ? String(input.rawScanOut) : null) : input.scanOut ? String(input.scanOut) : null,
    lateMinutes: isFieldDuty ? 0 : (Number(input.lateMinutes) || 0),
    earlyMinutes: isFieldDuty ? 0 : (Number(input.earlyMinutes) || 0),
    overtimeMinutes: isFieldDuty ? 0 : (Number(input.overtimeMinutes) || 0),
    attendanceStatus,
    isDayOff: isFieldDuty ? false : Boolean(input.isDayOff),
    normalized: Boolean(input.normalized),
  };
}

export async function getAttendanceRecords(req: Request, res: Response) {
  try {
    const { startDate, endDate, employeeId } = req.query;

    const conditions: any[] = [historicalScopePredicate(requireHrScope(req as any),attendanceRecords.groupId)];
    if (startDate && typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      conditions.push(gte(attendanceRecords.workDate, startDate));
    }
    if (endDate && typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      conditions.push(lte(attendanceRecords.workDate, endDate));
    }
    if (employeeId) {
      const empIdNum = Number(employeeId);
      if (!isNaN(empIdNum)) {
        conditions.push(eq(attendanceRecords.employeeId, empIdNum));
      }
    }

    const rows = await db
      .select()
      .from(attendanceRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(attendanceRecords.workDate));

    return res.status(200).json(await approvedAttendanceRecords(rows, db));
  } catch (err) {
    console.error('getAttendanceRecords error:', err);
    return res.status(500).json({ error: 'Failed to retrieve attendance records' });
  }
}

export async function getAttendanceBatches(req: Request, res: Response) {
  try {
    const batches = await db
      .select()
      .from(attendanceBatches)
      .where(and(ne(attendanceBatches.filename, 'MANUAL_ENTRY'),historicalScopePredicate(requireHrScope(req as any),attendanceBatches.groupId)))
      .orderBy(desc(attendanceBatches.createdAt))
      .limit(50);

    return res.status(200).json(batches);
  } catch (err) {
    console.error('getAttendanceBatches error:', err);
    return res.status(500).json({ error: 'Failed to retrieve attendance batches' });
  }
}

export async function saveAttendanceRecord(req: Request, res: Response) {
  try {
    const normalized = normalizeAttendanceRecordPayload(req.body?.record || {});
    const operation = req.body?.operation === 'correct' ? 'correct' : 'create';
    const reason = String(req.body?.reason || '').trim() || (operation === 'correct' ? 'Koreksi absensi' : 'Pencatatan absensi');
    const userId = Number((req as any).user?.userId) || null;

    const saved = await db.transaction(async (tx) => {
      const owner = await requireScopedEmployee(requireHrScope(req as any),normalized.employeeId,tx);
      const [before] = await tx
        .select()
        .from(attendanceRecords)
        .where(and(
          eq(attendanceRecords.employeeId, normalized.employeeId),
          eq(attendanceRecords.workDate, normalized.workDate),
        ))
        .limit(1);

      if (before && before.groupId !== owner.groupId) throw new Error("Historical attendance ownership does not match destination");
      const [record] = await tx
        .insert(attendanceRecords)
        .values({ ...normalized, groupId:owner.groupId, organizationId:owner.organizationId, sourceBatchId: null, revision: 1, createdAt: new Date(), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [attendanceRecords.employeeId, attendanceRecords.workDate],
          set: {
            shift: normalized.shift,
            scheduleIn: normalized.scheduleIn,
            scheduleOut: normalized.scheduleOut,
            scanIn: normalized.scanIn,
            scanOut: normalized.scanOut,
            rawScanIn: normalized.rawScanIn,
            rawScanOut: normalized.rawScanOut,
            lateMinutes: normalized.lateMinutes,
            earlyMinutes: normalized.earlyMinutes,
            overtimeMinutes: normalized.overtimeMinutes,
            attendanceStatus: normalized.attendanceStatus,
            isDayOff: normalized.isDayOff,
            normalized: normalized.normalized,
            revision: sql`${attendanceRecords.revision} + 1`,
            updatedAt: new Date(),
          },
        })
        .returning();

      await tx.insert(auditLogs).values({
        userId,
        action: before ? 'UPDATE' : 'CREATE',
        entity: 'ATTENDANCE',
        entityId: record.id,
        oldValues: before || null,
        newValues: { ...record, reason },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')?.slice(0, 255),
      });

      return record;
    });

    return res.status(200).json({ success: true, record: saved });
  } catch (err: any) {
    console.error('saveAttendanceRecord error:', err);
    return res.status(400).json({ error: err.message || 'Failed to save attendance record' });
  }
}

export async function getAttendanceActivity(req: Request, res: Response) {
  try {
    const rows = await db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        username: users.username,
        action: auditLogs.action,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        employeeName: employees.fullName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(attendanceRecords, eq(auditLogs.entityId, attendanceRecords.id))
      .leftJoin(employees, eq(attendanceRecords.employeeId, employees.id))
      .where(and(eq(auditLogs.entity, 'ATTENDANCE'),historicalScopePredicate(requireHrScope(req as any),attendanceRecords.groupId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(500);

    return res.status(200).json(rows.map(row => {
      const values = (row.newValues || {}) as Record<string, unknown>;
      const reason = String(values.reason || 'Tanpa catatan');
      const workDate = String(values.workDate || 'Tanggal tidak tersedia');
      return {
        id: row.id,
        createdAt: row.createdAt,
        actor: row.username || 'Sistem',
        action: row.action === 'CREATE' ? 'Pencatatan absensi' : 'Koreksi absensi',
        detail: `${row.employeeName || 'Karyawan'} · ${workDate} · ${reason}`,
      };
    }));
  } catch (err) {
    console.error('getAttendanceActivity error:', err);
    return res.status(500).json({ error: 'Failed to retrieve attendance activity' });
  }
}

export async function commitAttendanceBatch(req: Request, res: Response) {
  try {
    const { filename, sourceId = 1, fileHash, records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records must be a non-empty array' });
    }

    const normalizedRecords = records.map(normalizeAttendanceRecordPayload);
    const userId = (req as any).user?.id ? Number((req as any).user.id) : null;

    const result = await db.transaction(async (tx) => {
      const scope = requireHrScope(req as any);
      const owners = new Map<number, any>();
      for (const record of normalizedRecords) {
        const owner = await requireScopedEmployee(scope,record.employeeId,tx);
        owners.set(record.employeeId,owner);
        const [previous] = await tx.select().from(attendanceRecords).where(and(eq(attendanceRecords.employeeId,record.employeeId),eq(attendanceRecords.workDate,record.workDate)));
        if (previous && previous.groupId !== owner.groupId) throw new Error("Historical attendance ownership does not match destination");
      }
      const [batch] = await tx
        .insert(attendanceBatches)
        .values({
          groupId:scope.selectedGroupId,
          filename: String(filename || 'IMPORT_ATTENDANCE.xlsx'),
          sourceId: Number(sourceId) || 1,
          fileHash: fileHash ? String(fileHash) : null,
          status: 'COMMITTED',
          totalRows: normalizedRecords.length,
          validRows: normalizedRecords.length,
          skippedRows: 0,
          createdById: userId,
          createdAt: new Date(),
          committedAt: new Date(),
        })
        .returning();

      // Chunk inserts/upserts for safety
      const chunkSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < normalizedRecords.length; i += chunkSize) {
        const chunk = normalizedRecords.slice(i, i + chunkSize);
        await tx
          .insert(attendanceRecords)
          .values(
            chunk.map((rec) => ({
              ...rec,
              groupId: owners.get(rec.employeeId).groupId, organizationId:owners.get(rec.employeeId).organizationId,
              sourceBatchId: batch.id,
              revision: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            }))
          )
          .onConflictDoUpdate({
            target: [attendanceRecords.employeeId, attendanceRecords.workDate],
            set: {
              shift: sql`excluded.shift`,
              scheduleIn: sql`excluded.schedule_in`,
              scheduleOut: sql`excluded.schedule_out`,
              scanIn: sql`excluded.scan_in`,
              scanOut: sql`excluded.scan_out`,
              rawScanIn: sql`excluded.raw_scan_in`,
              rawScanOut: sql`excluded.raw_scan_out`,
              lateMinutes: sql`excluded.late_minutes`,
              earlyMinutes: sql`excluded.early_minutes`,
              overtimeMinutes: sql`excluded.overtime_minutes`,
              attendanceStatus: sql`excluded.attendance_status`,
              isDayOff: sql`excluded.is_day_off`,
              normalized: sql`excluded.normalized`,
              revision: sql`${attendanceRecords.revision} + 1`,
              sourceBatchId: batch.id,
              updatedAt: new Date(),
            },
          });
        insertedCount += chunk.length;
      }

      return { batch, insertedCount };
    });

    return res.status(200).json({
      success: true,
      message: `${result.insertedCount} attendance records saved to database`,
      batchId: result.batch.id,
      insertedCount: result.insertedCount,
    });
  } catch (err: any) {
    console.error('commitAttendanceBatch error:', err);
    return res.status(500).json({ error: err.message || 'Failed to commit attendance batch' });
  }
}
