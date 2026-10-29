import { Request, Response } from 'express';
import { db } from '../db';
import { itTickets, ticketCategories, slaPolicies, ticketComments } from '../db/schema/tickets';
import { users } from '../db/schema/users';
import { employees } from '../db/schema/employees';
import { assets } from '../db/schema/assets';
import { eq, ilike, or, and, desc, aliasedTable,isNull, sql } from 'drizzle-orm';
import {assetScopePredicate} from '../services/assetOrganizationScope';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { DEFAULT_TICKET_CATEGORIES, shouldSeedDefaultTicketCategories } from '../domain/ticketCategories';

// Aliased tables for joins
const reporterUser = aliasedTable(users, 'reporter_user');
const assigneeUser = aliasedTable(users, 'assignee_user');
const reporterEmployee = aliasedTable(employees, 'reporter_employee');

function ticketScopePredicate(req: Request) {
  return or(isNull(itTickets.assetId), sql`exists (select 1 from ${assets} where ${assets.id} = ${itTickets.assetId} and ${assetScopePredicate(req)})`);
}

// --- Zod Validation Schemas ---
const createTicketSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    subject: z.string().min(1).max(200).optional(),
    type: z.string().default('Incident'),
    priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
    categoryId: z.number({ message: 'Category ID is required' }),
    assetId: z.number().optional().nullable(),
    description: z.string().min(1, 'Description is required'),
    reporterId: z.number().optional(),
  })
  .refine((data) => !!(data.title || data.subject), {
    message: 'Title or subject is required',
    path: ['title'],
  });

const updateTicketSchema = z.object({
  title: z.string().max(200).optional(),
  subject: z.string().max(200).optional(),
  type: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  status: z.enum(['Open', 'In Progress', 'Pending', 'Resolved', 'Closed']).optional(),
  categoryId: z.number().optional(),
  assigneeId: z.number().optional().nullable(),
  assetId: z.number().optional().nullable(),
  description: z.string().optional(),
  resolutionNotes: z.string().optional().nullable(),
  resolvedAt: z.string().or(z.date()).optional().nullable(),
});

const addCommentSchema = z.object({
  commentText: z.string().min(1, 'Comment text is required'),
  isInternal: z.boolean().default(false),
  userId: z.number().optional(),
});

