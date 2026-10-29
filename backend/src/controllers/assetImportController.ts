import { assetRequestScope, custodianScopePredicate, employeeAssetScopePredicate, locationScopePredicate, requireAssetLocation } from '../services/assetOrganizationScope';
import { Request, Response } from 'express';
import { db } from '../db';
import {
  assets,
  assetCategories,
  assetComputerSpecs,
  assetAccessories,
  assetAssignmentHistory,
} from '../db/schema/assets';
import { locations } from '../db/schema/master';
import { auditLogs } from '../db/schema/system';
import { employees } from '../db/schema/employees';
import { assetCustodians } from '../db/schema/assetCustodians';
import { eq, and, isNotNull, sql, ilike } from 'drizzle-orm';
import { buildAssetImportTemplate, parseAssetImportWorkbook } from '../services/assetWorkbook';
import {
  validateAssetImport,
  commitAssetImport,
  type AssetImportLookups,
  type AssetImportRepository,
} from '../services/assetImport';
import { allocateSequentialCodes } from '../domain/assetCode';
import { sendCustodianError } from '../domain/assetCustodian';
import {
  createManualCustodian,
  lockCustodianDirectory,
  requireActiveCustodian,
  resolveEmployeeCustodian,
} from '../services/assetCustodian';

async function loadAssetImportLookups(req: Request, runner: any = db): Promise<AssetImportLookups> {
  const [empRows, custodianRows, catRows, locRows, codeRows, snRows] = await Promise.all([
    runner
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        fullName: employees.fullName,
        locationId: employees.locationId,
        locationName: locations.name,
      })
      .from(employees)
      .leftJoin(locations, eq(employees.locationId, locations.id))
      .where(and(ilike(employees.status, 'active'),employeeAssetScopePredicate(assetRequestScope(req)))),
    runner
      .select({
        id: assetCustodians.id,
        displayName: assetCustodians.displayName,
        normalizedName: assetCustodians.normalizedName,
        origin: assetCustodians.origin,
        verificationStatus: assetCustodians.verificationStatus,
        employeeId: assetCustodians.employeeId,
        locationId: assetCustodians.locationId,
        locationName: locations.name,
        recordStatus: assetCustodians.recordStatus,
      })
      .from(assetCustodians)
      .leftJoin(locations, eq(assetCustodians.locationId, locations.id))
      .where(and(eq(assetCustodians.recordStatus, 'ACTIVE'),custodianScopePredicate(assetRequestScope(req)))),
    runner
      .select({
        id: assetCategories.id,
        name: assetCategories.name,
        codePrefix: assetCategories.codePrefix,
      })
      .from(assetCategories),
    runner
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
      })
      .from(locations).where(locationScopePredicate(assetRequestScope(req),locations.id)),
    runner.select({ code: assets.assetCode }).from(assets),
    runner.select({ sn: assets.serialNumber }).from(assets).where(isNotNull(assets.serialNumber)),
  ]);

  return {
    employees: empRows,
    custodians: custodianRows,
    categories: catRows,
    locations: locRows,
    existingAssetCodes: new Set(codeRows.map((r: any) => r.code)),
    existingSerialNumbers: new Set(snRows.map((r: any) => r.sn)),
  };
}

export async function downloadAssetImportTemplate(_req: Request, res: Response) {
  try {
    const buffer = await buildAssetImportTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="gajianich-asset-import-template.xlsx"');
    return res.status(200).send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate template' });
  }
}

