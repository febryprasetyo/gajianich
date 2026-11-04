import { z } from 'zod';

export const VALID_ITEM_TYPES = ['laptop', 'monitor', 'printer', 'pc', 'mouse', 'lainnya'] as const;
export type ItemType = (typeof VALID_ITEM_TYPES)[number];

export type HandoverStatus = 'DRAFT' | 'COMPLETED' | 'ARCHIVED';

export class HandoverInputError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'HandoverInputError';
    this.statusCode = statusCode;
  }
}

export function formatHandoverNumber(dateStr: string, sequenceNumber: number): string {
  const cleanDate = dateStr.replace(/-/g, '').slice(0, 6); // YYYYMM
  const paddedSeq = String(Math.max(1, Math.floor(sequenceNumber))).padStart(4, '0');
  return `TTB-${cleanDate}-${paddedSeq}`;
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateSchema = z.string().regex(dateRegex, 'Format tanggal harus YYYY-MM-DD').refine((val) => {
  const d = new Date(`${val}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === val;
}, 'Tanggal tidak valid');

export const handoverItemInputSchema = z.object({
  itemOrder: z.number().int().min(1).default(1),
  assetId: z.number().int().positive().nullable().optional(),
  itemName: z.string().trim().min(1, 'Nama barang wajib diisi').max(255, 'Nama barang maksimal 255 karakter'),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const handoverInputSchema = z.object({
  handoverDate: dateSchema,
  organizationId: z.number().int().positive().nullable().optional(),
  employeeId: z.number().int().positive().nullable().optional(),
  recipientName: z.string().trim().min(1, 'Nama penerima wajib diisi').max(150),
  recipientAddress: z.string().trim().max(500).nullable().optional(),
  recipientPosition: z.string().trim().max(100).nullable().optional(),
  recipientPhone: z.string().trim().max(50).nullable().optional(),
  itemTypes: z.array(z.string().trim().toLowerCase()).default([]),
  itemTypesCustom: z.string().trim().max(150).nullable().optional(),
  givenByName: z.string().trim().min(1, 'Nama pihak yang menyerahkan wajib diisi').max(150),
  givenByTitle: z.string().trim().max(100).nullable().optional(),
  givenByUserId: z.number().int().positive().nullable().optional(),
  receivedByName: z.string().trim().min(1, 'Nama pihak yang menerima wajib diisi').max(150),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'COMPLETED', 'ARCHIVED']).default('COMPLETED'),
  items: z.array(handoverItemInputSchema).min(1, 'Minimal sertakan 1 rincian barang'),
});

export type HandoverInput = z.infer<typeof handoverInputSchema>;
export type HandoverItemInput = z.infer<typeof handoverItemInputSchema>;

export function validateHandoverInput(data: unknown): HandoverInput {
  const parsed = handoverInputSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const prefix = issue.path.length ? `[${issue.path.join('.')}] ` : '';
    throw new HandoverInputError(`${prefix}${issue.message}`);
  }
  return parsed.data;
}
