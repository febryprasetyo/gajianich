import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { and, desc, eq, getTableColumns, inArray, sql, or, isNull } from 'drizzle-orm';
import { db } from '../db';
import {
  goodsRequests,
  goodsRequestItems,
  goodsRequestAttachments,
  goodsRequestStatusLogs,
  goodsRequestSignedDocuments,
} from '../db/schema/goodsRequests';
import { users } from '../db/schema/users';
import { authenticateToken, requirePermission } from '../middleware/auth';
import {
  GoodsInputError,
  GoodsRequestStatus,
  isRequestEditable,
  isValidStatusTransition,
  validateGoodsRequest,
} from '../domain/goodsRequest';
import {
  GOODS_STORAGE_ROOT,
  saveGoodsEvidence,
  saveSignedDocument,
} from '../services/goodsEvidence';

import { requireOrganizationScope, type OrganizationScopedRequest } from '../middleware/organizationScope';
import { organizations } from '../db/schema/organizations';
import { resolveDocumentProfile, DocumentProfileUnavailableError } from '../services/documentProfile';
const router = Router();
router.use(authenticateToken);
const view = requirePermission('ga.requests.view');
const create = requirePermission('ga.requests.create');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 60,
    fileSize: 512000,
    fields: 2,
    fieldSize: 100000,
    parts: 62,
  },
}).array('evidence', 60);

const uploadSigned = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 10 * 1024 * 1024,
    fields: 1,
  },
}).single('document');

const asyncRoute = (handler: (req: OrganizationScopedRequest, res: Response) => Promise<unknown>) =>
  (req: OrganizationScopedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };

const readScope = requireOrganizationScope('ga', 'read');
const writeScope = requireOrganizationScope('ga', 'write');
const ownerScope = (req: OrganizationScopedRequest) => {
 const scope = req.organizationScope!;
 const mapped = scope.groupIds.length ? inArray(goodsRequests.groupId,scope.groupIds) : sql`false`;
 return scope.includeUnmapped ? or(mapped,isNull(goodsRequests.groupId))! : mapped;
};
async function destination(req: OrganizationScopedRequest, raw: any) {
 const groupId = req.organizationScope!.selectedGroupId!;
 if (raw.groupId !== undefined && raw.groupId !== groupId) throw new GoodsInputError('Kelompok tujuan tidak sesuai pilihan aktif.');
 const organizationId = Number(raw.organizationId);
 if (!Number.isSafeInteger(organizationId) || organizationId <= 0) throw new GoodsInputError('Pilih organisasi tujuan.');
 const [organization] = await db.select().from(organizations).where(and(eq(organizations.id,organizationId),eq(organizations.groupId,groupId),eq(organizations.isActive,true)));
 if (!organization) throw new GoodsInputError('Organisasi tujuan tidak tersedia dalam kelompok aktif.');
 return {groupId,organizationId};
}
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

