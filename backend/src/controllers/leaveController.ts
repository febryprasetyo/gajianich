import {employeeScopePredicate,historicalScopePredicate,requireHrScope,requireScopedEmployee} from '../services/hrOrganizationScope';
import {resolveDocumentProfile} from '../services/documentProfile';
import {loadCurrentIdentity} from '../services/currentIdentity';
import { resolveAuditContext, appendHrAudit } from '../services/hrAudit';
import { sanitizeAuditTarget } from '../domain/hrAudit';
import { Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, sql, desc, lt, asc, notInArray } from 'drizzle-orm';
import { db } from '../db';
import { employees } from '../db/schema/employees';
import { departments } from '../db/schema/master';
import {
  leaveHolidayCalendars,
  leaveBalances,
  leaveRequests,
  leaveApprovals,
  annualLeaveConfigs,
} from '../db/schema/leaves';
import {
  calculateLeaveWorkingDays,
  calculateLeaveBalances,
  calculateRolloverCarryForward,
  formatLeaveRequestNumber,
} from '../domain/leaveCalculation';

// Zod schemas
export const calculateDaysSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  employeeId: z.coerce.number().positive().optional(),
}).refine((data) => {
  const startYear = Number(data.startDate.split('-')[0]);
  const endYear = Number(data.endDate.split('-')[0]);
  return startYear === endYear;
}, {
  message: 'Periode perhitungan cuti harus berada dalam tahun kalender yang sama',
  path: ['endDate'],
});


export const annualLeaveConfigSchema = z.object({
  year: z.coerce.number().int().min(2000, 'Tahun minimal 2000').max(2100, 'Tahun maksimal 2100'),
  baseQuota: z.coerce.number().int().min(0, 'Hak cuti dasar tidak boleh negatif').max(100).default(12),
  collectiveLeaveDays: z.coerce.number().int().min(0, 'Cuti bersama tidak boleh negatif').max(50).default(0),
  allowCarryForward: z.boolean().default(false),
  maxCarryForwardDays: z.coerce.number().int().min(0, 'Batas carry forward tidak boleh negatif').max(50).default(0),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateLeaveBalanceSchema = z
  .object({
    baseQuota: z.coerce.number().int().min(0, 'Hak dasar tidak boleh negatif').max(100).optional(),
    carriedOverQuota: z.coerce.number().int().min(0, 'Carry over tidak boleh negatif').max(100).optional(),
  })
  .refine((data) => data.baseQuota !== undefined || data.carriedOverQuota !== undefined, {
    message: 'Setidaknya salah satu kuota dasar atau carry over harus diisi',
  });

export const updateLeaveRequestSchema = z.object({
  leaveType: z.enum(['ANNUAL', 'SPECIAL']),
  specialLeaveReason: z.string().max(100).optional().nullable(),
  reason: z.string().min(1, 'Alasan cuti wajib diisi').max(500),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  durationDays: z.coerce.number().positive('Jumlah cuti minimal 1 hari'),
  resumeWorkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional().nullable(),
  handoverToEmployeeId: z.coerce.number().positive().optional().nullable(),
  handoverTask: z.string().max(1000).optional().nullable(),
  emergencyPhone: z.string().max(50).optional().nullable(),
}).refine((data) => {
  const startYear = Number(data.startDate.split('-')[0]);
  const endYear = Number(data.endDate.split('-')[0]);
  return startYear === endYear;
}, {
  message: 'Periode cuti harus berada dalam tahun kalender yang sama. Jika melewati pergantian tahun, ajukan permohonan terpisah untuk masing-masing tahun.',
  path: ['endDate'],
}).refine((data) => {
  return data.endDate >= data.startDate;
}, {
  message: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai',
  path: ['endDate'],
});

export const createLeaveRequestSchema = z.object({
  employeeId: z.coerce.number().positive(),
  leaveType: z.enum(['ANNUAL', 'SPECIAL']),
  specialLeaveReason: z.string().max(100).optional().nullable(),
  reason: z.string().min(1, 'Alasan cuti wajib diisi').max(500),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  durationDays: z.coerce.number().positive('Jumlah cuti minimal 1 hari'), // Input manual dari pengguna!
  resumeWorkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional().nullable(),
  handoverToEmployeeId: z.coerce.number().positive().optional().nullable(),
  handoverTask: z.string().max(1000).optional().nullable(),
  emergencyPhone: z.string().max(50).optional().nullable(),
}).refine((data) => {
  const startYear = Number(data.startDate.split('-')[0]);
  const endYear = Number(data.endDate.split('-')[0]);
  return startYear === endYear;
}, {
  message: 'Periode cuti harus berada dalam tahun kalender yang sama. Jika melewati pergantian tahun, ajukan permohonan terpisah untuk masing-masing tahun.',
  path: ['endDate'],
}).refine((data) => {
  return data.endDate >= data.startDate;
}, {
  message: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai',
  path: ['endDate'],
});

// Helper: ambil profil ringkas karyawan
async function getEmployeeProfile(empId: number) {
  const [emp] = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      position: employees.position,
      joinDate: employees.joinDate,
      departmentId: employees.departmentId,
      departmentName: departments.name,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(eq(employees.id, empId));

  return emp || null;
}

// 0. GET /employees (Daftar karyawan aktif untuk dropdown)
export async function getActiveEmployeesForLeaves(req: Request, res: Response) {
  try {
    const list = await db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        employeeCode: employees.employeeCode,
        position: employees.position,
        departmentId: employees.departmentId,
        departmentName: departments.name,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(and(eq(employees.status, 'Active'),employeeScopePredicate(requireHrScope(req as any))))
      .orderBy(employees.fullName);

    return res.status(200).json(list);
  } catch (error) {
    console.error('Error getActiveEmployeesForLeaves:', error);
    return res.status(500).json({ error: 'Gagal memuat daftar karyawan' });
  }
}

// 1. GET /balance-summary
export async function getLeaveBalanceSummary(req: Request, res: Response) {
  try {
    const employeeId = Number(req.query.employeeId);
    const year = Number(req.query.year) || new Date().getUTCFullYear();

    if (!employeeId || isNaN(employeeId)) {
      return res.status(400).json({ error: 'employeeId query parameter is required' });
    }

    await requireScopedEmployee(requireHrScope(req as any),employeeId);
    const employee = await getEmployeeProfile(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
    }

    // 1. Ambil konfigurasi kebijakan cuti tahunan aktif
    const [cfg] = await db
      .select()
      .from(annualLeaveConfigs)
      .where(eq(annualLeaveConfigs.year, year));

    // 2. Ambil hari libur / cuti bersama tahun berjalan
    const holidays = await db
      .select()
      .from(leaveHolidayCalendars)
      .where(eq(leaveHolidayCalendars.year, year));

    const collectiveLeaves = holidays.filter((h) => h.isCollectiveLeave);
    const effectiveBaseQuota = cfg?.baseQuota ?? 12;
    const effectiveCollectiveLeaveDays = cfg?.collectiveLeaveDays ?? collectiveLeaves.length;

    // Ambil atau buat record saldo cuti karyawan untuk tahun bersangkutan
    let [balance] = await db
      .select()
      .from(leaveBalances)
      .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, year),historicalScopePredicate(requireHrScope(req as any),leaveBalances.groupId)));

    if (!balance) {
      const [inserted] = await db
        .insert(leaveBalances)
        .values({
          employeeId,
          groupId: (await requireScopedEmployee(requireHrScope(req as any),employeeId)).groupId,
          year,
          baseQuota: effectiveBaseQuota,
          collectiveLeaveDeduction: effectiveCollectiveLeaveDays,
          usedQuota: 0,
          carriedOverQuota: 0,
          isCustomQuota: false,
        })
        .returning();
      balance = inserted;
    } else {
      const needsSyncBase = !balance.isCustomQuota && balance.baseQuota !== effectiveBaseQuota;
      const needsSyncCollective = balance.collectiveLeaveDeduction !== effectiveCollectiveLeaveDays;
      if (needsSyncBase || needsSyncCollective) {
        const [updated] = await db
          .update(leaveBalances)
          .set({
            baseQuota: !balance.isCustomQuota ? effectiveBaseQuota : balance.baseQuota,
            collectiveLeaveDeduction: effectiveCollectiveLeaveDays,
            updatedAt: new Date(),
          })
          .where(eq(leaveBalances.id, balance.id))
          .returning();
        balance = updated;
      }
    }

    // Ambil histori cuti yang sudah diambil sebelumnya (maks 5 item sesuai slot format F4)
    const approvedRequests = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          historicalScopePredicate(requireHrScope(req as any),leaveRequests.groupId),
          eq(leaveRequests.employeeId, employeeId),
          eq(leaveRequests.balanceYear, year),
          eq(leaveRequests.status, 'APPROVED')
        )
      )
      .orderBy(desc(leaveRequests.startDate))
      .limit(5);

    const historyItems: Array<{ no: number; description: string }> = [];
    collectiveLeaves.slice(0, 2).forEach((cl) => {
      historyItems.push({
        no: historyItems.length + 1,
        description: `1 = ${cl.description}`,
      });
    });

    approvedRequests.forEach((req) => {
      if (historyItems.length < 5) {
        historyItems.push({
          no: historyItems.length + 1,
          description: `${req.durationDays} = Cuti tahunan tgl ${req.startDate}`,
        });
      }
    });

    while (historyItems.length < 5) {
      historyItems.push({
        no: historyItems.length + 1,
        description: '',
      });
    }

    const calc = calculateLeaveBalances({
      baseQuota: balance.baseQuota,
      collectiveLeaveDays: balance.collectiveLeaveDeduction,
      usedQuota: balance.usedQuota,
      carriedOverQuota: balance.carriedOverQuota,
      requestedDays: 0,
    });

    return res.status(200).json({
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        department: employee.departmentName || '-',
        position: employee.position || '-',
        joinDate: employee.joinDate || null,
      },
      year,
      baseQuota: balance.baseQuota,
      collectiveLeaveDays: balance.collectiveLeaveDeduction,
      cleanAnnualQuota: calc.cleanAnnualQuota,
      usedQuota: balance.usedQuota,
      availableBalance: calc.availableBefore,
      historyItems,
    });
  } catch (error) {
    console.error('Error getLeaveBalanceSummary:', error);
    return res.status(500).json({ error: 'Gagal mengambil ringkasan saldo cuti' });
  }
}

