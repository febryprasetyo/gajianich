import * as XLSX from 'xlsx';
import type { ImportRow } from './types';

function minutes(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    if (value < 0) throw new Error('Durasi tidak boleh negatif.');
    return Math.round(value);
  }
  const str = String(value).trim();
  if (!str) return 0;
  const match = /^(\d+):([0-5]\d)$/.exec(str);
  if (!match) throw new Error(`Durasi tidak valid: ${str}`);
  const result = Number(match[1]) * 60 + Number(match[2]);
  if (!Number.isSafeInteger(result)) throw new Error('Durasi terlalu besar.');
  return result;
}

const clockPattern = /^([01]?\d|2[0-3]):[0-5]\d$/;

function normalizeClock(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (value >= 0 && value < 1) {
      const totalMinutes = Math.round(value * 24 * 60);
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  const str = String(value).trim();
  if (!str) return null;
  if (clockPattern.test(str)) {
    const parts = str.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1]}`;
  }
  return str;
}

const isClockValid = (value: string | null) => value !== null && clockPattern.test(value);

function parseAttendanceDate(value: unknown, rowIndex: number): string {
  if (value === null || value === undefined || value === '') {
    throw new Error(`Tanggal baris ${rowIndex} tidak valid.`);
  }

  if (typeof value === 'number') {
    if (value < 1000 || value > 80000) {
      throw new Error(`Tanggal baris ${rowIndex} tidak valid.`);
    }
    const d = XLSX.SSF.parse_date_code(value);
    const y = d.y, m = String(d.m).padStart(2, '0'), day = String(d.d).padStart(2, '0');
    if (y < 2000 || y > 2100) throw new Error(`Tanggal baris ${rowIndex} tidak valid.`);
    const iso = `${y}-${m}-${day}`;
    if (new Date(iso).toISOString().slice(0, 10) !== iso) {
      throw new Error(`Tanggal baris ${rowIndex} tidak valid.`);
    }
    return iso;
  }

  const str = String(value).trim();
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
  if (slashMatch) {
    const y = Number(slashMatch[3]);
    const m = slashMatch[2].padStart(2, '0');
    const d = slashMatch[1].padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    if (!Number.isFinite(Date.parse(iso)) || y < 2000 || y > 2100 || new Date(iso).toISOString().slice(0, 10) !== iso) {
      throw new Error(`Tanggal baris ${rowIndex} tidak valid.`);
    }
    return iso;
  }

  const dashMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);
  if (dashMatch) {
    const y = Number(dashMatch[1]);
    const m = dashMatch[2].padStart(2, '0');
    const d = dashMatch[3].padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    if (!Number.isFinite(Date.parse(iso)) || y < 2000 || y > 2100 || new Date(iso).toISOString().slice(0, 10) !== iso) {
      throw new Error(`Tanggal baris ${rowIndex} tidak valid.`);
    }
    return iso;
  }

  const dmyDashMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(str);
  if (dmyDashMatch) {
    const y = Number(dmyDashMatch[3]);
    const m = dmyDashMatch[2].padStart(2, '0');
    const d = dmyDashMatch[1].padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    if (!Number.isFinite(Date.parse(iso)) || y < 2000 || y > 2100 || new Date(iso).toISOString().slice(0, 10) !== iso) {
      throw new Error(`Tanggal baris ${rowIndex} tidak valid.`);
    }
    return iso;
  }

  if (/^\d{5}$/.test(str)) {
    const num = Number(str);
    const d = XLSX.SSF.parse_date_code(num);
    const y = d.y, m = String(d.m).padStart(2, '0'), day = String(d.d).padStart(2, '0');
    if (y < 2000 || y > 2100) throw new Error(`Tanggal baris ${rowIndex} tidak valid.`);
    const iso = `${y}-${m}-${day}`;
    if (new Date(iso).toISOString().slice(0, 10) !== iso) {
      throw new Error(`Tanggal baris ${rowIndex} tidak valid.`);
    }
    return iso;
  }

  throw new Error(`Tanggal baris ${rowIndex} tidak valid.`);
}

function isRawBiff(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && bytes[0] === 9 && [0, 2, 8].includes(bytes[1]);
}

function parseRawBiffRecords(bytes: Uint8Array): Array<Record<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const table = new Map<number, Map<number, string>>();
  const decoder = new TextDecoder('utf-8');
  let offset = 0; let eof = false;
  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) throw new Error('Header BIFF terpotong.');
    const type = view.getUint16(offset, true), length = view.getUint16(offset + 2, true);
    const start = offset + 4, end = start + length;
    if (end > bytes.length) throw new Error('Record BIFF terpotong.');
    if (type === 4) {
      if (length < 8 || bytes[start + 7] > length - 8) throw new Error('Teks BIFF rusak.');
      const row = view.getUint16(start, true), col = view.getUint16(start + 2, true);
      const values = table.get(row) ?? new Map<number, string>();
      values.set(col, decoder.decode(bytes.subarray(start + 8, start + 8 + bytes[start + 7])).trim()); table.set(row, values);
      if (table.size > 50001) throw new Error('Batas 50.000 baris terlampaui.');
    }
    if (type === 10) eof = true;
    offset = end;
  }
  if (!eof) throw new Error('File BIFF terpotong: penanda akhir tidak ditemukan.');
  const header = table.get(0);
  if (!header) throw new Error('Header file tidak ditemukan.');
  const columns = new Map([...header].map(([index, name]) => [name, index]));
  for (const name of ['No. ID', 'Nama', 'Tanggal', 'Terlambat', 'Plg. Cepat', 'Lembur']) {
    if (!columns.has(name)) throw new Error(`Kolom wajib ${name} tidak ditemukan.`);
  }

  const result: Array<Record<string, string>> = [];
  const sortedRows = [...table].sort(([a], [b]) => a - b).filter(([index]) => index !== 0);
  for (const [index, cells] of sortedRows) {
    const rowObj: Record<string, string> = { __rowIndex: String(index) };
    for (const [colName, colIdx] of columns.entries()) {
      rowObj[colName] = cells.get(colIdx) ?? '';
    }
    result.push(rowObj);
  }
  return result;
}

function parseWorkbookWithSheetJs(bytes: Uint8Array): Array<Record<string, unknown>> {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(bytes, { type: 'array' });
  } catch {
    throw new Error('Gunakan file .xls atau .xlsx yang valid.');
  }
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('File Excel tidak memiliki lembar kerja (sheet).');
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('Lembar kerja Excel kosong.');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (!rows || rows.length === 0) throw new Error('File tidak memiliki data baris absensi.');
  if (rows.length > 50000) throw new Error('Batas 50.000 baris terlampaui.');

  const sampleRow = rows[0] || {};
  const sampleKeys = Object.keys(sampleRow).map(k => k.trim());
  for (const name of ['No. ID', 'Nama', 'Tanggal']) {
    if (!sampleKeys.some(k => k.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Kolom wajib ${name} tidak ditemukan.`);
    }
  }

  return rows.map((r, i) => ({ ...r, __rowIndex: i + 1 }));
}

