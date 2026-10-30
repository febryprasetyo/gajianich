import {
  getAdmsMonitoringHandler,
  getAdmsReviewLogsHandler,
  requestAdmsHistoryHandler,
  getAdmsReadCommandsHandler,
  getAdmsCandidatesHandler,
  registerAdmsDeviceHandler,
  toggleAdmsDeviceHandler,
} from '../controllers/admsMonitoringController';
import {requireOrganizationScope} from '../middleware/organizationScope';
import { Router } from "express";
import { authenticateToken, requirePermission } from "../middleware/auth";
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

router.get('/adms/review-logs',authenticateToken,requirePermission(['attendance.import','attendance.manage']),requireOrganizationScope('hr','read'),getAdmsReviewLogsHandler);
router.get('/adms/read-commands',authenticateToken,requirePermission(['attendance.import','attendance.manage']),requireOrganizationScope('hr','read'),getAdmsReadCommandsHandler);
router.get('/adms/candidates',authenticateToken,requirePermission(['attendance.manage']),requireOrganizationScope('hr','read'),getAdmsCandidatesHandler);
router.post('/adms/register',authenticateToken,requirePermission(['attendance.manage']),requireOrganizationScope('hr','write'),registerAdmsDeviceHandler);
router.patch('/adms/:id/toggle',authenticateToken,requirePermission(['attendance.manage']),requireOrganizationScope('hr','write'),toggleAdmsDeviceHandler);
router.post('/adms/:id/history',authenticateToken,requirePermission(['attendance.import','attendance.manage']),requireOrganizationScope('hr','write'),requestAdmsHistoryHandler);

// Device CRUD & Operations
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
  requirePermission(["attendance.manage"]),
  requireOrganizationScope('hr', 'write'),
  createAttendanceDeviceHandler
);

router.put(
  "/:id",
  authenticateToken,
  requirePermission(["attendance.manage"]),
  requireOrganizationScope('hr', 'write'),
  updateAttendanceDeviceHandler
);

router.delete(
  "/:id",
  authenticateToken,
  requirePermission(["attendance.manage"]),
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