// 2. POST /calculate-days
export async function calculateWorkingDays(req: Request, res: Response) {
  try {
    const parsed = calculateDaysSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validasi gagal', details: parsed.error.issues });
    }

    const { startDate, endDate } = parsed.data;
    const startYear = Number(startDate.split('-')[0]);

    const holidays = await db
      .select({ date: leaveHolidayCalendars.holidayDate })
      .from(leaveHolidayCalendars)
      .where(eq(leaveHolidayCalendars.year, startYear));

    const holidayDates = holidays.map((h) => h.date);

    const result = calculateLeaveWorkingDays({
      startDate,
      endDate,
      holidayDates,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error calculateWorkingDays:', error);
    return res.status(500).json({ error: 'Gagal menghitung hari kerja cuti' });
  }
}

// 3. POST /requests (Mendukung Input Manual durationDays)
export async function createLeaveRequest(req: Request, res: Response) {
  try {
    const parsed = createLeaveRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validasi form tidak lengkap', details: parsed.error.issues });
    }

    const data = parsed.data;
    const owner = await requireScopedEmployee(requireHrScope(req as any),data.employeeId);
    if (data.handoverToEmployeeId) await requireScopedEmployee(requireHrScope(req as any),data.handoverToEmployeeId);
    const employee = await getEmployeeProfile(data.employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Karyawan pemohon tidak ditemukan' });
    }

    const startYear = Number(data.startDate.split('-')[0]);
    const currentYear = new Date().getFullYear();

    if (startYear < currentYear) {
      return res.status(400).json({
        error: `Permohonan cuti tidak dapat diajukan untuk tahun lampau (${startYear}). Saldo cuti tahun lampau sudah ditutup.`,
      });
    }

    // Ambil hari libur
    const holidays = await db
      .select()
      .from(leaveHolidayCalendars)
      .where(eq(leaveHolidayCalendars.year, startYear));
    const holidayDates = holidays.map((h) => h.holidayDate);

    // Hitung rekomendasi tanggal kembali jika tidak diinput manual
    let finalResumeWorkDate = data.resumeWorkDate;
    if (!finalResumeWorkDate) {
      const daysCalc = calculateLeaveWorkingDays({
        startDate: data.startDate,
        endDate: data.endDate,
        holidayDates,
      });
      finalResumeWorkDate = daysCalc.resumeWorkDate;
    }

    // 1. Ambil kebijakan cuti aktif
    const [cfg] = await db
      .select()
      .from(annualLeaveConfigs)
      .where(eq(annualLeaveConfigs.year, startYear));
    const effectiveBaseQuota = cfg?.baseQuota ?? 12;
    const effectiveCollectiveLeaveDays = cfg?.collectiveLeaveDays ?? holidays.filter((h) => h.isCollectiveLeave).length;

    // 2. Ambil saldo
    let [balance] = await db
      .select()
      .from(leaveBalances)
      .where(and(eq(leaveBalances.employeeId, data.employeeId), eq(leaveBalances.year, startYear)));

    if (balance && balance.groupId !== owner.groupId) throw new Error('Historical leave balance ownership unresolved or different');
    if (!balance) {
      const [inserted] = await db
        .insert(leaveBalances)
        .values({
          employeeId: data.employeeId,
          groupId: owner.groupId,
          year: startYear,
          baseQuota: effectiveBaseQuota,
          collectiveLeaveDeduction: effectiveCollectiveLeaveDays,
          usedQuota: 0,
          carriedOverQuota: 0,
          isCustomQuota: false,
        })
        .returning();
      balance = inserted;
    }

    const balanceCalc = calculateLeaveBalances({
      baseQuota: balance.baseQuota,
      collectiveLeaveDays: balance.collectiveLeaveDeduction,
      usedQuota: balance.usedQuota,
      carriedOverQuota: balance.carriedOverQuota,
      requestedDays: data.durationDays, // Gunakan input manual!
    });

    if (data.leaveType === 'ANNUAL' && data.durationDays > balanceCalc.availableBefore) {
      return res.status(400).json({
        error: `Saldo cuti tahunan tidak mencukupi. Sisa saldo: ${balanceCalc.availableBefore} hari, pengajuan: ${data.durationDays} hari.`,
      });
    }

    // Hitung sequence number untuk nomor permohonan
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leaveRequests);
    const seq = (countResult?.count || 0) + 1;
    const requestNumber = formatLeaveRequestNumber(new Date(), seq);

    const snapshotRemaining =
      data.leaveType === 'ANNUAL'
        ? Math.max(0, balanceCalc.availableBefore - data.durationDays)
        : balanceCalc.availableBefore;

    let auditContext: any = null;
    if ((req as any).user) {
      try {
        auditContext = await resolveAuditContext(req as any);
      } catch (err) {}
    }

    // Database transaction
    const createdRequest = await db.transaction(async (tx) => {
      if (!owner.organizationId) throw new Error("Employee document identity is unresolved");
      const documentProfileSnapshot = await resolveDocumentProfile(tx,{kind:"LEAVE",groupId:owner.groupId,organizationId:owner.organizationId});
      const [leaveReq] = await tx
        .insert(leaveRequests)
        .values({
          requestNumber,
          groupId: owner.groupId, organizationId: owner.organizationId, documentProfileSnapshot,
          employeeId: data.employeeId,
          leaveType: data.leaveType,
          specialLeaveReason: data.specialLeaveReason || null,
          reason: data.reason,
          startDate: data.startDate,
          endDate: data.endDate,
          durationDays: data.durationDays, // Input manual
          resumeWorkDate: finalResumeWorkDate,
          handoverToEmployeeId: data.handoverToEmployeeId || null,
          handoverTask: data.handoverTask || null,
          emergencyPhone: data.emergencyPhone || null,
          status: 'PENDING',
          balanceYear: startYear,
          snapshotBaseQuota: balance.baseQuota,
          snapshotCollectiveLeave: balance.collectiveLeaveDeduction,
          snapshotAvailableBefore: balanceCalc.availableBefore,
          snapshotRemainingAfter: snapshotRemaining,
        })
        .returning();

      // Jika cuti tahunan, potong kuota terpakai sesuai input manual
      if (data.leaveType === 'ANNUAL') {
        await tx
          .update(leaveBalances)
          .set({
            usedQuota: balance.usedQuota + data.durationDays,
            updatedAt: new Date(),
          })
          .where(eq(leaveBalances.id, balance.id));
      }

      // Buat 4 tahap persetujuan (Pemohon langsung bertanda tangan)
      const todayStr = new Date().toISOString().split('T')[0];
      await tx.insert(leaveApprovals).values([
        {
          leaveRequestId: leaveReq.id,
          stage: 'APPLICANT',
          approverEmployeeId: employee.id,
          approverName: employee.fullName,
          status: 'APPROVED',
          signatureDate: todayStr,
        },
        {
          leaveRequestId: leaveReq.id,
          stage: 'DIRECT_SUPERVISOR',
          status: 'PENDING',
        },
        {
          leaveRequestId: leaveReq.id,
          stage: 'HRD',
          status: 'PENDING',
        },
        {
          leaveRequestId: leaveReq.id,
          stage: 'HIGHER_SUPERVISOR',
          status: 'PENDING',
        },
      ]);

      if (auditContext) {
        const target = sanitizeAuditTarget('leave_request', null, leaveReq, {
          entityId: String(leaveReq.id),
          entityLabel: `Cuti ${employee.fullName} (${leaveReq.requestNumber})`,
        });
        await appendHrAudit(tx, {
          operationId: auditContext.operationId,
          actor: auditContext.actor,
          action: 'CREATE',
          entityType: 'leave_request',
          entityId: String(leaveReq.id),
          entityLabel: `Cuti ${employee.fullName} (${leaveReq.requestNumber})`,
          outcome: 'SUCCESS',
          summary: `Pengajuan cuti ${leaveReq.requestNumber} (${employee.fullName}, ${data.durationDays} hari)`,
          targets: [target],
        });
      }

      return leaveReq;
    });

    return res.status(201).json({
      message: 'Permohonan cuti berhasil diajukan',
      data: createdRequest,
    });
  } catch (error) {
    console.error('Error createLeaveRequest:', error);
    return res.status(500).json({ error: 'Gagal mengajukan permohonan cuti' });
  }
}