export async function previewAssetImport(req: Request, res: Response) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No XLSX file uploaded. Ensure multipart field name is "file".' });
    }

    let parsedWorkbook;
    try {
      parsedWorkbook = await parseAssetImportWorkbook(req.file.buffer);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to parse XLSX workbook' });
    }

    const lookups = await loadAssetImportLookups(req,db);
    const validationResult = validateAssetImport(parsedWorkbook, lookups);

    return res.status(200).json(validationResult);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function commitAssetImportUpload(req: Request, res: Response) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No XLSX file uploaded. Ensure multipart field name is "file".' });
    }

    let parsedWorkbook;
    try {
      parsedWorkbook = await parseAssetImportWorkbook(req.file.buffer);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to parse XLSX workbook' });
    }

    const userId = (req as any).user?.userId ?? (req as any).user?.id ?? 1;

    const commitResult = await db.transaction(async (tx) => {
      const lookups = await loadAssetImportLookups(req,tx);
      const validation = validateAssetImport(parsedWorkbook, lookups);

      if (!validation.valid || validation.messages.some((m) => m.type === 'error')) {
        throw new Error(`Validation failed: ${validation.summary.errorCount} error(s) found in workbook`);
      }

      const repository: AssetImportRepository = {
        resolveEmployeeCustodian: async (employeeId: number) => {
          const custodian = await resolveEmployeeCustodian(tx, employeeId, userId);
          return {
            id: custodian.id,
            displayName: custodian.displayName,
            locationId: custodian.locationId,
          };
        },
        createManualCustodian: async (input) => {
          const custodian = await createManualCustodian(tx, input, userId,assetRequestScope(req));
          return {
            id: custodian.id,
            displayName: custodian.displayName,
            locationId: custodian.locationId,
          };
        },
        requireActiveCustodian: async (custodianId: number) => {
          const custodian = await requireActiveCustodian(tx, custodianId);
          return {
            id: custodian.id,
            displayName: custodian.displayName,
            locationId: custodian.locationId,
          };
        },
        allocateCodes: async (prefix: string, count: number) => {
          const year = new Date().getFullYear();
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext('asset_code_seq'), hashtext(${prefix + "-" + year}))`
          );
          const pattern = `${prefix}-${year}-%`;
          const existing = await tx
            .select({ assetCode: assets.assetCode })
            .from(assets)
            .where(ilike(assets.assetCode, pattern));

          const existingCodes = existing.map((r: any) => r.assetCode);
          return allocateSequentialCodes(prefix, year, existingCodes, count);
        },
        insertAsset: async (data) => {
          await requireAssetLocation(tx,req,data.locationId);
          const [inserted] = await tx
            .insert(assets)
            .values({
              assetCode: data.assetCode,
              name: data.name,
              categoryId: data.categoryId,
              locationId: data.locationId ?? null,
              currentCustodianId: data.currentCustodianId ?? null,
              serialNumber: data.serialNumber ?? null,
              status: data.status,
              condition: data.condition,
              notes: data.notes ?? null,
            })
            .returning({ id: assets.id });
          return inserted.id;
        },
        insertComputerSpecs: async (data) => {
          const hasSpec = data.cpuName || data.ramSizeGb || data.ramSlotCount || data.disk1SizeGb || data.disk2SizeGb;
          if (!hasSpec) return;
          await tx.insert(assetComputerSpecs).values({
            assetId: data.assetId,
            cpuName: data.cpuName ?? null,
            ramSizeGb: data.ramSizeGb ?? null,
            ramSlotCount: data.ramSlotCount ?? null,
            disk1SizeGb: data.disk1SizeGb ?? null,
            disk2SizeGb: data.disk2SizeGb ?? null,
          });
        },
        insertAccessories: async (data) => {
          if (data.length === 0) return;
          await tx.insert(assetAccessories).values(
            data.map((item) => ({
              assetId: item.assetId,
              accessoryType: item.accessoryType,
              description: item.description ?? null,
              quantity: item.quantity,
              condition: item.condition,
              notes: item.notes ?? null,
            }))
          );
        },
        insertAssignmentHistory: async (data) => {
          await tx.insert(assetAssignmentHistory).values({
            assetId: data.assetId,
            groupId: assetRequestScope(req).selectedGroupId,
            custodianId: data.custodianId,
            custodianNameSnapshot: data.custodianNameSnapshot,
            locationNameSnapshot: data.locationNameSnapshot ?? null,
            assignedAt: data.assignedDate,
            assignedByUserId: data.assignedByUserId,
            conditionOnAssign: data.conditionOnAssignment ?? "Good",
            handoverNotes: data.handoverNotes ?? null,
          });
        },
        insertAuditLog: async (data) => {
          await tx.insert(auditLogs).values({
            userId: data.performedBy,
            action: data.action,
            entity: data.entity,
            entityId: data.entityId,
            newValues: { groupId:assetRequestScope(req).selectedGroupId, info:data.details ?? null },
          });
        },
      };

      return await commitAssetImport(repository, validation, { userId });
    });

    return res.status(200).json(commitResult);
  } catch (err: any) {
    if (sendCustodianError(res, err)) return;
    if (err.message && err.message.startsWith("Validation failed")) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
