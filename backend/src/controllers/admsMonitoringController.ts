import type {AuthenticatedRequest} from '../middleware/auth';
import {getReviewLogs,parseReviewLogQuery,parseHistoryRequest,queueAttendanceRead,getReadCommands} from '../services/admsReview';
import type {Request,Response} from 'express';
import {pool} from '../db';
import {requireHrScope} from '../services/hrOrganizationScope';
import {getAdmsMonitoring,parseAdmsMonitorQuery} from '../services/admsMonitoring';
import {getAdmsCandidates,parseRegisterInput,parseToggleInput,registerAdmsDevice,toggleAdmsDevice} from '../services/admsRegistration';
import {cleanseAndIngestAdmsLogs,resolveUnmappedAdmsPin} from '../services/admsAttendanceSync';

export async function syncAdmsToAttendanceHandler(req: Request, res: Response) {
  try {
    const scope = requireHrScope(req as any);
    if (scope.selectedGroupId === null) {
      return res.status(400).json({ success: false, message: 'Pilih satu kelompok organisasi terlebih dahulu.' });
    }
    const { startDate, endDate, deviceId, pin } = req.body || {};
    const data = await cleanseAndIngestAdmsLogs(pool, {
      groupId: scope.selectedGroupId,
      startDate: startDate || null,
      endDate: endDate || null,
      deviceId: deviceId ? Number(deviceId) : null,
      pin: pin ? String(pin).trim() : null,
    });
    res.json({ success: true, message: data.message, data });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

export async function resolveUnmappedPinHandler(req: Request, res: Response) {
  try {
    const scope = requireHrScope(req as any);
    if (scope.selectedGroupId === null) {
      return res.status(400).json({ success: false, message: 'Pilih satu kelompok organisasi terlebih dahulu.' });
    }
    const { pin, employeeId, processLogs = true } = req.body || {};
    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      return res.status(400).json({ success: false, message: 'Nomor PIN mesin wajib diisi.' });
    }
    if (!employeeId || !Number.isInteger(Number(employeeId)) || Number(employeeId) < 1) {
      return res.status(400).json({ success: false, message: 'Pilih karyawan tujuan yang valid.' });
    }
    const data = await resolveUnmappedAdmsPin(pool, {
      groupId: scope.selectedGroupId,
      pin: pin.trim(),
      employeeId: Number(employeeId),
      processLogs: Boolean(processLogs),
    });
    res.json({ success: true, message: data.message, data });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}

export async function getAdmsCandidatesHandler(req: Request, res: Response) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const scope = requireHrScope(req as any);
    const data = await getAdmsCandidates(pool, scope);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

export async function registerAdmsDeviceHandler(req: Request, res: Response) {
  try {
    const scope = requireHrScope(req as any);
    const input = parseRegisterInput(req.body);
    const data = await registerAdmsDevice(pool, scope, input);
    res.json({ success: true, message: data.message, data });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}

export async function toggleAdmsDeviceHandler(req: Request, res: Response) {
  try {
    const deviceId = Number(req.params.id);
    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(deviceId) || deviceId < 1) {
      return res.status(400).json({ success: false, message: 'ID mesin tidak valid.' });
    }
    const scope = requireHrScope(req as any);
    const { enabled } = parseToggleInput(req.body);
    const data = await toggleAdmsDevice(pool, scope, deviceId, enabled);
    res.json({ success: true, message: data.message, data });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
}

export async function getAdmsMonitoringHandler(req:Request,res:Response) {
 try {
  res.setHeader('Cache-Control','no-store');
  const scope=requireHrScope(req as any);
  const query=parseAdmsMonitorQuery(req.query as Record<string,unknown>);
  const data=await getAdmsMonitoring(pool,scope,query);
  res.json({success:true,data});
 } catch(error:any) {
  const status=error.statusCode || 503;
  res.status(status).json({success:false,message:status===503?'Monitoring ADMS belum tersedia. Pemeriksaan akan diulang otomatis.':error.message});
 }
}

export async function getAdmsReviewLogsHandler(req:Request,res:Response) {
 try {
  res.setHeader('Cache-Control','no-store');
  const data=await getReviewLogs(pool,requireHrScope(req as any),parseReviewLogQuery(req.query as Record<string,unknown>));
  res.json({success:true,data});
 }catch(error:any){res.status(error.statusCode||503).json({success:false,message:error.statusCode?error.message:'Log review ADMS belum tersedia.'});}
}
export async function requestAdmsHistoryHandler(req:Request,res:Response) {
 try {
  const deviceId=Number(req.params.id);
  if(!/^\d+$/.test(req.params.id)||!Number.isSafeInteger(deviceId)||deviceId<1)return res.status(400).json({success:false,message:'ID mesin tidak valid.'});
  const actor=(req as AuthenticatedRequest).user;
  if(!actor)return res.status(401).json({success:false,message:'Login diperlukan.'});
  const data=await queueAttendanceRead(pool,requireHrScope(req as any),deviceId,parseHistoryRequest(req.body),actor.userId);
  res.status(202).json({success:true,data});
 }catch(error:any){res.status(error.statusCode||503).json({success:false,message:error.statusCode?error.message:'Permintaan baca ADMS belum tersedia.'});}
}
export async function getAdmsReadCommandsHandler(req:Request,res:Response) {
 try {
  res.setHeader('Cache-Control','no-store');
  const commands=await getReadCommands(pool,requireHrScope(req as any));
  res.json({success:true,data:{commands}});
 }catch(error:any){res.status(error.statusCode||503).json({success:false,message:error.statusCode?error.message:'Status permintaan ADMS belum tersedia.'});}
}
