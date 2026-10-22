import { db } from "../db";
import { users } from "../db/schema/users";
import { employees } from "../db/schema/employees";
import { departments, locations } from "../db/schema/master";
import { attendanceRecords } from "../db/schema/attendance";
import { attendanceSelfLogs } from "../db/schema/attendanceSelfLogs";
import { attendanceFaceProfiles } from "../db/schema/attendanceFaceProfiles";
import { attendanceShifts, attendanceShiftAssignments } from "../db/schema/attendanceWorkspace";
import {
  resolveEmployeeShift,
  getWorkingScheduleForDate,
  DEFAULT_OFFICE_SHIFT,
} from "../domain/attendanceSchedule";
import { isWithinGeofence, buildMapLinks } from "../domain/geofence";
import {
  determineShiftCategory,
  evaluateAttendanceApproval,
  ShiftCategory,
  AttendanceEventType,
} from "../domain/attendanceVerificationPolicy";
import { saveAttendancePhoto } from "./attendancePhotoStorage";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

// Default HQ Coordinates (PT Cahaya Mas Cemerlang, Pulo Gadung, Jakarta Timur)
export const DEFAULT_OFFICE_COORDINATES = {
  name: "PT Cahaya Mas Cemerlang HQ",
  latitude: -6.2088,
  longitude: 106.8456,
  radiusMeters: 100,
};

export function getWibDateAndTimeString(date = new Date()): {
  workDate: string;
  scanTime: string;
  dayShort: string;
  dateStr: string;
} {
  // Convert to Asia/Jakarta (WIB) timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const findPart = (t: string) => parts.find((p) => p.type === t)?.value || "00";

  const yyyy = findPart("year");
  const mm = findPart("month");
  const dd = findPart("day");
  const hh = findPart("hour");
  const min = findPart("minute");

  const workDate = `${yyyy}-${mm}-${dd}`;
  const scanTime = `${hh}:${min}`;

  const d = new Date(`${workDate}T12:00:00Z`);
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  const dayShort = dayNames[d.getUTCDay()];
  const dateStr = `${parseInt(dd, 10)} ${monthNames[parseInt(mm, 10) - 1]}`;

  return { workDate, scanTime, dayShort, dateStr };
}

export function parseMinutesFromTimeStr(timeStr?: string | null): number | null {
  if (!timeStr || !timeStr.includes(":")) return null;
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10));
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function calculateLateMinutes(scanIn?: string | null, scheduleIn?: string | null): number {
  const scanMins = parseMinutesFromTimeStr(scanIn);
  const schedMins = parseMinutesFromTimeStr(scheduleIn);
  if (scanMins === null || schedMins === null) return 0;
  return scanMins > schedMins ? scanMins - schedMins : 0;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 0 || isNaN(minutes)) return "--:--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

export async function resolveEmployeeUser(userId: number, targetDb = db) {
  const userRows = await targetDb
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      employeeId: users.employeeId,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRows.length === 0) {
    throw new Error("Akun pengguna tidak ditemukan.");
  }

  const user = userRows[0];
  if (!user.employeeId) {
    throw new Error(
      "Akun Anda belum dikaitkan dengan master data karyawan oleh Admin IT. Hubungi Admin IT untuk aktivasi akses presensi mobile."
    );
  }

  const empRows = await targetDb
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      email: employees.email,
      phone: employees.phone,
      position: employees.position,
      departmentId: employees.departmentId,
      locationId: employees.locationId,
      departmentName: departments.name,
      locationName: locations.name,
      locationAddress: locations.address,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(locations, eq(employees.locationId, locations.id))
    .where(eq(employees.id, user.employeeId))
    .limit(1);

  if (empRows.length === 0) {
    throw new Error("Data karyawan terkait tidak ditemukan di Master Data.");
  }

  return { user, employee: empRows[0] };
}