// --- Helper Functions ---
async function generateTicketCode(type: string): Promise<string> {
  const isRequest = type?.toLowerCase() === 'request' || type?.toUpperCase() === 'REQ';
  const prefix = isRequest ? 'REQ' : 'INC';
  const year = new Date().getFullYear().toString();
  const pattern = `${prefix}-${year}-%`;

  const existing = await db
    .select({ ticketCode: itTickets.ticketCode })
    .from(itTickets)
    .where(ilike(itTickets.ticketCode, pattern));

  let maxSeq = 0;
  const regex = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');

  for (const item of existing) {
    const match = item.ticketCode.match(regex);
    if (match) {
      const seqNum = parseInt(match[1], 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const seqFormatted = String(nextSeq).padStart(4, '0');
  return `${prefix}-${year}-${seqFormatted}`;
}

async function calculateSLADueDate(priority: string): Promise<Date> {
  const normalizedPriority = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  const policies = await db
    .select()
    .from(slaPolicies)
    .where(eq(slaPolicies.priority, normalizedPriority));

  let hours = 24;
  if (policies.length > 0) {
    hours = policies[0].targetResolutionHours;
  } else {
    switch (normalizedPriority) {
      case 'Critical':
        hours = 2;
        break;
      case 'High':
        hours = 8;
        break;
      case 'Medium':
        hours = 24;
        break;
      case 'Low':
        hours = 48;
        break;
    }
  }

  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// --- Controller Handlers ---

/**
 * GET /api/v1/tickets/categories
 * Retrieves all ticket categories from ticket_categories
 */
export async function getTicketCategories(req: Request, res: Response) {
  try {
    let categories = await db
      .select()
      .from(ticketCategories)
      .orderBy(ticketCategories.id);

    if (shouldSeedDefaultTicketCategories(categories.length)) {
      await db
        .insert(ticketCategories)
        .values([...DEFAULT_TICKET_CATEGORIES])
        .onConflictDoNothing();

      categories = await db
        .select()
        .from(ticketCategories)
        .orderBy(ticketCategories.id);
    }

    return res.status(200).json(categories);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * GET /api/v1/tickets
 * Accepts query filters (search, priority, status, categoryId, reporterId, assigneeId)
 * Performs LEFT JOIN on users (reporter & assignee), employees, assets, ticket_categories
 */
export async function getTickets(req: Request, res: Response) {
  try {
    const { search, priority, status, categoryId, reporterId, assigneeId } = req.query;

    const conditions = [or(isNull(itTickets.assetId),assetScopePredicate(req))];

    if (search && typeof search === 'string' && search.trim() !== '') {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(itTickets.ticketCode, searchPattern),
          ilike(itTickets.subject, searchPattern),
          ilike(itTickets.description, searchPattern)
        )
      );
    }

    if (priority && typeof priority === 'string' && priority.trim() !== '') {
      conditions.push(eq(itTickets.priority, priority.trim()));
    }

    if (status && typeof status === 'string' && status.trim() !== '') {
      conditions.push(eq(itTickets.status, status.trim()));
    }

    if (categoryId) {
      const catId = Number(categoryId);
      if (!isNaN(catId)) {
        conditions.push(eq(itTickets.categoryId, catId));
      }
    }

    if (reporterId) {
      const repId = Number(reporterId);
      if (!isNaN(repId)) {
        conditions.push(eq(itTickets.reporterId, repId));
      }
    }

    if (assigneeId) {
      const assId = Number(assigneeId);
      if (!isNaN(assId)) {
        conditions.push(eq(itTickets.assigneeId, assId));
      }
    }

    const baseQuery = db
      .select({
        id: itTickets.id,
        ticketCode: itTickets.ticketCode,
        type: itTickets.type,
        subject: itTickets.subject,
        title: itTickets.subject,
        description: itTickets.description,
        categoryId: itTickets.categoryId,
        categoryName: ticketCategories.name,
        priority: itTickets.priority,
        status: itTickets.status,
        reporterId: itTickets.reporterId,
        reporterName: reporterUser.username,
        reporterEmployeeName: reporterEmployee.fullName,
        reporterEmail: reporterUser.email,
        assigneeId: itTickets.assigneeId,
        assigneeName: assigneeUser.username,
        assigneeEmail: assigneeUser.email,
        assetId: itTickets.assetId,
        assetCode: assets.assetCode,
        assetName: assets.name,
        dueAt: itTickets.dueAt,
        resolvedAt: itTickets.resolvedAt,
        resolutionNotes: itTickets.resolutionNotes,
        createdAt: itTickets.createdAt,
        updatedAt: itTickets.updatedAt,
      })
      .from(itTickets)
      .leftJoin(ticketCategories, eq(itTickets.categoryId, ticketCategories.id))
      .leftJoin(reporterUser, eq(itTickets.reporterId, reporterUser.id))
      .leftJoin(reporterEmployee, eq(itTickets.reporterId, reporterEmployee.id))
      .leftJoin(assigneeUser, eq(itTickets.assigneeId, assigneeUser.id))
      .leftJoin(assets, eq(itTickets.assetId, assets.id));

    const result = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(desc(itTickets.id))
      : await baseQuery.orderBy(desc(itTickets.id));

    // Normalize reporter field for consistency
    const formatted = result.map((t) => ({
      ...t,
      reporterName: t.reporterName || t.reporterEmployeeName || `User #${t.reporterId}`,
    }));

    return res.status(200).json(formatted);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * GET /api/v1/tickets/:id
 * Single ticket detail with associated asset, reporter, assignee, and comments
 */
export async function getTicketById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ticket ID' });
    }

    const ticketResult = await db
      .select({
        id: itTickets.id,
        ticketCode: itTickets.ticketCode,
        type: itTickets.type,
        subject: itTickets.subject,
        title: itTickets.subject,
        description: itTickets.description,
        categoryId: itTickets.categoryId,
        categoryName: ticketCategories.name,
        priority: itTickets.priority,
        status: itTickets.status,
        reporterId: itTickets.reporterId,
        reporterName: reporterUser.username,
        reporterEmployeeName: reporterEmployee.fullName,
        reporterEmail: reporterUser.email,
        assigneeId: itTickets.assigneeId,
        assigneeName: assigneeUser.username,
        assigneeEmail: assigneeUser.email,
        assetId: itTickets.assetId,
        assetCode: assets.assetCode,
        assetName: assets.name,
        dueAt: itTickets.dueAt,
        resolvedAt: itTickets.resolvedAt,
        resolutionNotes: itTickets.resolutionNotes,
        createdAt: itTickets.createdAt,
        updatedAt: itTickets.updatedAt,
      })
      .from(itTickets)
      .leftJoin(ticketCategories, eq(itTickets.categoryId, ticketCategories.id))
      .leftJoin(reporterUser, eq(itTickets.reporterId, reporterUser.id))
      .leftJoin(reporterEmployee, eq(itTickets.reporterId, reporterEmployee.id))
      .leftJoin(assigneeUser, eq(itTickets.assigneeId, assigneeUser.id))
      .leftJoin(assets, eq(itTickets.assetId, assets.id))
      .where(and(eq(itTickets.id, id),or(isNull(itTickets.assetId),assetScopePredicate(req))));

    if (ticketResult.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketResult[0];

    // Query comments joined with users
    const commentList = await db
      .select({
        id: ticketComments.id,
        ticketId: ticketComments.ticketId,
        userId: ticketComments.userId,
        userName: users.username,
        userEmail: users.email,
        commentText: ticketComments.commentText,
        isInternal: ticketComments.isInternal,
        createdAt: ticketComments.createdAt,
      })
      .from(ticketComments)
      .leftJoin(users, eq(ticketComments.userId, users.id))
      .where(eq(ticketComments.ticketId, id))
      .orderBy(ticketComments.createdAt);

    return res.status(200).json({
      ...ticket,
      reporterName: ticket.reporterName || ticket.reporterEmployeeName || `User #${ticket.reporterId}`,
      comments: commentList,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * POST /api/v1/tickets
 * Validates payload, auto-generates ticketCode, calculates SLA dueAt, inserts record into tickets
 */
export async function createTicket(req: AuthenticatedRequest, res: Response) {
  try {
    if(req.body.assetId){
      const [visible]=await db.select({id:assets.id}).from(assets).where(and(eq(assets.id,Number(req.body.assetId)),assetScopePredicate(req)));
      if(!visible) return res.status(404).json({error:'Asset unavailable'});
    }
    const parsed = createTicketSchema.parse(req.body);

    const subjectText = parsed.title || parsed.subject || '';
    const ticketType = parsed.type === 'REQ' || parsed.type.toLowerCase() === 'request' ? 'Request' : 'Incident';
    const code = await generateTicketCode(ticketType);
    const dueAtDate = await calculateSLADueDate(parsed.priority);
    const reporterId = parsed.reporterId || req.user?.userId || 1;

    const [inserted] = await db
      .insert(itTickets)
      .values({
        ticketCode: code,
        type: ticketType,
        subject: subjectText,
        description: parsed.description,
        categoryId: parsed.categoryId,
        priority: parsed.priority,
        status: 'Open',
        reporterId: reporterId,
        assetId: parsed.assetId ?? null,
        dueAt: dueAtDate,
      })
      .returning();

    return res.status(201).json(inserted);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * PUT /api/v1/tickets/:id
 * Updates ticket fields (status, assigneeId, resolutionNotes, resolvedAt, etc.)
 */
export async function updateTicket(req: Request, res: Response) {
  try {
    if(req.body.assetId){
      const [visible]=await db.select({id:assets.id}).from(assets).where(and(eq(assets.id,Number(req.body.assetId)),assetScopePredicate(req)));
      if(!visible) return res.status(404).json({error:'Asset unavailable'});
    }
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ticket ID' });
    }

    const parsed = updateTicketSchema.parse(req.body);

    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (parsed.title || parsed.subject) {
      updatePayload.subject = parsed.title || parsed.subject;
    }
    if (parsed.type) {
      updatePayload.type = parsed.type;
    }
    if (parsed.priority) {
      updatePayload.priority = parsed.priority;
    }
    if (parsed.status) {
      updatePayload.status = parsed.status;
      if (parsed.status === 'Resolved' || parsed.status === 'Closed') {
        if (!parsed.resolvedAt) {
          updatePayload.resolvedAt = new Date();
        }
      } else {
        updatePayload.resolvedAt = null;
      }
    }
    if (parsed.categoryId !== undefined) {
      updatePayload.categoryId = parsed.categoryId;
    }
    if (parsed.assigneeId !== undefined) {
      updatePayload.assigneeId = parsed.assigneeId;
    }
    if (parsed.assetId !== undefined) {
      updatePayload.assetId = parsed.assetId;
    }
    if (parsed.description) {
      updatePayload.description = parsed.description;
    }
    if (parsed.resolutionNotes !== undefined) {
      updatePayload.resolutionNotes = parsed.resolutionNotes;
    }
    if (parsed.resolvedAt !== undefined) {
      updatePayload.resolvedAt = parsed.resolvedAt ? new Date(parsed.resolvedAt) : null;
    }

    const updatedList = await db
      .update(itTickets)
      .set(updatePayload)
      .where(and(eq(itTickets.id, id), ticketScopePredicate(req)))
      .returning();

    if (updatedList.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    return res.status(200).json(updatedList[0]);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * POST /api/v1/tickets/:id/comments
 * Inserts comment in ticket_comments with ticketId, userId, commentText, isInternal
 */
export async function addTicketComment(req: AuthenticatedRequest, res: Response) {
  try {
    const ticketId = Number(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: 'Invalid ticket ID' });
    }

    // Ensure ticket exists
    const ticketCheck = await db
      .select({ id: itTickets.id })
      .from(itTickets)
      .where(and(eq(itTickets.id, ticketId), ticketScopePredicate(req)));

    if (ticketCheck.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const parsed = addCommentSchema.parse(req.body);
    const userId = parsed.userId || req.user?.userId || 1;

    const [inserted] = await db
      .insert(ticketComments)
      .values({
        ticketId,
        userId,
        commentText: parsed.commentText,
        isInternal: parsed.isInternal,
      })
      .returning();

    // Fetch user details for returned comment
    const commentWithUser = await db
      .select({
        id: ticketComments.id,
        ticketId: ticketComments.ticketId,
        userId: ticketComments.userId,
        userName: users.username,
        userEmail: users.email,
        commentText: ticketComments.commentText,
        isInternal: ticketComments.isInternal,
        createdAt: ticketComments.createdAt,
      })
      .from(ticketComments)
      .leftJoin(users, eq(ticketComments.userId, users.id))
      .where(eq(ticketComments.id, inserted.id));

    return res.status(201).json(commentWithUser[0] || inserted);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