/** Parses attendance spreadsheet (.xls BIFF, OLE2 .xls, or .xlsx) into normalized ImportRow array. */
export function parseAttendanceWorkbook(bytes: Uint8Array): ImportRow[] {
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('Batas ukuran file 20 MiB.');

  let rawList: Array<Record<string, unknown>>;
  if (isRawBiff(bytes)) {
    rawList = parseRawBiffRecords(bytes);
  } else {
    rawList = parseWorkbookWithSheetJs(bytes);
  }

  return rawList.map((rowObj, listIdx) => {
    const rowIndex = Number(rowObj.__rowIndex ?? (listIdx + 1));
    const findValue = (...names: string[]): unknown => {
      for (const name of names) {
        for (const [k, v] of Object.entries(rowObj)) {
          if (k.trim().toLowerCase() === name.toLowerCase()) return v;
        }
      }
      return '';
    };

    const text = (...names: string[]) => String(findValue(...names) ?? '').trim();
    const optional = (...names: string[]) => {
      const normalized = normalizeClock(findValue(...names));
      return normalized || null;
    };

    const date = parseAttendanceDate(findValue('Tanggal'), rowIndex);
    const rawScanIn = optional('Scan Masuk');
    const rawScanOut = optional('Scan Pulang');

    const row: ImportRow = {
      id: rowIndex,
      externalNoId: text('No. ID'),
      employeeId: null,
      employeeName: text('Nama') || undefined,
      employeeCode: text('Emp No.', 'NIK') || undefined,
      department: text('Departemen') || undefined,
      workDate: date,
      shift: optional('Jam Kerja') ?? (text('Jam Kerja') || null),
      scheduleIn: optional('Jam Masuk'),
      scheduleOut: optional('Jam Pulang'),
      scanIn: rawScanIn,
      scanOut: rawScanOut,
      rawScanIn,
      rawScanOut,
      lateMinutes: 0,
      earlyMinutes: 0,
      overtimeMinutes: 0,
      reviewStatus: 'READY',
      note: '',
      normalized: false,
    };

    if (!rawScanIn && !rawScanOut) {
      return { ...row, reviewStatus: 'SKIPPED', note: 'Kedua scan kosong; tidak disimpulkan alpha.' };
    }

    try {
      if (!row.externalNoId) throw new Error('No. ID kosong.');
      row.lateMinutes = minutes(findValue('Terlambat'));
      row.earlyMinutes = minutes(findValue('Plg. Cepat'));
      row.overtimeMinutes = minutes(findValue('Lembur'));

      if (!rawScanIn) {
        row.scanIn = row.scheduleIn ?? null;
        row.lateMinutes = 0;
        row.normalized = true;
      }
      if (!rawScanOut) {
        row.scanOut = row.scheduleOut ?? null;
        row.earlyMinutes = 0;
        row.normalized = true;
      }

      if (!isClockValid(row.scanIn) || !isClockValid(row.scanOut)) {
        throw new Error('Scan atau jadwal tidak valid.');
      }
      if (row.normalized) {
        row.reviewStatus = 'NEEDS_REVIEW';
        row.note = 'Data Excel tidak lengkap, sudah dinormalisasi';
      }
    } catch (err) {
      row.reviewStatus = 'BLOCKED';
      row.note = err instanceof Error ? err.message : 'Data tidak valid.';
    }

    return row;
  });
}

/** Backward compatibility alias for legacy imports. */
export const parseAttendanceBiff = parseAttendanceWorkbook;
