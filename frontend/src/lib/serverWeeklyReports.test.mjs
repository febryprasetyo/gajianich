import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateReportStats,
  formatFileSizeBytes,
  filterWeeklyReports,
} from './serverWeeklyReports.ts';

const mockReports = [
  {
    id: 1,
    serverId: 161637,
    serverCode: 'srv-dev-cmc',
    serverName: 'Development Server',
    periodWeek: '2026-W48',
    startDate: '2026-11-17',
    endDate: '2026-11-24',
    status: 'NORMAL',
    executiveSummary: 'Sistem beroperasi normal tanpa kendala.',
    incidentRca: null,
    recommendations: [],
    pdfFileName: 'Laporan-Mingguan-srv-dev-cmc-2026-W48.pdf',
    fileSizeBytes: 177726,
    generatedBy: 'CLI_ON_DEMAND',
    createdAt: '2026-11-24T10:00:00Z',
  },
  {
    id: 2,
    serverId: 137021,
    serverCode: 'srv-prod-node-01',
    serverName: 'Host Server',
    periodWeek: '2026-W48',
    startDate: '2026-11-17',
    endDate: '2026-11-24',
    status: 'WARNING',
    executiveSummary: 'Lonjakan RAM terdeteksi di atas 85%.',
    incidentRca: 'Beban query database tinggi.',
    recommendations: [],
    pdfFileName: 'Laporan-Mingguan-srv-prod-node-01-2026-W48.pdf',
    fileSizeBytes: 234535,
    generatedBy: 'GEMINI_AI_SCHEDULER',
    createdAt: '2026-11-24T10:05:00Z',
  },
  {
    id: 3,
    serverId: 137021,
    serverCode: 'srv-prod-node-01',
    serverName: 'Host Server',
    periodWeek: '2026-W47',
    startDate: '2026-11-10',
    endDate: '2026-11-17',
    status: 'CRITICAL',
    executiveSummary: 'Docker restart 10 kali.',
    incidentRca: 'OOM killer.',
    recommendations: [],
    pdfFileName: 'Laporan-Mingguan-srv-prod-node-01-2026-W47.pdf',
    fileSizeBytes: 240000,
    generatedBy: 'GEMINI_AI_SCHEDULER',
    createdAt: '2026-11-17T10:00:00Z',
  },
];

test('calculateReportStats accurately counts total, normal, warning, and critical', () => {
  const stats = calculateReportStats(mockReports);
  assert.equal(stats.total, 3);
  assert.equal(stats.normal, 1);
  assert.equal(stats.warning, 1);
  assert.equal(stats.critical, 1);
});

test('formatFileSizeBytes formats bytes to KB and MB', () => {
  assert.equal(formatFileSizeBytes(0), '0 KB');
  assert.equal(formatFileSizeBytes(177726), '173.6 KB');
  assert.equal(formatFileSizeBytes(2097152), '2.0 MB');
});

test('filterWeeklyReports filters by status, server, and search query', () => {
  const normalOnly = filterWeeklyReports(mockReports, '', 'all', 'NORMAL');
  assert.equal(normalOnly.length, 1);
  assert.equal(normalOnly[0].serverCode, 'srv-dev-cmc');

  const prodOnly = filterWeeklyReports(mockReports, '', '137021', 'all');
  assert.equal(prodOnly.length, 2);

  const searchWeek47 = filterWeeklyReports(mockReports, 'W47', 'all', 'all');
  assert.equal(searchWeek47.length, 1);
  assert.equal(searchWeek47[0].periodWeek, '2026-W47');

  const searchSummary = filterWeeklyReports(mockReports, 'OOM killer', 'all', 'all');
  assert.equal(searchSummary.length, 1);
});
