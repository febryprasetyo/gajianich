import { WeeklyReportDetail } from '@/components/servers/ReportDetailModal';

export interface ReportStats {
  total: number;
  normal: number;
  warning: number;
  critical: number;
}

export function calculateReportStats(reports: WeeklyReportDetail[]): ReportStats {
  const total = reports.length;
  let normal = 0;
  let warning = 0;
  let critical = 0;

  for (const r of reports) {
    if (r.status === 'NORMAL') normal++;
    else if (r.status === 'WARNING') warning++;
    else if (r.status === 'CRITICAL') critical++;
  }

  return { total, normal, warning, critical };
}

export function formatFileSizeBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function filterWeeklyReports(
  reports: WeeklyReportDetail[],
  search = '',
  serverFilter = 'all',
  statusFilter = 'all'
): WeeklyReportDetail[] {
  const q = search.trim().toLowerCase();

  return reports.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) {
      return false;
    }
    if (
      serverFilter !== 'all' &&
      String(r.serverId) !== serverFilter &&
      r.serverCode !== serverFilter
    ) {
      return false;
    }
    if (q) {
      const matchCode = r.serverCode?.toLowerCase().includes(q);
      const matchName = r.serverName?.toLowerCase().includes(q);
      const matchWeek = r.periodWeek?.toLowerCase().includes(q);
      const matchSummary = r.executiveSummary?.toLowerCase().includes(q);
      const matchRca = r.incidentRca?.toLowerCase().includes(q);
      if (!matchCode && !matchName && !matchWeek && !matchSummary && !matchRca) {
        return false;
      }
    }
    return true;
  });
}