router.get('/', view, readScope, asyncRoute(async (req, res) => {
  const page = Math.max(1, Math.min(100000, Math.floor(Number(req.query.page)) || 1));
  const limit = 20;
  const statusFilter = typeof req.query.status === 'string' && req.query.status.trim() !== ''
    ? req.query.status.trim()
    : undefined;

  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 1000) : '';
  const searchClause = search ? sql`(
    strpos(lower(${goodsRequests.title}), lower(${search})) > 0
    or strpos(lower(${goodsRequests.requesterName}), lower(${search})) > 0
    or strpos(lower(${goodsRequests.division}), lower(${search})) > 0
    or strpos(lower('GA-' || replace(${goodsRequests.requestDate}::text, '-', '') || '-' || left(${goodsRequests.id}::text, 8)), lower(${search})) > 0
    or exists (
      select 1 from ga_goods_request_items i
      where i.request_id = ${goodsRequests.id} and strpos(lower(i.name), lower(${search})) > 0
    )
  )` : undefined;
  const whereClause = and(ownerScope(req), statusFilter ? eq(goodsRequests.status, statusFilter) : undefined, searchClause);

  const [items, [total]] = await Promise.all([
    db.select({
      ...getTableColumns(goodsRequests),
      creatorName: users.username,
      matchedItemNames: search ? sql<string[]>`array(select i.name from ga_goods_request_items i where i.request_id = ${goodsRequests.id} and strpos(lower(i.name), lower(${search})) > 0 order by i.position)` : sql<string[]>`array[]::text[]`,
      firstItemName: sql<string | null>`(select i.name from ga_goods_request_items i where i.request_id = ${goodsRequests.id} order by i.position, i.id limit 1)`,
      itemCount: sql<number>`(select count(*)::int from ga_goods_request_items i where i.request_id = ga_goods_requests.id)`,
      totalEstimated: sql<string>`coalesce((select sum(subtotal)::text from ga_goods_request_items i where i.request_id = ga_goods_requests.id), '0')`,
    })
      .from(goodsRequests)
      .leftJoin(users, eq(goodsRequests.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(goodsRequests.createdAt), desc(goodsRequests.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: sql<number>`count(*)::int` })
      .from(goodsRequests)
      .where(whereClause),
  ]);

  res.json({ items, total: total.count, page, pageSize: limit });
}));

router.get('/organizations', view, readScope, asyncRoute(async (req,res) => {
 const groups = req.organizationScope!.groupIds;
 res.json(groups.length ? await db.select({id:organizations.id,groupId:organizations.groupId,name:organizations.name,code:organizations.code}).from(organizations).where(and(inArray(organizations.groupId,groups),eq(organizations.isActive,true))) : []);
}));

router.get('/:id', view, readScope, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
  const [request] = await db.select({
    ...getTableColumns(goodsRequests),
    creatorName: users.username,
  })
    .from(goodsRequests)
    .leftJoin(users, eq(goodsRequests.createdBy, users.id))
    .where(and(eq(goodsRequests.id,req.params.id),ownerScope(req)));

  if (!request) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

  const items = await db.select()
    .from(goodsRequestItems)
    .where(eq(goodsRequestItems.requestId, request.id))
    .orderBy(goodsRequestItems.position);

  const attachments = items.length
    ? await db.select({
        id: goodsRequestAttachments.id,
        itemId: goodsRequestAttachments.itemId,
        size: goodsRequestAttachments.size,
      })
      .from(goodsRequestAttachments)
      .where(inArray(goodsRequestAttachments.itemId, items.map(item => item.id)))
    : [];

  const signedDocuments = await db.select({
    id: goodsRequestSignedDocuments.id,
    fileName: goodsRequestSignedDocuments.fileName,
    size: goodsRequestSignedDocuments.size,
    createdAt: goodsRequestSignedDocuments.createdAt,
    uploaderName: users.username,
  })
    .from(goodsRequestSignedDocuments)
    .leftJoin(users, eq(goodsRequestSignedDocuments.uploadedBy, users.id))
    .where(eq(goodsRequestSignedDocuments.requestId, request.id))
    .orderBy(desc(goodsRequestSignedDocuments.createdAt));

  let documentProfilePreview = null;
  let documentProfileUnavailable = !request.documentProfileSnapshot;
  if (request.status === 'draft' && !request.documentProfileSnapshot && request.groupId && request.organizationId) {
    try { documentProfilePreview = await resolveDocumentProfile(db,{groupId:request.groupId,organizationId:request.organizationId,kind:'GA'}); documentProfileUnavailable = false; }
    catch (error) { if (!(error instanceof DocumentProfileUnavailableError)) throw error; }
  }
  res.json({
    ...request,
    documentProfilePreview, documentProfileUnavailable,
    items: items.map(item => ({
      ...item,
      attachments: attachments.filter(file => file.itemId === item.id),
    })),
    signedDocuments,
  });
}));

