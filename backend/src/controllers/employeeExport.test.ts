import { test } from 'node:test';
import assert from 'node:assert';
import ExcelJS from 'exceljs';
import { exportEmployeesToExcel, generateEmployeesWorkbook } from './employeeExportController';
import { TALENTA_HEADERS } from '../lib/employeeImport';

test('generateEmployeesWorkbook builds workbook with 33 Talenta columns', async () => {
  const mockEmployees = [
    {
      id: 1,
      employeeCode: '30002',
      fullName: 'ABDUL AZIZ ZA',
      barcode: '30002',
      departmentName: 'CMC III',
      position: 'STAFF',
      jobLevel: 'Staff',
      joinDate: '2017-10-11',
      employmentStatus: 'Kontrak',
      email: 'ABDULAZIZZA501@GMAIL.COM',
      birthDate: '1995-08-14',
      age: '31 Year 1 Month 12 Day',
      birthPlace: null,
      citizenIdAddress: null,
      residentialAddress: null,
      npwp: null,
      ptkpStatus: 'K/0',
      employeeTaxStatus: 'Pegawai Tetap',
      bankName: 'BNI',
      bankAccount: '0589718952',
      bankAccountHolder: 'ABDUL AZIZ ZA',
      bpjsKetenagakerjaan: '123',
      bpjsKesehatan: '123',
      nikKtp: null,
      mobilePhone: '085711342895',
      secondaryPhone: null,
      religion: 'Islam',
      gender: 'Male',
      maritalStatus: 'Married',
      bloodType: null,
      nationalityCode: null,
      currency: 'IDR',
      lengthOfService: '8 Year 11 Month 15 Day',
      npwp16Digit: null,
    },
  ];

  const buffer = await generateEmployeesWorkbook(mockEmployees);
  assert.ok(Buffer.isBuffer(buffer));

  const wb = new ExcelJS.Workbook();
  // @ts-ignore
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  assert.ok(sheet);

  const row1Values = sheet.getRow(1).values.slice(1);
  assert.strictEqual(row1Values.length, 33);
  assert.deepStrictEqual(row1Values, TALENTA_HEADERS);

  const row2Values = sheet.getRow(2).values.slice(1);
  assert.strictEqual(row2Values[0], '30002');
  assert.strictEqual(row2Values[1], 'ABDUL AZIZ ZA');
  assert.strictEqual(row2Values[3], 'CMC III');
  assert.strictEqual(row2Values[8], 'ABDULAZIZZA501@GMAIL.COM');
});

test('exportEmployeesToExcel sets attachment headers', async () => {
  let headers: Record<string, string> = {};
  let statusCode = 0;
  let sentData: any = null;

  const req: any = { query: {},organizationScope:{module:'hr',groupIds:[],selectedGroupId:null,includeUnmapped:true} };
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
  };

  await exportEmployeesToExcel(req, res);
  assert.strictEqual(statusCode, 200);
  assert.ok(headers['content-type'].includes('spreadsheetml'));
  assert.ok(headers['content-disposition'].includes('gajianich-karyawan-aktif'));
  assert.ok(Buffer.isBuffer(sentData));
});
