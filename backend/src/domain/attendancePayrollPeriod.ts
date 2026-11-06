export function attendancePayrollPeriod(workDate: string, period: 'CURRENT' | 'PREVIOUS' = 'CURRENT') {
  const [year, month, day] = workDate.split('-').map(Number);
  const offset = (day < 21 ? -1 : 0) + (period === 'PREVIOUS' ? -1 : 0);
  const start = new Date(Date.UTC(year, month - 1 + offset, 21, 12));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 20, 12));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start),
  };
}
