import { authorizeCustodianSelection, assetRequestScope, assetScopePredicate, requireAssetLocation, authorizeAssetMutation, requireScopedAsset } from '../services/assetOrganizationScope';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';
import { assets, assetCategories, assetComputerSpecs, assetAccessories, assetAssignmentHistory } from '../db/schema/assets';
import { itTickets, assetMaintenances } from '../db/schema/tickets';
import { licenseAllocations, accurateLicenses } from '../db/schema/licenses';
import { locations } from '../db/schema/master';
import { employees } from '../db/schema/employees';
import { assetCustodians } from '../db/schema/assetCustodians';
import { auditLogs } from '../db/schema/system';
import { CustodianError, manualCustodianSchema, sendCustodianError } from '../domain/assetCustodian';
import { lockCustodianDirectory, resolveCustodianSelection } from '../services/assetCustodian';
import { hydrateAssetCustodians } from '../services/assetCustodianRead';
import { assignmentActor, canCreateManualCustodian, writeAssetAssignment } from '../services/assetAssignment';
import { eq, ilike, or, and, desc, ne, count, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { equipmentTypeDeleteConflict, parseEquipmentTypeInput } from '../domain/equipmentTypes';
import {
  computerSpecsSchema,
  accessorySchema,
  isComputerEquipmentType,
} from '../domain/assetDetails';
import { allocateSequentialCodes } from '../domain/assetCode';
import { replaceAssetDetails, type AssetDetailsRepository } from '../services/assetDetailsPersistence';

// --- Zod Schemas ---
const createCategorySchema = z
  .object({
    name: z.string().min(1, 'Category name is required').max(100),
    codePrefix: z.string().min(1, 'Code prefix is required').max(20).optional(),
    code: z.string().min(1).max(20).optional(),
  })
  .refine((data) => !!(data.codePrefix || data.code), {
    message: 'Code prefix is required',
    path: ['codePrefix'],
  });

const updateCategorySchema = z.object({
  name: z.string().min(1, 'Equipment type name is required').max(100),
  codePrefix: z.string().min(1, 'Code prefix is required').max(20),
});

function isDatabaseError(err: unknown, code: string): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    if ('code' in current && current.code === code) return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}

async function equipmentTypeExists(name: string, codePrefix: string, exceptId?: number): Promise<boolean> {
  const duplicateCondition = or(
    eq(sql<string>`lower(${assetCategories.name})`, name.toLowerCase()),
    eq(sql<string>`lower(${assetCategories.codePrefix})`, codePrefix.toLowerCase()),
  );
  const whereCondition = exceptId === undefined
    ? duplicateCondition
    : and(duplicateCondition, ne(assetCategories.id, exceptId));

  const existing = await db
    .select({ id: assetCategories.id })
    .from(assetCategories)
    .where(whereCondition)
    .limit(1);

  return existing.length > 0;
}

const createAssetSchema = z.object({
  custodianId: z.number().int().positive().nullable().optional(),
  newCustodian: manualCustodianSchema.optional(),
  assignedToEmployeeId: z.never().optional(),
  currentCustodianId: z.never().optional(),
  assetCode: z.string().max(50).optional().nullable(),
  name: z.string().min(1, 'Asset name is required').max(150),
  categoryId: z.number({ message: 'Category ID is required' }),
  locationId: z.number().optional().nullable(),
  serialNumber: z.string().max(100).optional().nullable(),
  status: z.enum(['Available', 'Assigned', 'Maintenance', 'Disposed', 'Lost']).default('Available'),
  condition: z.enum(['Good', 'Fair', 'Poor', 'Damaged']).default('Good'),
  notes: z.string().optional().nullable(),
  computerSpecs: computerSpecsSchema.nullable().optional(),
  accessories: z.array(accessorySchema).optional(),
});

