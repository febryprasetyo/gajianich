import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { serverWeeklyReports } from './infrastructure';

test('serverWeeklyReports schema defines correct column structure and nullability', () => {
  assert.ok(serverWeeklyReports, 'serverWeeklyReports table must be defined');
  assert.equal(serverWeeklyReports.serverId.notNull, true, 'serverId must be not null');
  assert.equal(serverWeeklyReports.periodWeek.notNull, true, 'periodWeek must be not null');
  assert.equal(serverWeeklyReports.startDate.notNull, true, 'startDate must be not null');
  assert.equal(serverWeeklyReports.endDate.notNull, true, 'endDate must be not null');
  assert.equal(serverWeeklyReports.status.notNull, true, 'status must be not null');
  assert.equal(serverWeeklyReports.pdfFileName.notNull, true, 'pdfFileName must be not null');
  assert.equal(serverWeeklyReports.pdfFilePath.notNull, true, 'pdfFilePath must be not null');
  assert.equal(serverWeeklyReports.fileSizeBytes.notNull, true, 'fileSizeBytes must be not null');
  assert.equal(serverWeeklyReports.generatedBy.notNull, true, 'generatedBy must be not null');
  assert.equal(serverWeeklyReports.createdAt.notNull, true, 'createdAt must be not null');
});

test('serverWeeklyReports migration 0059_server_weekly_reports.sql is registered in journal', () => {
  const journalPath = resolve(__dirname, '../../../drizzle/meta/_journal.json');
  assert.ok(existsSync(journalPath), 'Drizzle journal must exist');

  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>;
  };

  const entry = journal.entries.find((e) => e.tag === '0059_server_weekly_reports');
  assert.ok(entry, 'Journal must contain 0059_server_weekly_reports migration tag');

  const sqlPath = resolve(__dirname, '../../../drizzle/0059_server_weekly_reports.sql');
  assert.ok(existsSync(sqlPath), 'Migration SQL file 0059_server_weekly_reports.sql must exist');

  const sql = readFileSync(sqlPath, 'utf8');
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS "server_weekly_reports"'), 'SQL must create server_weekly_reports table');
  assert.ok(sql.includes('idx_server_weekly_reports_server_period'), 'SQL must create index on server and period');
});
