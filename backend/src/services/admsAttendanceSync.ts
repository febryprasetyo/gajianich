import type { Pool, PoolClient } from 'pg';
import {
  calculateAttendanceFromPunches,
  mergeAttendanceScans,
  type RawPunchInput,
} from './attendanceCalculationService';
import type { WorkShift, ShiftAssignment } from '../domain/attendanceTypes';

export interface AdmsRawLogItem {
  id?: number | string;
  pin: string;
  timestamp: string; // YYYY-MM-DD HH:mm:ss or ISO
  rawStatus: number;
  rawVerify: number;
  serial: string;
  deviceId: number;
  employeeId?: number | null;
  workDate?: string;
}

export function formatTimestamp(date: Date | string): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
}

export function extractWorkDate(timestampStr: string): string {
  return timestampStr.split(' ')[0] || timestampStr.slice(0, 10);
}

/**
 * Filter accidental double taps (< 60 seconds) for the same employee PIN.
 * Preserves punches that are more than 60s apart.
 */
export function filterDebouncePunches(punches: AdmsRawLogItem[]): AdmsRawLogItem[] {
  if (!punches.length) return [];

  // Sort ascending by timestamp
  const sorted = [...punches].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const result: AdmsRawLogItem[] = [];
  const lastPunchByPin = new Map<string, number>();

  for (const p of sorted) {
    const key = p.employeeId ? `emp_${p.employeeId}` : `pin_${p.pin}`;
    const timeMs = new Date(p.timestamp).getTime();
    const lastTime = lastPunchByPin.get(key);

    if (lastTime !== undefined && Math.abs(timeMs - lastTime) < 60000) {
      // Ignore double tap within 60s
      continue;
    }

    lastPunchByPin.set(key, timeMs);
    result.push(p);
  }

  return result;
}

export interface IngestOptions {
  groupId: number;
  startDate?: string | null;
  endDate?: string | null;
  deviceId?: number | null;
  pin?: string | null;
}

