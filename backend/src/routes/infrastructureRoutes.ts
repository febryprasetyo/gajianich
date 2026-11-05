import { Router } from 'express';
import { loadEnv } from '../config/env';
import {
  createOrUpdateServerNode,
  executeServerRemoteAction,
  getAccurateDatabase,
  getAccurateLicenses,
  getDbBackups,
  getServerById,
  getServers,
  getServerServiceLogs,
  receiveAccurateAgentSignal,
  receiveServerTelemetry,
  streamServerTelemetry,
  syncAccurateLicenses,
} from '../controllers/infrastructureController';
import { createAgentAuthenticator } from '../middleware/agentAuth';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();
const agentAuth = createAgentAuthenticator(loadEnv().agentApiKey);

router.post('/agent/signal', agentAuth, receiveAccurateAgentSignal);
router.post('/agent/telemetry', agentAuth, receiveServerTelemetry);

router.use(authenticateToken);

const viewInfra = requirePermission('infrastructure.view');
const manageInfra = requirePermission('infrastructure.manage');

router.post('/accurate/sync', manageInfra, syncAccurateLicenses);
router.get('/accurate', viewInfra, getAccurateLicenses);
router.get('/accurate/database', viewInfra, getAccurateDatabase);

router.get('/servers', viewInfra, getServers);
router.post('/servers', manageInfra, createOrUpdateServerNode);
router.get('/servers/stream', viewInfra, streamServerTelemetry);
router.get('/servers/:id', viewInfra, getServerById);
router.get('/servers/:id/logs', viewInfra, getServerServiceLogs);
router.post('/servers/:id/actions', manageInfra, executeServerRemoteAction);

router.get('/backups', viewInfra, getDbBackups);

export default router;
