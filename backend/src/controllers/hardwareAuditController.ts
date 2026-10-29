import { and, eq, or } from 'drizzle-orm';
import { db } from '../db';
import { hardwareAuditLogs } from '../db/schema/hardwareAudits';
import { assetRequestScope, requireScopedAsset, requireAssetLocation, requireScopedCustodian } from '../services/assetOrganizationScope';
import { loadGroupAccess } from '../services/organizationScope';
import { hardwareAuditScopePredicate, queueHardwareAudit } from '../services/hardwareAuditService';
import { CustodianError, sendCustodianError } from '../domain/assetCustodian';

async function requireAudit(tx: any, req: Request, id: number) {
  const [audit] = await tx.select().from(hardwareAuditLogs).where(eq(hardwareAuditLogs.id,id)).for('update');
  if (!audit) throw new CustodianError('Audit not found',404);
  if(audit.groupId!==null && !assetRequestScope(req).groupIds.includes(audit.groupId)) throw new CustodianError('Audit not found',404);
  if (audit.matchedAssetId) await requireScopedAsset(tx,req,audit.matchedAssetId);
  else if (!(await loadGroupAccess((req as any).user.userId,tx)).isGlobalAdministrator) throw new CustodianError('Unresolved audits require global review',403);
  return audit;
}
import { Request, Response } from 'express';
import {
  hardwareAuditPayloadSchema,
  batchHardwareAuditSchema,
  linkAssetAuditSchema,
  createAssetFromAuditSchema,
} from '../domain/hardwareAudit';
import {
  processHardwareAuditIngest,
  processBatchHardwareAudit,
  getHardwareAudits,
  linkAuditToAsset,
  createAssetFromAudit,
  deleteHardwareAudit,
  clearSyncedHardwareAudits,
} from '../services/hardwareAuditService';

export async function ingestHardwareAudit(req: Request, res: Response) {
  try {
    const parsed = hardwareAuditPayloadSchema.parse(req.body);
    const result = await db.transaction(tx => queueHardwareAudit(parsed,tx));

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    if (sendCustodianError(res,err)) return;
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Failed to ingest hardware audit' });
  }
}

export async function batchSyncHardwareAudits(req: Request, res: Response) {
  try {
    const parsed = batchHardwareAuditSchema.parse(req.body);
    const results = await db.transaction(async tx => { const queued = []; for (const item of parsed.audits) queued.push(await queueHardwareAudit(item,tx)); return queued; });
    const result = {total:results.length,syncedAuto:0,pendingReview:results.length,results};

    return res.status(200).json({
      success: true,
      message: `Berhasil memproses ${result.total} data audit (${result.syncedAuto} auto-synced, ${result.pendingReview} pending review)`,
      ...result,
    });
  } catch (err: any) {
    if (sendCustodianError(res,err)) return;
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Failed to batch sync hardware audits' });
  }
}

export async function listHardwareAudits(req: Request, res: Response) {
  try {
    const status = req.query.status as string | undefined;
    const audits = await getHardwareAudits(status,db,assetRequestScope(req));

    return res.status(200).json({
      data: audits,
      total: audits.length,
    });
  } catch (err: any) {
    if (sendCustodianError(res,err)) return;
    return res.status(500).json({ error: err.message || 'Failed to list hardware audits' });
  }
}

export async function linkHardwareAudit(req: Request, res: Response) {
  try {
    const auditId = Number(req.params.id);
    if (!Number.isSafeInteger(auditId) || auditId <= 0) {
      return res.status(400).json({ error: 'Invalid audit ID' });
    }

    const parsed = linkAssetAuditSchema.parse(req.body);
    const result = await db.transaction(async tx => { await requireAudit(tx,req,auditId); await requireScopedAsset(tx,req,parsed.assetId); return linkAuditToAsset(auditId,parsed,tx); });

    return res.status(200).json(result);
  } catch (err: any) {
    if (sendCustodianError(res,err)) return;
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(400).json({ error: err.message || 'Failed to link hardware audit to asset' });
  }
}

export async function createAssetFromHardwareAudit(req: Request, res: Response) {
  try {
    const auditId = Number(req.params.id);
    if (!Number.isSafeInteger(auditId) || auditId <= 0) {
      return res.status(400).json({ error: 'Invalid audit ID' });
    }

    const parsed = createAssetFromAuditSchema.parse(req.body);
    const actorUserId = (req as any).user?.userId;
    const result = await db.transaction(async tx => { await requireAudit(tx,req,auditId); await requireAssetLocation(tx,req,parsed.locationId); if (parsed.custodianId) await requireScopedCustodian(tx,req,parsed.custodianId); return createAssetFromAudit(auditId,parsed,actorUserId,tx); });

    return res.status(201).json(result);
  } catch (err: any) {
    const uniqueError=err.cause||err;
    if(uniqueError.code==='23505') return res.status(409).json({error:'Serial number atau kode aset sudah terdaftar. Gunakan Tautkan Spesifikasi untuk perangkat yang sudah ada.'});
    if (sendCustodianError(res,err)) return;
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    const databaseError = err.cause || err;
    if (databaseError.code === '23505') {
      return res.status(409).json({
        error: 'Serial number atau kode aset sudah terdaftar. Muat ulang daftar aset dan gunakan Tautkan Spesifikasi untuk perangkat yang sudah ada.',
      });
    }
    if (err.cause || databaseError.code) {
      console.error('Hardware audit asset registration database error:', databaseError.code || 'unknown');
      return res.status(500).json({ error: 'Gagal menyimpan aset. Silakan coba kembali atau hubungi administrator.' });
    }
    return res.status(400).json({ error: err.message || 'Failed to create asset from hardware audit' });
  }
}

export async function clearSyncedHardwareAuditsRecord(req: Request, res: Response) {
  try {
    const deletedCount = (await db.delete(hardwareAuditLogs).where(and(hardwareAuditScopePredicate(assetRequestScope(req)),or(eq(hardwareAuditLogs.status,'SYNCED_AUTO'),eq(hardwareAuditLogs.status,'SYNCED_MANUAL')))).returning({id:hardwareAuditLogs.id})).length;
    return res.status(200).json({
      success: true,
      message: `Berhasil menghapus ${deletedCount} riwayat audit yang sudah disinkronkan`,
      deletedCount,
    });
  } catch (err: any) {
    if (sendCustodianError(res,err)) return;
    return res.status(500).json({ error: err.message || 'Failed to clear synced audit records' });
  }
}

export async function deleteHardwareAuditRecord(req: Request, res: Response) {
  try {
    const auditId = Number(req.params.id);
    if (!Number.isSafeInteger(auditId) || auditId <= 0) {
      return res.status(400).json({ error: 'Invalid audit ID' });
    }

    await db.transaction(async tx => { await requireAudit(tx,req,auditId); await deleteHardwareAudit(auditId,tx); });
    return res.status(200).json({ success: true, message: 'Audit record deleted successfully' });
  } catch (err: any) {
    if (sendCustodianError(res,err)) return;
    return res.status(500).json({ error: err.message || 'Failed to delete audit record' });
  }
}