router.get('/:id/history', view, readScope, asyncRoute(async (req, res) => {
 if (!validId(req.params.id)) return res.status(404).json({error:'Pengajuan tidak ditemukan.'});
 const [parent] = await db.select({id:goodsRequests.id}).from(goodsRequests).where(and(eq(goodsRequests.id,req.params.id),ownerScope(req)));
 if (!parent) return res.status(404).json({error:'Pengajuan tidak ditemukan.'});

  const logs = await db.select({
    id: goodsRequestStatusLogs.id,
    requestId: goodsRequestStatusLogs.requestId,
    fromStatus: goodsRequestStatusLogs.fromStatus,
    toStatus: goodsRequestStatusLogs.toStatus,
    notes: goodsRequestStatusLogs.notes,
    createdAt: goodsRequestStatusLogs.createdAt,
    changerName: users.username,
  })
    .from(goodsRequestStatusLogs)
    .leftJoin(users, eq(goodsRequestStatusLogs.changedBy, users.id))
    .where(eq(goodsRequestStatusLogs.requestId, req.params.id))
    .orderBy(goodsRequestStatusLogs.createdAt, goodsRequestStatusLogs.id);

  res.json(logs);
}));

router.get('/:id/evidence/:attachmentId', view, readScope, asyncRoute(async (req, res) => {
 if (!validId(req.params.id)) return res.status(404).json({error:'Pengajuan tidak ditemukan.'});
 const [parent] = await db.select({id:goodsRequests.id}).from(goodsRequests).where(and(eq(goodsRequests.id,req.params.id),ownerScope(req)));
 if (!parent) return res.status(404).json({error:'Pengajuan tidak ditemukan.'});
  if (!validId(req.params.id) || !validId(req.params.attachmentId)) {
    return res.status(404).json({ error: 'Lampiran tidak ditemukan.' });
  }

  const [file] = await db.select({ storageKey: goodsRequestAttachments.storageKey })
    .from(goodsRequestAttachments)
    .innerJoin(goodsRequestItems, eq(goodsRequestItems.id, goodsRequestAttachments.itemId))
    .where(and(
      eq(goodsRequestItems.requestId, req.params.id),
      eq(goodsRequestAttachments.id, req.params.attachmentId)
    ));

  if (!file) return res.status(404).json({ error: 'Lampiran tidak ditemukan.' });

  res.set({
    'Content-Type': 'image/webp',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });

  res.sendFile(path.resolve(GOODS_STORAGE_ROOT, file.storageKey), err => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'File lampiran tidak tersedia. Hubungi administrator.' });
    }
  });
}));

router.post('/:id/signed-document', create, writeScope, uploadSigned, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
  const [request] = await db.select().from(goodsRequests).where(and(eq(goodsRequests.id,req.params.id),ownerScope(req)));
  if (!request) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

  const file = req.file;
  if (!file) throw new GoodsInputError('File dokumen fisik bertanda tangan wajib dilampirkan.');

  const directory = path.join(GOODS_STORAGE_ROOT, request.id);
  const stored = await saveSignedDocument(directory, file.buffer, file.originalname);
  const documentId = randomUUID();

  try {
  await db.insert(goodsRequestSignedDocuments).values({
    id: documentId,
    requestId: request.id,
    storageKey: request.id + '/' + stored.storageKey,
    fileName: file.originalname,
    size: stored.size,
    uploadedBy: req.user!.userId,
  });

  } catch (error) { await rm(path.join(directory,stored.storageKey),{force:true}); throw error; }
  res.status(201).json({ id: documentId, fileName: file.originalname, size: stored.size });
}));

