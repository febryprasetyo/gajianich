import { Router } from 'express';
import multer from 'multer';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
} from '../controllers/assetController';
import {
  downloadAssetImportTemplate,
  previewAssetImport,
  commitAssetImportUpload,
} from '../controllers/assetImportController';
import {
  assignAsset,
  unassignAsset,
  logMaintenance,
  disposeAsset,
  getAssetHistory,
} from '../controllers/assetLifecycleController';
import { getAssetDashboardSummary } from '../controllers/assetDashboardController';
import { authenticateToken, requirePermission } from '../middleware/auth';

import { requireOrganizationScope } from '../middleware/organizationScope';
const router = Router();

// Protect all asset routes with authentication
router.use(authenticateToken);

const viewAssets = requirePermission('assets.view');
const createAssets = requirePermission('assets.create');
const editAssets = requirePermission('assets.edit');
const deleteAssets = requirePermission('assets.delete');
const assignAssets = requirePermission('assets.assign');

const uploadXlsx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      return callback(new Error('Only .xlsx files are supported'));
    }
    callback(null, true);
  },
});

// --- Asset Categories ---
router.get('/categories', viewAssets, requireOrganizationScope('assets', 'read'), getCategories);
router.post('/categories', createAssets, requireOrganizationScope('assets', 'write'), createCategory);
router.put('/categories/:id', editAssets, requireOrganizationScope('assets', 'write'), updateCategory);
router.delete('/categories/:id', deleteAssets, requireOrganizationScope('assets', 'write'), deleteCategory);

// --- Asset Import (must be registered before /:id) ---
router.get('/import/template', createAssets, requireOrganizationScope('assets', 'write'), downloadAssetImportTemplate);
router.post('/import/preview', createAssets, requireOrganizationScope('assets', 'write'), uploadXlsx.single('file'), previewAssetImport);
router.post('/import/commit', createAssets, requireOrganizationScope('assets', 'write'), uploadXlsx.single('file'), commitAssetImportUpload);

// --- Asset Dashboard Summary (must be registered before /:id) ---
router.get('/dashboard-summary', viewAssets, requireOrganizationScope('assets', 'read'), getAssetDashboardSummary);

// --- Asset Inventory ---
router.get('/', viewAssets, requireOrganizationScope('assets', 'read'), getAssets);
router.get('/:id', viewAssets, requireOrganizationScope('assets', 'read'), getAssetById);
router.post('/', createAssets, requireOrganizationScope('assets', 'write'), createAsset);
router.put('/:id', editAssets, requireOrganizationScope('assets', 'write'), updateAsset);
router.delete('/:id', deleteAssets, requireOrganizationScope('assets', 'write'), deleteAsset);

// --- Asset Lifecycle, Maintenance & History ---
router.post('/:id/assign', assignAssets, requireOrganizationScope('assets', 'write'), assignAsset);
router.post('/:id/unassign', assignAssets, requireOrganizationScope('assets', 'write'), unassignAsset);
router.post('/:id/maintenance', editAssets, requireOrganizationScope('assets', 'write'), logMaintenance);
router.post('/:id/dispose', deleteAssets, requireOrganizationScope('assets', 'write'), disposeAsset);
router.get('/:id/history', viewAssets, requireOrganizationScope('assets', 'read'), getAssetHistory);

export default router;
