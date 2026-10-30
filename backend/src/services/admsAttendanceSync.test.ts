import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterDebouncePunches,
  cleanseAndIngestAdmsLogs,
  resolveUnmappedAdmsPin,
  type AdmsRawLogItem,
} from './admsAttendanceSync';

test('filterDebouncePunches removes accidental duplicate taps within 60 seconds for same PIN', () => {
  const punches: AdmsRawLogItem[] = [
    { pin: '101', timestamp: '2026-10-30 08:02:00', rawStatus: 0, rawVerify: 15, serial: 'SN1', deviceId: 1, employeeId: 10 },
    { pin: '101', timestamp: '2026-10-30 08:02:15', rawStatus: 0, rawVerify: 15, serial: 'SN1', deviceId: 1, employeeId: 10 }, // duplicate < 60s
    { pin: '101', timestamp: '2026-10-30 08:02:45', rawStatus: 0, rawVerify: 15, serial: 'SN1', deviceId: 1, employeeId: 10 }, // duplicate < 60s
    { pin: '102', timestamp: '2026-10-30 08:02:30', rawStatus: 0, rawVerify: 15, serial: 'SN1', deviceId: 1, employeeId: 11 }, // different PIN
    { pin: '101', timestamp: '2026-10-30 16:40:00', rawStatus: 1, rawVerify: 15, serial: 'SN1', deviceId: 1, employeeId: 10 }, // afternoon scan (>60s)
    { pin: '101', timestamp: '2026-10-30 17:04:00', rawStatus: 1, rawVerify: 15, serial: 'SN1', deviceId: 1, employeeId: 10 }, // final evening scan
  ];

  const filtered = filterDebouncePunches(punches);

  assert.equal(filtered.length, 4);
  assert.equal(filtered[0].timestamp, '2026-10-30 08:02:00');
  assert.equal(filtered[1].pin, '102');
  assert.equal(filtered[2].timestamp, '2026-10-30 16:40:00');
  assert.equal(filtered[3].timestamp, '2026-10-30 17:04:00');
});

test('cleanseAndIngestAdmsLogs only ingests mapped employee logs and performs atomic FIFO attendance update', async () => {
  const queries: { sql: string; params?: any[] }[] = [];
  const fakeClient = {
    query: async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT') && sql.includes('adms.review_logs')) {
        return {
          rows: [
            {
              id: 1,
              serial: 'SN1',
              group_id: 1,
              device_id: 1,
              pin: '101',
              punched_at: new Date('2026-10-30T08:02:00'),
              raw_status: 0,
              raw_verify: 15,
              employee_id: 10,
            },
            {
              id: 2,
              serial: 'SN1',
              group_id: 1,
              device_id: 1,
              pin: '999',
              punched_at: new Date('2026-10-30T08:05:00'),
              raw_status: 0,
              raw_verify: 15,
              employee_id: null, // UNMAPPED
            },
            {
              id: 3,
              serial: 'SN1',
              group_id: 1,
              device_id: 1,
              pin: '101',
              punched_at: new Date('2026-10-30T17:04:00'),
              raw_status: 1,
              raw_verify: 15,
              employee_id: 10,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO public.attendance_device_raw_logs')) {
        return { rowCount: 2, rows: [{ id: 101 }, { id: 102 }] };
      }
      if (sql.includes('SELECT') && sql.includes('FROM public.employees')) {
        return {
          rows: [
            {
              id: 10,
              nik: 'EMP101',
              fullName: 'Ahmad Dahlan',
              departmentId: 1,
              departmentName: 'Produksi',
              groupId: 1,
              organizationId: 1,
            },
          ],
        };
      }
      if (sql.includes('FROM public.attendance_shifts')) {
        return {
          rows: [
            {
              code: 'REGULER',
              name: 'Shift Reguler',
              scheduleIn: '08:00',
              scheduleOut: '17:00',
            },
          ],
        };
      }
      if (sql.includes('FROM public.attendance_shift_assignments')) {
        return { rows: [] };
      }
      if (sql.includes('FROM public.attendance_records')) {
        return { rows: [] };
      }
      return { rowCount: 1, rows: [] };
    },
    release: () => {},
  };

  const fakePool = {
    connect: async () => fakeClient,
  };

  const result = await cleanseAndIngestAdmsLogs(fakePool as any, {
    groupId: 1,
    startDate: '2026-10-30',
    endDate: '2026-10-30',
  });

  assert.equal(result.totalFound, 3);
  assert.equal(result.totalCleaned, 2); // 2 mapped, 1 unmapped skipped
  assert.equal(result.totalUnmappedSkipped, 1);
  assert.ok(queries.some(q => q.sql === 'BEGIN'));
  assert.ok(queries.some(q => q.sql.includes('INSERT INTO public.attendance_device_raw_logs')));
  assert.ok(queries.some(q => q.sql.includes('INSERT INTO public.attendance_records')));
  assert.ok(queries.some(q => q.sql === 'COMMIT'));
});

test('resolveUnmappedAdmsPin maps PIN, updates review logs, and ingests historical logs into attendance', async () => {
  const queries: { sql: string; params?: any[] }[] = [];
  const fakeClient = {
    query: async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT id, group_id FROM public.employees')) {
        return { rows: [{ id: 10, group_id: 1, employee_code: 'EMP101', full_name: 'Ahmad Dahlan' }] };
      }
      if (sql.includes('UPDATE adms.review_logs')) {
        return { rowCount: 3 };
      }
      if (sql.includes('SELECT') && sql.includes('adms.review_logs')) {
        return {
          rows: [
            {
              id: 1,
              serial: 'SN1',
              group_id: 1,
              device_id: 1,
              pin: '999',
              punched_at: new Date('2026-10-30T08:02:00'),
              raw_status: 0,
              raw_verify: 15,
              employee_id: 10,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO public.attendance_device_raw_logs')) {
        return { rowCount: 1, rows: [{ id: 103 }] };
      }
      if (sql.includes('FROM public.employees')) {
        return { rows: [{ id: 10, nik: 'EMP101', fullName: 'Ahmad Dahlan', departmentId: 1, departmentName: 'Produksi', groupId: 1 }] };
      }
      if (sql.includes('FROM public.attendance_shifts')) {
        return { rows: [{ code: 'REGULER', name: 'Shift Reguler', scheduleIn: '08:00', scheduleOut: '17:00' }] };
      }
      if (sql.includes('FROM public.attendance_shift_assignments')) return { rows: [] };
      if (sql.includes('FROM public.attendance_records')) return { rows: [] };
      return { rowCount: 1, rows: [] };
    },
    release: () => {},
  };

  const fakePool = {
    connect: async () => fakeClient,
  };

  const result = await resolveUnmappedAdmsPin(fakePool as any, {
    groupId: 1,
    pin: '999',
    employeeId: 10,
    processLogs: true,
  });

  assert.equal(result.pin, '999');
  assert.equal(result.employeeId, 10);
  assert.equal(result.updatedReviewLogs, 3);
  assert.ok(queries.some(q => q.sql.includes('UPDATE adms.review_logs')));
  assert.ok(queries.some(q => q.sql.includes('INSERT INTO public.attendance_device_raw_logs')));
});