export async function getMobileTodaySummary(userId: number, targetDb = db) {
  const { employee } = await resolveEmployeeUser(userId, targetDb);
  const { workDate } = getWibDateAndTimeString();

  // Load shifts & assignments
  const shifts = await targetDb.select().from(attendanceShifts);
  const assignments = await targetDb.select().from(attendanceShiftAssignments);

  const activeShift = resolveEmployeeShift(employee, shifts, assignments) || DEFAULT_OFFICE_SHIFT;
  const dailySchedule = getWorkingScheduleForDate(workDate, activeShift);
  const shiftCategory = determineShiftCategory(activeShift);

  // Load today attendance record from main attendance_records
  const records = await targetDb
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.employeeId, employee.id), eq(attendanceRecords.workDate, workDate)))
    .limit(1);

  // Load latest attendance_self_logs for today
  const selfLogs = await targetDb
    .select()
    .from(attendanceSelfLogs)
    .where(and(eq(attendanceSelfLogs.employeeId, employee.id), eq(attendanceSelfLogs.workDate, workDate)))
    .orderBy(desc(attendanceSelfLogs.createdAt));

  // Load face profile
  const faceProfiles = await targetDb
    .select()
    .from(attendanceFaceProfiles)
    .where(eq(attendanceFaceProfiles.employeeId, employee.id))
    .limit(1);

  const isFaceEnrolled = faceProfiles.length > 0 ? faceProfiles[0].isEnrolled : false;
  const faceId = isFaceEnrolled ? `BIO-CMC-${employee.id}-V1` : null;

  const todayRecord = records[0];
  const checkedIn = Boolean(todayRecord?.scanIn);
  const checkedOut = Boolean(todayRecord?.scanOut);

  let status: "NOT_CHECKED_IN" | "CHECKED_IN" | "COMPLETED" = "NOT_CHECKED_IN";
  if (checkedIn && !checkedOut) status = "CHECKED_IN";
  if (checkedIn && checkedOut) status = "COMPLETED";

  // Calculate work duration
  let totalHours = "--:--";
  if (todayRecord?.scanIn && todayRecord?.scanOut) {
    const inMins = parseMinutesFromTimeStr(todayRecord.scanIn);
    const outMins = parseMinutesFromTimeStr(todayRecord.scanOut);
    if (inMins !== null && outMins !== null && outMins >= inMins) {
      totalHours = formatDurationMinutes(outMins - inMins);
    }
  }

  const latestLog = selfLogs[0];
  const latestTxHash = latestLog?.txHash || null;
  const approvalStatus = latestLog?.approvalStatus || (checkedIn ? "PENDING" : "APPROVED");
  const approvalNote = latestLog?.approvalNote || (checkedIn ? "Menunggu review tim HRD." : "Belum ada catatan presensi.");

  return {
    employee: {
      id: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      position: employee.position || "Staff",
      department: employee.departmentName || "General",
      workLocation: employee.locationName || DEFAULT_OFFICE_COORDINATES.name,
      avatarInitial: employee.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase(),
    },
    shift: {
      id: activeShift.id,
      code: activeShift.code,
      name: activeShift.name,
      category: shiftCategory,
      scheduleIn: dailySchedule.scheduleIn,
      scheduleOut: dailySchedule.scheduleOut,
      officeLatitude: DEFAULT_OFFICE_COORDINATES.latitude,
      officeLongitude: DEFAULT_OFFICE_COORDINATES.longitude,
      geofenceRadiusMeters: DEFAULT_OFFICE_COORDINATES.radiusMeters,
    },
    attendance: {
      workDate,
      checkedIn,
      checkedOut,
      checkInTime: todayRecord?.scanIn || null,
      checkOutTime: todayRecord?.scanOut || null,
      totalHours,
      status,
      approvalStatus,
      approvalNote,
      txHash: latestTxHash,
    },
    faceEnrollment: {
      isFaceEnrolled,
      faceId,
    },
  };
}

export interface MobileClockInput {
  eventType: "IN" | "OUT";
  workDate?: string;
  scanTime?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  address?: string | null;
  photoBase64?: string | null;
  deviceInfo?: string | null;
  notes?: string | null;
  txHash?: string | null;
}

