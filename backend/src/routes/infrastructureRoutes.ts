import { Router } from 'express';
import { loadEnv } from '../config/env';
import {
  createOrUpdateServerNode,
  createServerTelemetryAuthenticator,
  deleteServerNode,
  downloadWeeklyReport,
  executeServerRemoteAction,
  generateWeeklyReportOnDemand,
  getAccurateDatabase,
  getAccurateLicenses,
  getDbBackups,
  getServerById,
  getServers,
  getServerServiceLogs,
  getWeeklyReports,
  receiveAccurateAgentSignal,
  receiveServerTelemetry,
  rotateServerAgentKey,
  streamServerTelemetry,
  syncAccurateLicenses,
  updateServerNode,
} from '../controllers/infrastructureController';
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from '../controllers/subscriptionController';
import { createAgentAuthenticator } from '../middleware/agentAuth';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();
const envKey = loadEnv().agentApiKey;
const agentAuth = createAgentAuthenticator(envKey);
const serverTelemetryAuth = createServerTelemetryAuthenticator(envKey);

router.post('/agent/signal', agentAuth, receiveAccurateAgentSignal);
router.post('/agent/telemetry', serverTelemetryAuth, receiveServerTelemetry);

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
router.put('/servers/:id', manageInfra, updateServerNode);
router.delete('/servers/:id', manageInfra, deleteServerNode);
router.get('/servers/:id/logs', viewInfra, getServerServiceLogs);
router.post('/servers/:id/actions', manageInfra, executeServerRemoteAction);
router.post('/servers/:id/rotate-key', manageInfra, rotateServerAgentKey);

router.get('/backups', viewInfra, getDbBackups);

// Weekly Health & Security Audit Reports
router.get('/reports', viewInfra, getWeeklyReports);
router.get('/reports/:id/download', viewInfra, downloadWeeklyReport);
router.post('/reports/generate', manageInfra, generateWeeklyReportOnDemand);

// Subscriptions & Recurring IT Services (Domain, Hosting, Email, SSL, SaaS)
const manageSubs = requirePermission(['infrastructure.manage', 'infrastructure.view']);
router.get('/subscriptions', viewInfra, getSubscriptions);
router.post('/subscriptions', manageSubs, createSubscription);
router.put('/subscriptions/:id', manageSubs, updateSubscription);
router.delete('/subscriptions/:id', manageSubs, deleteSubscription);

export default router;
