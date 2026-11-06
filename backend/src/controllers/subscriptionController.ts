import { Request, Response } from 'express';
import { db } from '../db';
import { subscriptions } from '../db/schema/infrastructure';
import { eq, ilike, or, and, asc, sql } from 'drizzle-orm';
import { z } from 'zod';

const subscriptionCategories = ['DOMAIN', 'HOSTING', 'EMAIL', 'SSL', 'SAAS'] as const;
const billingCycles = ['Tahunan', 'Bulanan', '2 Tahun', '3 Tahun'] as const;

export const createSubscriptionSchema = z.object({
  name: z.string().trim().min(1, 'Nama layanan wajib diisi').max(150),
  category: z.enum(subscriptionCategories, {
    message: 'Kategori harus DOMAIN, HOSTING, EMAIL, SSL, atau SAAS',
  }),
  provider: z.string().trim().min(1, 'Provider/Registrar wajib diisi').max(150),
  registeredDomain: z.string().trim().max(255).optional().nullable(),
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal mulai harus YYYY-MM-DD')
    .optional()
    .nullable()
    .or(z.literal('')),
  expiryDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal kedaluwarsa harus YYYY-MM-DD'),
  renewalCost: z.coerce.number().min(0, 'Biaya perpanjangan tidak boleh negatif').default(0),
  billingCycle: z.enum(billingCycles).default('Tahunan'),
  autoRenew: z.boolean().default(false),
  loginUrl: z.string().trim().max(255).optional().nullable().or(z.literal('')),
  notes: z.string().trim().optional().nullable(),
});

export const updateSubscriptionSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  category: z.enum(subscriptionCategories).optional(),
  provider: z.string().trim().min(1).max(150).optional(),
  registeredDomain: z.string().trim().max(255).optional().nullable(),
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal('')),
  expiryDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  renewalCost: z.coerce.number().min(0).optional(),
  billingCycle: z.enum(billingCycles).optional(),
  autoRenew: z.boolean().optional(),
  loginUrl: z.string().trim().max(255).optional().nullable().or(z.literal('')),
  notes: z.string().trim().optional().nullable(),
});

export async function getSubscriptions(req: Request, res: Response) {
  try {
    const { search, category } = req.query;

    const conditions = [];

    if (search && typeof search === 'string' && search.trim() !== '') {
      const pattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(subscriptions.name, pattern),
          ilike(subscriptions.provider, pattern),
          ilike(subscriptions.registeredDomain, pattern),
          ilike(subscriptions.notes, pattern)
        )
      );
    }

    if (
      category &&
      typeof category === 'string' &&
      category !== 'ALL' &&
      subscriptionCategories.includes(category as any)
    ) {
      conditions.push(eq(subscriptions.category, category));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(subscriptions)
      .where(whereClause)
      .orderBy(asc(subscriptions.expiryDate), asc(subscriptions.name));

    return res.json({
      success: true,
      data: rows,
    });
  } catch (err: any) {
    console.error('Error fetching subscriptions:', err);
    return res.status(500).json({
      success: false,
      error: 'Gagal mengambil data layanan langganan',
    });
  }
}

export async function createSubscription(req: Request, res: Response) {
  try {
    const parsed = createSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Input tidak valid',
        issues: parsed.error.issues,
      });
    }

    const input = parsed.data;

    const [created] = await db
      .insert(subscriptions)
      .values({
        name: input.name,
        category: input.category,
        provider: input.provider,
        registeredDomain: input.registeredDomain || null,
        startDate: input.startDate || null,
        expiryDate: input.expiryDate,
        renewalCost: String(input.renewalCost ?? 0),
        billingCycle: input.billingCycle,
        autoRenew: Boolean(input.autoRenew),
        loginUrl: input.loginUrl || null,
        notes: input.notes || null,
      })
      .returning();

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (err: any) {
    console.error('Error creating subscription:', err);
    return res.status(500).json({
      success: false,
      error: 'Gagal menambahkan layanan langganan baru',
    });
  }
}

export async function updateSubscription(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID langganan tidak valid' });
    }

    const parsed = updateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Input tidak valid',
        issues: parsed.error.issues,
      });
    }

    const existing = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Layanan langganan tidak ditemukan' });
    }

    const input = parsed.data;
    const valuesToUpdate: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) valuesToUpdate.name = input.name;
    if (input.category !== undefined) valuesToUpdate.category = input.category;
    if (input.provider !== undefined) valuesToUpdate.provider = input.provider;
    if (input.registeredDomain !== undefined) valuesToUpdate.registeredDomain = input.registeredDomain || null;
    if (input.startDate !== undefined) valuesToUpdate.startDate = input.startDate || null;
    if (input.expiryDate !== undefined) valuesToUpdate.expiryDate = input.expiryDate;
    if (input.renewalCost !== undefined) valuesToUpdate.renewalCost = String(input.renewalCost);
    if (input.billingCycle !== undefined) valuesToUpdate.billingCycle = input.billingCycle;
    if (input.autoRenew !== undefined) valuesToUpdate.autoRenew = Boolean(input.autoRenew);
    if (input.loginUrl !== undefined) valuesToUpdate.loginUrl = input.loginUrl || null;
    if (input.notes !== undefined) valuesToUpdate.notes = input.notes || null;

    const [updated] = await db
      .update(subscriptions)
      .set(valuesToUpdate)
      .where(eq(subscriptions.id, id))
      .returning();

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    console.error('Error updating subscription:', err);
    return res.status(500).json({
      success: false,
      error: 'Gagal memperbarui layanan langganan',
    });
  }
}

export async function deleteSubscription(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID langganan tidak valid' });
    }

    const [deleted] = await db
      .delete(subscriptions)
      .where(eq(subscriptions.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Layanan langganan tidak ditemukan' });
    }

    return res.json({
      success: true,
      message: 'Layanan langganan berhasil dihapus',
      id: deleted.id,
    });
  } catch (err: any) {
    console.error('Error deleting subscription:', err);
    return res.status(500).json({
      success: false,
      error: 'Gagal menghapus layanan langganan',
    });
  }
}
