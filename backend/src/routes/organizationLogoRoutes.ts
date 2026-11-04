import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../db';
import { authenticateToken, requirePermission, type AuthenticatedRequest } from '../middleware/auth';
import { requireOrganizationScope, type OrganizationScopedRequest } from '../middleware/organizationScope';
import { requireHrScope } from '../services/hrOrganizationScope';
import { loadGroupAccess } from '../services/organizationScope';
import { resolveAuditContext } from '../services/hrAudit';
import { verifyToken } from '../utils/jwt';
import {
  MAX_LOGO_BYTE_SIZE,
  DocumentLogoValidationError,
  getDocumentAssetById,
  listOrganizationLogos,
  uploadOrganizationLogo,
} from '../services/documentProfile';

const uploadLogoMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_LOGO_BYTE_SIZE,
    files: 1,
  },
}).single('file');

function handleLogoUpload(req: Request, res: Response, next: NextFunction) {
  uploadLogoMiddleware(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Ukuran file logo maksimal 512 KB' });
      }
      return res.status(400).json({ error: 'File unggahan tidak valid' });
    }
    if (err) {
      return res.status(400).json({ error: 'Gagal memproses file unggahan' });
    }
    next();
  });
}

function extractCookieToken(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((c) => c.trim());
  for (const name of ['gajianich_prod_token', 'token']) {
    const match = parts.find((p) => p.startsWith(`${name}=`));
    if (match) {
      const val = match.slice(name.length + 1);
      if (val) {
        try {
          return decodeURIComponent(val);
        } catch {
          return val;
        }
      }
    }
  }
  return null;
}

export const documentAssetRoutes = Router();

// GET /api/v1/document-assets/:id (or /api/document-assets/:id)
// Supports both Authorization Bearer header and same-origin auth cookie (for <img> in print preview).
documentAssetRoutes.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idParsed = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(404).json({ error: 'Aset dokumen tidak ditemukan' });
    }

    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.split(' ')[1];
    const token = bearerToken || extractCookieToken(req.headers.cookie);

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let userId: number;
    try {
      const verified = verifyToken(token);
      userId = verified.userId;
    } catch {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const access = await loadGroupAccess(userId);
    const allowedGroupIds = access.isGlobalAdministrator ? null : access.groupIds;

    const asset = await getDocumentAssetById(db, idParsed.data, allowedGroupIds);
    if (!asset) {
      return res.status(404).json({ error: 'Aset dokumen tidak ditemukan' });
    }

    res.set({
      'Content-Type': asset.mimeType,
      'Content-Length': String(asset.byteSize),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=31536000, immutable',
    });
    return res.status(200).send(asset.content);
  } catch {
    return res.status(500).json({ error: 'Gagal memuat aset dokumen' });
  }
});

export const organizationLogoRoutes = Router();
organizationLogoRoutes.use(authenticateToken);

// GET /api/v1/hr/organization-logos
organizationLogoRoutes.get(
  '/',
  requirePermission(['attendance.view', 'attendance.manage']),
  requireOrganizationScope('hr', 'read'),
  async (req: OrganizationScopedRequest, res: Response) => {
    try {
      const scope = requireHrScope(req);
      const data = await listOrganizationLogos(db, scope.groupIds);
      return res.status(200).json({ data });
    } catch (error: any) {
      return res.status(error?.statusCode || 500).json({
        error: 'Gagal memuat daftar logo organisasi',
      });
    }
  }
);

// POST /api/v1/hr/organization-logos/:organizationId
organizationLogoRoutes.post(
  '/:organizationId',
  requirePermission(['attendance.manage']),
  requireOrganizationScope('hr', 'write'),
  handleLogoUpload,
  async (req: OrganizationScopedRequest, res: Response) => {
    try {
      const orgIdParsed = z.coerce.number().int().positive().safeParse(req.params.organizationId);
      if (!orgIdParsed.success) {
        return res.status(400).json({ error: 'ID organisasi tidak valid' });
      }
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'File logo wajib diunggah' });
      }

      const scope = requireHrScope(req);
      let auditContext = null;
      if (req.user) {
        try {
          auditContext = await resolveAuditContext(req);
        } catch {
          // ignore if unavailable in isolated test
        }
      }

      const result = await uploadOrganizationLogo(db, {
        organizationId: orgIdParsed.data,
        allowedGroupIds: scope.groupIds,
        buffer: req.file.buffer,
        userId: req.user?.userId ?? null,
        auditContext,
      });

      return res.status(201).json({
        logoAssetKey: result.logoAssetKey,
        version: result.version,
        organizationId: result.organizationId,
      });
    } catch (error: any) {
      if (error instanceof DocumentLogoValidationError) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(error?.statusCode || 500).json({
        error: 'Gagal menyimpan logo organisasi',
      });
    }
  }
);
