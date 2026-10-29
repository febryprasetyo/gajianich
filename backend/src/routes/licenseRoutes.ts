import { requireOrganizationScope } from '../middleware/organizationScope';
import { Router } from 'express';
import {
  getLicenses,
  getLicenseById,
  createLicense,
  updateLicense,
  deleteLicense,
  allocateLicenseSeat,
  revokeLicenseSeat,
} from '../controllers/licenseController';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

// Protect all software license routes with authentication
router.use(authenticateToken);

const viewLicenses = requirePermission('licenses.view');
const manageLicenses = requirePermission('licenses.manage');

router.get('/', viewLicenses, requireOrganizationScope('assets','read'), getLicenses);
router.get('/:id', viewLicenses, requireOrganizationScope('assets','read'), getLicenseById);
router.post('/', manageLicenses, requireOrganizationScope('assets','write'), createLicense);
router.put('/:id', manageLicenses, requireOrganizationScope('assets','write'), updateLicense);
router.delete('/:id', manageLicenses, requireOrganizationScope('assets','write'), deleteLicense);
router.post('/:id/allocate', manageLicenses, requireOrganizationScope('assets','write'), allocateLicenseSeat);
router.post('/:id/revoke', manageLicenses, requireOrganizationScope('assets','write'), revokeLicenseSeat);

export default router;
