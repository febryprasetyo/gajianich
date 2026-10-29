import { requireOrganizationScope } from '../middleware/organizationScope';
import { Router, Request, Response, NextFunction } from 'express';
import {
  ingestHardwareAudit,
  batchSyncHardwareAudits,
  listHardwareAudits,
  linkHardwareAudit,
  createAssetFromHardwareAudit,
  deleteHardwareAuditRecord,
  clearSyncedHardwareAuditsRecord,
} from '../controllers/hardwareAuditController';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { createAgentAuthenticator } from '../middleware/agentAuth';
import { loadEnv } from '../config/env';

const router = Router();
let agentAuthMiddleware: any = null;

function getAgentAuth() {
  if (!agentAuthMiddleware) {
    try {
      const env = loadEnv();
      agentAuthMiddleware = createAgentAuthenticator(env.agentApiKey);
    } catch {
      agentAuthMiddleware = (_req: Request, res: Response) => {
        res.status(500).json({ error: 'AGENT_API_KEY is not configured on server' });
      };
    }
  }
  return agentAuthMiddleware;
}

function agentOrUserAuth(req: Request, res: Response, next: NextFunction) {
  if (req.header('X-Agent-Key')) {
    return getAgentAuth()(req, res, next);
  }
  return authenticateToken(req as any,res,() => requirePermission('hardware_audits.manage')(req as any,res,() => requireOrganizationScope('assets','write')(req as any,res,next)));
}

// Ingestion endpoints (Agent tool or Web UI)
router.post('/ingest', agentOrUserAuth, ingestHardwareAudit);
router.post('/batch-sync', agentOrUserAuth, batchSyncHardwareAudits);

// Management & Reconciliation endpoints (Web UI for IT staff/admins)
const viewAudits = requirePermission('hardware_audits.view');
const manageAudits = requirePermission('hardware_audits.manage');

router.get('/', authenticateToken, viewAudits, requireOrganizationScope('assets','read'), listHardwareAudits);
router.post('/:id/link', authenticateToken, manageAudits, requireOrganizationScope('assets','write'), linkHardwareAudit);
router.post('/:id/create-asset', authenticateToken, manageAudits, requireOrganizationScope('assets','write'), createAssetFromHardwareAudit);
router.delete('/clear-synced', authenticateToken, manageAudits, requireOrganizationScope('assets','write'), clearSyncedHardwareAuditsRecord);
router.delete('/:id', authenticateToken, manageAudits, requireOrganizationScope('assets','write'), deleteHardwareAuditRecord);

export default router;