const updateAssetSchema = z.object({
  custodianId: z.number().int().positive().nullable().optional(),
  newCustodian: manualCustodianSchema.optional(),
  assignedToEmployeeId: z.never().optional(),
  currentCustodianId: z.never().optional(),
  assetCode: z.string().max(50).optional(),
  name: z.string().min(1).max(150).optional(),
  categoryId: z.number().optional(),
  locationId: z.number().optional().nullable(),
  serialNumber: z.string().max(100).optional().nullable(),
  status: z.enum(['Available', 'Assigned', 'Maintenance', 'Disposed', 'Lost']).optional(),
  condition: z.enum(['Good', 'Fair', 'Poor', 'Damaged']).optional(),
  notes: z.string().optional().nullable(),
  computerSpecs: computerSpecsSchema.nullable().optional(),
  accessories: z.array(accessorySchema).optional(),
});

// --- Auto Code Generator Helper ---
export async function generateAssetCode(categoryId: number, runner: any = db): Promise<string> {
  const [category] = await runner
    .select()
    .from(assetCategories)
    .where(eq(assetCategories.id, categoryId));

  if (!category) {
    throw new Error('Category not found');
  }

  const prefix = (category.codePrefix || 'AST').toUpperCase();
  const year = new Date().getFullYear();

  await runner.execute(sql`SELECT pg_advisory_xact_lock(hashtext('asset_code_seq'), hashtext(${prefix + '-' + year}))`);

  const pattern = `${prefix}-${year}-%`;
  const existingAssets = await runner
    .select({ assetCode: assets.assetCode })
    .from(assets)
    .where(ilike(assets.assetCode, pattern));

  const existingCodes = existingAssets.map((item: any) => item.assetCode as string);
  const [allocated] = allocateSequentialCodes(prefix, year, existingCodes, 1);
  return allocated;
}

async function hydrateAssetsWithDetails<T extends { id: number; currentCustodianId: number | null }>(
  assetRows: T[],
  runner: any = db,
): Promise<Array<T & { computerSpecs: any; accessories: any[] }>> {
  if (assetRows.length === 0) return [];
  const assetIds = assetRows.map((a) => a.id);

  const specsRows = await runner.select().from(assetComputerSpecs).where(inArray(assetComputerSpecs.assetId, assetIds));
  const accRows = await runner.select().from(assetAccessories).where(inArray(assetAccessories.assetId, assetIds));
  const rowsWithCustodians = await hydrateAssetCustodians(assetRows, runner);

  const specsByAssetId = new Map<number, any>();
  for (const s of specsRows) {
    specsByAssetId.set(s.assetId, s);
  }

  const accessoriesByAssetId = new Map<number, any[]>();
  for (const a of accRows) {
    const list = accessoriesByAssetId.get(a.assetId) || [];
    list.push(a);
    accessoriesByAssetId.set(a.assetId, list);
  }

  return rowsWithCustodians.map((asset) => ({
    ...asset,
    computerSpecs: specsByAssetId.get(asset.id) ?? null,
    accessories: accessoriesByAssetId.get(asset.id) ?? [],
  }));
}

