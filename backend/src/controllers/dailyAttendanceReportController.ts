import { Request, Response } from 'express';
import { requireHrScope } from '../services/hrOrganizationScope';
import {
  getDailyAttendanceReport,
  upsertDailyAttendanceNote,
  getDepartmentRoster,
  saveDepartmentRoster,
} from '../services/dailyAttendanceReportService';

export async function getDailyAttendanceReportHandler(req: Request, res: Response): Promise<void> {
  try {
    const scope = requireHrScope(req as any);
    const workDate = String(req.query.date || '').trim() || new Date().toISOString().slice(0, 10);
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const highlightOnly = req.query.highlightOnly === 'true';

    const report = await getDailyAttendanceReport(scope, {
      workDate,
      departmentId,
      highlightOnly,
    });

    res.json({
      success: true,
      data: report,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message || 'Gagal memuat laporan absensi harian',
    });
  }
}

export async function upsertDailyAttendanceNoteHandler(req: Request, res: Response): Promise<void> {
  try {
    const scope = requireHrScope(req as any);
    const userId = (req as any).user?.id || 1;
    const { workDate, employeeId, isHighlighted, manualNote } = req.body || {};

    if (!workDate || !employeeId) {
      res.status(400).json({
        success: false,
        error: 'workDate dan employeeId wajib diisi',
      });
      return;
    }

    const updated = await upsertDailyAttendanceNote(
      scope,
      {
        workDate: String(workDate).trim(),
        employeeId: Number(employeeId),
        isHighlighted: isHighlighted !== undefined ? Boolean(isHighlighted) : undefined,
        manualNote: manualNote !== undefined ? String(manualNote) : undefined,
      },
      userId
    );

    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message || 'Gagal menyimpan catatan harian absensi',
    });
  }
}

export async function getDepartmentRosterHandler(req: Request, res: Response): Promise<void> {
  try {
    const scope = requireHrScope(req as any);
    const departmentId = Number(req.query.departmentId);

    if (!departmentId || isNaN(departmentId)) {
      res.status(400).json({
        success: false,
        error: 'Parameter departmentId wajib disertakan',
      });
      return;
    }

    const roster = await getDepartmentRoster(scope, departmentId);

    res.json({
      success: true,
      data: roster,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message || 'Gagal memuat susunan roster departemen',
    });
  }
}

export async function saveDepartmentRosterHandler(req: Request, res: Response): Promise<void> {
  try {
    const scope = requireHrScope(req as any);
    const userId = (req as any).user?.id || 1;
    const { departmentId, items } = req.body || {};

    if (!departmentId || !Array.isArray(items)) {
      res.status(400).json({
        success: false,
        error: 'departmentId dan items wajib disertakan',
      });
      return;
    }

    const result = await saveDepartmentRoster(scope, { departmentId: Number(departmentId), items }, userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message || 'Gagal menyimpan format susunan roster',
    });
  }
}