router.get('/:id/signed-document/:docId', view, readScope, asyncRoute(async (req, res) => {
 if (!validId(req.params.id)) return res.status(404).json({error:'Pengajuan tidak ditemukan.'});
 const [parent] = await db.select({id:goodsRequests.id}).from(goodsRequests).where(and(eq(goodsRequests.id,req.params.id),ownerScope(req)));
 if (!parent) return res.status(404).json({error:'Pengajuan tidak ditemukan.'});
  if (!validId(req.params.id) || !validId(req.params.docId)) {
    return res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
  }

  const [doc] = await db.select().from(goodsRequestSignedDocuments)
    .where(and(
      eq(goodsRequestSignedDocuments.requestId, req.params.id),
      eq(goodsRequestSignedDocuments.id, req.params.docId)
    ));

  if (!doc) return res.status(404).json({ error: 'Dokumen tidak ditemukan.' });

  const isPdf = doc.storageKey.endsWith('.pdf');
  res.set({
    'Content-Type': isPdf ? 'application/pdf' : 'image/webp',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });

  res.sendFile(path.resolve(GOODS_STORAGE_ROOT, doc.storageKey), err => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'File dokumen fisik tidak tersedia.' });
    }
  });
}));

router.post('/:id/status', create, writeScope, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
  const [request] = await db.select().from(goodsRequests).where(and(eq(goodsRequests.id,req.params.id),ownerScope(req)));
  if (!request) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

  const toStatus = req.body.toStatus as GoodsRequestStatus;
  const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';

  if (!isValidStatusTransition(request.status as GoodsRequestStatus, toStatus)) {
    return res.status(400).json({
      error: `Transisi status dari '${request.status}' ke '${toStatus}' tidak diizinkan.`,
    });
  }

  if ((toStatus === 'cancelled' || toStatus === 'rejected') && !notes) {
    return res.status(400).json({ error: toStatus === 'rejected' ? 'Alasan penolakan wajib diisi.' : 'Catatan alasan pembatalan wajib diisi.' });
  }

  if (toStatus === 'approved_manually') {
    const items = await db.select().from(goodsRequestItems).where(eq(goodsRequestItems.requestId, request.id));
    const attachments = items.length ? await db.select().from(goodsRequestAttachments)
      .where(inArray(goodsRequestAttachments.itemId, items.map(item => item.id))) : [];
    validateGoodsRequest({ ...request, items: items.map(item => ({
      ...item,
      estimatedPrice: Number(item.estimatedPrice),
      attachmentKeys: attachments.filter(file => file.itemId === item.id).map(file => file.id),
    })) }, attachments.map(file => file.id));
  }

  await db.transaction(async tx => {
    const [locked] = await tx.select().from(goodsRequests).where(and(eq(goodsRequests.id,request.id),ownerScope(req))).for('update');
    if (!locked || locked.status !== request.status || locked.version !== request.version) throw new GoodsInputError('Pengajuan telah berubah. Buka kembali rincian pengajuan.');
    let snapshot = request.documentProfileSnapshot;
    if (!snapshot && !['draft','rejected','cancelled'].includes(toStatus)) {
      if (request.status !== 'draft' || !request.groupId || !request.organizationId) throw new DocumentProfileUnavailableError();
      snapshot = await resolveDocumentProfile(tx,{groupId:request.groupId,organizationId:request.organizationId,kind:'GA'});
    }
    await tx.update(goodsRequests)
      .set({status:toStatus,documentProfileSnapshot:snapshot})
      .where(eq(goodsRequests.id, request.id));

    await tx.insert(goodsRequestStatusLogs).values({
      requestId: request.id,
      fromStatus: request.status,
      toStatus,
      notes,
      changedBy: req.user!.userId,
    });
  });

  res.json({ success: true, status: toStatus });
}));

