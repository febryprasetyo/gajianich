import { assetRequestScope, requireScopedCustodian, requireScopedEmployee, requireAssetLocation } from '../services/assetOrganizationScope';
import type { Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import type { AuthenticatedRequest } from '../middleware/auth';
import { manualCustodianSchema, sendCustodianError } from '../domain/assetCustodian';
import { createManualCustodian, getCustodianAssets, linkCustodianEmployee, mergeCustodians, reconciliationCandidates, resolveEmployeeCustodian, searchCustodians, updateCustodian } from '../services/assetCustodian';
const idSchema = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const employeeSchema = z.object({ employeeId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict();
const updateSchema = manualCustodianSchema.partial()
  .extend({ recordStatus: z.enum(['ACTIVE', 'INACTIVE']).optional() })
  .refine(value => Object.keys(value).length > 0, 'Provide at least one update');

function fail(res: Response, err: unknown) {
  if (!sendCustodianError(res, err)) {
    console.error('Custodian operation failed', err);
    res.status(500).json({ error: 'Custodian operation failed' });
  }
}

export async function getCustodians(req: AuthenticatedRequest, res: Response) {
  try {
    const query = z.object({
      search: z.string().max(150).default(''),
      status: z.enum(['ACTIVE', 'INACTIVE', 'MERGED', 'ALL']).default('ACTIVE'),
    }).parse(req.query);
    res.json(await searchCustodians(query.search, query.status,assetRequestScope(req)));
  } catch (err) {
    fail(res, err);
  }
}

export async function postCustodian(req: AuthenticatedRequest, res: Response) {
  try {
    const input = manualCustodianSchema.parse(req.body);
    res.status(201).json(await db.transaction(async tx => { await requireAssetLocation(tx,req,input.locationId); return createManualCustodian(tx, input, req.user!.userId,assetRequestScope(req)); }));
  } catch (err) {
    fail(res, err);
  }
}

export async function patchCustodian(req: AuthenticatedRequest, res: Response) {
  try {
    const id = idSchema.parse(req.params.id);
    const input = updateSchema.parse(req.body);
    res.json(await db.transaction(async tx => { await requireScopedCustodian(tx,req,id,true); if (input.locationId !== undefined) await requireAssetLocation(tx,req,input.locationId); return updateCustodian(tx, id, input, req.user!.userId); }));
  } catch (err) {
    fail(res, err);
  }
}

export async function resolveEmployee(req: AuthenticatedRequest, res: Response) {
  try {
    const input = employeeSchema.parse(req.body);
    res.json(await db.transaction(async tx => { await requireScopedEmployee(tx,req,input.employeeId); return resolveEmployeeCustodian(tx, input.employeeId, req.user!.userId); }));
  } catch (err) {
    fail(res, err);
  }
}

export async function linkEmployee(req: AuthenticatedRequest, res: Response) {
  try {
    const id = idSchema.parse(req.params.id);
    const input = employeeSchema.parse(req.body);
    res.json(await db.transaction(async tx => { await requireScopedCustodian(tx,req,id,true); await requireScopedEmployee(tx,req,input.employeeId); return linkCustodianEmployee(tx, id, input.employeeId, req.user!.userId); }));
  } catch (err) {
    fail(res, err);
  }
}

export async function mergeCustodian(req: AuthenticatedRequest, res: Response) {
  try {
    const id = idSchema.parse(req.params.id);
    const input = z.object({ targetCustodianId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict().parse(req.body);
    res.json(await db.transaction(async tx => { await requireScopedCustodian(tx,req,id,true); await requireScopedCustodian(tx,req,input.targetCustodianId,true); return mergeCustodians(tx, id, input.targetCustodianId, req.user!.userId); }));
  } catch (err) {
    fail(res, err);
  }
}

export async function getReconciliationCandidates(req: AuthenticatedRequest, res: Response) {
  try {
    res.json(await reconciliationCandidates(assetRequestScope(req)));
  } catch (err) {
    fail(res, err);
  }
}


export async function getCustodianAssetsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const id = idSchema.parse(req.params.id);
    res.json(await getCustodianAssets(id,assetRequestScope(req)));
  } catch (err) {
    fail(res, err);
  }
}
