import {
  getAdmsMonitoringHandler,
  getAdmsReviewLogsHandler,
  requestAdmsHistoryHandler,
  getAdmsReadCommandsHandler,
  getAdmsCandidatesHandler,
  registerAdmsDeviceHandler,
  toggleAdmsDeviceHandler,
  syncAdmsToAttendanceHandler,
  resolveUnmappedPinHandler,
} from '../controllers/admsMonitoringController';
import {requireOrganizationScope} from '../middleware/organizationScope';
import { Router } from "express";
import { authenticateToken, requirePermission, requireRoles } from "../middleware/auth";
import {
  getAttendanceDevicesHandler,
  createAttendanceDeviceHandler,
  updateAttendanceDeviceHandler,
  deleteAttendanceDeviceHandler,
  connectAttendanceDeviceHandler,
  disconnectAttendanceDeviceHandler,
  syncAttendanceDeviceHandler,
  getRawAttendanceLogsHandler,
  calculateAttendanceHandler,
} from "../controllers/attendanceDeviceController";

const router = Router();

router.get(
  "/adms/monitor",
  authenticateToken,
  requirePermission(["attendance.import", "attendance.manage"]),
  requireOrganizationScope('hr', 'read'),
  getAdmsMonitoringHandler
);

router.get('/adms/review-logs', authenticateToken, requirePermission(['attendance.import', 'attendance.manage']), requireOrganizationScope('hr', 'read'), getAdmsReviewLogsHandler);
router.get('/adms/read-commands', authenticateToken, requirePermission(['attendance.import', 'attendance.manage']), requireOrganizationScope('hr', 'read'), getAdmsReadCommandsHandler);

// Sinkronisasi Hybrid ADMS ke Daftar Absensi & Pemetaan PIN Manual oleh HR
router.post('/adms/sync-to-attendance', authenticateToken, requirePermission(['attendance.import', 'attendance.manage']), requireOrganizationScope('hr', 'write'), syncAdmsToAttendanceHandler);
router.post('/adms/resolve-unmapped', authenticateToken, requirePermission(['attendance.manage']), requireOrganizationScope('hr', 'write'), resolveUnmappedPinHandler);

// Manajemen Mesin ADMS: Hanya SuperAdmin & ITAdmin
router.get('/adms/candidates', authenticateToken, requireRoles('SuperAdmin', 'ITAdmin'), requireOrganizationScope('hr', 'read'), getAdmsCandidatesHandler);
router.post('/adms/register', authenticateToken, requireRoles('SuperAdmin', 'ITAdmin'), requireOrganizationScope('hr', 'write'), registerAdmsDeviceHandler);
router.patch('/adms/:id/toggle', authenticateToken, requireRoles('SuperAdmin', 'ITAdmin'), requireOrganizationScope('hr', 'write'), toggleAdmsDeviceHandler);
router.post('/adms/:id/history', authenticateToken, requireRoles('SuperAdmin', 'ITAdmin'), requireOrganizationScope('hr', 'write'), requestAdmsHistoryHandler);

// Device CRUD: Hanya SuperAdmin & ITAdmin yang dapat membuat, mengubah, atau menghapus mesin absensi
router.get(
  "/",
  authenticateToken,
  requirePermission(["attendance.view", "attendance.manage"]),
  requireOrganizationScope('hr', 'read'),
  getAttendanceDevicesHandler
);

router.post(
  "/",
  authenticateToken,
  requireRoles('SuperAdmin', 'ITAdmin'),
  requireOrganizationScope('hr', 'write'),
  createAttendanceDeviceHandler
);

router.put(
  "/:id",
  authenticateToken,
  requireRoles('SuperAdmin', 'ITAdmin'),
  requireOrganizationScope('hr', 'write'),
  updateAttendanceDeviceHandler
);

router.delete(
  "/:id",
  authenticateToken,
  requireRoles('SuperAdmin', 'ITAdmin'),
  requireOrganizationScope('hr', 'write'),
  deleteAttendanceDeviceHandler
);

router.post(
  "/:id/connect",
  authenticateToken,
  requirePermission(["attendance.manage", "attendance.import"]),
  requireOrganizationScope('hr', 'write'),
  connectAttendanceDeviceHandler
);

router.post(
  "/:id/disconnect",
  authenticateToken,
  requirePermission(["attendance.manage", "attendance.import"]),
  requireOrganizationScope('hr', 'write'),
  disconnectAttendanceDeviceHandler
);

router.post(
  "/:id/sync",
  authenticateToken,
  requirePermission(["attendance.manage", "attendance.import"]),
  requireOrganizationScope('hr', 'write'),
  syncAttendanceDeviceHandler
);

// Raw Logs Query
router.get(
  "/raw-logs/query",
  authenticateToken,
  requirePermission(["attendance.view", "attendance.manage"]),
  requireOrganizationScope('hr', 'read'),
  getRawAttendanceLogsHandler
);

// Shift Calculation
router.post(
  "/calculate",
  authenticateToken,
  requirePermission(["attendance.manage"]),
  requireOrganizationScope('hr', 'read'),
  calculateAttendanceHandler
);

export default router;