// 4. GET /requests/:id (Untuk Tampilan Form F4 & Pratinjau Cetak)
export async function getLeaveRequestById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'ID tidak valid' });
    }

    const [request] = await db
      .select()
      .from(leaveRequests)
      .where(and(eq(leaveRequests.id, id),historicalScopePredicate(requireHrScope(req as any),leaveRequests.groupId)));

    if (!request) {
      return res.status(404).json({ error: 'Data permohonan cuti tidak ditemukan' });
    }

    const employee = await getEmployeeProfile(request.employeeId);
    let handoverEmployee = null;
    if (request.handoverToEmployeeId) {
      handoverEmployee = await getEmployeeProfile(request.handoverToEmployeeId);
    }

    const approvalsList = await db
      .select()
      .from(leaveApprovals)
      .where(eq(leaveApprovals.leaveRequestId, id));

    const applicantApproval = approvalsList.find((a) => a.stage === 'APPLICANT') || null;
    const directSupApproval = approvalsList.find((a) => a.stage === 'DIRECT_SUPERVISOR') || null;
    const hrdApproval = approvalsList.find((a) => a.stage === 'HRD') || null;
    const higherSupApproval = approvalsList.find((a) => a.stage === 'HIGHER_SUPERVISOR') || null;

    const prevLeaves = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          historicalScopePredicate(requireHrScope(req as any),leaveRequests.groupId),
          eq(leaveRequests.employeeId, request.employeeId),
          eq(leaveRequests.balanceYear, request.balanceYear),
          eq(leaveRequests.leaveType, 'ANNUAL'),
          lt(leaveRequests.id, request.id),
          notInArray(leaveRequests.status, ['REJECTED', 'CANCELLED'])
        )
      )
      .orderBy(asc(leaveRequests.id));

    const historyItems: Array<{ no: number; description: string }> = [];
    if (prevLeaves.length <= 10) {
      prevLeaves.forEach((pl, i) => {
        historyItems.push({
          no: i + 1,
          description: `${pl.durationDays} = Cuti tahunan tgl ${pl.startDate}`,
        });
      });
    } else {
      // Tampilkan 9 cuti terbaru, baris 10 akumulasi cuti sebelumnya
      const recent = prevLeaves.slice(0, 9);
      const older = prevLeaves.slice(9);
      recent.forEach((pl, i) => {
        historyItems.push({
          no: i + 1,
          description: `${pl.durationDays} = Cuti tahunan tgl ${pl.startDate}`,
        });
      });
      const olderTotalDays = older.reduce((sum, r) => sum + r.durationDays, 0);
      historyItems.push({
        no: 10,
        description: `${olderTotalDays} = Akumulasi ${older.length} cuti sebelumnya`,
      });
    }
    while (historyItems.length < 5) {
      historyItems.push({
        no: historyItems.length + 1,
        description: '',
      });
    }

    const cleanAnnualQuota = Math.max(0, request.snapshotBaseQuota - request.snapshotCollectiveLeave);

    return res.status(200).json({
      id: request.id,
      requestNumber: request.requestNumber,
      groupId:request.groupId, organizationId:request.organizationId, documentProfileSnapshot:request.documentProfileSnapshot,
      status: request.status,
      formNumber: '001',
      revisionCode: 'REV. 170208-1-W',
      createdAt: request.createdAt,
      employee: {
        id: employee?.id || request.employeeId,
        employeeCode: employee?.employeeCode || '-',
        fullName: employee?.fullName || '-',
        department: employee?.departmentName || '-',
        position: employee?.position || '-',
        joinDate: employee?.joinDate || null,
      },
      balanceYear: request.balanceYear,
      baseQuota: request.snapshotBaseQuota,
      collectiveLeaveDays: request.snapshotCollectiveLeave,
      cleanAnnualQuota,
      historyItems,
      detailedHistoryItems: prevLeaves.map((previous, index) => ({
        no: index + 1,
        description: `${previous.durationDays} = Cuti tahunan tgl ${previous.startDate}`,
        startDate: previous.startDate,
        endDate: previous.endDate,
        durationDays: previous.durationDays,
      })),
      availableBefore: request.snapshotAvailableBefore,
      leaveDaysRequested: request.durationDays,
      remainingAfter: request.snapshotRemainingAfter,
      leaveType: request.leaveType,
      specialLeaveReason: request.specialLeaveReason,
      reason: request.reason,
      startDate: request.startDate,
      endDate: request.endDate,
      resumeWorkDate: request.resumeWorkDate,
      hrdNotes: request.hrdNotes || '',
      handover: {
        recipientId: request.handoverToEmployeeId,
        recipientName: handoverEmployee?.fullName || '',
        taskDescription: request.handoverTask || '',
        emergencyPhone: request.emergencyPhone || '',
      },
      approvals: {
        applicant: {
          name: applicantApproval?.approverName || employee?.fullName || '-',
          date: applicantApproval?.signatureDate || null,
          status: applicantApproval?.status || 'PENDING',
        },
        directSupervisor: {
          name: directSupApproval?.approverName || '',
          date: directSupApproval?.signatureDate || null,
          status: directSupApproval?.status || 'PENDING',
        },
        hrd: {
          name: hrdApproval?.approverName || '',
          date: hrdApproval?.signatureDate || null,
          status: hrdApproval?.status || 'PENDING',
        },
        higherSupervisor: {
          name: higherSupApproval?.approverName || '',
          date: higherSupApproval?.signatureDate || null,
          status: higherSupApproval?.status || 'PENDING',
        },
      },
    });
  } catch (error) {
    console.error('Error getLeaveRequestById:', error);
    return res.status(500).json({ error: 'Gagal mengambil detail form cuti' });
  }
}

