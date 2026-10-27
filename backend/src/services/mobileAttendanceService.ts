function computeRecordDuration(scanIn?: string | null, scanOut?: string | null): string {
  if (!scanIn || !scanOut) return '--';
  const matchIn = scanIn.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  const matchOut = scanOut.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!matchIn || !matchOut) return '--';
  const inMins = parseInt(matchIn[1], 10) * 60 + parseInt(matchIn[2], 10);
  let outMins = parseInt(matchOut[1], 10) * 60 + parseInt(matchOut[2], 10);
  if (outMins < inMins) outMins += 24 * 60;
  return formatDurationMinutes(outMins - inMins);
}
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { db } from '../db';
import { approvedMobileRecord } from '../domain/approvedMobileAttendance';
import { users } from '../db/schema/users';
import { employees } from '../db/schema/employees';
import { departments, locations } from '../db/schema/master';
import { attendanceRecords } from '../db/schema/attendance';
import { attendanceSelfLogs } from '../db/schema/attendanceSelfLogs';
import { attendanceFaceProfiles } from '../db/schema/attendanceFaceProfiles';
import { attendanceFaceRequests } from '../db/schema/attendanceFaceRequests';
import { attendanceShifts, attendanceShiftAssignments, attendanceLocks } from '../db/schema/attendanceWorkspace';
import { systemSettings } from '../db/schema/system';
import { resolveEmployeeShift, resolveActiveEmployeeShift, getWorkingScheduleForDate } from '../domain/attendanceSchedule';
import { isWithinGeofence, buildMapLinks } from '../domain/geofence';
import { determineShiftCategory, evaluateAttendanceApproval } from '../domain/attendanceVerificationPolicy';
import { localAttendanceTime, zoneAtLocation, zoneLabels, attendanceMetrics, minuteValue } from '../domain/attendanceTime';
import { verifyBiometricMatch } from '../domain/faceMatcher';
import { extractPhotoFace, FACE_DESCRIPTOR_VERSION } from './faceRecognition';
import { saveAttendancePhoto } from './attendancePhotoStorage';
import { eq, and, or, desc, gte, lte, sql } from 'drizzle-orm';

type SelfLog = typeof attendanceSelfLogs.$inferSelect;
export async function isMobileStrictClockEnabled(targetDb: any): Promise<boolean> {
  const [row] = await targetDb.select().from(systemSettings).where(eq(systemSettings.key, 'attendance_mobile_strict_clock')).limit(1);
  if (!row) return false;
  return row.value === true || row.value === 'true' || (typeof row.value === 'object' && row.value?.enabled === true);
}
export const DEFAULT_OFFICE_COORDINATES = { name: 'PT Cahaya Mas Cemerlang HQ', latitude: -6.2088, longitude: 106.8456, radiusMeters: 100 };
export function getWibDateAndTimeString(date = new Date()) {
  const time = localAttendanceTime(date, 'Asia/Jakarta');
  const d = new Date(`${time.workDate}T12:00:00Z`);
  return { ...time, dayShort: ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getUTCDay()], dateStr: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d) };
}
export function parseMinutesFromTimeStr(value?: string | null) { return value?.includes(':') ? minuteValue(value) : null; }
export function calculateLateMinutes(scan?: string | null, schedule?: string | null) { return scan && schedule ? Math.max(0, minuteValue(scan) - minuteValue(schedule)) : 0; }
export function formatDurationMinutes(value: number) { if (value < 0 || !Number.isFinite(value)) return '--:--'; return `${String(Math.floor(value / 60)).padStart(2,'0')}h ${String(value % 60).padStart(2,'0')}m`; }

export function resolveFirstInLastOutLogs<T extends { eventType: string; occurredAt: Date; id?: number | string | bigint }>(
  logs: T[]
): { inLog: T | null; outLog: T | null } {
  const inLogs = logs
    .filter(l => l.eventType === "IN")
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || Number(a.id || 0) - Number(b.id || 0));
  const inLog = inLogs[0] || null;

  const outLogs = logs
    .filter(l => l.eventType === "OUT")
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || Number(b.id || 0) - Number(a.id || 0));
  const outLog = outLogs[0] || null;

  return { inLog, outLog };
}

export const MIN_CHECKOUT_INTERVAL_MINUTES = 30;

