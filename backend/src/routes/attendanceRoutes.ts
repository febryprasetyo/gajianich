import {requireOrganizationScope} from '../middleware/organizationScope';
import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import {
  getAttendanceRecords,
  getAttendanceBatches,
  commitAttendanceBatch,
  saveAttendanceRecord,
  getAttendanceActivity,
} from '../controllers/attendanceController';
import {
  getAttendanceWorkspace,
  postAttendanceCommand,
} from '../controllers/attendanceCommandController';
import {
  getDailyAttendanceReportHandler,
  upsertDailyAttendanceNoteHandler,
} from '../controllers/dailyAttendanceReportController';

const router = Router();

// Daily Attendance Report (Print Landscape)
router.get(
  '/daily-report',
  authenticateToken,
  requirePermission(['attendance.view', 'attendance.manage', 'attendance.import']),
  requireOrganizationScope('hr', 'read'),
  getDailyAttendanceReportHandler
);

router.post(
  '/daily-report/note',
  authenticateToken,
  requirePermission(['attendance.manage']),
  requireOrganizationScope('hr', 'write'),
  upsertDailyAttendanceNoteHandler
);

// Workspace & Commands (Server-backed Attendance Workspace)
router.get(
  '/workspace',
  authenticateToken,
  requirePermission(['attendance.view', 'attendance.manage', 'attendance.import']),
  requireOrganizationScope('hr', 'read'),
  getAttendanceWorkspace
);

router.post(
  '/commands',
  authenticateToken,
  requirePermission(['attendance.view', 'attendance.manage', 'attendance.import']),
  requireOrganizationScope('hr', 'write'),
  postAttendanceCommand
);

// Read operations
router.get(
  '/records',
  authenticateToken,
  requirePermission(['attendance.view', 'attendance.manage', 'attendance.import']),
  requireOrganizationScope('hr', 'read'),
  getAttendanceRecords
);

router.get(
  '/batches',
  authenticateToken,
  requirePermission(['attendance.view', 'attendance.manage', 'attendance.import']),
  requireOrganizationScope('hr', 'read'),
  getAttendanceBatches
);

router.get(
  '/activity',
  authenticateToken,
  requirePermission(['attendance.view', 'attendance.manage', 'attendance.import']),
  requireOrganizationScope('hr', 'read'),
  getAttendanceActivity
);

router.put(
  '/records',
  authenticateToken,
  requirePermission(['attendance.manage']),
  requireOrganizationScope('hr', 'write'),
  saveAttendanceRecord
);

// Commit batch import operation
router.post(
  '/commit-batch',
  authenticateToken,
  requirePermission(['attendance.import', 'attendance.manage']),
  requireOrganizationScope('hr', 'write'),
  commitAttendanceBatch
);

export default router;
