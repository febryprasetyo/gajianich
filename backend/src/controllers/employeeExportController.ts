import {employeeScopePredicate,requireHrScope} from '../services/hrOrganizationScope';
import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { employees } from '../db/schema/employees';
import { departments, locations } from '../db/schema/master';
import { TALENTA_HEADERS, formatDateValue } from '../lib/employeeImport';

export async function generateEmployeesWorkbook(empList: any[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Worksheet');

  sheet.columns = TALENTA_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: Math.max(h.length + 4, 15),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Slate-800
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  empList.forEach((e) => {
    sheet.addRow({
      'Employee ID': e.employeeCode || '',
      'Full Name': e.fullName || '',
      'Barcode': e.barcode || e.employeeCode || '',
      'Organization': e.departmentName || '',
      'Job Position': e.position || '',
      'Job Level': e.jobLevel || '',
      'Join Date': formatDateValue(e.joinDate) || '',
      'Status Employee': e.employmentStatus || e.status || '',
      'Email': e.email || '',
      'Birth Date': formatDateValue(e.birthDate) || '',
      'Age': e.age || '',
      'Birth Place': e.birthPlace || '',
      'Citizen ID Address': e.citizenIdAddress || '',
      'Residential Address': e.residentialAddress || '',
      'NPWP': e.npwp || '',
      'PTKP Status': e.ptkpStatus || '',
      'Employee Tax Status': e.employeeTaxStatus || '',
      'Bank Name': e.bankName || '',
      'Bank Account': e.bankAccount || '',
      'Bank Account Holder': e.bankAccountHolder || '',
      'BPJS Ketenagakerjaan': e.bpjsKetenagakerjaan || '',
      'BPJS Kesehatan': e.bpjsKesehatan || '',
      'NIK (NPWP 16 Digit)': e.nikKtp || '',
      'Mobile Phone': e.mobilePhone || e.phone || '',
      'Phone': e.secondaryPhone || '',
      'Religion': e.religion || '',
      'Gender': e.gender || '',
      'Marital Status': e.maritalStatus || '',
      'Blood Type': e.bloodType || '',
      'Nationality Code': e.nationalityCode || '',
      'Currency': e.currency || 'IDR',
      'Length Of Service': e.lengthOfService || '',
      'NPWP 16 digit (new)': e.npwp16Digit || '',
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportEmployeesToExcel(req: Request, res: Response) {
  try {
    const statusFilter = req.query.status as string | undefined;

    let query = db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        fullName: employees.fullName,
        email: employees.email,
        phone: employees.phone,
        departmentId: employees.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        locationId: employees.locationId,
        locationName: locations.name,
        position: employees.position,
        status: employees.status,
        barcode: employees.barcode,
        jobLevel: employees.jobLevel,
        joinDate: employees.joinDate,
        employmentStatus: employees.employmentStatus,
        birthDate: employees.birthDate,
        age: employees.age,
        birthPlace: employees.birthPlace,
        citizenIdAddress: employees.citizenIdAddress,
        residentialAddress: employees.residentialAddress,
        npwp: employees.npwp,
        ptkpStatus: employees.ptkpStatus,
        employeeTaxStatus: employees.employeeTaxStatus,
        bankName: employees.bankName,
        bankAccount: employees.bankAccount,
        bankAccountHolder: employees.bankAccountHolder,
        bpjsKetenagakerjaan: employees.bpjsKetenagakerjaan,
        bpjsKesehatan: employees.bpjsKesehatan,
        nikKtp: employees.nikKtp,
        mobilePhone: employees.mobilePhone,
        secondaryPhone: employees.secondaryPhone,
        religion: employees.religion,
        gender: employees.gender,
        maritalStatus: employees.maritalStatus,
        bloodType: employees.bloodType,
        nationalityCode: employees.nationalityCode,
        currency: employees.currency,
        lengthOfService: employees.lengthOfService,
        npwp16Digit: employees.npwp16Digit,
        createdAt: employees.createdAt,
        updatedAt: employees.updatedAt,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(locations, eq(employees.locationId, locations.id));

    let list: any[] = [];
    if (statusFilter) {
      list = await query.where(and(eq(employees.status, statusFilter),employeeScopePredicate(requireHrScope(req as any))));
    } else {
      list = await query.where(employeeScopePredicate(requireHrScope(req as any)));
    }

    const buffer = await generateEmployeesWorkbook(list);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `gajianich-karyawan-aktif-${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to export employees to Excel' });
  }
}
