import { Request, Response } from 'express';
import { db } from '../db';
import { departments, locations } from '../db/schema/master';
import { vendors } from '../db/schema/vendors';
import { eq,getTableColumns } from 'drizzle-orm';
import {departmentOrganizationMappings,locationOrganizationMappings} from '../db/schema/organizations';
import {requireHrScope,historicalScopePredicate} from '../services/hrOrganizationScope';
import { z } from 'zod';
import { resolveAuditContext } from '../services/hrAudit';
import { runHrMutation } from '../services/hrMutation';
import { hashRequestPayload } from '../domain/hrAudit';
import { mutateDepartment, mutateLocation } from '../services/hrMasterMutations';

// --- Zod Schemas ---
const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100),
  code: z.string().min(1, 'Department code is required').max(20),
  isActive: z.boolean().optional().default(true),
});

const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
});

const createLocationSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1, 'Location name is required').max(100),
  address: z.string().max(255).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const updateLocationSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(255).optional().nullable(),
  isActive: z.boolean().optional(),
});

const createVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required').max(150),
  contactName: z.string().max(100).optional().nullable(),
  email: z.string().email('Invalid email format').optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().optional().nullable(),
});

const updateVendorSchema = createVendorSchema.partial();

// --- Department Controllers ---
export async function getDepartments(req: Request, res: Response) {
  try {
    const scope=requireHrScope(req as any);
    const list = await db.select(getTableColumns(departments)).from(departments).leftJoin(departmentOrganizationMappings,eq(departmentOrganizationMappings.departmentId,departments.id)).where(historicalScopePredicate(scope,departmentOrganizationMappings.groupId));
    return res.status(200).json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function createDepartment(req: Request, res: Response) {
  try {
    const parsed = createDepartmentSchema.parse(req.body);
    if ((req as any).user) {
      const context = await resolveAuditContext(req as any);
      const requestHash = hashRequestPayload({ command: 'department_create', body: parsed });
      const result = await runHrMutation(context, requestHash, async (tx) => {
        return await mutateDepartment(tx, context, { type: 'CREATE', data: parsed });
      });
      return res.status(201).json(result.department);
    }
    const [inserted] = await db.insert(departments).values(parsed).returning();
    return res.status(201).json(inserted);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    const isUnique =
      err.code === '23505' ||
      err.cause?.code === '23505' ||
      /unique constraint|duplicate key/i.test(err.message || '');
    if (isUnique) {
      return res.status(409).json({
        error: 'Departemen dengan nama atau kode tersebut sudah terdaftar.',
      });
    }
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

export async function updateDepartment(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid department ID' });
    }

    const parsed = updateDepartmentSchema.parse(req.body);
    if ((req as any).user) {
      const context = await resolveAuditContext(req as any);
      const requestHash = hashRequestPayload({ command: 'department_update', id, body: parsed });
      const result = await runHrMutation(context, requestHash, async (tx) => {
        return await mutateDepartment(tx, context, { type: 'UPDATE', id, data: parsed });
      });
      return res.status(200).json(result.department);
    }

    const updatedList = await db
      .update(departments)
      .set(parsed)
      .where(eq(departments.id, id))
      .returning();

    if (updatedList.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    return res.status(200).json(updatedList[0]);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    const isUnique =
      err.code === '23505' ||
      err.cause?.code === '23505' ||
      /unique constraint|duplicate key/i.test(err.message || '');
    if (isUnique) {
      return res.status(409).json({
        error: 'Departemen dengan nama atau kode tersebut sudah terdaftar.',
      });
    }
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

export async function deleteDepartment(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid department ID' });
    }

    if ((req as any).user) {
      const context = await resolveAuditContext(req as any);
      const requestHash = hashRequestPayload({ command: 'department_delete', id });
      const result = await runHrMutation(context, requestHash, async (tx) => {
        return await mutateDepartment(tx, context, { type: 'DELETE', id });
      });
      return res.status(200).json({ message: 'Department deleted successfully', department: result.department });
    }

    const deletedList = await db
      .delete(departments)
      .where(eq(departments.id, id))
      .returning();

    if (deletedList.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    return res.status(200).json({ message: 'Department deleted successfully', department: deletedList[0] });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

// --- Location Controllers ---
export async function getLocations(req: Request, res: Response) {
  try {
    const scope=requireHrScope(req as any);
    const list = await db.select(getTableColumns(locations)).from(locations).leftJoin(locationOrganizationMappings,eq(locationOrganizationMappings.locationId,locations.id)).where(historicalScopePredicate(scope,locationOrganizationMappings.groupId));
    return res.status(200).json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function createLocation(req: Request, res: Response) {
  try {
    const parsed = createLocationSchema.parse(req.body);
    const code = parsed.code || 'LOC-' + Date.now().toString().slice(-6);
    const data = { ...parsed, code };

    if ((req as any).user) {
      const context = await resolveAuditContext(req as any);
      const requestHash = hashRequestPayload({ command: 'location_create', body: data });
      const result = await runHrMutation(context, requestHash, async (tx) => {
        return await mutateLocation(tx, context, { type: 'CREATE', data });
      });
      return res.status(201).json(result.location);
    }

    const [inserted] = await db.insert(locations).values(data).returning();
    return res.status(201).json(inserted);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    const isUnique =
      err.code === '23505' ||
      err.cause?.code === '23505' ||
      /unique constraint|duplicate key/i.test(err.message || '');
    if (isUnique) {
      return res.status(409).json({
        error: 'Lokasi dengan nama atau kode tersebut sudah terdaftar.',
      });
    }
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

export async function updateLocation(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid location ID' });
    }

    const parsed = updateLocationSchema.parse(req.body);
    if ((req as any).user) {
      const context = await resolveAuditContext(req as any);
      const requestHash = hashRequestPayload({ command: 'location_update', id, body: parsed });
      const result = await runHrMutation(context, requestHash, async (tx) => {
        return await mutateLocation(tx, context, { type: 'UPDATE', id, data: parsed });
      });
      return res.status(200).json(result.location);
    }

    const updatedList = await db
      .update(locations)
      .set(parsed)
      .where(eq(locations.id, id))
      .returning();

    if (updatedList.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    return res.status(200).json(updatedList[0]);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

export async function deleteLocation(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid location ID' });
    }

    if ((req as any).user) {
      const context = await resolveAuditContext(req as any);
      const requestHash = hashRequestPayload({ command: 'location_delete', id });
      const result = await runHrMutation(context, requestHash, async (tx) => {
        return await mutateLocation(tx, context, { type: 'DELETE', id });
      });
      return res.status(200).json({ message: 'Location deleted successfully', location: result.location });
    }

    const deletedList = await db
      .delete(locations)
      .where(eq(locations.id, id))
      .returning();

    if (deletedList.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    return res.status(200).json({ message: 'Location deleted successfully', location: deletedList[0] });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
  }
}

// --- Vendor Controllers ---
export async function getVendors(req: Request, res: Response) {
  try {
    const list = await db.select().from(vendors);
    return res.status(200).json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function createVendor(req: Request, res: Response) {
  try {
    const parsed = createVendorSchema.parse(req.body);
    const [inserted] = await db.insert(vendors).values(parsed).returning();
    return res.status(201).json(inserted);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function updateVendor(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid vendor ID' });
    }

    const parsed = updateVendorSchema.parse(req.body);
    const updatedList = await db
      .update(vendors)
      .set(parsed)
      .where(eq(vendors.id, id))
      .returning();

    if (updatedList.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    return res.status(200).json(updatedList[0]);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export async function deleteVendor(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid vendor ID' });
    }

    const deletedList = await db
      .delete(vendors)
      .where(eq(vendors.id, id))
      .returning();

    if (deletedList.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    return res.status(200).json({ message: 'Vendor deleted successfully', vendor: deletedList[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
