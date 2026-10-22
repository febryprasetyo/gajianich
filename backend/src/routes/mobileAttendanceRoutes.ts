import { Router } from "express";
import { authenticateToken, requirePermission } from "../middleware/auth";
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
  requirePermission(["attendance.view", "attendance.manage", "attendance.mobile.verify"]),
  getVerificationsController
);

router.post(
  "/verify",
  authenticateToken,
  requirePermission(["attendance.manage", "attendance.mobile.verify"]),
  verifyAttendanceController
);

export default router;
