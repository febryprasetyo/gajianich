import { Router } from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth';
import {requireOrganizationScope} from '../middleware/organizationScope';
import {
  getUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  resetPassword,
  deleteUser,
} from '../controllers/userController';

const router = Router();

router.get('/', authenticateToken, requirePermission('access.users.view'),requireOrganizationScope('users','read'), getUsers);
router.post('/', authenticateToken, requirePermission('access.users.manage'),requireOrganizationScope('users','write'), createUser);
router.put('/:id', authenticateToken, requirePermission('access.users.manage'),requireOrganizationScope('users','write'), updateUser);
router.patch('/:id/status', authenticateToken, requirePermission('access.users.manage'),requireOrganizationScope('users','write'), toggleUserStatus);
router.post('/:id/reset-password', authenticateToken, requirePermission('access.users.manage'),requireOrganizationScope('users','write'), resetPassword);
router.delete('/:id', authenticateToken, requirePermission('access.users.manage'),requireOrganizationScope('users','write'), deleteUser);

export default router;
