import { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { db } from '../db';
import { employees } from '../db/schema/employees';
import { departments } from '../db/schema/master';
import { auditLogs } from '../db/schema/system';
import {
  parseEmployeeWorkbook,
  validateEmployeeImport,
  buildEmployeeImportTemplate,
  EmployeeImportLookups,
} from '../lib/employeeImport';
import { resolveAuditContext, appendHrAudit } from '../services/hrAudit';
import { runHrMutation } from '../services/hrMutation';
import { hashRequestPayload } from '../domain/hrAudit';

export async function downloadEmployeeTemplate(_req: Request, res: Response) {
  try {
    const buffer = await buildEmployeeImportTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="gajianich-employee-import-template.xlsx"');
    return res.status(200).send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate template' });
  }
}

async function loadEmployeeImportLookups(runner: any): Promise<{
  lookups: EmployeeImportLookups;
  deptMap: Map<string, number>;
}> {
  const [empRows, deptRows] = await Promise.all([
    runner.select({ code: employees.employeeCode, email: employees.email }).from(employees),
    runner.select({ id: departments.id, name: departments.name, code: departments.code }).from(departments),
  ]);

  const existingEmployeeCodes = new Set<string>();
  const existingEmails = new Set<string>();
  const existingDepartmentNames = new Set<string>();
  const deptMap = new Map<string, number>();

  empRows.forEach((r: any) => {
    if (r.code) existingEmployeeCodes.add(String(r.code).trim().toUpperCase());
    if (r.email) existingEmails.add(String(r.email).trim().toLowerCase());
  });

  deptRows.forEach((d: any) => {
    if (d.name) {
      existingDepartmentNames.add(d.name);
      deptMap.set(d.name.trim().toUpperCase(), d.id);
    }
  });

  return {
    lookups: {
      existingEmployeeCodes,
      existingEmails,
      existingDepartmentNames,
    },
    deptMap,
  };
}

export async function previewEmployeeImport(req: Request, res: Response) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No XLSX file uploaded. Ensure multipart field name is "file".' });
    }

    let rows;
    try {
      rows = await parseEmployeeWorkbook(req.file.buffer);
    } catch (parseErr: any) {
      return res.status(400).json({ error: parseErr.message || 'Failed to parse XLSX workbook' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File Excel kosong atau tidak memiliki baris data karyawan' });
    }

    const { lookups } = await loadEmployeeImportLookups(db);
    const validationResult = validateEmployeeImport(rows, lookups);

    return res.status(200).json(validationResult);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

function generateDepartmentCode(deptName: string, existingCodes: Set<string>): string {
  let base = deptName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 16);
  if (!base) base = 'DEPT';
  let candidate = base;
  let counter = 1;
  while (existingCodes.has(candidate)) {
    candidate = `${base.slice(0, 14)}-${counter}`;
    counter++;
  }
  existingCodes.add(candidate);
  return candidate;
}

export async function commitEmployeeImport(req: Request, res: Response) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No XLSX file uploaded. Ensure multipart field name is "file".' });
    }

    let rows;
    try {
      rows = await parseEmployeeWorkbook(req.file.buffer);
    } catch (parseErr: any) {
      return res.status(400).json({ error: parseErr.message || 'Failed to parse XLSX workbook' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File Excel kosong atau tidak memiliki baris data karyawan' });
    }

    const executeImport = async (tx: any) => {
      const { lookups, deptMap } = await loadEmployeeImportLookups(tx);
      const validation = validateEmployeeImport(rows, lookups);

      if (!validation.valid || validation.summary.errorCount > 0) {
        throw new Error(`Validation failed: ${validation.summary.errorCount} error(s) found in workbook`);
      }

      // Existing department codes for generating unique codes
      const existingCodes = new Set<string>();
      const existingDepts = await tx.select({ code: departments.code }).from(departments);
      existingDepts.forEach((d: any) => existingCodes.add(d.code));

      // Auto-create new departments
      let createdDeptCount = 0;
      for (const deptName of validation.summary.newDepartments) {
        const code = generateDepartmentCode(deptName, existingCodes);
        const [insertedDept] = await tx
          .insert(departments)
          .values({
            name: deptName,
            code,
          })
          .returning({ id: departments.id });
        deptMap.set(deptName.trim().toUpperCase(), insertedDept.id);
        createdDeptCount++;
      }

      // Insert employees
      for (const r of rows) {
        const deptId = r.organization ? deptMap.get(r.organization.trim().toUpperCase()) || null : null;
        await tx.insert(employees).values({
          employeeCode: r.employeeCode,
          fullName: r.fullName,
          email: r.email,
          phone: r.mobilePhone || r.secondaryPhone || null,
          departmentId: deptId,
          position: r.position || null,
          status: 'Active',
          barcode: r.barcode || null,
          jobLevel: r.jobLevel || null,
          joinDate: r.joinDate || null,
          employmentStatus: r.employmentStatus || null,
          birthDate: r.birthDate || null,
          age: r.age || null,
          birthPlace: r.birthPlace || null,
          citizenIdAddress: r.citizenIdAddress || null,
          residentialAddress: r.residentialAddress || null,
          npwp: r.npwp || null,
          ptkpStatus: r.ptkpStatus || null,
          employeeTaxStatus: r.employeeTaxStatus || null,
          bankName: r.bankName || null,
          bankAccount: r.bankAccount || null,
          bankAccountHolder: r.bankAccountHolder || null,
          bpjsKetenagakerjaan: r.bpjsKetenagakerjaan || null,
          bpjsKesehatan: r.bpjsKesehatan || null,
          nikKtp: r.nikKtp || null,
          mobilePhone: r.mobilePhone || null,
          secondaryPhone: r.secondaryPhone || null,
          religion: r.religion || null,
          gender: r.gender || null,
          maritalStatus: r.maritalStatus || null,
          bloodType: r.bloodType || null,
          nationalityCode: r.nationalityCode || null,
          currency: r.currency || 'IDR',
          lengthOfService: r.lengthOfService || null,
          npwp16Digit: r.npwp16Digit || null,
        });
      }

      return {
        importedCount: rows.length,
        createdDepartmentsCount: createdDeptCount,
      };
    };

    if ((req as any).user) {
      const context = await resolveAuditContext(req as any);
      const fileChecksum = createHash('sha256').update(req.file.buffer).digest('hex');
      const requestHash = hashRequestPayload({ command: 'employee.import', count: rows.length, checksum: fileChecksum });

      const result = await runHrMutation(context, requestHash, async (tx) => {
        const importSummary = await executeImport(tx);

        await appendHrAudit(tx, {
          operationId: context.operationId,
          actor: context.actor,
          action: 'IMPORT',
          entityType: 'employee',
          entityId: null,
          entityLabel: `Batch Import (${importSummary.importedCount} karyawan)`,
          outcome: 'SUCCESS',
          summary: `Berhasil mengimpor ${importSummary.importedCount} data karyawan dan menambahkan ${importSummary.createdDepartmentsCount} departemen baru`,
          metadata: {
            importedCount: importSummary.importedCount,
            createdDepartmentsCount: importSummary.createdDepartmentsCount,
          },
        });

        return {
          message: `Successfully imported ${importSummary.importedCount} employees`,
          importedCount: importSummary.importedCount,
          createdDepartmentsCount: importSummary.createdDepartmentsCount,
        };
      });

      return res.status(200).json(result);
    }

    // Fallback for unauthenticated legacy test calls
    const userId = (req as any).user?.userId ?? (req as any).user?.id ?? 1;
    const result = await db.transaction(async (tx) => {
      const importSummary = await executeImport(tx);

      await tx.insert(auditLogs).values({
        userId,
        action: 'IMPORT',
        entity: 'employees',
        entityId: 0,
        newValues: {
          importedCount: importSummary.importedCount,
          createdDepartmentsCount: importSummary.createdDepartmentsCount,
        },
      });

      return {
        message: `Successfully imported ${importSummary.importedCount} employees`,
        importedCount: importSummary.importedCount,
        createdDepartmentsCount: importSummary.createdDepartmentsCount,
      };
    });

    return res.status(200).json(result);
  } catch (err: any) {
    if (err.message && err.message.startsWith('Validation failed')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}
