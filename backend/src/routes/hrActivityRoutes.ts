import {requireOrganizationScope} from '../middleware/organizationScope';
import { Router } from "express";
import { authenticateToken, requirePermission } from "../middleware/auth";
import {
  getActivities,
  getActors,
  getActivityById,
  getActivityTargets,
} from "../controllers/hrActivityController";

const router = Router();

const hrAuditPermissions = [
  "hr.audit.view",
  "attendance.view",
  "attendance.manage",
];

// Disallow any mutation methods on activity resource
const disallowMutation = (_req: any, res: any) => {
  return res.status(405).json({
    success: false,
    error: "Method Not Allowed: Audit log is strictly read-only append-only",
  });
};

router.post("*", disallowMutation);
router.put("*", disallowMutation);
router.patch("*", disallowMutation);
router.delete("*", disallowMutation);

// 1. List distinct actors (MUST precede /:id)
router.get(
  "/actors",
  authenticateToken,
  requirePermission(hrAuditPermissions),
  requireOrganizationScope("hr","read"),
  getActors
);

// 2. List activities with query filters and cursor pagination
router.get(
  "/",
  authenticateToken,
  requirePermission(hrAuditPermissions),
  requireOrganizationScope("hr","read"),
  getActivities
);

// 3. Get single activity event detail + first 50 targets
router.get(
  "/:id",
  authenticateToken,
  requirePermission(hrAuditPermissions),
  requireOrganizationScope("hr","read"),
  getActivityById
);

// 4. Paginated targets for an activity
router.get(
  "/:id/targets",
  authenticateToken,
  requirePermission(hrAuditPermissions),
  requireOrganizationScope("hr","read"),
  getActivityTargets
);

export default router;
