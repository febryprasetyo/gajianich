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
    const result = await processHardwareAuditIngest(parsed);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Failed to ingest hardware audit' });
  }
}

export async function batchSyncHardwareAudits(req: Request, res: Response) {
  try {
    const parsed = batchHardwareAuditSchema.parse(req.body);
    const result = await processBatchHardwareAudit(parsed);

    return res.status(200).json({
      success: true,
      message: `Berhasil memproses ${result.total} data audit (${result.syncedAuto} auto-synced, ${result.pendingReview} pending review)`,
      ...result,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Failed to batch sync hardware audits' });
  }
}

export async function listHardwareAudits(req: Request, res: Response) {
  try {
    const status = req.query.status as string | undefined;
    const audits = await getHardwareAudits(status);

    return res.status(200).json({
      data: audits,
      total: audits.length,
    });
  } catch (err: any) {
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
    const result = await linkAuditToAsset(auditId, parsed);

    return res.status(200).json(result);
  } catch (err: any) {
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
    const result = await createAssetFromAudit(auditId, parsed, actorUserId);

    return res.status(201).json(result);
  } catch (err: any) {
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
    const deletedCount = await clearSyncedHardwareAudits();
    return res.status(200).json({
      success: true,
      message: `Berhasil menghapus ${deletedCount} riwayat audit yang sudah disinkronkan`,
      deletedCount,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to clear synced audit records' });
  }
}

export async function deleteHardwareAuditRecord(req: Request, res: Response) {
  try {
    const auditId = Number(req.params.id);
    if (!Number.isSafeInteger(auditId) || auditId <= 0) {
      return res.status(400).json({ error: 'Invalid audit ID' });
    }

    await deleteHardwareAudit(auditId);
    return res.status(200).json({ success: true, message: 'Audit record deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete audit record' });
  }
}