export function validateClockAllowed(
  eventType: string,
  workDate: string,
  existingLogs: Array<{ eventType: string; workDate: string; occurredAt?: Date }>,
  now: Date = new Date(),
  isDirectOut: boolean = false
): void {
  const dateLogs = existingLogs.filter(l => l.workDate === workDate);
  const hasIn = dateLogs.some(l => l.eventType === "IN");
  const hasOut = dateLogs.some(l => l.eventType === "OUT");

  if (eventType === "IN" && hasIn && hasOut) {
    throw new Error("Presensi hari ini sudah lengkap (sudah absen masuk dan pulang). Hubungi HRD jika memerlukan koreksi.");
  }

  if (eventType === "OUT" && !isDirectOut && hasIn) {
    const inLogs = dateLogs
      .filter(l => l.eventType === "IN" && l.occurredAt)
      .sort((a, b) => a.occurredAt!.getTime() - b.occurredAt!.getTime());
    if (inLogs.length > 0) {
      const elapsedMinutes = Math.floor((now.getTime() - inLogs[0].occurredAt!.getTime()) / 60000);
      if (elapsedMinutes < MIN_CHECKOUT_INTERVAL_MINUTES) {
        throw new Error(`Absen pulang baru dapat dilakukan minimal ${MIN_CHECKOUT_INTERVAL_MINUTES} menit setelah absen masuk. Scan ini dianggap duplikasi.`);
      }
    }
  }
}

