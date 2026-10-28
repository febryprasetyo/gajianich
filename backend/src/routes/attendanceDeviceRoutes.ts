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

// Device CRUD & Operations
router.get(
  "/",
  authenticateToken,
  requirePermission(["attendance.view", "attendance.manage"]),
  getAttendanceDevicesHandler
);

router.post(
  "/",
  authenticateToken,
  requirePermission(["attendance.manage"]),
  createAttendanceDeviceHandler
);

router.put(
  "/:id",
  authenticateToken,
  requirePermission(["attendance.manage"]),
  updateAttendanceDeviceHandler
);

router.delete(
  "/:id",
  authenticateToken,
  requirePermission(["attendance.manage"]),
  deleteAttendanceDeviceHandler
);

router.post(
  "/:id/connect",
  authenticateToken,
  requirePermission(["attendance.manage", "attendance.import"]),
  connectAttendanceDeviceHandler
);

router.post(
  "/:id/disconnect",
  authenticateToken,
  requirePermission(["attendance.manage", "attendance.import"]),
  disconnectAttendanceDeviceHandler
);

router.post(
  "/:id/sync",
  authenticateToken,
  requirePermission(["attendance.manage", "attendance.import"]),
  syncAttendanceDeviceHandler
);

// Raw Logs Query
router.get(
  "/raw-logs/query",
  authenticateToken,
  requirePermission(["attendance.view", "attendance.manage"]),
  getRawAttendanceLogsHandler
);

// Shift Calculation
router.post(
  "/calculate",
  authenticateToken,
  requirePermission(["attendance.manage"]),
  calculateAttendanceHandler
);

export default router;
