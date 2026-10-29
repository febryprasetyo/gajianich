import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import {requireGlobalAdministrator} from '../middleware/organizationScope';
import {
  getSystemSetting,
  getAllSystemSettings,
  setSystemSetting,
} from '../controllers/systemSettingController';

const router = Router();

// Reading system settings: any authenticated user
router.get('/:key', authenticateToken,requirePermission('attendance.view'), getSystemSetting);
router.get('/', authenticateToken,requirePermission('attendance.view'),requireGlobalAdministrator, getAllSystemSettings);

// Updating system settings: requires admin / management permissions
router.put(
  '/:key',
  authenticateToken,
  requirePermission(['attendance.manage', 'master.manage', 'access.users.manage']),
  requireGlobalAdministrator,
  setSystemSetting
);

export default router;