// 5. GET /requests (List)
export async function getLeaveRequests(req: Request, res: Response) {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;

    let query = db
      .select({
        id: leaveRequests.id,
        requestNumber: leaveRequests.requestNumber,
        employeeId: leaveRequests.employeeId,
        employeeName: employees.fullName,
        employeeCode: employees.employeeCode,
        leaveType: leaveRequests.leaveType,
        reason: leaveRequests.reason,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        durationDays: leaveRequests.durationDays,
        resumeWorkDate: leaveRequests.resumeWorkDate,
        status: leaveRequests.status,
        balanceYear: leaveRequests.balanceYear,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .leftJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .$dynamic();

    query = query.where(and(historicalScopePredicate(requireHrScope(req as any),leaveRequests.groupId),year && !isNaN(year) ? eq(leaveRequests.balanceYear, year) : undefined));

    const records = await query.orderBy(desc(leaveRequests.createdAt));

    return res.status(200).json(records);
  } catch (error) {
    console.error('Error getLeaveRequests:', error);
    return res.status(500).json({ error: 'Gagal memuat daftar permohonan cuti' });
  }
}

// 6. GET /holidays
// 5c. PUT /requests/:id (Edit permohonan cuti yang berstatus PENDING)
export async function updateLeaveRequest(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'ID permohonan cuti tidak valid' });
    }

    const [request] = await db
      .select()
      .from(leaveRequests)
      .where(and(eq(leaveRequests.id, id),historicalScopePredicate(requireHrScope(req as any),leaveRequests.groupId)));

    if (!request) {
      return res.status(404).json({ error: 'Data permohonan cuti tidak ditemukan' });
    }

    if (request.status !== 'PENDING') {
      return res.status(403).json({
        error: `Permohonan cuti tidak dapat diedit karena berstatus ${request.status}. Hanya permohonan PENDING yang dapat diubah.`,
      });
    }

    const parseResult = updateLeaveRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validasi form tidak lengkap',
        details: parseResult.error.issues,
      });
    }

    const data = parseResult.data;
    if (data.handoverToEmployeeId) await requireScopedEmployee(requireHrScope(req as any),data.handoverToEmployeeId);
    const startYear = Number(data.startDate.split('-')[0]);
    const currentYear = new Date().getFullYear();

    if (startYear < currentYear) {
      return res.status(400).json({
        error: `Permohonan cuti tidak dapat diubah ke tahun lampau (${startYear}).`,
      });
    }

    const holidays = await db
      .select()
      .from(leaveHolidayCalendars)
      .where(eq(leaveHolidayCalendars.year, startYear));
    const holidayDates = holidays.map((h) => h.holidayDate);

    let finalResumeWorkDate = data.resumeWorkDate;
    if (!finalResumeWorkDate) {
      const daysCalc = calculateLeaveWorkingDays({
        startDate: data.startDate,
        endDate: data.endDate,
        holidayDates,
      });
      finalResumeWorkDate = daysCalc.resumeWorkDate;
    }

    let [balance] = await db
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.employeeId, request.employeeId),
          eq(leaveBalances.year, startYear)
        )
      );

    const oldUsedDays = request.leaveType === 'ANNUAL' ? request.durationDays : 0;
    const newUsedDays = data.leaveType === 'ANNUAL' ? data.durationDays : 0;
    const deltaDays = newUsedDays - oldUsedDays;

    if (balance && deltaDays > 0) {
      const availableNow = balance.baseQuota - balance.collectiveLeaveDeduction - balance.usedQuota;
      if (deltaDays > availableNow) {
        return res.status(400).json({
          error: `Saldo cuti tahunan tidak mencukupi untuk penambahan durasi cuti. Sisa saldo tersedia: ${availableNow} hari, penambahan: ${deltaDays} hari.`,
        });
      }
    }

    const snapshotRemaining =
      data.leaveType === 'ANNUAL'
        ? Math.max(0, request.snapshotAvailableBefore - data.durationDays)
        : request.snapshotAvailableBefore;

    let auditContext: any = null;
    if ((req as any).user) {
      try {
        auditContext = await resolveAuditContext(req as any);
      } catch (err) {}
    }

    await db.transaction(async (tx) => {
      if (balance && deltaDays !== 0) {
        await tx
          .update(leaveBalances)
          .set({
            usedQuota: Math.max(0, balance.usedQuota + deltaDays),
            updatedAt: new Date(),
          })
          .where(eq(leaveBalances.id, balance.id));
      }

      await tx
        .update(leaveRequests)
        .set({
          leaveType: data.leaveType,
          specialLeaveReason: data.leaveType === 'SPECIAL' ? data.specialLeaveReason : null,
          reason: data.reason,
          startDate: data.startDate,
          endDate: data.endDate,
          durationDays: data.durationDays,
          resumeWorkDate: finalResumeWorkDate,
          handoverToEmployeeId: data.handoverToEmployeeId || null,
          handoverTask: data.handoverTask || null,
          emergencyPhone: data.emergencyPhone || null,
          balanceYear: startYear,
          snapshotRemainingAfter: snapshotRemaining,
          updatedAt: new Date(),
        })
        .where(and(eq(leaveRequests.id, id),historicalScopePredicate(requireHrScope(req as any),leaveRequests.groupId)));

      if (auditContext) {
        const target = sanitizeAuditTarget('leave_request', request, { ...request, ...data }, {
          entityId: String(id),
          entityLabel: `Cuti ${request.requestNumber}`,
        });
        await appendHrAudit(tx, {
          operationId: auditContext.operationId,
          actor: auditContext.actor,
          action: 'UPDATE',
          entityType: 'leave_request',
          entityId: String(id),
          entityLabel: `Cuti ${request.requestNumber}`,
          outcome: 'SUCCESS',
          summary: `Memperbarui permohonan cuti ${request.requestNumber} (${data.durationDays} hari)`,
          targets: [target],
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: `Permohonan cuti ${request.requestNumber} berhasil diperbarui.`,
      data: {
        id,
        requestNumber: request.requestNumber,
        status: 'PENDING',
      },
    });
  } catch (error) {
    console.error('Error updateLeaveRequest:', error);
    return res.status(500).json({ error: 'Gagal memperbarui permohonan cuti' });
  }
}

// 5a. PATCH /requests/:id/approve
export async function approveLeaveRequest(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "ID permohonan cuti tidak valid" });
    }

    const [request] = await db
      .select()
      .from(leaveRequests)
      .where(and(eq(leaveRequests.id, id),historicalScopePredicate(requireHrScope(req as any),leaveRequests.groupId)));

    if (!request) {
      return res.status(404).json({ error: "Data permohonan cuti tidak ditemukan" });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        error: `Permohonan cuti tidak dapat disetujui karena berstatus ${request.status}`,
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const user = (req as any).user;
    const approverName = user?.fullName || user?.username || "HR Administrator";

    let auditContext: any = null;
    if ((req as any).user) {
      try {
        auditContext = await resolveAuditContext(req as any);
      } catch (err) {}
    }

    await db.transaction(async (tx) => {
      await tx
        .update(leaveRequests)
        .set({
          status: "APPROVED",
          updatedAt: new Date(),
        })
        .where(and(eq(leaveRequests.id, id),historicalScopePredicate(requireHrScope(req as any),leaveRequests.groupId)));

      await tx
        .update(leaveApprovals)
        .set({
          status: "APPROVED",
          signatureDate: todayStr,
          approverName,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leaveApprovals.leaveRequestId, id),
            eq(leaveApprovals.stage, "HRD")
          )
        );

      if (auditContext) {
        const target = sanitizeAuditTarget('leave_request', request, { ...request, status: 'APPROVED' }, {
          entityId: String(id),
          entityLabel: `Cuti ${request.requestNumber}`,
        });
        await appendHrAudit(tx, {
          operationId: auditContext.operationId,
          actor: auditContext.actor,
          action: 'APPROVE',
          entityType: 'leave_request',
          entityId: String(id),
          entityLabel: `Cuti ${request.requestNumber}`,
          outcome: 'SUCCESS',
          summary: `Menyetujui permohonan cuti ${request.requestNumber} oleh HRD`,
          targets: [target],
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: "Permohonan cuti berhasil disetujui oleh HRD",
      data: { id, status: "APPROVED" },
    });
  } catch (error) {
    console.error("Error approveLeaveRequest:", error);
    return res.status(500).json({ error: "Gagal menyetujui permohonan cuti" });
  }
}

// 5b. DELETE /requests/:id
export async function deleteLeaveRequestDraft(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "ID permohonan cuti tidak valid" });
    }

    const [request] = await db
      .select()
      .from(leaveRequests)
      .where(and(eq(leaveRequests.id, id),historicalScopePredicate(requireHrScope(req as any),leaveRequests.groupId)));

    if (!request) {
      return res.status(404).json({ error: "Data permohonan cuti tidak ditemukan" });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        error: "Hanya permohonan cuti berstatus PENDING yang dapat dihapus",
      });
    }

    let auditContext: any = null;
    if ((req as any).user) {
      try {
        auditContext = await resolveAuditContext(req as any);
      } catch (err) {}
    }

    await db.transaction(async (tx) => {
      if (request.leaveType === "ANNUAL") {
        const [balance] = await tx
          .select()
          .from(leaveBalances)
          .where(
            and(
              eq(leaveBalances.employeeId, request.employeeId),
              eq(leaveBalances.year, request.balanceYear)
            )
          );

        if (balance) {
          const newUsed = Math.max(0, balance.usedQuota - request.durationDays);
          await tx
            .update(leaveBalances)
            .set({
              usedQuota: newUsed,
              updatedAt: new Date(),
            })
            .where(eq(leaveBalances.id, balance.id));
        }
      }

      await tx
        .delete(leaveApprovals)
        .where(eq(leaveApprovals.leaveRequestId, id));

      await tx
        .delete(leaveRequests)
        .where(and(eq(leaveRequests.id, id),historicalScopePredicate(requireHrScope(req as any),leaveRequests.groupId)));

      if (auditContext) {
        const target = sanitizeAuditTarget('leave_request', request, null, {
          entityId: String(id),
          entityLabel: `Draft Cuti ${request.requestNumber}`,
        });
        await appendHrAudit(tx, {
          operationId: auditContext.operationId,
          actor: auditContext.actor,
          action: 'DELETE',
          entityType: 'leave_request',
          entityId: String(id),
          entityLabel: `Draft Cuti ${request.requestNumber}`,
          outcome: 'SUCCESS',
          summary: `Menghapus draft permohonan cuti ${request.requestNumber}`,
          targets: [target],
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: "Draft permohonan cuti berhasil dihapus dan saldo telah dipulihkan",
    });
  } catch (error) {
    console.error("Error deleteLeaveRequestDraft:", error);
    return res.status(500).json({ error: "Gagal menghapus draft permohonan cuti" });
  }
}

export async function getHolidays(req: Request, res: Response) {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getUTCFullYear();
    const holidays = await db
      .select()
      .from(leaveHolidayCalendars)
      .where(eq(leaveHolidayCalendars.year, year))
      .orderBy(leaveHolidayCalendars.holidayDate);

    return res.status(200).json(holidays);
  } catch (error) {
    console.error('Error getHolidays:', error);
    return res.status(500).json({ error: 'Gagal mengambil data kalender libur' });
  }
}


