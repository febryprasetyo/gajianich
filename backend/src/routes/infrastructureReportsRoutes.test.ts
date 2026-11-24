import assert from 'node:assert/strict';
import test from 'node:test';
import router from './infrastructureRoutes';
import {
  getWeeklyReports,
  downloadWeeklyReport,
  generateWeeklyReportOnDemand,
} from '../controllers/infrastructureController';

function registeredMethods(path: string): string[] {
  const stack = (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;
  return stack
    .filter((item) => item.route?.path === path)
    .flatMap((item) => Object.keys(item.route!.methods).filter((method) => item.route!.methods[method]));
}

test('infrastructure routes register weekly report endpoints', () => {
  assert.deepEqual(registeredMethods('/reports'), ['get'], 'GET /reports must be registered');
  assert.deepEqual(registeredMethods('/reports/:id/download'), ['get'], 'GET /reports/:id/download must be registered');
  assert.deepEqual(registeredMethods('/reports/generate'), ['post'], 'POST /reports/generate must be registered');
});

test('infrastructureController exports weekly report handlers', () => {
  assert.equal(typeof getWeeklyReports, 'function', 'getWeeklyReports must be a function');
  assert.equal(typeof downloadWeeklyReport, 'function', 'downloadWeeklyReport must be a function');
  assert.equal(typeof generateWeeklyReportOnDemand, 'function', 'generateWeeklyReportOnDemand must be a function');
});

test('generateWeeklyReportOnDemand responds with 202 Accepted for Node and Cluster scope', async () => {
  let statusCode = 0;
  let jsonBody: any = null;

  const mockReq: any = {
    body: { scope: 'CLUSTER' },
  };

  const mockRes: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      jsonBody = body;
      return this;
    },
  };

  await generateWeeklyReportOnDemand(mockReq, mockRes);
  assert.equal(statusCode, 202);
  assert.equal(jsonBody?.success, true);
  assert.ok(jsonBody?.message?.includes('dimulai'));
});

test('getWeeklyReports returns 8 sections and supports scope filter', async () => {
  let statusCode = 0;
  let jsonBody: any = null;

  const mockReq: any = {
    query: { limit: 10, scope: 'CLUSTER' },
  };

  const mockRes: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      jsonBody = body;
      return this;
    },
  };

  await getWeeklyReports(mockReq, mockRes);
  assert.equal(statusCode, 200);
  assert.equal(jsonBody?.success, true);
  assert.ok(Array.isArray(jsonBody?.data));
  if (jsonBody.data.length > 0) {
    const report = jsonBody.data[0];
    assert.equal(report.scopeType, 'CLUSTER');
    assert.ok(report.slaPercent);
    assert.ok(report.serviceAvailability !== undefined);
    assert.ok(report.resourceMetrics !== undefined);
    assert.ok(report.databaseMiddleware !== undefined);
    assert.ok(report.securityAudit !== undefined);
    assert.ok(report.backupDr !== undefined);
    assert.ok(Array.isArray(report.incidentsMaintenance));
    assert.ok(Array.isArray(report.actionItems));
  }
});

test('downloadWeeklyReport serves physical PDF file from storage or backend sync', async () => {
  let downloadedPath = '';
  let downloadedFileName = '';

  const mockReq: any = {
    params: { id: 9 }, // Existing generated report id
  };

  const mockRes: any = {
    status() {
      return this;
    },
    json() {
      return this;
    },
    download(filePath: string, fileName?: string) {
      downloadedPath = filePath;
      downloadedFileName = fileName || '';
      return this;
    },
  };

  await downloadWeeklyReport(mockReq, mockRes);
  assert.ok(downloadedPath.length > 0, 'Must provide downloadable file path');
  assert.ok(downloadedFileName.endsWith('.pdf'), 'Downloaded file must be a PDF');
});