export async function resolveEmployeeUser(userId: number, targetDb = db) {
  const [user] = await targetDb.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.status !== 'active') throw new Error('Akun pengguna tidak ditemukan atau tidak aktif.');
  if (!user.employeeId) throw new Error('Akun Anda belum dikaitkan dengan master data karyawan. Hubungi Admin IT.');
  const [employee] = await targetDb.select({ id: employees.id, employeeCode: employees.employeeCode, fullName: employees.fullName, photoUrl: employees.photoUrl, employeeStatus: employees.status, position: employees.position, departmentId: employees.departmentId, departmentName: departments.name, locationName: locations.name })
    .from(employees).leftJoin(departments, eq(employees.departmentId, departments.id)).leftJoin(locations, eq(employees.locationId, locations.id)).where(eq(employees.id, user.employeeId)).limit(1);
  if (!employee) throw new Error('Data karyawan tidak ditemukan.');
  if (employee.employeeStatus !== 'Active') throw new Error('Status karyawan tidak aktif. Hubungi HRD.');
  return { user, employee };
}
async function employeeLogs(employeeId: number, targetDb: any): Promise<SelfLog[]> {
  return targetDb.select().from(attendanceSelfLogs).where(eq(attendanceSelfLogs.employeeId, employeeId)).orderBy(desc(attendanceSelfLogs.occurredAt), desc(attendanceSelfLogs.id));
}
async function shiftForEmployee(employee: { id: number; departmentId: number | null }, targetDb: any) {
  const shifts = await targetDb.select().from(attendanceShifts);
  const assignments = await targetDb.select().from(attendanceShiftAssignments);
  const { shift, hasActiveAssignment } = resolveActiveEmployeeShift(employee, shifts, assignments);
  return { shift, approvalShift: hasActiveAssignment ? shift : null };
}
function latestPair(logs: SelfLog[], now = new Date()) {
  const entry = logs.find(l => l.eventType === 'IN');
  return entry && now.getTime() - entry.occurredAt.getTime() <= 36 * 3600_000 ? entry : null;
}
async function employeeLock(tx: any, id: number) { await tx.execute(sql`SELECT pg_advisory_xact_lock(72423, ${id}::integer)`); }
async function checkUnlocked(tx: any, date: string) {
  const [lock] = await tx.select().from(attendanceLocks).where(eq(attendanceLocks.workDate, date));
  if (lock) throw new Error('Periode absensi dikunci. Hubungi HRD.');
}
export async function projectApprovedLog(tx: any, log: SelfLog) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"att_date_" + log.workDate}))`);
  await checkUnlocked(tx, log.workDate);
  const all: SelfLog[] = await tx.select().from(attendanceSelfLogs).where(and(eq(attendanceSelfLogs.employeeId, log.employeeId), eq(attendanceSelfLogs.workDate, log.workDate))).orderBy(desc(attendanceSelfLogs.id));
  const approved = all.filter(l => l.approvalStatus === 'APPROVED');
  const { inLog, outLog } = resolveFirstInLastOutLogs(approved);
  const [storedRecord] = await tx.select().from(attendanceRecords).where(and(eq(attendanceRecords.employeeId, log.employeeId), eq(attendanceRecords.workDate, log.workDate)));
  if (storedRecord?.scanIn) {
    const isMobileOwned = storedRecord.sourceBatchId === null
      && !storedRecord.normalized
      && Boolean(inLog && storedRecord.scanIn === inLog.scanTime);
    if (!isMobileOwned) {
      if (log.eventType === "IN") {
        throw new Error("Konflik: Presensi masuk independen (mesin/impor/manual) sudah tercatat untuk tanggal ini.");
      }
      throw new Error("Konflik: Record absensi pada tanggal ini milik mesin/impor/manual dan tidak dapat ditimpa.");
    }
  }
  const existing = storedRecord ? approvedMobileRecord(storedRecord, all) : null;
  const hasPendingIn = all.some(l => l.eventType === "IN" && l.approvalStatus === "PENDING");
  const isDirectOut = Boolean(outLog && (outLog.notes?.includes("[DIRECT_OUT]") || !all.some(l => l.eventType === "IN")));
  if (!inLog && !existing?.scanIn && (!isDirectOut || hasPendingIn)) return;
  const scanIn = inLog?.scanTime || existing?.scanIn || null;
  const scanOut = outLog?.scanTime || existing?.scanOut || null;
  const scheduleIn = log.scheduleIn || existing?.scheduleIn || '08:00';
  const scheduleOut = log.scheduleOut || existing?.scheduleOut || '17:00';
  const offset = outLog?.scanDate ? Math.round((Date.parse(outLog.scanDate) - Date.parse(log.workDate)) / 86400_000) : 0;
  const values = { scanIn, scanOut, rawScanIn: scanIn, rawScanOut: scanOut, scheduleIn, scheduleOut, shift: log.shiftCode,
    ...attendanceMetrics(scheduleIn, scheduleOut, scanIn, scanOut, offset), attendanceStatus: approved.some(l => !l.isWithinGeofence) ? 'DINAS_LUAR' : 'PRESENT', updatedAt: new Date() };
  await tx.insert(attendanceRecords).values({ employeeId: log.employeeId, workDate: log.workDate, ...values })
    .onConflictDoUpdate({ target: [attendanceRecords.employeeId, attendanceRecords.workDate], set: { ...values, revision: sql`${attendanceRecords.revision} + 1` } });
}
export interface MobileClockInput {
  eventType: 'IN' | 'OUT';
  isDirectOut?: boolean; workDate?: string; scanTime?: string; latitude?: number | null; longitude?: number | null; accuracy?: number | null; address?: string | null; photoBase64?: string | null; deviceInfo?: string | null; notes?: string | null; txHash?: string | null;
}
export async function recordMobileClock(userId: number, payload: MobileClockInput, targetDb = db, recognize: typeof extractPhotoFace = extractPhotoFace) {
  const { user, employee } = await resolveEmployeeUser(userId, targetDb);
  const gpsZone = zoneAtLocation(payload.latitude, payload.longitude);
  if (!['IN','OUT'].includes(payload.eventType)) throw new Error('Event type harus IN atau OUT.');
  const [profile] = await targetDb.select().from(attendanceFaceProfiles).where(eq(attendanceFaceProfiles.employeeId, employee.id));
  if (!profile?.isEnrolled || !profile.samplePhotoUrl) throw new Error('Wajah belum terdaftar. Daftarkan wajah pada halaman profil sebelum presensi.');
  if (!payload.photoBase64) throw new Error('Foto kamera diperlukan. Ulangi presensi.');
  const live = await recognize(payload.photoBase64);
  let reference = profile.faceDescriptorHash;
  if (profile.descriptorVersion !== FACE_DESCRIPTOR_VERSION) {
    const referencePhoto = profile.samplePhotoUrl.startsWith('data:image/') ? profile.samplePhotoUrl : `data:image/webp;base64,${(await fs.readFile(profile.samplePhotoUrl)).toString('base64')}`;
    reference = JSON.stringify((await recognize(referencePhoto)).descriptor);
  }
  if (!verifyBiometricMatch(live.descriptor, reference).isMatch) throw new Error('Wajah tidak cocok dengan foto terdaftar. Ulangi presensi menggunakan wajah Anda.');
  const now = new Date();
  const hash = `TX-${randomUUID()}`;
  const photoPath = await saveAttendancePhoto(hash, live.photoUrl);
  try {
    return await targetDb.transaction(async tx => {
      await employeeLock(tx, employee.id);
      const [currentProfile] = await tx.select().from(attendanceFaceProfiles).where(eq(attendanceFaceProfiles.employeeId, employee.id));
      const currentReference = currentProfile?.samplePhotoUrl === profile.samplePhotoUrl ? reference : currentProfile?.faceDescriptorHash;
      if (!currentProfile?.isEnrolled || !verifyBiometricMatch(live.descriptor, currentReference).isMatch) throw new Error('Foto acuan telah berubah. Ulangi presensi.');
      const logs = await employeeLogs(employee.id, tx);
      const entry = latestPair(logs, now);
      const zone = payload.eventType === 'OUT' && entry ? entry.timeZone : gpsZone;
      const local = localAttendanceTime(now, zone);
      const workDate = payload.eventType === 'OUT' && entry ? entry.workDate : local.workDate;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"att_date_" + workDate}))`);
      await checkUnlocked(tx, workDate);
      const [existingRecord] = await tx.select().from(attendanceRecords).where(and(eq(attendanceRecords.employeeId, employee.id), eq(attendanceRecords.workDate, workDate)));
      if (payload.eventType === 'IN' && existingRecord?.scanIn) {
        throw new Error('Presensi masuk sudah tercatat di sistem.');
      }
      validateClockAllowed(payload.eventType, workDate, logs, now, payload.isDirectOut);
      const strictClock = await isMobileStrictClockEnabled(tx);
      const todayLogs = logs.filter(l => l.workDate === workDate);
      if (strictClock && todayLogs.some(l => l.eventType === payload.eventType)) throw new Error('Presensi sudah tercatat. Gunakan pengajuan koreksi jika ditolak.');
      if (payload.isDirectOut) {
        if (payload.eventType !== 'OUT') throw new Error('isDirectOut hanya berlaku untuk event OUT.');
        if (!payload.notes || payload.notes.trim().length < 3) throw new Error('Keterangan wajib diisi untuk absensi pulang tanpa jam masuk.');
      }
      if (payload.eventType === 'OUT' && !entry && !payload.isDirectOut) throw new Error('Belum melakukan presensi masuk.');
      if (payload.eventType === 'IN' && entry && !logs.some(l => l.workDate === entry.workDate && l.eventType === 'OUT')) throw new Error('Selesaikan presensi pulang shift sebelumnya terlebih dahulu.');
      const { shift, approvalShift } = await shiftForEmployee(employee, tx);
      const daily = getWorkingScheduleForDate(workDate, shift);
      const isReclock = todayLogs.some(l => l.eventType === payload.eventType);
      const approval = payload.isDirectOut
        ? { requiresVerification: true, approvalStatus: 'PENDING' as const, approvalNote: 'Menunggu pemeriksaan HRD (Langsung Absen Pulang).' }
        : isReclock
        ? { requiresVerification: true, approvalStatus: 'PENDING' as const, approvalNote: 'Menunggu pemeriksaan HRD (Absensi Ulang).' }
        : evaluateAttendanceApproval(approvalShift, payload.eventType);
      const finalNotes = payload.isDirectOut ? `[DIRECT_OUT] ${payload.notes!.trim()}` : payload.notes;
      const geo = isWithinGeofence(payload.latitude, payload.longitude, DEFAULT_OFFICE_COORDINATES.latitude, DEFAULT_OFFICE_COORDINATES.longitude, DEFAULT_OFFICE_COORDINATES.radiusMeters);
      const links = buildMapLinks(payload.latitude!, payload.longitude!);
      const [log] = await tx.insert(attendanceSelfLogs).values({ employeeId: employee.id, userId: user.id, eventType: payload.eventType, workDate, scanDate: local.workDate, scanTime: local.scanTime, timeZone: zone, occurredAt: now,
        scheduleIn: entry && payload.eventType === 'OUT' ? entry.scheduleIn : daily.scheduleIn, scheduleOut: entry && payload.eventType === 'OUT' ? entry.scheduleOut : daily.scheduleOut,
        shiftCode: entry && payload.eventType === 'OUT' ? entry.shiftCode : shift.code, shiftCategory: determineShiftCategory(shift),
        latitude: String(payload.latitude), longitude: String(payload.longitude), accuracy: payload.accuracy == null ? null : Math.round(payload.accuracy), address: payload.address || null,
        mapUrl: links.osmUrl, googleMapsUrl: links.googleMapsUrl, isWithinGeofence: geo.isWithin, distanceMeters: geo.distanceMeters,
        photoUrl: photoPath, txHash: hash, deviceInfo: payload.deviceInfo, notes: finalNotes, ...approval,
        reviewHistory: [{ status: approval.approvalStatus, note: approval.approvalNote, actorId: user.id, at: now.toISOString() }],
      }).returning();
      if (log.approvalStatus === 'APPROVED') await projectApprovedLog(tx, log);
      return { success: true, message: 'Presensi berhasil dicatat.', data: { ...publicLog(log), status: payload.eventType === 'IN' ? 'CHECKED_IN' : 'COMPLETED' } };
    });
  } catch (error) { await fs.unlink(photoPath).catch(() => {}); throw error; }
}
function reviewSummary(logs: SelfLog[]): { status: 'PENDING' | 'APPROVED' | 'REJECTED' | null; note: string } {
  if (!logs.length) {
    return { status: null, note: 'Belum ada pengajuan.' };
  }
  const log = logs.find(item => item.approvalStatus === 'REJECTED') || logs.find(item => item.approvalStatus === 'PENDING') || logs[0];
  const rawStatus = log.approvalStatus;
  const status: 'PENDING' | 'APPROVED' | 'REJECTED' | null =
    rawStatus === 'PENDING' || rawStatus === 'APPROVED' || rawStatus === 'REJECTED' ? rawStatus : null;
  const note = log.approvalNote || (status === 'PENDING' ? 'Menunggu pemeriksaan HRD.' : status === 'REJECTED' ? 'Ditolak oleh HRD.' : 'Disetujui.');
  return { status, note };
}
export async function getMobileTodaySummary(userId: number, targetDb = db) {
  const { employee } = await resolveEmployeeUser(userId, targetDb);
  const logs = await employeeLogs(employee.id, targetDb);
  const entry = latestPair(logs);
  const zone = entry?.timeZone || 'Asia/Jakarta';
  const today = localAttendanceTime(new Date(), zone).workDate;
  const open = entry && !logs.some(l => l.workDate === entry.workDate && l.eventType === 'OUT');
  const workDate = open ? entry.workDate : today;
  const current = logs.filter(l => l.workDate === workDate);
  const { inLog, outLog } = resolveFirstInLastOutLogs(current);
  const { shift } = await shiftForEmployee(employee, targetDb);
  const daily = getWorkingScheduleForDate(workDate, shift);
  const face = await getFaceProfile(userId, targetDb);
  const approval = reviewSummary(current);
  const strictClock = await isMobileStrictClockEnabled(targetDb);
  const scheduleInMinutes = minuteValue(daily.scheduleIn);
  const thresholdMinutes = scheduleInMinutes + 5 * 60;
  const currentLocal = localAttendanceTime(new Date(), zone);
  const currentMinutes = minuteValue(currentLocal.scanTime);
  const isLateAfternoon = currentMinutes >= thresholdMinutes;
  const canDirectOut = !inLog && !outLog && isLateAfternoon;
  const elapsedSinceIn = inLog?.occurredAt ? Math.floor((new Date().getTime() - inLog.occurredAt.getTime()) / 60000) : null;
  const isCheckoutCooldown = elapsedSinceIn !== null && elapsedSinceIn < MIN_CHECKOUT_INTERVAL_MINUTES;
  const cooldownRemainingMinutes = isCheckoutCooldown ? Math.max(1, MIN_CHECKOUT_INTERVAL_MINUTES - elapsedSinceIn!) : 0;

  return {
    employee: { ...employee, position: employee.position || 'Staff', department: employee.departmentName || '-', workLocation: employee.locationName || '', avatarInitial: employee.fullName.split(' ').slice(0,2).map(n => n[0]).join('') },
    shift: { ...shift, category: determineShiftCategory(shift), ...daily, officeLatitude: DEFAULT_OFFICE_COORDINATES.latitude, officeLongitude: DEFAULT_OFFICE_COORDINATES.longitude, geofenceRadiusMeters: 100 },
    attendance: { workDate, checkedIn: !!inLog, checkedOut: !!outLog, checkInTime: inLog?.scanTime || null, checkOutTime: outLog?.scanTime || null,
      totalHours: inLog?.approvalStatus === 'APPROVED' && outLog?.approvalStatus === 'APPROVED' ? formatDurationMinutes(Math.floor((outLog.occurredAt.getTime() - inLog.occurredAt.getTime()) / 60000)) : '--:--',
      status: outLog ? 'COMPLETED' : inLog ? 'CHECKED_IN' : 'NOT_CHECKED_IN', approvalStatus: approval.status, approvalNote: approval.note, txHash: current[0]?.txHash || null, timeZone: zone, timeZoneLabel: entry ? zoneLabels[zone] : 'waktu lokal', events: current.map(publicLog),
      isLateAfternoon, strictClock, isCheckoutCooldown, cooldownRemainingMinutes, checkInOccurredAt: inLog?.occurredAt ? inLog.occurredAt.toISOString() : null, shiftWindow: { scheduleIn: daily.scheduleIn, scheduleOut: daily.scheduleOut, canDirectOut } },
    faceEnrollment: { isFaceEnrolled: face.data.isEnrolled, faceId: face.data.isEnrolled ? `BIO-${employee.id}` : null, changeStatus: face.data.changeStatus, changeNote: face.data.changeNote },
  };
}
function publicLog(log: SelfLog) { return { ...log, photoUrl: log.photoUrl ? `/attendance/mobile/photos/${log.id}` : null, timeZoneLabel: zoneLabels[log.timeZone] }; }
export async function getMobileAttendanceHistory(userId: number, period: 'CURRENT' | 'PREVIOUS' = 'CURRENT', targetDb = db) {
  const { employee } = await resolveEmployeeUser(userId, targetDb);
  const logs = await employeeLogs(employee.id, targetDb);
  const zone = logs[0]?.timeZone || 'Asia/Jakarta';
  const local = localAttendanceTime(new Date(), zone);
  const month = new Date(`${local.workDate.slice(0,7)}-01T12:00:00Z`);
  if (period === 'PREVIOUS') month.setUTCMonth(month.getUTCMonth() - 1);
  const prefix = month.toISOString().slice(0,7);
  const core = await targetDb.select().from(attendanceRecords).where(and(eq(attendanceRecords.employeeId, employee.id), gte(attendanceRecords.workDate, `${prefix}-01`), lte(attendanceRecords.workDate, `${prefix}-31`)));
  const dates = [...new Set([...logs.filter(l => l.workDate.startsWith(prefix)).map(l => l.workDate), ...core.map(r => r.workDate)])].sort().reverse();
  return { period, monthName: new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month), records: dates.map(date => {
    const events = logs.filter(l => l.workDate === date);
    const inLog = events.find(l => l.eventType === 'IN'); const outLog = events.find(l => l.eventType === 'OUT');
    const record = core.find(r => r.workDate === date); const ref = inLog || outLog;
    const approval = reviewSummary(events);
    const status = approval.status;
    const isAbsent = !events.length && record?.attendanceStatus === 'ALPHA';
    const attendanceLabels: Record<string,string> = { ALPHA: 'Tidak hadir', DINAS_LUAR: 'Dinas luar', CUTI: 'Cuti', IZIN: 'Izin', SAKIT: 'Sakit' };
    const statusText = status === 'PENDING' ? 'Menunggu review' : status === 'REJECTED' ? 'Ditolak' : attendanceLabels[record?.attendanceStatus || ''] || (record?.lateMinutes ? `Terlambat (${record.lateMinutes}m)` : 'Disetujui');
    const d = new Date(`${date}T12:00:00Z`);
    return { id: ref?.id || record!.id, workDate: date, dayShort: ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getUTCDay()], dateStr: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d), clockIn: inLog?.scanTime || record?.scanIn || '--', clockOut: outLog?.scanTime || record?.scanOut || '--',
      workHours: events.length
  ? (status === 'APPROVED' && inLog && outLog && inLog.approvalStatus === 'APPROVED' && outLog.approvalStatus === 'APPROVED'
      ? formatDurationMinutes(Math.floor((outLog.occurredAt.getTime() - inLog.occurredAt.getTime()) / 60000))
      : '--')
  : computeRecordDuration(record?.scanIn, record?.scanOut), status: isAbsent ? 'ABSENT' : status === 'PENDING' || status === 'REJECTED' ? status : record?.attendanceStatus === 'DINAS_LUAR' ? 'FIELD_DUTY' : record?.lateMinutes ? 'LATE' : 'ON_TIME', statusText, isAbsent, approvalStatus: events.length ? status : undefined, approvalNote: events.length ? approval.note : 'Tercatat di sistem.', serverRef: ref?.txHash || `REC-${record!.id}`, mapUrl: ref?.mapUrl || null, googleMapsUrl: ref?.googleMapsUrl || null, address: ref?.address || null,
      schedule: `${ref?.scheduleIn || record?.scheduleIn || '-'} – ${ref?.scheduleOut || record?.scheduleOut || '-'} ${zoneLabels[ref?.timeZone || zone]}`, employeeName: employee.fullName, photoUrl: ref?.photoUrl ? `/attendance/mobile/photos/${ref.id}` : null, events: events.map(publicLog),
    };
  }) };
}
export async function getFaceProfile(userId: number, targetDb = db) {
  const { employee } = await resolveEmployeeUser(userId, targetDb);
  const [profile] = await targetDb.select().from(attendanceFaceProfiles).where(eq(attendanceFaceProfiles.employeeId, employee.id));
  const [request] = await targetDb.select().from(attendanceFaceRequests).where(eq(attendanceFaceRequests.employeeId, employee.id)).orderBy(desc(attendanceFaceRequests.id)).limit(1);
  return { success: true, data: { employeeId: employee.id, employeeName: employee.fullName, isEnrolled: !!(profile?.isEnrolled && profile.samplePhotoUrl && profile.faceDescriptorHash), faceDescriptor: null, samplePhotoUrl: employee.photoUrl, enrolledAt: profile?.enrolledAt || null, changeStatus: request?.status || null, changeNote: request?.note || null } };
}
export async function updateFaceEnrollment(userId: number, payload: { isEnrolled?: boolean; faceDescriptor?: unknown; faceDescriptorHash?: string; samplePhotoBase64?: string }, targetDb = db, recognize: typeof extractPhotoFace = extractPhotoFace) {
  const { employee } = await resolveEmployeeUser(userId, targetDb);
  if (!payload.samplePhotoBase64 || payload.isEnrolled === false) throw new Error('Foto wajah diperlukan. Pendaftaran tidak dapat dinonaktifkan.');
  const face = await recognize(payload.samplePhotoBase64);
  return targetDb.transaction(async tx => {
    await employeeLock(tx, employee.id);
    const [existing] = await tx.select().from(attendanceFaceProfiles).where(eq(attendanceFaceProfiles.employeeId, employee.id));
    if (existing?.samplePhotoUrl && existing.faceDescriptorHash) {
      const [pending] = await tx.select().from(attendanceFaceRequests).where(and(eq(attendanceFaceRequests.employeeId, employee.id), eq(attendanceFaceRequests.status, 'PENDING')));
      if (pending) throw new Error('Perubahan foto masih menunggu approval HRD.');
      await tx.insert(attendanceFaceRequests).values({ employeeId: employee.id, descriptor: JSON.stringify(face.descriptor), photoUrl: face.photoUrl, oldPhotoUrl: existing.samplePhotoUrl?.startsWith('data:image/') ? existing.samplePhotoUrl : employee.photoUrl });
      return { success: true, message: 'Perubahan foto dikirim untuk approval HRD. Foto lama tetap digunakan.', isEnrolled: existing.isEnrolled, changeStatus: 'PENDING' };
    }
    const initialProfile = { employeeId: employee.id, isEnrolled: true, faceDescriptorHash: JSON.stringify(face.descriptor), descriptorVersion: FACE_DESCRIPTOR_VERSION, samplePhotoUrl: face.photoUrl, enrolledAt: new Date(), updatedAt: new Date() };
    await tx.insert(attendanceFaceProfiles).values(initialProfile).onConflictDoUpdate({ target: attendanceFaceProfiles.employeeId, set: initialProfile });
    await tx.update(employees).set({ photoUrl: face.photoUrl, updatedAt: new Date() }).where(eq(employees.id, employee.id));
    return { success: true, message: 'Wajah berhasil didaftarkan dan menjadi foto profil.', isEnrolled: true, changeStatus: null };
  });
}
export async function listPendingVerifications(targetDb = db) {
  const rows = await targetDb.select({ log: attendanceSelfLogs, employeeName: employees.fullName, employeeCode: employees.employeeCode, departmentName: departments.name }).from(attendanceSelfLogs).leftJoin(employees, eq(attendanceSelfLogs.employeeId, employees.id)).leftJoin(departments, eq(employees.departmentId, departments.id)).where(or(eq(attendanceSelfLogs.approvalStatus, 'PENDING'), sql`${attendanceSelfLogs.id} IN (SELECT id FROM attendance_self_logs WHERE approval_status <> 'PENDING' ORDER BY id DESC LIMIT 500)`)).orderBy(desc(attendanceSelfLogs.id));
  return rows.map(row => ({ ...publicLog(row.log), employeeName: row.employeeName, employeeCode: row.employeeCode, departmentName: row.departmentName }));
}
export async function verifyAttendanceRecord(verifierUserId: number, payload: { logId: number; status: 'APPROVED' | 'REJECTED'; note?: string }, targetDb = db) {
  return targetDb.transaction(async tx => {
    const [initial] = await tx.select().from(attendanceSelfLogs).where(eq(attendanceSelfLogs.id, payload.logId));
    if (!initial) throw new Error('Log presensi tidak ditemukan.');
    await employeeLock(tx, initial.employeeId);
    const [log] = await tx.select().from(attendanceSelfLogs).where(eq(attendanceSelfLogs.id, payload.logId)).for('update');
    if (log.approvalStatus !== 'PENDING') throw new Error('Pengajuan sudah diproses. Muat ulang halaman.');
    if (payload.status === 'REJECTED' && !payload.note?.trim()) throw new Error('Alasan penolakan wajib diisi.');
    const note = payload.note?.trim() || 'Disetujui oleh HRD.';
    const [updated] = await tx.update(attendanceSelfLogs).set({ approvalStatus: payload.status, approvalNote: note, verifiedById: verifierUserId, verifiedAt: new Date(), reviewHistory: [...log.reviewHistory, { status: payload.status, note, actorId: verifierUserId, at: new Date().toISOString() }] }).where(eq(attendanceSelfLogs.id, log.id)).returning();
    if (payload.status === 'APPROVED') await projectApprovedLog(tx, updated);
    return { success: true, message: 'Keputusan presensi disimpan.' };
  });
}
export async function correctMobileAttendance(userId: number, logId: number, note: string, targetDb = db) {
  const { employee } = await resolveEmployeeUser(userId, targetDb);
  if (!note.trim()) throw new Error('Keterangan koreksi wajib diisi.');
  return targetDb.transaction(async tx => {
    await employeeLock(tx, employee.id);
    const [log] = await tx.select().from(attendanceSelfLogs).where(and(eq(attendanceSelfLogs.id, logId), eq(attendanceSelfLogs.employeeId, employee.id))).for('update');
    if (!log || log.approvalStatus !== 'REJECTED') throw new Error('Hanya absensi milik Anda yang ditolak dapat dikoreksi.');
    await tx.update(attendanceSelfLogs).set({ approvalStatus: 'PENDING', requiresVerification: true, approvalNote: 'Koreksi menunggu pemeriksaan HRD.', verifiedById: null, verifiedAt: null, reviewHistory: [...log.reviewHistory, { status: 'CORRECTION', note: note.trim(), actorId: userId, at: new Date().toISOString() }] }).where(eq(attendanceSelfLogs.id, log.id));
    return { success: true, message: 'Keterangan koreksi dikirim ke HRD.' };
  });
}
export async function listFaceRequests(targetDb = db) {
  return targetDb.select({ id: attendanceFaceRequests.id, employeeName: employees.fullName, employeeCode: employees.employeeCode, oldPhotoUrl: attendanceFaceRequests.oldPhotoUrl, photoUrl: attendanceFaceRequests.photoUrl, status: attendanceFaceRequests.status, note: attendanceFaceRequests.note, createdAt: attendanceFaceRequests.createdAt, verifiedAt: attendanceFaceRequests.verifiedAt, verifiedById: attendanceFaceRequests.verifiedById }).from(attendanceFaceRequests).leftJoin(employees, eq(employees.id, attendanceFaceRequests.employeeId)).where(or(eq(attendanceFaceRequests.status, 'PENDING'), sql`${attendanceFaceRequests.id} IN (SELECT id FROM attendance_face_requests WHERE status <> 'PENDING' ORDER BY id DESC LIMIT 500)`)).orderBy(desc(attendanceFaceRequests.id));
}
export async function verifyFaceRequest(userId: number, id: number, status: 'APPROVED' | 'REJECTED', note: string, targetDb = db) {
  return targetDb.transaction(async tx => {
    const [initial] = await tx.select().from(attendanceFaceRequests).where(eq(attendanceFaceRequests.id, id));
    if (!initial) throw new Error('Pengajuan foto tidak ditemukan.');
    await employeeLock(tx, initial.employeeId);
    const [request] = await tx.select().from(attendanceFaceRequests).where(eq(attendanceFaceRequests.id, id)).for('update');
    if (request.status !== 'PENDING') throw new Error('Pengajuan foto sudah diproses.');
    if (status === 'REJECTED' && !note.trim()) throw new Error('Alasan penolakan wajib diisi.');
    if (status === 'APPROVED') {
      await tx.update(attendanceFaceProfiles).set({ isEnrolled: true, faceDescriptorHash: request.descriptor, descriptorVersion: FACE_DESCRIPTOR_VERSION, samplePhotoUrl: request.photoUrl, updatedAt: new Date() }).where(eq(attendanceFaceProfiles.employeeId, request.employeeId));
      await tx.update(employees).set({ photoUrl: request.photoUrl, updatedAt: new Date() }).where(eq(employees.id, request.employeeId));
    }
    await tx.update(attendanceFaceRequests).set({ status, note: note.trim() || 'Disetujui HRD.', verifiedById: userId, verifiedAt: new Date() }).where(eq(attendanceFaceRequests.id, id));
    return { success: true, message: 'Keputusan perubahan foto disimpan.' };
  });
}