router.post('/', create, writeScope, upload, asyncRoute(async (req, res) => {
  const files = (req.files || []) as Express.Multer.File[];
  let raw: any;
  try {
    raw = JSON.parse(req.body.payload);
  } catch {
    throw new GoodsInputError('Data pengajuan tidak valid.');
  }

  const owner = await destination(req, raw);
  const isDraft = raw.isDraft === true || raw.isDraft === 'true';
  const input = validateGoodsRequest(raw, files.map(file => file.originalname), isDraft);
  const requestId = randomUUID();
  const directory = path.join(GOODS_STORAGE_ROOT, requestId);

  try {
    const evidence = new Map<string, { storageKey: string; size: number }>();
    for (const file of files) {
      const stored = await saveGoodsEvidence(directory, file.buffer);
      evidence.set(file.originalname, { ...stored, storageKey: requestId + '/' + stored.storageKey });
    }

    await db.transaction(async tx => {
      await tx.insert(goodsRequests).values({
        id: requestId,
        ...owner,
        title: input.title,
        purpose: input.purpose,
        status: input.status,
        version: 1,
        requestDate: input.requestDate,
        requesterName: input.requesterName,
        jobTitle: input.jobTitle,
        division: input.division,
        createdBy: req.user!.userId,
      });

      await tx.insert(goodsRequestStatusLogs).values({
        requestId,
        fromStatus: '',
        toStatus: input.status,
        notes: 'Draft pengajuan dibuat',
        changedBy: req.user!.userId,
      });

      for (const [position, item] of input.items.entries()) {
        const [saved] = await tx.insert(goodsRequestItems).values({
          requestId,
          position: position + 1,
          name: item.name,
          quantity: item.quantity,
          estimatedPrice: String(item.estimatedPrice),
          subtotal: String(item.subtotal),
          notes: item.notes,
        }).returning();

        if (item.attachmentKeys && item.attachmentKeys.length > 0) {
          await tx.insert(goodsRequestAttachments).values(
            item.attachmentKeys.map(key => ({
              id: randomUUID(),
              itemId: saved.id,
              ...evidence.get(key)!,
            }))
          );
        }
      }
    });

    res.status(201).json({ id: requestId });
  } catch (error) {
    await rm(directory, { recursive: true, force: true }).catch(cleanupError =>
      console.error('GA evidence cleanup failed', cleanupError)
    );
    throw error;
  }
}));


