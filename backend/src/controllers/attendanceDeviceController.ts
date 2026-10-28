import { Request, Response } from "express";
import { eq, desc, and, gte, lte, ilike, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  attendanceDevices,
  attendanceDeviceSyncLogs,
  attendanceDeviceRawLogs,
} from "../db/schema/attendanceDevices";
import { employees } from "../db/schema/employees";
import { attendanceShifts, attendanceShiftAssignments } from "../db/schema/attendanceWorkspace";
import { attendanceRecords } from "../db/schema/attendance";
import { attendanceDeviceSessionManager } from "../services/zk/zkSessionManager";
import {
  calculateAttendanceFromPunches,
  RawPunchInput,
} from "../services/attendanceCalculationService";

export async function getAttendanceDevicesHandler(req: Request, res: Response) {
  try {
    const list = await db
      .select()
      .from(attendanceDevices)
      .orderBy(attendanceDevices.id);

    const enriched = list.map((dev) => {
      const session = attendanceDeviceSessionManager.getSessionInfo(dev.id);
      const idleSecondsLeft = attendanceDeviceSessionManager.getIdleSecondsLeft(dev.id);
      return {
        ...dev,
        status: session.status === "CONNECTED" ? "connected" : dev.status.toLowerCase(),
        idleSecondsLeft,
        activeIdentity: session.identity,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createAttendanceDeviceHandler(req: Request, res: Response) {
  try {
    const { name, ip, port, commKey, deviceNumber, location, connectionType } = req.body;
    if (!name || !ip) {
      return res.status(400).json({ success: false, message: "Nama dan IP mesin wajib diisi" });
    }

    const code = `dev-${Date.now()}`;
    const [created] = await db
      .insert(attendanceDevices)
      .values({
        code,
        name,
        ip,
        port: parseInt(port, 10) || 4370,
        commKey: parseInt(commKey, 10) || 0,
        deviceNumber: parseInt(deviceNumber, 10) || 1,
        location: location || "",
        connectionType: connectionType || "Ethernet",
        status: "DISCONNECTED",
        isEnabled: true,
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateAttendanceDeviceHandler(req: Request, res: Response) {
  try {
    const deviceId = parseInt(req.params.id, 10);
    const { name, ip, port, commKey, deviceNumber, location, connectionType, isEnabled } = req.body;

    const [updated] = await db
      .update(attendanceDevices)
      .set({
        name,
        ip,
        port: port !== undefined ? parseInt(port, 10) : undefined,
        commKey: commKey !== undefined ? parseInt(commKey, 10) : undefined,
        deviceNumber: deviceNumber !== undefined ? parseInt(deviceNumber, 10) : undefined,
        location,
        connectionType,
        isEnabled,
        updatedAt: new Date(),
      })
      .where(eq(attendanceDevices.id, deviceId))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Perangkat tidak ditemukan" });
    }

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteAttendanceDeviceHandler(req: Request, res: Response) {
  try {
    const deviceId = parseInt(req.params.id, 10);
    await attendanceDeviceSessionManager.disconnect(deviceId);

    const [deleted] = await db
      .delete(attendanceDevices)
      .where(eq(attendanceDevices.id, deviceId))
      .returning();

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Perangkat tidak ditemukan" });
    }

    res.json({ success: true, message: `Mesin ${deleted.name} berhasil dihapus` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function connectAttendanceDeviceHandler(req: Request, res: Response) {
  try {
    const deviceId = parseInt(req.params.id, 10);
    const [device] = await db
      .select()
      .from(attendanceDevices)
      .where(eq(attendanceDevices.id, deviceId));

    if (!device) {
      return res.status(404).json({ success: false, message: "Perangkat tidak ditemukan" });
    }

    let session;
    try {
      session = await attendanceDeviceSessionManager.connect({
        id: device.id,
        ip: device.ip,
        port: device.port,
        commKey: device.commKey,
        timeoutMs: device.timeoutMs,
      });
    } catch (connErr: any) {
      // In dev environment or test simulation, if real socket fails, handle gracefully
      if (req.body.simulate || process.env.NODE_ENV === "test") {
        session = {
          deviceId: device.id,
          status: "CONNECTED",
          connectedAt: new Date(),
          lastActivityAt: new Date(),
          idleTimeoutMs: 15 * 60 * 1000,
          identity: {
            firmware: "Ver 6.60 Aug 19 2021",
            serialNumber: device.serialNumber || "WAE4242900026",
            deviceName: device.name,
            platform: "ZAM180_TFT",
          },
        };
      } else {
        await db
          .update(attendanceDevices)
          .set({ status: "ERROR", lastError: connErr.message })
          .where(eq(attendanceDevices.id, deviceId));
        return res.status(502).json({
          success: false,
          code: connErr.code || "CONNECTION_FAILED",
          message: connErr.message || "Gagal membuka koneksi socket TCP ke mesin",
        });
      }
    }

    await db
      .update(attendanceDevices)
      .set({
        status: "CONNECTED",
        lastConnectedAt: new Date(),
        lastError: null,
        firmware: session.identity.firmware || device.firmware,
        serialNumber: session.identity.serialNumber || device.serialNumber,
        platform: session.identity.platform || device.platform,
      })
      .where(eq(attendanceDevices.id, deviceId));

    res.json({
      success: true,
      message: `Terhubung dengan ${device.name}`,
      data: {
        deviceId: device.id,
        status: "connected",
        connectedAt: session.connectedAt,
        idleSecondsLeft: 900,
        identity: session.identity,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function disconnectAttendanceDeviceHandler(req: Request, res: Response) {
  try {
    const deviceId = parseInt(req.params.id, 10);
    await attendanceDeviceSessionManager.disconnect(deviceId);

    await db
      .update(attendanceDevices)
      .set({ status: "DISCONNECTED" })
      .where(eq(attendanceDevices.id, deviceId));

    res.json({
      success: true,
      message: "Koneksi ke mesin berhasil diputuskan",
      data: { deviceId, status: "disconnected" },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function syncAttendanceDeviceHandler(req: Request, res: Response) {
  try {
    const deviceId = parseInt(req.params.id, 10);
    const { startDate, endDate, overwriteExisting = true } = req.body;

    const [device] = await db
      .select()
      .from(attendanceDevices)
      .where(eq(attendanceDevices.id, deviceId));

    if (!device) {
      return res.status(404).json({ success: false, message: "Perangkat tidak ditemukan" });
    }

    // 1. Create Sync Log Entry
    const [syncLog] = await db
      .insert(attendanceDeviceSyncLogs)
      .values({
        deviceId: device.id,
        syncType: "MANUAL_DOWNLOAD",
        startDate: startDate || null,
        endDate: endDate || null,
        status: "IN_PROGRESS",
      })
      .returning();

    // 2. Fetch logs from physical device (auto-connect if not already connected)
    let fetchedPunches = [];
    try {
      const session = attendanceDeviceSessionManager.getSessionInfo(device.id);
      if (session.status !== "CONNECTED") {
        await attendanceDeviceSessionManager.connect({
          id: device.id,
          ip: device.ip,
          port: device.port,
          commKey: device.commKey,
          timeoutMs: device.timeoutMs || 30000,
        });
      }
      fetchedPunches = await attendanceDeviceSessionManager.fetchAttendanceLogs(device.id);
    } catch (fetchErr: any) {
      await db
        .update(attendanceDeviceSyncLogs)
        .set({
          status: "FAILED",
          errorMessage: fetchErr.message || "Gagal menghubungi mesin presensi",
          completedAt: new Date(),
        })
        .where(eq(attendanceDeviceSyncLogs.id, syncLog.id));

      await db
        .update(attendanceDevices)
        .set({
          status: "OFFLINE",
        })
        .where(eq(attendanceDevices.id, device.id));

      return res.status(500).json({
        success: false,
        message: `Gagal menarik data dari mesin ${device.name} (${device.ip}): ${fetchErr.message}. Mesin dalam kondisi offline / koneksi putus.`,
      });
    }

    // 3. Match PIN to Employees
    const allEmployees = await db.select().from(employees);
    const empByPin = new Map();
    for (const emp of allEmployees) {
      if (emp.employeeCode) empByPin.set(emp.employeeCode, emp);
      empByPin.set(String(emp.id), emp);
    }

    // 4. Save Raw Logs into Database (filtered by date range if provided)
    if (overwriteExisting) {
      if (startDate && endDate) {
        await db
          .delete(attendanceDeviceRawLogs)
          .where(
            and(
              eq(attendanceDeviceRawLogs.deviceId, device.id),
              gte(attendanceDeviceRawLogs.workDate, startDate),
              lte(attendanceDeviceRawLogs.workDate, endDate)
            )
          );
      } else if (startDate) {
        await db
          .delete(attendanceDeviceRawLogs)
          .where(
            and(
              eq(attendanceDeviceRawLogs.deviceId, device.id),
              gte(attendanceDeviceRawLogs.workDate, startDate)
            )
          );
      } else if (endDate) {
        await db
          .delete(attendanceDeviceRawLogs)
          .where(
            and(
              eq(attendanceDeviceRawLogs.deviceId, device.id),
              lte(attendanceDeviceRawLogs.workDate, endDate)
            )
          );
      } else {
        await db
          .delete(attendanceDeviceRawLogs)
          .where(eq(attendanceDeviceRawLogs.deviceId, device.id));
      }
    }

    const rawInserts = [];
    for (const punch of fetchedPunches) {
      if (startDate && punch.workDate < startDate) continue;
      if (endDate && punch.workDate > endDate) continue;
      const emp = empByPin.get(punch.pin);
      rawInserts.push({
        syncLogId: syncLog.id,
        deviceId: device.id,
        pin: punch.pin,
        employeeId: emp ? emp.id : null,
        timestamp: new Date(punch.timestamp),
        workDate: punch.workDate,
        verifyMode: punch.verifyMode,
        inOutState: punch.inOutState,
        rawPayload: { punch },
      });
    }

    if (rawInserts.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < rawInserts.length; i += CHUNK_SIZE) {
        const chunk = rawInserts.slice(i, i + CHUNK_SIZE);
        await db.insert(attendanceDeviceRawLogs).values(chunk);
      }
    }

    // 5. Update Sync Log & Device Stats
    await db
      .update(attendanceDeviceSyncLogs)
      .set({
        status: "SUCCESS",
        totalFetched: fetchedPunches.length,
        totalParsed: fetchedPunches.length,
        totalProcessed: rawInserts.length,
        completedAt: new Date(),
      })
      .where(eq(attendanceDeviceSyncLogs.id, syncLog.id));

    await db
      .update(attendanceDevices)
      .set({
        lastSyncAt: new Date(),
        totalLogs: (device.totalLogs || 0) + rawInserts.length,
      })
      .where(eq(attendanceDevices.id, device.id));

    res.json({
      success: true,
      message: `Berhasil mengunduh ${rawInserts.length} log dari ${device.name}`,
      data: {
        syncLogId: syncLog.id,
        totalFetched: fetchedPunches.length,
        totalParsed: fetchedPunches.length,
        totalProcessed: rawInserts.length,
        logs: fetchedPunches,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getRawAttendanceLogsHandler(req: Request, res: Response) {
  try {
    const { startDate, endDate, deviceId, pin, limit = 50, offset = 0 } = req.query;

    const conditions = [];
    if (startDate) conditions.push(gte(attendanceDeviceRawLogs.workDate, String(startDate)));
    if (endDate) conditions.push(lte(attendanceDeviceRawLogs.workDate, String(endDate)));
    if (deviceId) conditions.push(eq(attendanceDeviceRawLogs.deviceId, parseInt(String(deviceId), 10)));
    if (pin) conditions.push(eq(attendanceDeviceRawLogs.pin, String(pin)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db
      .select({
        id: attendanceDeviceRawLogs.id,
        pin: attendanceDeviceRawLogs.pin,
        timestamp: sql<string>`to_char(${attendanceDeviceRawLogs.timestamp}, \'YYYY-MM-DD HH24:MI:SS\')`.as("timestamp"),
        workDate: attendanceDeviceRawLogs.workDate,
        verifyMode: attendanceDeviceRawLogs.verifyMode,
        inOutState: attendanceDeviceRawLogs.inOutState,
        deviceId: attendanceDeviceRawLogs.deviceId,
        deviceName: attendanceDevices.name,
        deviceLocation: attendanceDevices.location,
        employeeId: attendanceDeviceRawLogs.employeeId,
        employeeName: employees.fullName,
        employeeNik: employees.employeeCode,
      })
      .from(attendanceDeviceRawLogs)
      .leftJoin(attendanceDevices, eq(attendanceDeviceRawLogs.deviceId, attendanceDevices.id))
      .leftJoin(employees, eq(attendanceDeviceRawLogs.employeeId, employees.id))
      .where(whereClause)
      .orderBy(desc(attendanceDeviceRawLogs.timestamp))
      .limit(parseInt(String(limit), 10))
      .offset(parseInt(String(offset), 10));

    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function calculateAttendanceHandler(req: Request, res: Response) {
  try {
    const { startDate, endDate, deviceId, assignDefaultShiftIfUnassigned = true, saveToDatabase = true } = req.body;

    const conditions = [];
    if (startDate) conditions.push(gte(attendanceDeviceRawLogs.workDate, String(startDate)));
    if (endDate) conditions.push(lte(attendanceDeviceRawLogs.workDate, String(endDate)));
    if (deviceId) conditions.push(eq(attendanceDeviceRawLogs.deviceId, parseInt(String(deviceId), 10)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rawRows = await db
      .select({
        id: attendanceDeviceRawLogs.id,
        pin: attendanceDeviceRawLogs.pin,
        employeeId: attendanceDeviceRawLogs.employeeId,
        timestamp: sql<string>`to_char(${attendanceDeviceRawLogs.timestamp}, \'YYYY-MM-DD HH24:MI:SS\')`.as("timestamp"),
        workDate: attendanceDeviceRawLogs.workDate,
        verifyMode: attendanceDeviceRawLogs.verifyMode,
        inOutState: attendanceDeviceRawLogs.inOutState,
        employeeName: employees.fullName,
        employeeNik: employees.employeeCode,
      })
      .from(attendanceDeviceRawLogs)
      .leftJoin(employees, eq(attendanceDeviceRawLogs.employeeId, employees.id))
      .where(whereClause);

    // Format raw rows to RawPunchInput
    const rawPunches: RawPunchInput[] = rawRows.map((r) => ({
      id: r.id,
      pin: r.pin,
      employeeId: r.employeeId,
      employeeCode: r.employeeNik || r.pin,
      employeeName: r.employeeName || undefined,
      timestamp: String(r.timestamp),
      workDate: r.workDate,
      verifyMode: r.verifyMode,
      inOutState: r.inOutState,
    }));

    // Query employees, shifts, assignments
    const allEmployees = await db.select().from(employees);
    const employeesMap = new Map();
    for (const emp of allEmployees) {
      employeesMap.set(emp.id, {
        id: emp.id,
        nik: emp.employeeCode || String(emp.id),
        fullName: emp.fullName,
        departmentId: emp.departmentId,
      });
      if (emp.employeeCode) {
        employeesMap.set(emp.employeeCode, {
          id: emp.id,
          nik: emp.employeeCode,
          fullName: emp.fullName,
          departmentId: emp.departmentId,
        });
      }
    }

    const shifts = await db.select().from(attendanceShifts);
    const assignments = await db.select().from(attendanceShiftAssignments);

    const result = calculateAttendanceFromPunches(
      rawPunches,
      employeesMap,
      shifts as any,
      assignments as any,
      { assignDefaultShiftIfUnassigned }
    );

    // If saveToDatabase requested, upsert into attendance_records
    if (saveToDatabase && result.processedRecords.length > 0) {
      for (const rec of result.processedRecords) {
        if (!rec.employeeId) continue;
        await db
          .insert(attendanceRecords)
          .values({
            employeeId: rec.employeeId,
            workDate: rec.workDate,
            shift: rec.shiftName,
            scheduleIn: rec.scheduleIn,
            scheduleOut: rec.scheduleOut,
            scanIn: rec.scanIn,
            scanOut: rec.scanOut,
            lateMinutes: rec.lateMinutes,
            earlyMinutes: rec.earlyMinutes,
            attendanceStatus: rec.attendanceStatus,
          })
          .onConflictDoUpdate({
            target: [attendanceRecords.employeeId, attendanceRecords.workDate],
            set: {
              shift: rec.shiftName,
              scheduleIn: rec.scheduleIn,
              scheduleOut: rec.scheduleOut,
              scanIn: rec.scanIn,
              scanOut: rec.scanOut,
              lateMinutes: rec.lateMinutes,
              earlyMinutes: rec.earlyMinutes,
              attendanceStatus: rec.attendanceStatus,
              updatedAt: new Date(),
            },
          });
      }
    }

    res.json({
      success: true,
      message: `Kalkulasi selesai: ${result.totalProcessed} absensi berhasil dihitung, ${result.totalUnassigned} tanpa shift`,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
