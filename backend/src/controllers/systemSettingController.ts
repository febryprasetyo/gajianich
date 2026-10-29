import { loadGroupAccess } from '../services/organizationScope';
import type { AuthenticatedRequest } from '../middleware/auth';
import { Request, Response } from 'express';
import { db } from '../db';
import { systemSettings } from '../db/schema/system';
import { eq, sql, inArray } from 'drizzle-orm';
import { resolveAuditContext } from '../services/hrAudit';
import { runHrMutation } from '../services/hrMutation';
import { hashRequestPayload } from '../domain/hrAudit';
import { setHrSetting as executeSetHrSetting } from '../services/hrMasterMutations';

export async function getSystemSetting(req: Request, res: Response) {
  try {
    const { key } = req.params;
    if (!publicSettings.includes(key) && !await isGlobal(req)) return res.status(403).json({error:'Global settings require a global administrator'});
    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);

    if (rows.length === 0) {
      return res.status(200).json({ key, value: null });
    }

    return res.status(200).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve system setting' });
  }
}

export async function getAllSystemSettings(req: Request, res: Response) {
  try {
    const global = await isGlobal(req);
    const rows = await db.select().from(systemSettings).where(global ? undefined : inArray(systemSettings.key,publicSettings));
    return res.status(200).json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve system settings' });
  }
}

export async function setSystemSetting(req: Request, res: Response) {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    if (!await isGlobal(req)) return res.status(403).json({error:'Global settings require a global administrator'});

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    if ((req as any).user) {
      const context = await resolveAuditContext(req as any);
      const requestHash = hashRequestPayload({ command: 'set_setting', key, value });
      const result = await runHrMutation(context, requestHash, async (tx) => {
        return await executeSetHrSetting(tx, context, { key, value, description });
      });
      return res.status(200).json(result.setting);
    }

    return res.status(401).json({error:'Unauthorized'});
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Failed to update system setting' });
  }
}

const publicSettings = ['attendance_strict_integrity'];
async function isGlobal(req: Request): Promise<boolean> {
  const userId = (req as AuthenticatedRequest).user?.userId;
  return userId ? (await loadGroupAccess(userId)).isGlobalAdministrator : false;
}