// ==========================================
// MASTER CUTI, CUTI BERSAMA & REKAP SALDO
// ==========================================

export async function getAnnualLeaveConfig(req: Request, res: Response) {
  try {
    const year = Number(req.query.year) || new Date().getUTCFullYear();
    const [config] = await db
      .select()
      .from(annualLeaveConfigs)
      .where(eq(annualLeaveConfigs.year, year));

    if (!config) {
      return res.json({
        year,
        baseQuota: 12,
        collectiveLeaveDays: 0,
        allowCarryForward: false,
        maxCarryForwardDays: 0,
        notes: null,
      });
    }

    return res.json(config);
  } catch (error) {
    console.error('Error getAnnualLeaveConfig:', error);
    return res.status(500).json({ error: 'Gagal memuat konfigurasi master cuti tahunan' });
  }
}

export async function saveAnnualLeaveConfig(req: Request, res: Response) {
  try {
    if (!(await loadCurrentIdentity((req as any).user?.userId))?.isGlobalAdministrator) return res.status(403).json({error:"Shared leave policy requires global administrator"});
    const parseResult = annualLeaveConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Data konfigurasi cuti tidak valid',
        details: parseResult.error.format(),
      });
    }

    const data = parseResult.data;
    let auditContext: any = null;
    if ((req as any).user) {
      try {
        auditContext = await resolveAuditContext(req as any);
      } catch (err) {}
    }

    let savedConfig: any = null;
    let syncedCount = 0;

    await db.transaction(async (tx) => {
      // 1. Upsert annualLeaveConfigs
      const [existingConfig] = await tx
        .select()
        .from(annualLeaveConfigs)
        .where(eq(annualLeaveConfigs.year, data.year));

      if (existingConfig) {
        const [updated] = await tx
          .update(annualLeaveConfigs)
          .set({
            baseQuota: data.baseQuota,
            collectiveLeaveDays: data.collectiveLeaveDays,
            allowCarryForward: data.allowCarryForward,
            maxCarryForwardDays: data.maxCarryForwardDays,
            notes: data.notes ?? null,
            updatedAt: new Date(),
          })
          .where(eq(annualLeaveConfigs.id, existingConfig.id))
          .returning();
        savedConfig = updated;
      } else {
        const [inserted] = await tx
          .insert(annualLeaveConfigs)
          .values({
            year: data.year,
            baseQuota: data.baseQuota,
            collectiveLeaveDays: data.collectiveLeaveDays,
            allowCarryForward: data.allowCarryForward,
            maxCarryForwardDays: data.maxCarryForwardDays,
            notes: data.notes ?? null,
          })
          .returning();
        savedConfig = inserted;
      }

      // 2. Ambil seluruh karyawan aktif
      const activeEmployees = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.status, 'Active'),employeeScopePredicate(requireHrScope(req as any))));

      // 3. Ambil saldo tahun berjalan (N) dan tahun sebelumnya (N - 1)
      const currentBalances = await tx
        .select()
        .from(leaveBalances)
        .where(eq(leaveBalances.year, data.year));

      const prevBalances = await tx
        .select()
        .from(leaveBalances)
        .where(eq(leaveBalances.year, data.year - 1));

      const currentMap = new Map<number, typeof currentBalances[0]>();
      currentBalances.forEach((b) => currentMap.set(b.employeeId, b));

      const prevMap = new Map<number, typeof prevBalances[0]>();
      prevBalances.forEach((b) => prevMap.set(b.employeeId, b));

      // 4. Lakukan bulk sync per karyawan
      for (const emp of activeEmployees) {
        const prev = prevMap.get(emp.id);
        const autoCarry = calculateRolloverCarryForward({
          prevBaseQuota: prev?.baseQuota ?? 12,
          prevCollectiveLeave: prev?.collectiveLeaveDeduction ?? 0,
          prevCarriedOver: prev?.carriedOverQuota ?? 0,
          prevUsedQuota: prev?.usedQuota ?? 0,
          maxCarryForwardDays: data.maxCarryForwardDays,
          isCarryForwardEnabled: data.allowCarryForward,
        });

        const curr = currentMap.get(emp.id);

        if (!curr) {
          await tx.insert(leaveBalances).values({
            employeeId: emp.id,
            year: data.year,
            baseQuota: data.baseQuota,
            collectiveLeaveDeduction: data.collectiveLeaveDays,
            usedQuota: 0,
            carriedOverQuota: autoCarry,
            isCustomQuota: false,
            isCustomCarryForward: false,
          });
          syncedCount++;
        } else {
          const updateData: Partial<typeof leaveBalances.$inferInsert> = {
            collectiveLeaveDeduction: data.collectiveLeaveDays,
            updatedAt: new Date(),
          };

          if (!curr.isCustomQuota) {
            updateData.baseQuota = data.baseQuota;
          }

          if (!curr.isCustomCarryForward) {
            updateData.carriedOverQuota = autoCarry;
          }

          await tx
            .update(leaveBalances)
            .set(updateData)
            .where(eq(leaveBalances.id, curr.id));
          syncedCount++;
        }
      }

      if (auditContext) {
        await appendHrAudit(tx, {
          operationId: auditContext.operationId,
          actor: auditContext.actor,
          action: 'UPDATE',
          entityType: 'hr_setting',
          entityId: `annual_leave_${data.year}`,
          entityLabel: `Konfigurasi Cuti ${data.year}`,
          outcome: 'SUCCESS',
          summary: `Menyimpan konfigurasi master cuti tahun ${data.year} (Kuota: ${data.baseQuota}, Bersama: ${data.collectiveLeaveDays})`,
        });
      }
    });

    return res.json({
      message: 'Konfigurasi cuti berhasil disimpan dan saldo karyawan disinkronisasi',
      data: savedConfig,
      syncedEmployeesCount: syncedCount,
    });
  } catch (error) {
    console.error('Error saveAnnualLeaveConfig:', error);
    return res.status(500).json({ error: 'Gagal menyimpan konfigurasi master cuti tahunan' });
  }
}

