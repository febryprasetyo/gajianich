import {requireOrganizationScope} from '../middleware/organizationScope';
import { Router } from "express";
import { authenticateToken, requirePermission } from "../middleware/auth";
import mobileApprovalRoutes from './mobileApprovalRoutes';
import { db } from "../db";
import { attendanceSelfLogs } from "../db/schema/attendanceSelfLogs";
import { eq } from "drizzle-orm";
import {
  getTodaySummaryController,
  clockAttendanceController,
  getAttendanceHistoryController,
  enrollFaceController,
  getFaceProfileController,
  getVerificationsController,
  verifyAttendanceController,
} from "../controllers/mobileAttendanceController";

const router = Router();
router.use(mobileApprovalRoutes);

async function resolveLogGroupForVerify(req: any, _res: any, next: any) {
  try {
    if (!req.headers['x-organization-group-id'] && !req.body?.groupId && req.body?.logId) {
      const logId = Number(req.body.logId);
      if (Number.isSafeInteger(logId) && logId > 0) {
        const [log] = await db
          .select({ groupId: attendanceSelfLogs.groupId })
          .from(attendanceSelfLogs)
          .where(eq(attendanceSelfLogs.id, logId));
        if (log?.groupId) {
          req.headers['x-organization-group-id'] = String(log.groupId);
        }
      }
    }
  } catch {
    // Continue to downstream middleware
  }
  next();
}

// Employee Self-Service Mobile Endpoints (Scoped to authenticated employee)
router.get("/summary", authenticateToken, getTodaySummaryController);
router.post("/clock", authenticateToken, clockAttendanceController);
router.get("/history", authenticateToken, getAttendanceHistoryController);
router.get("/face-profile", authenticateToken, getFaceProfileController);
router.post("/enroll-face", authenticateToken, enrollFaceController);

// HRD Review & Verification Endpoints
router.get(
  "/verifications",
  authenticateToken,
  requirePermission('attendance.mobile.verify'),
  requireOrganizationScope('hr','read'),
  getVerificationsController
);

router.post(
  "/verify",
  authenticateToken,
  requirePermission('attendance.mobile.verify'),
  resolveLogGroupForVerify,
  requireOrganizationScope('hr','write'),
  verifyAttendanceController
);

export default router;
