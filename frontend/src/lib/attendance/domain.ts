import type { AttendanceDataset, AttendanceRecord, EmployeeReport, ImportRow, RecordFilter } from './types';

export const statusLabels = { PRESENT: 'Hadir', DINAS_LUAR: 'Dinas Luar', IZIN: 'Izin', SAKIT: 'Sakit', CUTI: 'Cuti', ALPHA: 'Tidak hadir', UNSPECIFIED: 'Belum ditentukan' };
export const roleLabels = { HR_ADMIN: 'HR Admin', HR_STAFF: 'HR Staff', REPORT_VIEWER: 'Pembaca Laporan' };
export function durationLabel(minutes: number): string {
  return minutes < 60 ? `${minutes} menit` : `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}
export function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(`${value}T00:00:00+07:00`));
}
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validatePeriod(start: string, end: string) {
  if (!validDate(start) || !validDate(end)) throw new Error('Tanggal tidak valid.');
  if (start > end) throw new Error('Tanggal awal harus sebelum atau sama dengan tanggal akhir.');
  if ((Date.parse(end) - Date.parse(start)) / 86400000 >= 366) throw new Error('Rentang maksimal 366 hari.');
}
export function filterEmployees(data: AttendanceDataset, filter: Omit<RecordFilter, 'startDate' | 'endDate'>) {
  const q = (filter.q ?? '').trim().toLocaleLowerCase();
  return data.employees.filter(e => (!filter.employeeId || e.id === filter.employeeId)
    && (!filter.departmentId || e.departmentId === filter.departmentId)
    && (!filter.locationId || e.locationId === filter.locationId)
    && (!q || `${e.fullName} ${e.employeeCode}`.toLocaleLowerCase().includes(q)));
}
export function filterRecords(data: AttendanceDataset, filter: RecordFilter): AttendanceRecord[] {
  validatePeriod(filter.startDate, filter.endDate);
  const ids = new Set(filterEmployees(data, filter).map(e => e.id));
  return data.records.filter(r => ids.has(r.employeeId) && r.workDate >= filter.startDate && r.workDate <= filter.endDate);
}
export function isRecordedAbsence(record: AttendanceRecord | null, today = getJakartaToday()): boolean {
  return record?.attendanceStatus === 'ALPHA' && !record.isDayOff && record.workDate <= today;
}
export function summarizeEmployees(data: AttendanceDataset, filter: RecordFilter, today = getJakartaToday()): EmployeeReport[] {
  const absentDates = new Map<number, Set<string>>();
  const totals = new Map<number, {
    recordCount: number;
    lateMinutes: number;
    overtimeMinutes: number;
    sakitCount: number;
    izinCount: number;
    cutiCount: number;
    absentCount: number;
  }>();

  for (const r of filterRecords(data, filter)) {
    const row = totals.get(r.employeeId) ?? {
      recordCount: 0,
      lateMinutes: 0,
      overtimeMinutes: 0,
      sakitCount: 0,
      izinCount: 0,
      cutiCount: 0,
      absentCount: 0,
    };
    if (isRecordedAbsence(r, today)) {
      const dates = absentDates.get(r.employeeId) ?? new Set<string>();
      dates.add(r.workDate);
      absentDates.set(r.employeeId, dates);
      row.absentCount = dates.size;
    }
    if (!r.isDayOff && (r.attendanceStatus === 'PRESENT' || r.attendanceStatus === 'DINAS_LUAR')) row.recordCount++;
    if (!r.isDayOff) row.lateMinutes += r.lateMinutes || 0;
    row.overtimeMinutes += r.overtimeMinutes || 0;
    if (r.attendanceStatus === 'SAKIT') row.sakitCount++;
    else if (r.attendanceStatus === 'IZIN') row.izinCount++;
    else if (r.attendanceStatus === 'CUTI') row.cutiCount++;
    totals.set(r.employeeId, row);
  }
  return filterEmployees(data, filter).map(employee => ({
    employee,
    ...(totals.get(employee.id) ?? {
      recordCount: 0,
      lateMinutes: 0,
      overtimeMinutes: 0,
      sakitCount: 0,
      izinCount: 0,
      cutiCount: 0,
      absentCount: 0,
    }),
  }));
}
function csvCell(value: string | number) {
  const raw = String(value);
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function reportCsv(rows: EmployeeReport[], filter: RecordFilter, anonymous = false): string {
  const headers = anonymous ? ['Dari', 'Sampai', 'Keterlambatan (menit)', 'Lembur (menit)', 'Izin', 'Cuti', 'Sakit', 'Tidak Hadir'] : ['Dari', 'Sampai', 'ID karyawan', 'Nama', 'Hari Hadir', 'Keterlambatan (menit)', 'Lembur (menit)', 'Izin', 'Cuti', 'Sakit', 'Tidak Hadir'];
  const values = anonymous
    ? [[filter.startDate, filter.endDate, rows.reduce((v, r) => v + r.lateMinutes, 0), rows.reduce((v, r) => v + r.overtimeMinutes, 0), rows.reduce((v, r) => v + (r.izinCount || 0), 0), rows.reduce((v, r) => v + (r.cutiCount || 0), 0), rows.reduce((v, r) => v + (r.sakitCount || 0), 0), rows.reduce((v, r) => v + (r.absentCount || 0), 0)]]
    : rows.map(r => [filter.startDate, filter.endDate, r.employee.employeeCode, r.employee.fullName, r.recordCount, r.recordCount ? r.lateMinutes : '', r.recordCount ? r.overtimeMinutes : '', r.izinCount || 0, r.cutiCount || 0, r.sakitCount || 0, r.absentCount || 0]);
  return '\uFEFF' + [headers, ...values].map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function downloadText(text: string, filename: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function parseImportRows(text: string): ImportRow[] {
  const input: unknown = JSON.parse(text);
  if (!Array.isArray(input) || input.length === 0 || input.length > 50000) throw new Error('File harus berisi 1–50.000 baris JSON.');
  return input.map((value: unknown, index) => {
    if (!value || typeof value !== 'object') throw new Error(`Baris ${index + 1} tidak valid.`);
    const r = value as Record<string, unknown>;
    if (typeof r.externalNoId !== 'string' || !r.externalNoId.trim() || typeof r.workDate !== 'string' || !validDate(r.workDate)) throw new Error(`Baris ${index + 1}: nomor mesin dan tanggal wajib valid.`);
    for (const key of ['lateMinutes', 'earlyMinutes', 'overtimeMinutes']) {
      if (typeof r[key] !== 'number' || !Number.isSafeInteger(r[key]) || r[key] < 0) throw new Error(`Baris ${index + 1}: ${key} harus berupa menit nonnegatif.`);
    }
    for (const key of ['scanIn', 'scanOut']) {
      if (r[key] !== null && (typeof r[key] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r[key]))) throw new Error(`Baris ${index + 1}: ${key} harus HH:mm atau null.`);
    }
    return { id: index + 1, externalNoId: r.externalNoId.trim(), employeeId: null, workDate: r.workDate, scanIn: r.scanIn as string | null, scanOut: r.scanOut as string | null, lateMinutes: r.lateMinutes as number, earlyMinutes: r.earlyMinutes as number, overtimeMinutes: r.overtimeMinutes as number, reviewStatus: 'BLOCKED', note: '' };
  });
}

export function getJakartaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function subtractOneMonth(dateStr: string): string {
  if (!validDate(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  let targetYear = y;
  let targetMonth = m - 1;
  if (targetMonth === 0) {
    targetYear -= 1;
    targetMonth = 12;
  }
  const maxDays = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(d, maxDays);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

export function getDefaultAttendancePeriod(data: AttendanceDataset, employeeId?: number): { startDate: string; endDate: string } {
  const records = employeeId
    ? data.records.filter(r => r.employeeId === employeeId)
    : data.records;

  const today = getJakartaToday();

  let latestDate = '';
  for (const r of records) {
    if (r.workDate && (!latestDate || r.workDate > latestDate)) {
      latestDate = r.workDate;
    }
  }

  if (!latestDate && employeeId && data.records.length > 0) {
    for (const r of data.records) {
      if (r.workDate && (!latestDate || r.workDate > latestDate)) {
        latestDate = r.workDate;
      }
    }
  }

  if (!latestDate) {
    latestDate = (data.meta?.defaultDate && validDate(data.meta.defaultDate))
      ? data.meta.defaultDate
      : today;
  }

  let baseDate = latestDate;
  if (today >= latestDate) {
    const diffDays = (Date.parse(today) - Date.parse(latestDate)) / (1000 * 60 * 60 * 24);
    if (diffDays <= 31) {
      baseDate = today;
    }
  }

  // Calculate 21st-to-20th cut-off cycle containing baseDate
  const [y, m, d] = baseDate.split('-').map(Number);
  let cycleMonth = m;
  let cycleYear = y;

  if (d < 21) {
    cycleMonth = m === 1 ? 12 : m - 1;
    cycleYear = m === 1 ? y - 1 : y;
  }

  const nextMonth = cycleMonth === 12 ? 1 : cycleMonth + 1;
  const nextYear = cycleMonth === 12 ? cycleYear + 1 : cycleYear;

  const startMonthStr = String(cycleMonth).padStart(2, '0');
  const endMonthStr = String(nextMonth).padStart(2, '0');

  return {
    startDate: `${cycleYear}-${startMonthStr}-21`,
    endDate: `${nextYear}-${endMonthStr}-20`,
  };
}

export function sortRecordsDescending(records: AttendanceRecord[]): AttendanceRecord[] {
  return [...records].sort((a, b) => b.workDate.localeCompare(a.workDate) || (b.id - a.id));
}