export async function recordMobileClock(
  userId: number,
  payload: MobileClockInput,
  targetDb = db
) {
  const { user, employee } = await resolveEmployeeUser(userId, targetDb);
  const currentTime = getWibDateAndTimeString();

  const workDate = payload.workDate || currentTime.workDate;
  const scanTime = payload.scanTime || currentTime.scanTime;
  const eventType = payload.eventType;

  if (eventType !== "IN" && eventType !== "OUT") {
    throw new Error("Event type harus IN atau OUT.");
  }

  // Load shifts to evaluate schedule & verification rules
  const shifts = await targetDb.select().from(attendanceShifts);
  const assignments = await targetDb.select().from(attendanceShiftAssignments);
  const activeShift = resolveEmployeeShift(employee, shifts, assignments) || DEFAULT_OFFICE_SHIFT;
  const dailySchedule = getWorkingScheduleForDate(workDate, activeShift);
  const shiftCategory = determineShiftCategory(activeShift);

  // Check existing attendance record for today
  const existingRecords = await targetDb
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.employeeId, employee.id), eq(attendanceRecords.workDate, workDate)))
    .limit(1);

  const existing = existingRecords[0];

  if (eventType === "IN" && existing?.scanIn) {
    throw new Error("Presensi masuk hari ini sudah tercatat sebelumnya.");
  }

  if (eventType === "OUT" && !existing?.scanIn) {
    throw new Error("Belum melakukan presensi masuk hari ini.");
  }

  // Geofence check
  const geofenceResult = isWithinGeofence(
    payload.latitude,
    payload.longitude,
    DEFAULT_OFFICE_COORDINATES.latitude,
    DEFAULT_OFFICE_COORDINATES.longitude,
    DEFAULT_OFFICE_COORDINATES.radiusMeters
  );

  const isWithin = geofenceResult.isWithin;
  const distance = geofenceResult.distanceMeters;

  // OpenStreetMap & Google Maps links
  let mapUrl: string | null = null;
  let googleMapsUrl: string | null = null;
  if (payload.latitude !== null && payload.latitude !== undefined && payload.longitude !== null && payload.longitude !== undefined) {
    const links = buildMapLinks(payload.latitude, payload.longitude);
    mapUrl = links.osmUrl;
    googleMapsUrl = links.googleMapsUrl;
  }

  // Evaluate verification rules based on shift (Office vs Produksi)
  const approval = evaluateAttendanceApproval(shiftCategory, eventType, isWithin);

  const txHash =
    payload.txHash ||
    `TX-GJN-${workDate.replace(/-/g, "")}-${Math.floor(100 + Math.random() * 899)}`;

  // Save photo if supplied
  let savedPhotoPath: string | null = null;
  if (payload.photoBase64) {
    try {
      savedPhotoPath = await saveAttendancePhoto(txHash, payload.photoBase64);
    } catch {
      // If photo saving fails, do not block attendance record
    }
  }

  // Atomic persistence using transaction
  return await targetDb.transaction(async (tx) => {
    // 1. Insert into attendance_self_logs
    await tx.insert(attendanceSelfLogs).values({
      employeeId: employee.id,
      userId: user.id,
      eventType,
      workDate,
      scanTime,
      shiftCode: activeShift.code,
      shiftCategory,
      latitude: payload.latitude !== undefined && payload.latitude !== null ? String(payload.latitude) : null,
      longitude: payload.longitude !== undefined && payload.longitude !== null ? String(payload.longitude) : null,
      accuracy: payload.accuracy || null,
      address: payload.address || null,
      mapUrl,
      googleMapsUrl,
      isWithinGeofence: isWithin,
      distanceMeters: distance,
      photoUrl: savedPhotoPath,
      txHash,
      deviceInfo: payload.deviceInfo || null,
      notes: payload.notes || null,
      requiresVerification: approval.requiresVerification,
      approvalStatus: approval.approvalStatus,
      approvalNote: approval.approvalNote,
      createdAt: new Date(),
    });

    // 2. Upsert into core attendance_records
    const lateMinutes = eventType === "IN" ? calculateLateMinutes(scanTime, dailySchedule.scheduleIn) : existing?.lateMinutes || 0;
    const attendanceStatus = !isWithin ? "DINAS_LUAR" : "PRESENT";

    if (eventType === "IN") {
      await tx
        .insert(attendanceRecords)
        .values({
          employeeId: employee.id,
          workDate,
          shift: activeShift.name,
          scheduleIn: dailySchedule.scheduleIn,
          scheduleOut: dailySchedule.scheduleOut,
          scanIn: scanTime,
          rawScanIn: scanTime,
          lateMinutes,
          earlyMinutes: 0,
          overtimeMinutes: 0,
          attendanceStatus,
          isDayOff: false,
          normalized: false,
          revision: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [attendanceRecords.employeeId, attendanceRecords.workDate],
          set: {
            scanIn: scanTime,
            rawScanIn: scanTime,
            lateMinutes,
            attendanceStatus,
            updatedAt: new Date(),
          },
        });
    } else {
      // Event OUT
      let overtimeMinutes = 0;
      let earlyMinutes = 0;
      const scanOutMins = parseMinutesFromTimeStr(scanTime);
      const schedOutMins = parseMinutesFromTimeStr(dailySchedule.scheduleOut);
      if (scanOutMins !== null && schedOutMins !== null) {
        if (scanOutMins > schedOutMins) {
          overtimeMinutes = scanOutMins - schedOutMins;
        } else if (scanOutMins < schedOutMins) {
          earlyMinutes = schedOutMins - scanOutMins;
        }
      }

      await tx
        .update(attendanceRecords)
        .set({
          scanOut: scanTime,
          rawScanOut: scanTime,
          earlyMinutes,
          overtimeMinutes,
          updatedAt: new Date(),
        })
        .where(and(eq(attendanceRecords.employeeId, employee.id), eq(attendanceRecords.workDate, workDate)));
    }

    return {
      success: true,
      message: eventType === "IN" ? "Presensi masuk berhasil dicatat." : "Presensi pulang berhasil dicatat.",
      data: {
        txHash,
        eventType,
        scanTime,
        workDate,
        isWithinGeofence: isWithin,
        distanceMeters: distance,
        status: eventType === "IN" ? "CHECKED_IN" : "COMPLETED",
        approvalStatus: approval.approvalStatus,
        approvalNote: approval.approvalNote,
        mapUrl,
        googleMapsUrl,
      },
    };
  });
}

