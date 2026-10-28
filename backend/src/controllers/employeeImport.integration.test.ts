import { test } from 'node:test';
import assert from 'node:assert';
import {
  downloadEmployeeTemplate,
  previewEmployeeImport,
  commitEmployeeImport,
} from './employeeImportController';
import { buildEmployeeImportTemplate } from '../lib/employeeImport';

test('downloadEmployeeTemplate sets XLSX headers and sends binary buffer', async () => {
  let headers: Record<string, string> = {};
  let statusCode = 0;
  let sentData: any = null;

  const req: any = {};
  const res: any = {
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    send: (data: any) => {
      sentData = data;
      return res;
    },
    json: (data: any) => {
      sentData = data;
      return res;
    },
  };

  await downloadEmployeeTemplate(req, res);
  assert.strictEqual(statusCode, 200);
  assert.ok(headers['content-type'].includes('spreadsheetml'));
  assert.ok(headers['content-disposition'].includes('gajianich-employee-import-template.xlsx'));
  assert.ok(Buffer.isBuffer(sentData));
});

test('previewEmployeeImport returns 400 when no file is uploaded', async () => {
  let statusCode = 0;
  let jsonResponse: any = null;

  const req: any = { file: null };
  const res: any = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      jsonResponse = data;
      return res;
    },
  };

  await previewEmployeeImport(req, res);
  assert.strictEqual(statusCode, 400);
  assert.ok(jsonResponse.error.includes('No XLSX file uploaded'));
});

test('commitEmployeeImport returns 400 when no file is uploaded', async () => {
  let statusCode = 0;
  let jsonResponse: any = null;

  const req: any = { file: null };
  const res: any = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      jsonResponse = data;
      return res;
    },
  };

  await commitEmployeeImport(req, res);
  assert.strictEqual(statusCode, 400);
  assert.ok(jsonResponse.error.includes('No XLSX file uploaded'));
});
