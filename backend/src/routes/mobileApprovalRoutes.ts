import { Router, Response } from 'express';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { authenticateToken, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';
import { attendanceShifts } from '../db/schema/attendanceWorkspace';
import { attendanceSelfLogs } from '../db/schema/attendanceSelfLogs';
import { users } from '../db/schema/users';
import { eq } from 'drizzle-orm';
import { correctMobileAttendance, listFaceRequests, verifyFaceRequest } from '../services/mobileAttendanceService';
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
router.get('/approval-settings', review, handle(async (_req, res) => { res.json({ data: await db.select().from(attendanceShifts).orderBy(attendanceShifts.id) }); }));
router.put('/approval-settings/:id', review, handle(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = z.object({ autoApproveIn: z.boolean(), autoApproveOut: z.boolean() }).parse(req.body);
  const [shift] = await db.update(attendanceShifts).set({ ...data, updatedAt: new Date() }).where(eq(attendanceShifts.id, id)).returning();
  if (!shift) throw new Error('Shift tidak ditemukan.');
  res.json({ success: true, data: shift });
}));
router.get('/face-requests', review, handle(async (_req, res) => { res.json({ data: await listFaceRequests() }); }));
router.post('/face-requests/:id/review', review, handle(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = z.object({ status: z.enum(['APPROVED','REJECTED']), note: z.string().max(2000).default('') }).parse(req.body);
  res.json(await verifyFaceRequest(req.user!.userId, id, data.status, data.note));
}));
router.get('/photos/:id', handle(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const [log] = await db.select().from(attendanceSelfLogs).where(eq(attendanceSelfLogs.id, id));
  if (!log?.photoUrl) { res.status(404).json({ error: 'Foto tidak tersedia atau sudah melewati masa penyimpanan.' }); return; }
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId));
  const send = async () => { res.set('Cache-Control','no-store').json({ dataUrl: `data:image/webp;base64,${(await readFile(log.photoUrl!)).toString('base64')}` }); };
  if (user?.employeeId === log.employeeId) { await send(); return; }
  await review(req, res, () => { void send().catch(() => { res.status(404).json({ error: 'Foto tidak tersedia.' }); }); });
}));
export default router;
