import { invalidateAuthOnSuccessfulMutation } from '../services/authCache';
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
  getUnprovisionedSummary,
  bulkProvisionAndBlast,
  blastUserWhatsApp,
} from '../controllers/userController';

const router = Router();

router.get('/unprovisioned-summary', authenticateToken, requirePermission('access.users.view'), requireOrganizationScope('users', 'read'), getUnprovisionedSummary);
router.get('/', authenticateToken, requirePermission('access.users.view'), requireOrganizationScope('users', 'read'), getUsers);
router.use(invalidateAuthOnSuccessfulMutation);
router.post('/bulk-provision-blast', authenticateToken, requirePermission('access.users.manage'), requireOrganizationScope('users', 'write'), bulkProvisionAndBlast);
router.post('/:id/blast-whatsapp', authenticateToken, requirePermission('access.users.manage'), requireOrganizationScope('users', 'write'), blastUserWhatsApp);
router.post('/', authenticateToken, requirePermission('access.users.manage'), requireOrganizationScope('users', 'write'), createUser);
router.put('/:id', authenticateToken, requirePermission('access.users.manage'), requireOrganizationScope('users', 'write'), updateUser);
router.patch('/:id/status', authenticateToken, requirePermission('access.users.manage'), requireOrganizationScope('users', 'write'), toggleUserStatus);
router.post('/:id/reset-password', authenticateToken, requirePermission('access.users.manage'), requireOrganizationScope('users', 'write'), resetPassword);
router.delete('/:id', authenticateToken, requirePermission('access.users.manage'), requireOrganizationScope('users', 'write'), deleteUser);

export default router;
