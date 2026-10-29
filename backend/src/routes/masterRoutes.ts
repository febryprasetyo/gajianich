import { Router } from 'express';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor,
} from '../controllers/masterController';
import { authenticateToken, requirePermission } from '../middleware/auth';
import {requireOrganizationScope,requireGlobalAdministrator} from '../middleware/organizationScope';

const router = Router();

// Protect all master data routes with authentication
router.use(authenticateToken);

const viewMaster = requirePermission('master.view');
const manageMaster = requirePermission('master.manage');
// HR Attendance juga perlu baca & kelola departments & locations untuk sinkronisasi
const viewMasterOrAttendance = requirePermission(['master.view', 'attendance.view']);
const manageMasterOrAttendance = requirePermission(['master.manage', 'attendance.manage']);

// --- Departments ---
router.get('/departments', viewMasterOrAttendance,requireOrganizationScope('hr','read'), getDepartments);
router.post('/departments', manageMasterOrAttendance,requireGlobalAdministrator, createDepartment);
router.put('/departments/:id', manageMasterOrAttendance,requireGlobalAdministrator, updateDepartment);
router.delete('/departments/:id', manageMasterOrAttendance,requireGlobalAdministrator, deleteDepartment);

// --- Locations ---
router.get('/locations', viewMasterOrAttendance,requireOrganizationScope('hr','read'), getLocations);
router.post('/locations', manageMasterOrAttendance,requireGlobalAdministrator, createLocation);
router.put('/locations/:id', manageMasterOrAttendance,requireGlobalAdministrator, updateLocation);
router.delete('/locations/:id', manageMasterOrAttendance,requireGlobalAdministrator, deleteLocation);

// --- Vendors ---
router.get('/vendors', viewMaster, getVendors);
router.post('/vendors', manageMaster, createVendor);
router.put('/vendors/:id', manageMaster, updateVendor);
router.delete('/vendors/:id', manageMaster, deleteVendor);

export default router;