// --- Category Controllers ---
export async function getCategories(req: Request, res: Response) {
  try {
    const categories = await db.select().from(assetCategories).orderBy(assetCategories.id);
    return res.status(200).json(categories);
  } catch (err: any) {
    if (sendCustodianError(res, err)) return;
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function createCategory(req: Request, res: Response) {
  try {
    const parsed = createCategorySchema.parse(req.body);
    const normalized = parseEquipmentTypeInput({
      name: parsed.name,
      codePrefix: parsed.codePrefix || parsed.code || '',
    });

    if (await equipmentTypeExists(normalized.name, normalized.codePrefix)) {
      return res.status(409).json({ error: 'Equipment type name or code prefix already exists' });
    }

    const [inserted] = await db
      .insert(assetCategories)
      .values(normalized)
      .returning();

    return res.status(201).json(inserted);
  } catch (err: any) {
    if (sendCustodianError(res, err)) return;
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    if (isDatabaseError(err, '23505')) {
      return res.status(409).json({ error: 'Equipment type name or code prefix already exists' });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid equipment type ID' });
    }

    const parsed = updateCategorySchema.parse(req.body);
    const normalized = parseEquipmentTypeInput(parsed);

    if (await equipmentTypeExists(normalized.name, normalized.codePrefix, id)) {
      return res.status(409).json({ error: 'Equipment type name or code prefix already exists' });
    }

    const [updated] = await db
      .update(assetCategories)
      .set(normalized)
      .where(eq(assetCategories.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Equipment type not found' });
    }

    return res.status(200).json(updated);
  } catch (err: any) {
    if (sendCustodianError(res, err)) return;
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    if (isDatabaseError(err, '23505')) {
      return res.status(409).json({ error: 'Equipment type name or code prefix already exists' });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid equipment type ID' });
    }

    const [{ assetCount }] = await db
      .select({ assetCount: count() })
      .from(assets)
      .where(eq(assets.categoryId, id));
    const conflict = equipmentTypeDeleteConflict(assetCount);

    if (conflict) {
      return res.status(409).json({ error: conflict });
    }

    const [deleted] = await db
      .delete(assetCategories)
      .where(eq(assetCategories.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Equipment type not found' });
    }

    return res.status(200).json({ message: 'Equipment type deleted successfully', equipmentType: deleted });
  } catch (err: any) {
    if (sendCustodianError(res, err)) return;
    if (isDatabaseError(err, '23503')) {
      return res.status(409).json({ error: 'Equipment type is still used by inventory and cannot be deleted' });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// --- Asset Controllers ---
export async function getAssets(req: Request, res: Response) {
  try {
    const { search, categoryId, locationId, status } = req.query;

    const conditions = [assetScopePredicate(req)];

    if (search && typeof search === 'string' && search.trim() !== '') {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(assets.name, searchPattern),
          ilike(assets.assetCode, searchPattern),
          ilike(assets.serialNumber, searchPattern),
          ilike(assetCustodians.displayName, searchPattern),
          ilike(employees.employeeCode, searchPattern)
        )!
      );
    }

    if (categoryId) {
      const catId = Number(categoryId);
      if (!isNaN(catId)) {
        conditions.push(eq(assets.categoryId, catId));
      }
    }

    if (locationId) {
      const locId = Number(locationId);
      if (!isNaN(locId)) {
        conditions.push(eq(assets.locationId, locId));
      }
    }

    if (status && typeof status === 'string' && status.trim() !== '') {
      conditions.push(eq(assets.status, status.trim()));
    }

    const query = db
      .select({
        id: assets.id,
        assetCode: assets.assetCode,
        name: assets.name,
        categoryId: assets.categoryId,
        categoryName: assetCategories.name,
        categoryCodePrefix: assetCategories.codePrefix,
        locationId: assets.locationId,
        locationName: locations.name,
        currentCustodianId: assets.currentCustodianId,
        assignedToEmployeeId: employees.id,
        assignedEmployeeName: sql<string | null>`coalesce(${employees.fullName}, ${assetCustodians.displayName})`,
        assignedEmployeeCode: employees.employeeCode,
        serialNumber: assets.serialNumber,
        status: assets.status,
        condition: assets.condition,
        notes: assets.notes,
        createdAt: assets.createdAt,
        updatedAt: assets.updatedAt,
      })
      .from(assets)
      .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
      .leftJoin(locations, eq(assets.locationId, locations.id))
      .leftJoin(assetCustodians, eq(assets.currentCustodianId, assetCustodians.id))
      .leftJoin(employees, eq(assetCustodians.employeeId, employees.id));

    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(assets.id))
      : await query.orderBy(desc(assets.id));

    const result = await hydrateAssetsWithDetails(rows);
    return res.status(200).json(result);
  } catch (err: any) {
    if (sendCustodianError(res, err)) return;
    return res.status(500).json({ error: 'Asset operation failed' });
  }
}

export async function getAssetById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const rows = await db
      .select({
        id: assets.id,
        assetCode: assets.assetCode,
        name: assets.name,
        categoryId: assets.categoryId,
        categoryName: assetCategories.name,
        categoryCodePrefix: assetCategories.codePrefix,
        locationId: assets.locationId,
        locationName: locations.name,
        currentCustodianId: assets.currentCustodianId,
        assignedToEmployeeId: employees.id,
        assignedEmployeeName: sql<string | null>`coalesce(${employees.fullName}, ${assetCustodians.displayName})`,
        assignedEmployeeCode: employees.employeeCode,
        serialNumber: assets.serialNumber,
        status: assets.status,
        condition: assets.condition,
        notes: assets.notes,
        createdAt: assets.createdAt,
        updatedAt: assets.updatedAt,
      })
      .from(assets)
      .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
      .leftJoin(locations, eq(assets.locationId, locations.id))
      .leftJoin(assetCustodians, eq(assets.currentCustodianId, assetCustodians.id))
      .leftJoin(employees, eq(assetCustodians.employeeId, employees.id))
      .where(and(eq(assets.id, id),assetScopePredicate(req)));

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const hydrated = await hydrateAssetsWithDetails(rows);
    return res.status(200).json(hydrated[0]);
  } catch (err: any) {
    if (sendCustodianError(res, err)) return;
    return res.status(500).json({ error: 'Asset operation failed' });
  }
}

export async function createAsset(req: AuthenticatedRequest, res: Response) {
  try {
    const parsed = createAssetSchema.parse(req.body);
    const actorId = assignmentActor(req);
    if (parsed.custodianId !== undefined && parsed.newCustodian !== undefined) throw new CustodianError('Select one custodian or create one holder, not both');

    const result = await db.transaction(async (tx) => {
      await lockCustodianDirectory(tx);
      await requireAssetLocation(tx,req,parsed.locationId);
      const [category] = await tx
        .select()
        .from(assetCategories)
        .where(eq(assetCategories.id, parsed.categoryId));

      if (!category) {
        throw new Error('Category not found');
      }

      const normSerial = parsed.serialNumber && parsed.serialNumber.trim() ? parsed.serialNumber.trim() : null;

      if (normSerial) {
        const [existingSerial] = await tx
          .select({ id: assets.id, assetCode: assets.assetCode })
          .from(assets)
          .where(sql`lower(trim(${assets.serialNumber})) = lower(${normSerial})`)
          .limit(1);

        if (existingSerial) {
          throw new Error(`Serial number is already registered. Each device must have a unique serial number.`);
        }
      }

      let code = parsed.assetCode;
      if (!code || code.trim() === '') {
        code = await generateAssetCode(parsed.categoryId, tx);
      }

      await authorizeCustodianSelection(tx,req,parsed,parsed.locationId);
      const custodian = parsed.custodianId != null || parsed.newCustodian
        ? await resolveCustodianSelection(tx, parsed, actorId, canCreateManualCustodian(req),assetRequestScope(req))
        : null;
      if (parsed.status === 'Assigned' && !custodian) throw new CustodianError('Assigned assets require a custodian');
      if (custodian && !['Assigned', 'Available'].includes(parsed.status)) throw new CustodianError('A new holder requires an available asset');

      const [inserted] = await tx
        .insert(assets)
        .values({
          assetCode: code,
          name: parsed.name,
          categoryId: parsed.categoryId,
          locationId: parsed.locationId ?? null,
          serialNumber: normSerial,
          status: parsed.status,
          condition: parsed.condition,
          notes: parsed.notes ?? null,
        })
        .returning();

      if (custodian) {
        await writeAssetAssignment(tx, inserted, custodian, actorId, {
          locationId: parsed.locationId ?? null,
          handoverNotes: parsed.notes,
        });
      }
      await tx.insert(auditLogs).values({
        userId: actorId, action: 'CREATE', entity: 'ASSET', entityId: inserted.id,
        newValues: { groupId:assetRequestScope(req).selectedGroupId, assetCode: inserted.assetCode, currentCustodianId: custodian?.id ?? null },
      });

      const repository: AssetDetailsRepository = {
        deleteComputerSpecs: async (assetId) => {
          await tx.delete(assetComputerSpecs).where(eq(assetComputerSpecs.assetId, assetId));
        },
        deleteAccessories: async (assetId) => {
          await tx.delete(assetAccessories).where(eq(assetAccessories.assetId, assetId));
        },
        insertComputerSpecs: async (value) => {
          await tx.insert(assetComputerSpecs).values(value);
        },
        insertAccessories: async (values) => {
          await tx.insert(assetAccessories).values(values);
        },
      };

      await replaceAssetDetails(repository, {
        assetId: inserted.id,
        categoryName: category.name,
        computerSpecs: parsed.computerSpecs,
        accessories: parsed.accessories,
      });

      const rows = await tx
        .select({
          id: assets.id,
          assetCode: assets.assetCode,
          name: assets.name,
          categoryId: assets.categoryId,
          categoryName: assetCategories.name,
          categoryCodePrefix: assetCategories.codePrefix,
          locationId: assets.locationId,
          locationName: locations.name,
          currentCustodianId: assets.currentCustodianId,
        assignedToEmployeeId: employees.id,
          assignedEmployeeName: sql<string | null>`coalesce(${employees.fullName}, ${assetCustodians.displayName})`,
          assignedEmployeeCode: employees.employeeCode,
          serialNumber: assets.serialNumber,
          status: assets.status,
          condition: assets.condition,
          notes: assets.notes,
          createdAt: assets.createdAt,
          updatedAt: assets.updatedAt,
        })
        .from(assets)
        .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
        .leftJoin(locations, eq(assets.locationId, locations.id))
        .leftJoin(assetCustodians, eq(assets.currentCustodianId, assetCustodians.id))
      .leftJoin(employees, eq(assetCustodians.employeeId, employees.id))
        .where(eq(assets.id, inserted.id));

      const hydrated = await hydrateAssetsWithDetails(rows, tx);
      return hydrated[0];
    });

    return res.status(201).json(result);
  } catch (err: any) {
    if (sendCustodianError(res, err)) return;
    if (sendCustodianError(res, err)) return;
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    if (err.message === 'Category not found') {
      return res.status(400).json({ error: 'Invalid categoryId: Category not found' });
    }
    if (err.message && (err.message.includes('Computer specifications') || err.message.includes('Laptop or PC'))) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message?.includes('already registered on asset')) return res.status(409).json({ error: err.message });
    return res.status(500).json({ error: 'Failed to create asset' });
  }
}

export async function updateAsset(req: AuthenticatedRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const parsed = updateAssetSchema.parse(req.body);
    const actorId = assignmentActor(req);
    if (parsed.custodianId !== undefined && parsed.newCustodian !== undefined) throw new CustodianError('Select one custodian or create one holder, not both');

    const result = await db.transaction(async (tx) => {
      await lockCustodianDirectory(tx);
      const [existing] = await tx
        .select()
        .from(assets)
        .where(eq(assets.id, id)).for('update');

      if (!existing) {
        return null;
      }

      await authorizeAssetMutation(tx,req,existing,parsed.locationId);

      const effectiveCategoryId = parsed.categoryId ?? existing.categoryId;
      const [category] = await tx
        .select()
        .from(assetCategories)
        .where(eq(assetCategories.id, effectiveCategoryId));

      if (!category) {
        throw new Error('Category not found');
      }

      const { computerSpecs, accessories, custodianId, newCustodian, assignedToEmployeeId: _legacyEmployeeId, currentCustodianId: _readOnlyCustodianId, ...baseUpdateFields } = parsed;
      const selectionChanged = newCustodian !== undefined || (custodianId !== undefined && custodianId !== existing.currentCustodianId);
      if (selectionChanged && (custodianId != null || newCustodian) && ['Disposed', 'Lost', 'Maintenance'].includes(existing.status)) {
        throw new CustodianError('This asset is not available for assignment', 409);
      }
      if (selectionChanged) {
        await authorizeCustodianSelection(tx,req,parsed,parsed.locationId === undefined ? existing.locationId : parsed.locationId);
        const custodian = custodianId != null || newCustodian
          ? await resolveCustodianSelection(tx, parsed, actorId, canCreateManualCustodian(req),assetRequestScope(req))
          : null;
        if (parsed.status && !['Assigned', 'Available'].includes(parsed.status)) throw new CustodianError('Change holder and lifecycle status separately');
        await writeAssetAssignment(tx, existing, custodian, actorId, {
          locationId: parsed.locationId === undefined ? existing.locationId : parsed.locationId,
          conditionOnAssign: parsed.condition,
          handoverNotes: parsed.notes,
        });
        baseUpdateFields.status = custodian ? 'Assigned' : 'Available';
      } else if ((parsed.status === 'Assigned' && !existing.currentCustodianId) || (parsed.status === 'Available' && existing.currentCustodianId)) {
        throw new CustodianError('Change the custodian to assign or return this asset');
      }

      if (baseUpdateFields.serialNumber !== undefined) {
        const normSerial = baseUpdateFields.serialNumber && baseUpdateFields.serialNumber.trim()
          ? baseUpdateFields.serialNumber.trim()
          : null;
        baseUpdateFields.serialNumber = normSerial;

        if (normSerial) {
          const [existingSerial] = await tx
            .select({ id: assets.id, assetCode: assets.assetCode })
            .from(assets)
            .where(
              and(
                sql`lower(trim(${assets.serialNumber})) = lower(${normSerial})`,
                ne(assets.id, id)
              )
            )
            .limit(1);

          if (existingSerial) {
            throw new Error(`Serial number is already registered. Each device must have a unique serial number.`);
          }
        }
      }

      if (Object.keys(baseUpdateFields).length > 0) {
        await tx
          .update(assets)
          .set({
            ...baseUpdateFields,
            updatedAt: new Date(),
          })
          .where(eq(assets.id, id));
      }

      const repository: AssetDetailsRepository = {
        deleteComputerSpecs: async (assetId) => {
          await tx.delete(assetComputerSpecs).where(eq(assetComputerSpecs.assetId, assetId));
        },
        deleteAccessories: async (assetId) => {
          await tx.delete(assetAccessories).where(eq(assetAccessories.assetId, assetId));
        },
        insertComputerSpecs: async (value) => {
          await tx.insert(assetComputerSpecs).values(value);
        },
        insertAccessories: async (values) => {
          await tx.insert(assetAccessories).values(values);
        },
      };

      if (computerSpecs !== undefined || accessories !== undefined || parsed.categoryId !== undefined) {
        let specsToUse = computerSpecs;
        if (specsToUse === undefined && isComputerEquipmentType(category.name)) {
          const [existingSpecs] = await tx
            .select()
            .from(assetComputerSpecs)
            .where(eq(assetComputerSpecs.assetId, id));
          specsToUse = existingSpecs ? {
            cpuName: existingSpecs.cpuName,
            ramSizeGb: existingSpecs.ramSizeGb,
            ramSlotCount: existingSpecs.ramSlotCount,
            disk1SizeGb: existingSpecs.disk1SizeGb,
            disk2SizeGb: existingSpecs.disk2SizeGb,
          } : null;
        }

        let accToUse = accessories;
        if (accToUse === undefined && isComputerEquipmentType(category.name)) {
          const existingAcc = await tx
            .select()
            .from(assetAccessories)
            .where(eq(assetAccessories.assetId, id));
          accToUse = existingAcc.map((a) => ({
            accessoryType: a.accessoryType,
            description: a.description,
            quantity: a.quantity,
            condition: a.condition as any,
            notes: a.notes,
          }));
        }

        await replaceAssetDetails(repository, {
          assetId: id,
          categoryName: category.name,
          computerSpecs: specsToUse,
          accessories: accToUse,
        });
      }

      await tx.insert(auditLogs).values({
        userId: actorId, action: 'UPDATE', entity: 'ASSET', entityId: id,
        oldValues: { name: existing.name, currentCustodianId: existing.currentCustodianId, locationId: existing.locationId },
        newValues: { ...baseUpdateFields, groupId:assetRequestScope(req).selectedGroupId },
      });

      const rows = await tx
        .select({
          id: assets.id,
          assetCode: assets.assetCode,
          name: assets.name,
          categoryId: assets.categoryId,
          categoryName: assetCategories.name,
          categoryCodePrefix: assetCategories.codePrefix,
          locationId: assets.locationId,
          locationName: locations.name,
          currentCustodianId: assets.currentCustodianId,
        assignedToEmployeeId: employees.id,
          assignedEmployeeName: sql<string | null>`coalesce(${employees.fullName}, ${assetCustodians.displayName})`,
          assignedEmployeeCode: employees.employeeCode,
          serialNumber: assets.serialNumber,
          status: assets.status,
          condition: assets.condition,
          notes: assets.notes,
          createdAt: assets.createdAt,
          updatedAt: assets.updatedAt,
        })
        .from(assets)
        .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
        .leftJoin(locations, eq(assets.locationId, locations.id))
        .leftJoin(assetCustodians, eq(assets.currentCustodianId, assetCustodians.id))
      .leftJoin(employees, eq(assetCustodians.employeeId, employees.id))
        .where(eq(assets.id, id));

      const hydrated = await hydrateAssetsWithDetails(rows, tx);
      return hydrated[0];
    });

    if (!result) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    return res.status(200).json(result);
  } catch (err: any) {
    if (sendCustodianError(res, err)) return;
    if (sendCustodianError(res, err)) return;
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    if (err.message && (err.message.includes('Computer specifications') || err.message.includes('Laptop or PC'))) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message === 'Category not found') return res.status(400).json({ error: 'Invalid categoryId: Category not found' });
    if (err.message?.includes('already registered on asset')) return res.status(409).json({ error: err.message });
    return res.status(500).json({ error: 'Failed to update asset' });
  }
}

