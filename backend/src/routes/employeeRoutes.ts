import {requireOrganizationScope} from '../middleware/organizationScope';
import { Router } from 'express';
import multer from 'multer';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from '../controllers/employeeController';
import {
  downloadEmployeeTemplate,
  previewEmployeeImport,
  commitEmployeeImport,
} from '../controllers/employeeImportController';
import { exportEmployeesToExcel } from '../controllers/employeeExportController';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

// Protect all employee routes with authentication
router.use(authenticateToken);

const viewEmployee = requirePermission(['attendance.view', 'attendance.manage']);
const manageEmployee = requirePermission(['attendance.manage', 'attendance.import']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// --- Employee Import & Export Routes (Must be registered before /:id) ---
router.get('/import/template', viewEmployee, requireOrganizationScope('hr', 'read'), downloadEmployeeTemplate);
router.post('/import/preview', manageEmployee, requireOrganizationScope('hr', 'write'), upload.single('file'), previewEmployeeImport);
router.post('/import/commit', manageEmployee, requireOrganizationScope('hr', 'write'), upload.single('file'), commitEmployeeImport);
router.get('/export', viewEmployee, requireOrganizationScope('hr', 'read'), exportEmployeesToExcel);

// --- Employee CRUD Routes ---
router.get('/', viewEmployee, requireOrganizationScope('hr', 'read'), getEmployees);
router.get('/:id', viewEmployee, requireOrganizationScope('hr', 'read'), getEmployeeById);
router.post('/', manageEmployee, requireOrganizationScope('hr', 'write'), createEmployee);
router.put('/:id', manageEmployee, requireOrganizationScope('hr', 'write'), updateEmployee);
router.delete('/:id', manageEmployee, requireOrganizationScope('hr', 'write'), deleteEmployee);

export default router;
