import { Router, type Response } from 'express';
import { db } from '../db';
import { authenticateToken, requirePermission, type AuthenticatedRequest } from '../middleware/auth';
import {
  listHandovers,
  getHandoverStats,
  getHandoverById,
  createHandover,
  updateHandover,
  deleteHandover,
} from '../services/assetHandoverService';
import { HandoverInputError } from '../domain/assetHandover';

const router = Router();

router.use(authenticateToken);

// GET /api/v1/assets/handovers/stats
router.get(
  '/stats',
  requirePermission('assets.view'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await getHandoverStats(db);
      return res.json(stats);
    } catch (err: any) {
      console.error('Error fetching handover stats:', err);
      return res.status(500).json({ error: 'Gagal mengambil statistik tanda terima' });
    }
  }
);

// GET /api/v1/assets/handovers
router.get(
  '/',
  requirePermission('assets.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { search, itemType, status, page, limit } = req.query;
      const result = await listHandovers(db, {
        search: typeof search === 'string' ? search : undefined,
        itemType: typeof itemType === 'string' ? itemType : undefined,
        status: typeof status === 'string' ? status : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return res.json(result);
    } catch (err: any) {
      console.error('Error listing handovers:', err);
      return res.status(500).json({ error: 'Gagal mengambil daftar tanda terima' });
    }
  }
);

// GET /api/v1/assets/handovers/:id
router.get(
  '/:id',
  requirePermission('assets.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'ID dokumen tanda terima tidak valid' });
      }
      const data = await getHandoverById(db, id);
      return res.json(data);
    } catch (err: any) {
      if (err instanceof HandoverInputError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error('Error getting handover:', err);
      return res.status(500).json({ error: 'Gagal mengambil detail tanda terima' });
    }
  }
);

// POST /api/v1/assets/handovers
router.post(
  '/',
  requirePermission('assets.assign'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await createHandover(db, req.body, req.user?.userId);
      return res.status(201).json(result);
    } catch (err: any) {
      if (err instanceof HandoverInputError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error('Error creating handover:', err);
      return res.status(500).json({ error: 'Gagal membuat dokumen tanda terima' });
    }
  }
);

// PUT /api/v1/assets/handovers/:id
router.put(
  '/:id',
  requirePermission('assets.assign'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'ID dokumen tanda terima tidak valid' });
      }
      const result = await updateHandover(db, id, req.body, req.user?.userId);
      return res.json(result);
    } catch (err: any) {
      if (err instanceof HandoverInputError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error('Error updating handover:', err);
      return res.status(500).json({ error: 'Gagal memperbarui dokumen tanda terima' });
    }
  }
);

// DELETE /api/v1/assets/handovers/:id
router.delete(
  '/:id',
  requirePermission('assets.assign'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'ID dokumen tanda terima tidak valid' });
      }
      const result = await deleteHandover(db, id, req.user?.userId);
      return res.json(result);
    } catch (err: any) {
      if (err instanceof HandoverInputError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error('Error deleting handover:', err);
      return res.status(500).json({ error: 'Gagal menghapus dokumen tanda terima' });
    }
  }
);

export default router;
