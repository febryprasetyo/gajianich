import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import {requireGlobalAdministrator} from '../middleware/organizationScope';
import {
  getRoles,
  getPermissionsCatalog,
  createRole,
  updateRole,
  deleteRole,
  updateRolePermissions,
} from '../controllers/roleController';

const router = Router();

const roleManageAuth = [authenticateToken, requirePermission('access.roles.manage'),requireGlobalAdministrator];
const roleViewAuth = [
  authenticateToken,
  requirePermission(['access.roles.manage', 'access.users.view', 'access.users.manage']),
];

router.get('/permissions', ...roleManageAuth, getPermissionsCatalog);
router.get('/', ...roleViewAuth, getRoles);
router.post('/', ...roleManageAuth, createRole);
router.put('/:id', ...roleManageAuth, updateRole);
router.delete('/:id', ...roleManageAuth, deleteRole);
router.put('/:id/permissions', ...roleManageAuth, updateRolePermissions);

export default router;