export async function getMasterLeaveBalances(req: Request, res: Response) {
  try {
    const year = Number(req.query.year) || new Date().getUTCFullYear();
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    const [config] = await db
      .select()
      .from(annualLeaveConfigs)
      .where(eq(annualLeaveConfigs.year, year));

    const defaultBaseQuota = config?.baseQuota ?? 12;
    const defaultCollectiveLeave = config?.collectiveLeaveDays ?? 0;

    const activeEmployees = await db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        fullName: employees.fullName,
        departmentId: employees.departmentId,
        departmentName: departments.name,
        position: employees.position,
        status: employees.status,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(and(eq(employees.status, 'Active'),employeeScopePredicate(requireHrScope(req as any))));

    const balances = await db
      .select()
      .from(leaveBalances)
      .where(and(eq(leaveBalances.year, year),historicalScopePredicate(requireHrScope(req as any),leaveBalances.groupId)));

    const balanceMap = new Map<number, typeof balances[0]>();
    balances.forEach((b) => balanceMap.set(b.employeeId, b));

    let totalAllocatedQuota = 0;
    let totalUsedDays = 0;
    let totalRemainingDays = 0;

    const items: Array<{
      balanceId: number | null;
      employeeId: number;
      employeeCode: string;
      fullName: string;
      department: string;
      departmentId: number | null;
      position: string;
      year: number;
      baseQuota: number;
      collectiveLeaveDeduction: number;
      cleanAnnualQuota: number;
      carriedOverQuota: number;
      totalEntitlement: number;
      usedQuota: number;
      remainingQuota: number;
      isCustomQuota: boolean;
      isCustomCarryForward: boolean;
    }> = [];

    for (const emp of activeEmployees) {
      const b = balanceMap.get(emp.id);
      const baseQuota = b?.baseQuota ?? defaultBaseQuota;
      const collectiveLeaveDeduction = b?.collectiveLeaveDeduction ?? defaultCollectiveLeave;
      const carriedOverQuota = b?.carriedOverQuota ?? 0;
      const usedQuota = b?.usedQuota ?? 0;
      const isCustomQuota = b?.isCustomQuota ?? false;
      const isCustomCarryForward = b?.isCustomCarryForward ?? false;

      const calc = calculateLeaveBalances({
        baseQuota,
        collectiveLeaveDays: collectiveLeaveDeduction,
        usedQuota,
        carriedOverQuota,
        requestedDays: 0,
      });

      totalAllocatedQuota += calc.totalEntitlement;
      totalUsedDays += usedQuota;
      totalRemainingDays += calc.availableBefore;

      items.push({
        balanceId: b?.id ?? null,
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        department: emp.departmentName || 'Belum Ditentukan',
        departmentId: emp.departmentId,
        position: emp.position || '-',
        year,
        baseQuota,
        collectiveLeaveDeduction,
        cleanAnnualQuota: calc.cleanAnnualQuota,
        carriedOverQuota,
        totalEntitlement: calc.totalEntitlement,
        usedQuota,
        remainingQuota: calc.availableBefore,
        isCustomQuota,
        isCustomCarryForward,
      });
    }

    let filtered = items;
    if (departmentId && !isNaN(departmentId)) {
      filtered = filtered.filter((i) => i.departmentId === departmentId);
    }
    if (search) {
      filtered = filtered.filter(
        (i) =>
          i.fullName.toLowerCase().includes(search) ||
          i.employeeCode.toLowerCase().includes(search) ||
          i.department.toLowerCase().includes(search)
      );
    }

    const totalEmployees = activeEmployees.length;
    const averageRemainingDays = totalEmployees > 0 ? Number((totalRemainingDays / totalEmployees).toFixed(1)) : 0;

    return res.json({
      year,
      totalEmployees,
      totalAllocatedQuota,
      averageRemainingDays,
      totalUsedDays,
      balances: filtered,
    });
  } catch (error) {
    console.error('Error getMasterLeaveBalances:', error);
    return res.status(500).json({ error: 'Gagal memuat rekap saldo cuti karyawan' });
  }
}