export async function cleanseAndIngestAdmsLogs(
  pool: { connect(): Promise<PoolClient> },
  options: IngestOptions
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch review logs from adms.review_logs matching scope
    const sql = `
      SELECT 
        r.id,
        r.serial,
        r.group_id,
        dev.device_id,
        r.pin,
        r.punched_at,
        r.raw_status,
        r.raw_verify,
        r.employee_id
      FROM adms.review_logs r
      JOIN adms.devices dev ON dev.serial = r.serial AND dev.group_id = r.group_id
      JOIN public.attendance_devices d ON d.id = dev.device_id
      WHERE r.group_id = $1
        AND ($2::text IS NULL OR r.punched_at::date >= $2::date)
        AND ($3::text IS NULL OR r.punched_at::date <= $3::date)
        AND ($4::bigint IS NULL OR dev.device_id = $4::bigint)
        AND ($5::text IS NULL OR r.pin = $5::text)
      ORDER BY r.punched_at ASC
    `;

    const rawRes = await client.query(sql, [
      options.groupId,
      options.startDate || null,
      options.endDate || null,
      options.deviceId || null,
      options.pin || null,
    ]);

    const allRows = rawRes.rows;
    const totalFound = allRows.length;

    // 2. Data Cleansing Gate: Filter only mapped logs (employee_id IS NOT NULL)
    const mappedRows = allRows.filter(r => r.employee_id !== null && r.employee_id !== undefined);
    const totalUnmappedSkipped = totalFound - mappedRows.length;

    const formattedPunches: AdmsRawLogItem[] = mappedRows.map(r => {
      const ts = formatTimestamp(r.punched_at);
      return {
        id: r.id,
        serial: r.serial,
        deviceId: Number(r.device_id),
        pin: r.pin,
        timestamp: ts,
        workDate: extractWorkDate(ts),
        rawStatus: Number(r.raw_status),
        rawVerify: Number(r.raw_verify),
        employeeId: Number(r.employee_id),
      };
    });

    // 3. Debounce filter (< 60s accidental double tap)
    const cleanedPunches = filterDebouncePunches(formattedPunches);
    const totalCleaned = cleanedPunches.length;

    let insertedRawLogs = 0;
    if (cleanedPunches.length > 0) {
      // 4. Ingest into attendance_device_raw_logs
      for (const p of cleanedPunches) {
        const verifyMode = p.rawVerify === 1 ? 'Fingerprint' : p.rawVerify === 2 ? 'Password' : 'Card / Scan';
        const inOutState = p.rawStatus === 0 ? 'Masuk' : p.rawStatus === 1 ? 'Pulang' : 'Scan';
        const rawPayload = JSON.stringify({
          source: 'ADMS',
          serial: p.serial,
          rawStatus: p.rawStatus,
          rawVerify: p.rawVerify,
        });

        const insRes = await client.query(
          `INSERT INTO public.attendance_device_raw_logs
             (device_id, pin, employee_id, timestamp, work_date, verify_mode, in_out_state, raw_payload, group_id)
           VALUES ($1, $2, $3, $4::timestamp, $5, $6, $7, $8::jsonb, $9)
           ON CONFLICT (ingestion_key) DO NOTHING
           RETURNING id`,
          [
            p.deviceId,
            p.pin,
            p.employeeId,
            p.timestamp,
            p.workDate,
            verifyMode,
            inOutState,
            rawPayload,
            options.groupId,
          ]
        );
        if (insRes.rowCount) insertedRawLogs += insRes.rowCount;
      }

      // 5. Query Master Data for Reactive FIFO Calculation
      const empRes = await client.query(
        `SELECT e.id, e.employee_number AS nik, e.full_name AS "fullName",
                e.department_id AS "departmentId", d.name AS "departmentName",
                m.group_id AS "groupId", m.organization_id AS "organizationId"
         FROM public.employees e
         LEFT JOIN public.departments d ON d.id = e.department_id
         LEFT JOIN public.department_organization_mappings m ON m.department_id = e.department_id
         WHERE m.group_id = $1`,
        [options.groupId]
      );

      const employeesMap = new Map();
      const empOrgMap = new Map<number, number | null>();
      for (const emp of empRes.rows) {
        employeesMap.set(emp.id, {
          id: emp.id,
          nik: emp.nik,
          fullName: emp.fullName,
          departmentId: emp.departmentId,
          departmentName: emp.departmentName || 'Umum',
        });
        empOrgMap.set(emp.id, emp.organizationId ? Number(emp.organizationId) : null);
      }

      const shiftRes = await client.query(`SELECT code, name, schedule_in AS "scheduleIn", schedule_out AS "scheduleOut" FROM public.attendance_shifts`);
      const assignRes = await client.query(
        `SELECT a.employee_id AS "employeeId", a.department_id AS "departmentId", s.code AS "shiftCode"
         FROM public.attendance_shift_assignments a
         JOIN public.attendance_shifts s ON s.id = a.shift_id`
      );

      const rawPunchesForCalc: RawPunchInput[] = cleanedPunches.map(p => ({
        pin: p.pin,
        employeeId: p.employeeId,
        timestamp: p.timestamp,
        workDate: p.workDate || extractWorkDate(p.timestamp),
      }));

      const calcResult = calculateAttendanceFromPunches(
        rawPunchesForCalc,
        employeesMap,
        shiftRes.rows as unknown as WorkShift[],
        assignRes.rows as unknown as ShiftAssignment[],
        { assignDefaultShiftIfUnassigned: true }
      );

      // 6. Upsert calculated records into attendance_records
      for (const rec of calcResult.processedRecords) {
        if (!rec.employeeId) continue;
        const orgId = empOrgMap.get(rec.employeeId) || null;

        const prevRes = await client.query(
          `SELECT scan_in AS "scanIn", scan_out AS "scanOut", schedule_in AS "scheduleIn",
                  schedule_out AS "scheduleOut", attendance_status AS "attendanceStatus", shift
           FROM public.attendance_records
           WHERE employee_id = $1 AND work_date = $2`,
          [rec.employeeId, rec.workDate]
        );
        const previous = prevRes.rows[0];

        const merged = mergeAttendanceScans(previous, {
          scanIn: rec.scanIn,
          scanOut: rec.scanOut,
          scheduleIn: previous?.scheduleIn || rec.scheduleIn || '08:00',
          scheduleOut: previous?.scheduleOut || rec.scheduleOut || '17:00',
          attendanceStatus: rec.attendanceStatus,
        });

        await client.query(
          `INSERT INTO public.attendance_records
             (group_id, organization_id, employee_id, work_date, shift, schedule_in, schedule_out,
              scan_in, scan_out, raw_scan_in, raw_scan_out, late_minutes, early_minutes, attendance_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8, $9, $10, $11, $12)
           ON CONFLICT (employee_id, work_date) DO UPDATE SET
             shift = EXCLUDED.shift,
             schedule_in = EXCLUDED.schedule_in,
             schedule_out = EXCLUDED.schedule_out,
             scan_in = EXCLUDED.scan_in,
             scan_out = EXCLUDED.scan_out,
             late_minutes = EXCLUDED.late_minutes,
             early_minutes = EXCLUDED.early_minutes,
             attendance_status = EXCLUDED.attendance_status,
             updated_at = NOW()`,
          [
            options.groupId,
            orgId,
            rec.employeeId,
            rec.workDate,
            rec.shiftName || previous?.shift || 'Shift Reguler',
            rec.scheduleIn || '08:00',
            rec.scheduleOut || '17:00',
            merged.scanIn,
            merged.scanOut,
            merged.lateMinutes,
            merged.earlyMinutes,
            merged.attendanceStatus,
          ]
        );
      }
    }

    await client.query('COMMIT');

    return {
      totalFound,
      totalCleaned,
      totalUnmappedSkipped,
      insertedRawLogs,
      message: `Berhasil membersihkan dan memasukkan ${totalCleaned} log ADMS ke presensi utama.`,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function resolveUnmappedAdmsPin(
  pool: { connect(): Promise<PoolClient> },
  input: { groupId: number; pin: string; employeeId: number; processLogs?: boolean }
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify employee exists in target group
    const empRes = await client.query(
      `SELECT e.id, m.group_id, e.employee_number, e.full_name
       FROM public.employees e
       JOIN public.department_organization_mappings m ON m.department_id = e.department_id
       WHERE e.id = $1 AND m.group_id = $2`,
      [input.employeeId, input.groupId]
    );

    if (!empRes.rows.length) {
      throw Object.assign(new Error('Karyawan tidak ditemukan dalam kelompok organisasi aktif.'), { statusCode: 404 });
    }
    const emp = empRes.rows[0];

    // 2. Update employee_id in adms.review_logs for this PIN and group
    const updateRes = await client.query(
      `UPDATE adms.review_logs
       SET employee_id = $1
       WHERE pin = $2 AND group_id = $3 AND employee_id IS NULL`,
      [input.employeeId, input.pin, input.groupId]
    );

    const updatedReviewLogs = updateRes.rowCount || 0;

    // 3. If processLogs requested, run ingestion for this PIN immediately
    let ingestResult = null;
    if (input.processLogs) {
      ingestResult = await cleanseAndIngestAdmsLogs({ connect: async () => client }, {
        groupId: input.groupId,
        pin: input.pin,
      });
    }

    await client.query('COMMIT');

    return {
      pin: input.pin,
      employeeId: input.employeeId,
      employeeName: emp.full_name,
      updatedReviewLogs,
      ingestResult,
      message: `PIN ${input.pin} berhasil dipetakan ke ${emp.full_name} (${updatedReviewLogs} log review diperbarui).`,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
