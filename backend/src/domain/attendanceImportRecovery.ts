import { resolveImportEmployee } from './attendanceImportMapping';

interface RecoveryRow {
  id: number; batchId: number; sourceId: number; employeeId: number | null;
  externalNoId: string; workDate: string; reviewStatus: string;
  scanIn: string | null; scanOut: string | null; issues: string[] | null;
}
export function planImportRecovery<T extends RecoveryRow>(
  input: T[],
  employees: Parameters<typeof resolveImportEmployee>[2],
  identities: Parameters<typeof resolveImportEmployee>[3],
  existing: { employeeId: number; workDate: string }[],
  lockedDates: string[],
) {
  const key = (r: { employeeId: number | null; workDate: string }) => `${r.employeeId}:${r.workDate}`;
  const occupied = new Set(existing.map(key));
  const locked = new Set(lockedDates);
  const rows = input.map(r => ({ ...r, employeeId: r.employeeId ?? resolveImportEmployee(r.externalNoId, r.sourceId, employees, identities) }));
  const groups = new Map<string, typeof rows>();
  const validTime = (s: string | null) => Boolean(s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s));
  for (const row of rows) {
    if (!row.employeeId || occupied.has(key(row)) || locked.has(row.workDate)) continue;
    const group = groups.get(key(row)) ?? [];
    group.push(row);
    groups.set(key(row), group);
  }
  const candidates: typeof rows = [];
  for (const group of groups.values()) {
    const latest = Math.max(...group.map(r => r.batchId));
    const current = group.filter(r => r.batchId === latest);
    if (current.length !== 1) continue;
    const row = current[0];
    if (row.reviewStatus === 'READY' && !row.issues?.length && validTime(row.scanIn) && validTime(row.scanOut)) candidates.push(row);
  }
  return { rows, candidates };
}