export async function updateEmployeeLeaveBalance(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'ID saldo tidak valid' });
    }

    const parseResult = updateLeaveBalanceSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Data penyesuaian saldo tidak valid',
        details: parseResult.error.format(),
      });
    }

    const { baseQuota, carriedOverQuota } = parseResult.data;

    const [existing] = await db
      .select()
      .from(leaveBalances)
      .where(and(eq(leaveBalances.id, id),historicalScopePredicate(requireHrScope(req as any),leaveBalances.groupId)));

    if (!existing) {
      return res.status(404).json({ error: 'Data saldo cuti tidak ditemukan' });
    }

    const updatePayload: Partial<typeof leaveBalances.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (baseQuota !== undefined) {
      updatePayload.baseQuota = baseQuota;
      updatePayload.isCustomQuota = true;
    }

    if (carriedOverQuota !== undefined) {
      updatePayload.carriedOverQuota = carriedOverQuota;
      updatePayload.isCustomCarryForward = true;
    }

    let auditContext: any = null;
    if ((req as any).user) {
      try {
        auditContext = await resolveAuditContext(req as any);
      } catch (err) {}
    }

    const [updated] = await db
      .update(leaveBalances)
      .set(updatePayload)
      .where(and(eq(leaveBalances.id, id),historicalScopePredicate(requireHrScope(req as any),leaveBalances.groupId)))
      .returning();

    if (auditContext) {
      await appendHrAudit(db as any, {
        operationId: auditContext.operationId,
        actor: auditContext.actor,
        action: 'UPDATE',
        entityType: 'leave_balance',
        entityId: String(id),
        entityLabel: `Saldo Cuti Karyawan #${existing.employeeId} (${existing.year})`,
        outcome: 'SUCCESS',
        summary: `Menyesuaikan kuota cuti karyawan #${existing.employeeId} tahun ${existing.year}`,
      });
    }

    const calc = calculateLeaveBalances({
      baseQuota: updated.baseQuota,
      collectiveLeaveDays: updated.collectiveLeaveDeduction,
      usedQuota: updated.usedQuota,
      carriedOverQuota: updated.carriedOverQuota,
      requestedDays: 0,
    });

    return res.json({
      message: 'Saldo cuti karyawan berhasil diperbarui',
      data: {
        ...updated,
        cleanAnnualQuota: calc.cleanAnnualQuota,
        totalEntitlement: calc.totalEntitlement,
        remainingQuota: calc.availableBefore,
      },
    });
  } catch (error) {
    console.error('Error updateEmployeeLeaveBalance:', error);
    return res.status(500).json({ error: 'Gagal memperbarui saldo cuti karyawan' });
  }
}