export async function getMobileAttendanceHistory(
  userId: number,
  period: "CURRENT" | "PREVIOUS" = "CURRENT",
  targetDb = db
) {
  const { employee } = await resolveEmployeeUser(userId, targetDb);

  const now = new Date();
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth() + 1;

  if (period === "PREVIOUS") {
    targetMonth -= 1;
    if (targetMonth === 0) {
      targetMonth = 12;
      targetYear -= 1;
    }
  }

  const monthStr = String(targetMonth).padStart(2, "0");
  const startDate = `${targetYear}-${monthStr}-01`;
  const endDate = `${targetYear}-${monthStr}-31`;

  // Fetch core attendance records
  const records = await targetDb
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, employee.id),
        gte(attendanceRecords.workDate, startDate),
        lte(attendanceRecords.workDate, endDate)
      )
    )
    .orderBy(desc(attendanceRecords.workDate));

  // Fetch self logs for extra metadata
  const selfLogs = await targetDb
    .select()
    .from(attendanceSelfLogs)
    .where(
      and(
        eq(attendanceSelfLogs.employeeId, employee.id),
        gte(attendanceSelfLogs.workDate, startDate),
        lte(attendanceSelfLogs.workDate, endDate)
      )
    )
    .orderBy(desc(attendanceSelfLogs.createdAt));

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const formattedMonthName = `${monthNames[targetMonth - 1]} ${targetYear}`;

  const historyItems = records.map((rec) => {
    const matchingLogs = selfLogs.filter((l) => l.workDate === rec.workDate);
    const inLog = matchingLogs.find((l) => l.eventType === "IN");
    const outLog = matchingLogs.find((l) => l.eventType === "OUT");

    const [y, m, d] = rec.workDate.split("-").map(Number);
    const dateObj = new Date(`${rec.workDate}T12:00:00Z`);
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const dayShort = dayNames[dateObj.getUTCDay()];
    const dateStr = `${d} ${monthNames[m - 1].slice(0, 3)}`;

    const clockIn = rec.scanIn || "--";
    const clockOut = rec.scanOut || "--";

    let workHours = "--";
    if (rec.scanIn && rec.scanOut) {
      const inM = parseMinutesFromTimeStr(rec.scanIn);
      const outM = parseMinutesFromTimeStr(rec.scanOut);
      if (inM !== null && outM !== null && outM >= inM) {
        workHours = formatDurationMinutes(outM - inM);
      }
    }

    const isAbsent = !rec.scanIn && !rec.scanOut && rec.attendanceStatus === "ALPHA";
    let statusText = "Tepat Waktu";
    let status = "ON_TIME";

    if (rec.attendanceStatus === "DINAS_LUAR") {
      statusText = "Dinas Luar";
      status = "FIELD_DUTY";
    } else if (rec.lateMinutes > 0) {
      statusText = `Terlambat (${rec.lateMinutes}m)`;
      status = "LATE";
    } else if (isAbsent) {
      statusText = "Tidak Hadir";
      status = "ABSENT";
    }

    const approvalStatus = inLog?.approvalStatus || (rec.scanIn ? "APPROVED" : "PENDING");
    const approvalNote = inLog?.approvalNote || "Tercatat di sistem.";
    const serverRef = inLog?.txHash || `REC-${rec.id}`;

    return {
      id: rec.id,
      workDate: rec.workDate,
      dayShort,
      dateStr,
      clockIn,
      clockOut,
      workHours,
      status,
      statusText,
      isAbsent,
      approvalStatus,
      approvalNote,
      serverRef,
      mapUrl: inLog?.mapUrl || null,
      googleMapsUrl: inLog?.googleMapsUrl || null,
      address: inLog?.address || null,
      schedule: `${rec.scheduleIn || "08:00"} – ${rec.scheduleOut || "17:00"} WIB`,
      employeeName: employee.fullName,
      photoUrl: inLog?.photoUrl || null,
    };
  });

  return {
    period,
    monthName: formattedMonthName,
    records: historyItems,
  };
}