router.put('/:id', create, writeScope, upload, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
  const [request] = await db.select().from(goodsRequests).where(and(eq(goodsRequests.id,req.params.id),ownerScope(req)));
  if (!request) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

  if (!isRequestEditable(request.status)) {
    return res.status(403).json({ error: 'Pengajuan yang sudah disetujui atau diproses tidak dapat diubah.' });
  }

  const files = (req.files || []) as Express.Multer.File[];
  let raw: any;
  try {
    raw = JSON.parse(req.body.payload);
  } catch {
    throw new GoodsInputError('Data pengajuan tidak valid.');
  }

  const owner = await destination(req,raw);
  if (owner.groupId !== request.groupId || owner.organizationId !== request.organizationId) throw new GoodsInputError('Organisasi pengajuan tidak dapat dipindahkan.');
  const existingItems = await db.select().from(goodsRequestItems).where(eq(goodsRequestItems.requestId, request.id));
  const existingAtts = existingItems.length
    ? await db.select().from(goodsRequestAttachments).where(inArray(goodsRequestAttachments.itemId, existingItems.map(i => i.id)))
    : [];
  const existingAttMap = new Map(existingAtts.map(att => [att.id, att]));

  const newFileNames = files.map(file => file.originalname);
  const availableKeys = [...newFileNames, ...existingAtts.map(att => att.id)];

  const isDraft = raw.isDraft === true || raw.isDraft === 'true';
  const input = validateGoodsRequest(raw, availableKeys, isDraft);
  const directory = path.join(GOODS_STORAGE_ROOT, request.id);

  const evidence = new Map<string, { storageKey: string; size: number }>();
  const nextVersion = (request.version || 1) + 1;
  const newStorageKeys: string[] = [];
  try {
  for (const file of files) {
    const stored = await saveGoodsEvidence(directory, file.buffer);
    newStorageKeys.push(stored.storageKey);
    evidence.set(file.originalname, { ...stored, storageKey: request.id + '/' + stored.storageKey });
  }

  await db.transaction(async tx => {
    const [locked] = await tx.select().from(goodsRequests).where(and(eq(goodsRequests.id,request.id),ownerScope(req))).for('update');
    if (!locked || locked.status !== request.status || locked.version !== request.version) throw new GoodsInputError('Pengajuan telah berubah. Buka kembali rincian pengajuan.');
    await tx.update(goodsRequests)
      .set({
        title: input.title,
        purpose: input.purpose,
        requestDate: input.requestDate,
        requesterName: input.requesterName,
        jobTitle: input.jobTitle,
        division: input.division,
        version: nextVersion,
      })
      .where(eq(goodsRequests.id, request.id));

    await tx.insert(goodsRequestStatusLogs).values({
      requestId: request.id,
      fromStatus: request.status,
      toStatus: request.status,
      notes: `Pengajuan diperbarui (Versi ${nextVersion})`,
      changedBy: req.user!.userId,
    });

    // Delete existing items (cascades to attachments)
    await tx.delete(goodsRequestItems).where(eq(goodsRequestItems.requestId, request.id));

    // Re-insert items and re-link attachments
    for (const [position, item] of input.items.entries()) {
      const [saved] = await tx.insert(goodsRequestItems).values({
        requestId: request.id,
        position: position + 1,
        name: item.name,
        quantity: item.quantity,
        estimatedPrice: String(item.estimatedPrice),
        subtotal: String(item.subtotal),
        notes: item.notes,
      }).returning();

      if (item.attachmentKeys && item.attachmentKeys.length > 0) {
        const attValues = item.attachmentKeys.map(key => {
          if (existingAttMap.has(key)) {
            const oldAtt = existingAttMap.get(key)!;
            return {
              id: oldAtt.id,
              itemId: saved.id,
              storageKey: oldAtt.storageKey,
              size: oldAtt.size,
            };
          }
          const newlyStored = evidence.get(key)!;
          return {
            id: randomUUID(),
            itemId: saved.id,
            storageKey: newlyStored.storageKey,
            size: newlyStored.size,
          };
        });
        await tx.insert(goodsRequestAttachments).values(attValues);
      }
    }
  });

  } catch (error) {
    await Promise.all(newStorageKeys.map(key => rm(path.join(directory,key),{force:true})));
    throw error;
  }
  const retainedKeys = new Set(input.items.flatMap(item => item.attachmentKeys));
  await Promise.all(existingAtts.filter(att => !retainedKeys.has(att.id)).map(att => rm(path.join(GOODS_STORAGE_ROOT,att.storageKey),{force:true}).catch(error => console.error('GA unused evidence cleanup failed',error))));
  res.json({ success: true, id: request.id, version: nextVersion });
}));

router.delete('/:id', create, writeScope, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
  const [request] = await db.select().from(goodsRequests).where(and(eq(goodsRequests.id,req.params.id),ownerScope(req)));
  if (!request) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });

  if (!isRequestEditable(request.status)) {
    return res.status(403).json({ error: 'Pengajuan yang sudah disetujui atau diproses tidak dapat dihapus.' });
  }

  await db.transaction(async tx => {
    const [locked] = await tx.select().from(goodsRequests).where(and(eq(goodsRequests.id,request.id),ownerScope(req))).for('update');
    if (!locked || !isRequestEditable(locked.status)) throw new GoodsInputError('Pengajuan telah berubah dan tidak dapat dihapus.');
    await tx.delete(goodsRequests).where(eq(goodsRequests.id, request.id));
  });

  const directory = path.join(GOODS_STORAGE_ROOT, request.id);
  await rm(directory, { recursive: true, force: true }).catch(() => {});

  res.json({ success: true, message: 'Pengajuan berhasil dihapus.' });
}));

router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: 'Lampiran melebihi batas: maksimal 3 gambar per item, 500 KB per gambar, dan 20 item.',
    });
  }
  if (error instanceof DocumentProfileUnavailableError) return res.status(409).json({error:error.message});
  if (error instanceof GoodsInputError) return res.status(400).json({ error: error.message });
  console.error('GA request failed', error);
  res.status(500).json({ error: 'Pengajuan belum dapat diproses. Coba kembali; data formulir tetap tersedia.' });
});

export default router;
