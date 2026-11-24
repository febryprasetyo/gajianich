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

test('generateWeeklyReportOnDemand responds with 202 Accepted', async () => {
  let statusCode = 0;
  let jsonBody: any = null;

  const mockReq: any = {
    body: { serverId: 161637 },
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
