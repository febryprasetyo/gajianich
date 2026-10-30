import {requireOrganizationScope} from '../middleware/organizationScope';
import {requireHrScope,historicalScopePredicate} from '../services/hrOrganizationScope';
import {loadCurrentIdentity} from '../services/currentIdentity';
import { Router, Response } from 'express';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';
import { attendanceShifts } from '../db/schema/attendanceWorkspace';
import { attendanceSelfLogs } from '../db/schema/attendanceSelfLogs';
import { attendanceFaceRequests } from '../db/schema/attendanceFaceRequests';
import { users } from '../db/schema/users';
import { and,eq, sql } from 'drizzle-orm';
import { resolveEmployeeUser, correctMobileAttendance, listFaceRequests, verifyFaceRequest } from '../services/mobileAttendanceService';
const router = Router();
const review = requirePermission('attendance.mobile.verify');
const handle = (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) => async (req: AuthenticatedRequest, res: Response) => {
  try { await fn(req, res); } catch (error) { res.status(400).json({ success: false, error: error instanceof z.ZodError ? 'Data pengajuan tidak valid.' : error instanceof Error ? error.message : 'Permintaan gagal.' }); }
};
router.use(authenticateToken);
router.post('/corrections', handle(async (req, res) => {
  const data = z.object({ logId: z.number().int().positive(), note: z.string().trim().min(1).max(2000) }).parse(req.body);
  res.json(await correctMobileAttendance(req.user!.userId, data.logId, data.note));
}));
router.get('/approval-settings', review, requireOrganizationScope('hr','read'), handle(async (_req, res) => { res.json({ data: await db.select().from(attendanceShifts).orderBy(attendanceShifts.id) }); }));
router.put('/approval-settings/:id', review, requireOrganizationScope('hr','write'), handle(async (req, res) => {
  if (!(await loadCurrentIdentity(req.user!.userId))?.isGlobalAdministrator) {res.status(403).json({error:'Shared approval settings require global administrator'});return;}
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = z.object({ autoApproveIn: z.boolean(), autoApproveOut: z.boolean() }).parse(req.body);
  const [shift] = await db.update(attendanceShifts).set({ ...data, updatedAt: new Date() }).where(eq(attendanceShifts.id, id)).returning();
  if (!shift) throw new Error('Shift tidak ditemukan.');
  res.json({ success: true, data: shift });
}));
router.get('/face-requests', review, requireOrganizationScope('hr','read'),handle(async (req, res) => { res.json({ data: await listFaceRequests(db,requireHrScope(req as any)) }); }));
router.post('/face-requests/:id/review', review, async (req, _res, next) => {
  try {
    if (!req.headers['x-organization-group-id'] && !req.body?.groupId && req.params?.id) {
      const id = Number(req.params.id);
      if (Number.isSafeInteger(id) && id > 0) {
        const [row] = await db
          .select({ groupId: attendanceFaceRequests.groupId })
          .from(attendanceFaceRequests)
          .where(eq(attendanceFaceRequests.id, id));
        if (row?.groupId) {
          req.headers['x-organization-group-id'] = String(row.groupId);
        }
      }
    }
  } catch {}
  next();
}, requireOrganizationScope('hr','write'), handle(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = z.object({ status: z.enum(['APPROVED','REJECTED']), note: z.string().max(2000).default('') }).parse(req.body);
  res.json(await verifyFaceRequest(req.user!.userId, id, data.status, data.note,db,requireHrScope(req as any)));
}));
router.get('/photos/:id', handle(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const [log] = await db.select().from(attendanceSelfLogs).where(eq(attendanceSelfLogs.id, id));
  if (!log?.photoUrl) { res.status(404).json({ error: 'Foto tidak tersedia atau sudah melewati masa penyimpanan.' }); return; }
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId));
  const send = async () => { res.set('Cache-Control','no-store').json({ dataUrl: `data:image/webp;base64,${(await readFile(log.photoUrl!)).toString('base64')}` }); };
  if (user?.employeeId === log.employeeId) {const {employee} = await resolveEmployeeUser(req.user!.userId); if (log.groupId !== employee.groupId) {res.status(404).json({error:'Photo unavailable'});return;} await send(); return; }
  await review(req, res, () => {void requireOrganizationScope('hr','read')(req,res,()=>{void (async()=>{const [owned] = await db.select().from(attendanceSelfLogs).where(and(eq(attendanceSelfLogs.id,id),historicalScopePredicate(requireHrScope(req as any),attendanceSelfLogs.groupId))); if(!owned){res.status(404).json({error:'Photo unavailable'});return;} await send();})().catch(()=>res.status(404).json({error:'Photo unavailable'}));});});
}));
router.get('/badge-count', review,requireOrganizationScope('hr','read'), handle(async (req, res) => {
  const [attendanceCount, photoCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` })
      .from(attendanceSelfLogs)
      .where(and(eq(attendanceSelfLogs.approvalStatus, 'PENDING'),historicalScopePredicate(requireHrScope(req as any),attendanceSelfLogs.groupId))),
    db.select({ count: sql<number>`count(*)::int` })
      .from(attendanceFaceRequests)
      .where(and(eq(attendanceFaceRequests.status, 'PENDING'),historicalScopePredicate(requireHrScope(req as any),attendanceFaceRequests.groupId))),
  ]);

  const pendingAttendance = Number(attendanceCount[0]?.count || 0);
  const pendingPhotos = Number(photoCount[0]?.count || 0);

  res.json({
    success: true,
    data: {
      pendingAttendance,
      pendingPhotos,
      totalPending: pendingAttendance + pendingPhotos,
    },
  });
}));

export default router;
