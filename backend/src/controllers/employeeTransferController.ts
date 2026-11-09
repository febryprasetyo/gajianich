import { Request, Response } from 'express';
import { z } from 'zod';
import {
  executeEmployeeTransfer,
  getEmployeeTransferHistory,
  getOrganizationGroupsWithDepartments,
  EmployeeTransferError,
} from '../services/employeeTransferService';
import type { AuthenticatedRequest } from '../middleware/auth';

const transferSchema = z.object({
  targetGroupId: z.number().int().positive('Kelompok organisasi tujuan wajib dipilih'),
  targetDepartmentId: z.number().int().positive('Departemen tujuan wajib dipilih'),
  targetLocationId: z.number().int().positive().optional().nullable(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  reason: z.string().min(3, 'Alasan transfer minimal 3 karakter').max(1000),
});

export async function transferEmployee(req: Request, res: Response) {
  try {
    const employeeId = Number(req.params.id);
    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({ error: 'ID karyawan tidak valid' });
    }

    const parsed = transferSchema.parse(req.body);
    const result = await executeEmployeeTransfer(req as AuthenticatedRequest, employeeId, parsed);

    return res.status(200).json({
      success: true,
      message: `Karyawan berhasil ditransfer ke ${result.toGroup.name} (${result.toGroup.code})`,
      ...result,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi form gagal', details: err.issues });
    }
    if (err instanceof EmployeeTransferError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

export async function getEmployeeTransfers(req: Request, res: Response) {
  try {
    const employeeId = Number(req.params.id);
    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({ error: 'ID karyawan tidak valid' });
    }

    const history = await getEmployeeTransferHistory(employeeId);
    return res.status(200).json(history);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function getOrganizationTransferCandidates(req: Request, res: Response) {
  try {
    const data = await getOrganizationGroupsWithDepartments();
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