export async function deleteAsset(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const deletedAsset = await db.transaction(async (tx) => {
      await requireScopedAsset(tx,req,id);
      // Proactively clean up child records and decouple references
      await tx.delete(assetAssignmentHistory).where(eq(assetAssignmentHistory.assetId, id));
      await tx.delete(assetAccessories).where(eq(assetAccessories.assetId, id));
      await tx.delete(assetComputerSpecs).where(eq(assetComputerSpecs.assetId, id));
      await tx.delete(assetMaintenances).where(eq(assetMaintenances.assetId, id));
      await tx.update(itTickets).set({ assetId: null }).where(eq(itTickets.assetId, id));
      await tx.update(licenseAllocations).set({ assetId: null }).where(eq(licenseAllocations.assetId, id));
      await tx.update(accurateLicenses).set({ assetId: null }).where(eq(accurateLicenses.assetId, id));

      const deletedList = await tx
        .delete(assets)
        .where(eq(assets.id, id))
        .returning();

      if (deletedList.length === 0) {
        return null;
      }
      return deletedList[0];
    });

    if (!deletedAsset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    return res.status(200).json({ message: 'Asset deleted successfully', asset: deletedAsset });
  } catch (err: any) {
    if (sendCustodianError(res, err)) return;
    console.error('Failed to delete asset:', err);
    return res.status(500).json({ error: err.message || 'Asset operation failed' });
  }
}