export async function getFaceProfile(userId: number, targetDb = db) {
  const { employee } = await resolveEmployeeUser(userId, targetDb);
  const profiles = await targetDb
    .select()
    .from(attendanceFaceProfiles)
    .where(eq(attendanceFaceProfiles.employeeId, employee.id))
    .limit(1);

  const profile = profiles[0] || null;
  return {
    success: true,
    data: {
      employeeId: employee.id,
      employeeName: employee.fullName,
      isEnrolled: profile ? profile.isEnrolled : false,
      faceDescriptor: profile ? profile.faceDescriptorHash : null,
      samplePhotoUrl: profile ? profile.samplePhotoUrl : null,
      enrolledAt: profile ? profile.enrolledAt : null,
    },
  };
}

export async function updateFaceEnrollment(
  userId: number,
  payload: {
    isEnrolled?: boolean;
    faceDescriptor?: unknown;
    faceDescriptorHash?: string;
    samplePhotoBase64?: string;
  },
  targetDb = db
) {
  const { employee } = await resolveEmployeeUser(userId, targetDb);
  const isEnrolled = payload.isEnrolled !== undefined ? payload.isEnrolled : true;

  let descriptorStr: string | null = null;
  if (payload.faceDescriptor !== undefined) {
    descriptorStr = typeof payload.faceDescriptor === "object"
      ? JSON.stringify(payload.faceDescriptor)
      : String(payload.faceDescriptor);
  } else if (payload.faceDescriptorHash) {
    descriptorStr = payload.faceDescriptorHash;
  }

  let samplePhotoUrl: string | null = null;
  if (payload.samplePhotoBase64) {
    try {
      const saved = await saveAttendancePhoto(payload.samplePhotoBase64, `FACE-REF-${employee.id}`);
      samplePhotoUrl = saved.photoUrl;
    } catch {
      // Photo save fallback
    }
  }

  const existing = await targetDb
    .select()
    .from(attendanceFaceProfiles)
    .where(eq(attendanceFaceProfiles.employeeId, employee.id))
    .limit(1);

  if (existing.length === 0) {
    await targetDb.insert(attendanceFaceProfiles).values({
      employeeId: employee.id,
      isEnrolled,
      faceDescriptorHash: descriptorStr,
      samplePhotoUrl,
      enrolledAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    await targetDb
      .update(attendanceFaceProfiles)
      .set({
        isEnrolled,
        faceDescriptorHash: descriptorStr || existing[0].faceDescriptorHash,
        samplePhotoUrl: samplePhotoUrl || existing[0].samplePhotoUrl,
        updatedAt: new Date(),
      })
      .where(eq(attendanceFaceProfiles.employeeId, employee.id));
  }

  return {
    success: true,
    message: isEnrolled ? "Wajah berhasil didaftarkan." : "Pendaftaran wajah dinonaktifkan.",
    isEnrolled,
    faceDescriptor: descriptorStr,
  };
}

export async function listPendingVerifications(
  targetDb = db
) {
  const rows = await targetDb
    .select({
      id: attendanceSelfLogs.id,
      employeeId: attendanceSelfLogs.employeeId,
      employeeName: employees.fullName,
      employeeCode: employees.employeeCode,
      position: employees.position,
      departmentName: departments.name,
      eventType: attendanceSelfLogs.eventType,
      workDate: attendanceSelfLogs.workDate,
      scanTime: attendanceSelfLogs.scanTime,
      shiftCode: attendanceSelfLogs.shiftCode,
      shiftCategory: attendanceSelfLogs.shiftCategory,
      latitude: attendanceSelfLogs.latitude,
      longitude: attendanceSelfLogs.longitude,
      accuracy: attendanceSelfLogs.accuracy,
      address: attendanceSelfLogs.address,
      mapUrl: attendanceSelfLogs.mapUrl,
      googleMapsUrl: attendanceSelfLogs.googleMapsUrl,
      isWithinGeofence: attendanceSelfLogs.isWithinGeofence,
      distanceMeters: attendanceSelfLogs.distanceMeters,
      photoUrl: attendanceSelfLogs.photoUrl,
      txHash: attendanceSelfLogs.txHash,
      approvalStatus: attendanceSelfLogs.approvalStatus,
      approvalNote: attendanceSelfLogs.approvalNote,
      createdAt: attendanceSelfLogs.createdAt,
    })
    .from(attendanceSelfLogs)
    .leftJoin(employees, eq(attendanceSelfLogs.employeeId, employees.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(eq(attendanceSelfLogs.approvalStatus, "PENDING"))
    .orderBy(desc(attendanceSelfLogs.createdAt))
    .limit(100);

  return rows;
}

export async function verifyAttendanceRecord(
  verifierUserId: number,
  payload: { logId: number; status: "APPROVED" | "REJECTED"; note?: string },
  targetDb = db
) {
  const existingLogs = await targetDb
    .select()
    .from(attendanceSelfLogs)
    .where(eq(attendanceSelfLogs.id, payload.logId))
    .limit(1);

  if (existingLogs.length === 0) {
    throw new Error("Log presensi tidak ditemukan.");
  }

  const log = existingLogs[0];
  const newStatus = payload.status;
  const newNote = payload.note || (newStatus === "APPROVED" ? "Disetujui oleh HRD" : "Ditolak oleh HRD");

  await targetDb
    .update(attendanceSelfLogs)
    .set({
      approvalStatus: newStatus,
      approvalNote: newNote,
      verifiedById: verifierUserId,
      verifiedAt: new Date(),
    })
    .where(eq(attendanceSelfLogs.id, payload.logId));

  return {
    success: true,
    message: `Presensi berhasil ${newStatus === "APPROVED" ? "disetujui" : "ditolak"}.`,
    logId: payload.logId,
    status: newStatus,
  };
}
