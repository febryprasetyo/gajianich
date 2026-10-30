import {departmentOrganizationMappings} from '../db/schema/organizations';
import {attendanceConnectionStatus,attendanceIdentitySourceId} from '../domain/attendanceDeviceTransport';
import {employeeScopePredicate,historicalScopePredicate,requireHrScope,requireScopedEmployee} from '../services/hrOrganizationScope';
import { Request, Response } from "express";
import { eq, desc, and, gte, lte, ilike, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  attendanceDevices,
  attendanceDeviceSyncLogs,
  attendanceDeviceRawLogs,
} from "../db/schema/attendanceDevices";
import { employees } from "../db/schema/employees";
import {
  attendanceShifts,
  attendanceShiftAssignments,
  attendanceIdentities,
} from "../db/schema/attendanceWorkspace";
import { attendanceRecords } from "../db/schema/attendance";
import { departments } from "../db/schema/master";
import { attendanceDeviceSessionManager } from "../services/zk/zkSessionManager";
import {
  calculateAttendanceFromPunches,
  RawPunchInput,
  parseMinutesFromTime,
  mergeAttendanceScans,
} from "../services/attendanceCalculationService";
import { resolveImportEmployee } from "../domain/attendanceImportMapping";

// Register disconnect listener to update database status when idle timeout or disconnect occurs
attendanceDeviceSessionManager.onDisconnect(async (deviceId, reason) => {
  try {
    await db
      .update(attendanceDevices)
      .set({ status: "DISCONNECTED" })
      .where(eq(attendanceDevices.id, deviceId));
    console.log(`[attendanceDeviceController] Device ${deviceId} status updated to DISCONNECTED in DB (reason: ${reason})`);
  } catch (err) {
    console.error(`[attendanceDeviceController] Failed to update device ${deviceId} status in DB:`, err);
  }
});

export async function getAttendanceDevicesHandler(req: Request, res: Response) {
  try {
    const list = await db
      .select()
      .from(attendanceDevices)
      .where(historicalScopePredicate(requireHrScope(req as any),attendanceDevices.groupId))
      .orderBy(attendanceDevices.id);

    // Query adms.devices for all device_ids in list to support unified device dashboard
    const deviceIds = list.map(d => d.id);
    const admsMap: Record<number, { serial: string; enabled: boolean; allowedNetwork: string | null; lastSeenAt: string | null; lastDataAt: string | null }> = {};
    if (deviceIds.length > 0) {
      try {
        const admsRows = await db.execute(sql`
          SELECT device_id, serial, enabled,
                 host(allowed_network) || '/' || masklen(allowed_network) AS "allowedNetwork",
                 last_seen_at AS "lastSeenAt",
                 last_data_at AS "lastDataAt"
          FROM adms.devices
          WHERE device_id = ANY(${deviceIds})
        `);
        for (const row of (admsRows.rows as any[])) {
          admsMap[Number(row.device_id)] = {
            serial: row.serial,
            enabled: Boolean(row.enabled),
            allowedNetwork: row.allowedNetwork,
            lastSeenAt: row.lastSeenAt,
            lastDataAt: row.lastDataAt,
          };
        }
      } catch (e) {
        console.warn('Failed to query adms.devices:', e);
      }
    }

    const enriched = list.map((dev) => {
      const session = attendanceDeviceSessionManager.getSessionInfo(dev.id);
      const idleSecondsLeft = attendanceDeviceSessionManager.getIdleSecondsLeft(dev.id);
      const connectionStatus = attendanceConnectionStatus(dev, session.status);
      const isActuallyConnected = connectionStatus === "connected";
      const admsInfo = admsMap[dev.id];

      // Self-healing: if DB says CONNECTED but session is DISCONNECTED, heal DB to DISCONNECTED
      if (dev.connectionType !== "ADMS" && !isActuallyConnected && dev.status === "CONNECTED") {
        db.update(attendanceDevices)
          .set({ status: "DISCONNECTED" })
          .where(eq(attendanceDevices.id, dev.id))
          .catch(() => {});
      }

      return {
        ...dev,
        status: connectionStatus,
        idleSecondsLeft: dev.connectionType === "ADMS" ? null : idleSecondsLeft,
        activeIdentity: dev.connectionType === "ADMS" ? { firmware: dev.firmware, serialNumber: dev.serialNumber, deviceName: dev.model, platform: dev.platform } : session.identity,
        admsRegistered: Boolean(admsInfo),
        admsEnabled: admsInfo ? admsInfo.enabled : false,
        allowedNetwork: admsInfo?.allowedNetwork ?? null,
        admsLastSeenAt: admsInfo?.lastSeenAt ?? dev.lastAdmsSeenAt ?? null,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createAttendanceDeviceHandler(req: Request, res: Response) {
  try {
    const scope = requireHrScope(req as any);
    const { name, ip, port, commKey, deviceNumber, location, connectionType } = req.body;
    if (!name || !ip) {
      return res.status(400).json({ success: false, message: "Nama dan IP mesin wajib diisi" });
    }

    const code = `dev-${Date.now()}`;
    const [created] = await db
      .insert(attendanceDevices)
      .values({
        code,
        groupId:scope.selectedGroupId,
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
    const scope = requireHrScope(req as any);
    const [ownedDevice] = await db.select().from(attendanceDevices).where(and(eq(attendanceDevices.id,Number(req.params.id)),historicalScopePredicate({...scope,includeUnmapped:false},attendanceDevices.groupId)));
    if (!ownedDevice) return res.status(404).json({error:'Device unavailable in destination group'});
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
  let ownedDevice: any = null;
  try {
    const scope = requireHrScope(req as any);
    const [found] = await db
      .select()
      .from(attendanceDevices)
      .where(and(eq(attendanceDevices.id, Number(req.params.id)), historicalScopePredicate({ ...scope, includeUnmapped: false }, attendanceDevices.groupId)));
    if (!found) return res.status(404).json({ error: 'Device unavailable in destination group' });
    ownedDevice = found;
    const deviceId = parseInt(req.params.id, 10);
    await attendanceDeviceSessionManager.disconnect(deviceId);

    let deleted: any = null;
    await db.transaction(async (tx) => {
      // Hapus relasi pendaftaran ADMS jika ada
      await tx.execute(sql`DELETE FROM adms.devices WHERE device_id = ${deviceId}`);
      const [res] = await tx
        .delete(attendanceDevices)
        .where(eq(attendanceDevices.id, deviceId))
        .returning();
      deleted = res;
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Perangkat tidak ditemukan" });
    }

    res.json({ success: true, message: `Mesin "${deleted.name}" berhasil dihapus.` });
  } catch (err: any) {
    if (err?.code === '23503' || String(err?.message || '').includes('violates foreign key constraint')) {
      const devName = ownedDevice?.name || 'tersebut';
      return res.status(409).json({
        success: false,
        message: `Mesin "${devName}" tidak dapat dihapus karena masih memiliki riwayat data transaksi atau log presensi di sistem. Silakan nonaktifkan status mesin jika perangkat sudah tidak beroperasi.`,
      });
    }
    res.status(500).json({ success: false, message: err.message || 'Gagal menghapus mesin absensi.' });
  }
}

export async function connectAttendanceDeviceHandler(req: Request, res: Response) {
  try {
    const scope = requireHrScope(req as any);
    const [ownedDevice] = await db.select().from(attendanceDevices).where(and(eq(attendanceDevices.id,Number(req.params.id)),historicalScopePredicate({...scope,includeUnmapped:false},attendanceDevices.groupId)));
    if (!ownedDevice) return res.status(404).json({error:'Device unavailable in destination group'});
    if (ownedDevice.connectionType === "ADMS") {
      return res.status(409).json({ success: false, message: "Mesin ADMS mengirim data otomatis. Gunakan impor historis ADMS untuk menggabungkan data lama." });
    }
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
          idleTimeoutMs: 5 * 60 * 1000,
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
        idleSecondsLeft: Math.floor((session.idleTimeoutMs || 300000) / 1000),
        identity: session.identity,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function disconnectAttendanceDeviceHandler(req: Request, res: Response) {
  try {
    const scope = requireHrScope(req as any);
    const [ownedDevice] = await db.select().from(attendanceDevices).where(and(eq(attendanceDevices.id,Number(req.params.id)),historicalScopePredicate({...scope,includeUnmapped:false},attendanceDevices.groupId)));
    if (!ownedDevice) return res.status(404).json({error:'Device unavailable in destination group'});
    if (ownedDevice.connectionType === "ADMS") {
      return res.status(409).json({ success: false, message: "Mesin ADMS mengirim data otomatis. Gunakan impor historis ADMS untuk menggabungkan data lama." });
    }
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
    const scope = requireHrScope(req as any);
    const [ownedDevice] = await db.select().from(attendanceDevices).where(and(eq(attendanceDevices.id,Number(req.params.id)),historicalScopePredicate({...scope,includeUnmapped:false},attendanceDevices.groupId)));
    if (!ownedDevice) return res.status(404).json({error:'Device unavailable in destination group'});
    if (ownedDevice.connectionType === "ADMS") {
      return res.status(409).json({ success: false, message: "Mesin ADMS mengirim data otomatis. Gunakan impor historis ADMS untuk menggabungkan data lama." });
    }
    const deviceId = parseInt(req.params.id, 10);
    const { startDate, endDate } = req.body;

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
        groupId:device.groupId,
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

    // 3. Match PIN to Employees using canonical resolveImportEmployee
    const allEmployees = await db.select().from(employees).where(employeeScopePredicate({...requireHrScope(req as any),includeUnmapped:false}));
    const identities = await db.select().from(attendanceIdentities);
    const pinResolutionCache = new Map<string, number | null>();

    const getEmployeeIdForPin = (pin: string): number | null => {
      const cleanPin = String(pin).trim();
      if (pinResolutionCache.has(cleanPin)) {
        return pinResolutionCache.get(cleanPin)!;
      }
      const resolvedId = resolveImportEmployee(cleanPin, device.id, allEmployees, identities);
      pinResolutionCache.set(cleanPin, resolvedId);
      return resolvedId;
    };

    // Merge downloaded scans; replacing a date range could erase PUSH or imported history.
    const rawInserts = [];
    for (const punch of fetchedPunches) {
      if (startDate && punch.workDate < startDate) continue;
      if (endDate && punch.workDate > endDate) continue;
      const empId = getEmployeeIdForPin(punch.pin);
      const owner = empId ? await requireScopedEmployee(requireHrScope(req as any),empId) : null;
      rawInserts.push({
        groupId:owner?.groupId ?? device.groupId,
        syncLogId: syncLog.id,
        deviceId: device.id,
        pin: punch.pin,
        employeeId: empId,
        timestamp: sql`${punch.timestamp}::timestamp`,
        workDate: punch.workDate,
        verifyMode: punch.verifyMode,
        inOutState: punch.inOutState,
        rawPayload: { punch },
      });
    }

    let insertedCount = 0;
    if (rawInserts.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < rawInserts.length; i += CHUNK_SIZE) {
        const chunk = rawInserts.slice(i, i + CHUNK_SIZE);
        const inserted = await db.insert(attendanceDeviceRawLogs).values(chunk).onConflictDoNothing().returning({id:attendanceDeviceRawLogs.id});
        insertedCount += inserted.length;
      }
    }

    // 5. Update Sync Log & Device Stats
    await db
      .update(attendanceDeviceSyncLogs)
      .set({
        status: "SUCCESS",
        totalFetched: fetchedPunches.length,
        totalParsed: fetchedPunches.length,
        totalProcessed: insertedCount,
        completedAt: new Date(),
      })
      .where(eq(attendanceDeviceSyncLogs.id, syncLog.id));

    await db
      .update(attendanceDevices)
      .set({
        lastSyncAt: new Date(),
        totalLogs: sql`(select count(*) from attendance_device_raw_logs where device_id = ${device.id})`,
      })
      .where(eq(attendanceDevices.id, device.id));

    res.json({
      success: true,
      message: `Berhasil menggabungkan ${insertedCount} log baru dari ${device.name}`,
      data: {
        syncLogId: syncLog.id,
        totalFetched: fetchedPunches.length,
        totalParsed: fetchedPunches.length,
        totalProcessed: insertedCount,
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

    const conditions = [historicalScopePredicate(requireHrScope(req as any),attendanceDeviceRawLogs.groupId)];
    if (startDate) conditions.push(gte(attendanceDeviceRawLogs.workDate, String(startDate)));
    if (endDate) conditions.push(lte(attendanceDeviceRawLogs.workDate, String(endDate)));
    if (deviceId) conditions.push(eq(attendanceDeviceRawLogs.deviceId, parseInt(String(deviceId), 10)));
    if (pin) conditions.push(eq(attendanceDeviceRawLogs.pin, String(pin)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db
      .select({
        id: attendanceDeviceRawLogs.id,
        groupId: attendanceDeviceRawLogs.groupId,
        rawSource: sql<string | null>`${attendanceDeviceRawLogs.rawPayload}->>'source'`,
        identitySourceId: sql<string | null>`${attendanceDeviceRawLogs.rawPayload}->>'identitySourceId'`,
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
        department: departments.name,
      })
      .from(attendanceDeviceRawLogs)
      .leftJoin(attendanceDevices, eq(attendanceDeviceRawLogs.deviceId, attendanceDevices.id))
      .leftJoin(employees, eq(attendanceDeviceRawLogs.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(attendanceDeviceRawLogs.timestamp))
      .limit(parseInt(String(limit), 10))
      .offset(parseInt(String(offset), 10));

    // Fallback: If any log rows have null employeeId, resolve them dynamically
    const unmappedLogs = logs.filter((l) => !l.employeeId);
    if (unmappedLogs.length > 0) {
      const allEmployees = await db
        .select({
          id: employees.id,
          fullName: employees.fullName,
          employeeCode: employees.employeeCode,
          barcode: employees.barcode,
          departmentId: employees.departmentId,
          groupId: departmentOrganizationMappings.groupId,
          departmentName: departments.name,
        })
        .from(employees)
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(departmentOrganizationMappings, eq(employees.departmentId, departmentOrganizationMappings.departmentId))
        .where(employeeScopePredicate({...requireHrScope(req as any),includeUnmapped:false}));
      const identities = await db.select().from(attendanceIdentities);
      const pinCache = new Map<string, number | null>();
      for (const log of unmappedLogs) {
        const cleanPin = String(log.pin).trim();
        const sourceId = attendanceIdentitySourceId(log.deviceId, log.rawSource, log.identitySourceId);
        const cacheKey = `${log.groupId}:${sourceId}:${cleanPin}`;
        let resolvedId = pinCache.get(cacheKey);
        if (resolvedId === undefined) {
          resolvedId = resolveImportEmployee(cleanPin, sourceId, allEmployees.filter(e=>e.groupId===log.groupId) as any, identities);
          pinCache.set(cacheKey, resolvedId);
        }
        if (resolvedId) {
          const emp = allEmployees.find((e) => e.id === resolvedId);
          if (emp) {
            log.employeeId = emp.id;
            log.employeeName = emp.fullName;
            log.employeeNik = emp.employeeCode;
            log.department = emp.departmentName;
          }
        }
      }
    }

    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function calculateAttendanceHandler(req: Request, res: Response) {
  try {
    const { startDate, endDate, deviceId, assignDefaultShiftIfUnassigned = true, saveToDatabase = true } = req.body;

    const conditions = [historicalScopePredicate(requireHrScope(req as any),attendanceDeviceRawLogs.groupId)];
    if (startDate) conditions.push(gte(attendanceDeviceRawLogs.workDate, String(startDate)));
    if (endDate) conditions.push(lte(attendanceDeviceRawLogs.workDate, String(endDate)));
    if (deviceId) conditions.push(eq(attendanceDeviceRawLogs.deviceId, parseInt(String(deviceId), 10)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rawRows = await db
      .select({
        id: attendanceDeviceRawLogs.id,
        groupId: attendanceDeviceRawLogs.groupId,
        rawSource: sql<string | null>`${attendanceDeviceRawLogs.rawPayload}->>'source'`,
        identitySourceId: sql<string | null>`${attendanceDeviceRawLogs.rawPayload}->>'identitySourceId'`,
        deviceId: attendanceDeviceRawLogs.deviceId,
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

    // Query employees with department name, shifts, assignments, and identities
    const allEmployees = await db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        employeeCode: employees.employeeCode,
        barcode: employees.barcode,
        departmentId: employees.departmentId,
          groupId: departmentOrganizationMappings.groupId,
        departmentName: departments.name,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(departmentOrganizationMappings, eq(employees.departmentId, departmentOrganizationMappings.departmentId))
      .where(employeeScopePredicate({...requireHrScope(req as any),includeUnmapped:false}));
    const identities = await db.select().from(attendanceIdentities);
    const pinResolutionCache = new Map<string, number | null>();

    const getEmployeeIdForPin = (pin: string, sourceId: number, groupId: number | null): number | null => {
      const cleanPin = String(pin).trim();
      const cacheKey = `${groupId}:${sourceId}:${cleanPin}`;
      if (pinResolutionCache.has(cacheKey)) {
        return pinResolutionCache.get(cacheKey)!;
      }
      const resolvedId = resolveImportEmployee(cleanPin, sourceId, allEmployees.filter(e=>e.groupId===groupId) as any, identities);
      pinResolutionCache.set(cacheKey, resolvedId);
      return resolvedId;
    };

    // Format raw rows to RawPunchInput, skipping punches for employees outside current scope
    const rawPunches: RawPunchInput[] = [];
    let totalUnmappedRawLogs = 0;
    for (const r of rawRows) {
      const resolvedEmpId =
        r.employeeId || getEmployeeIdForPin(r.pin, attendanceIdentitySourceId(r.deviceId, r.rawSource, r.identitySourceId), r.groupId);
      const emp = resolvedEmpId ? allEmployees.find((e) => e.id === resolvedEmpId && e.groupId === r.groupId) : null;
      if (!emp) {
        totalUnmappedRawLogs++;
        continue;
      }
      rawPunches.push({
        id: r.id,
        pin: r.pin,
        employeeId: emp.id,
        employeeCode: emp?.employeeCode || r.employeeNik || r.pin,
        employeeName: emp?.fullName || r.employeeName || undefined,
        department: emp?.departmentName || undefined,
        timestamp: String(r.timestamp),
        workDate: r.workDate,
        verifyMode: r.verifyMode,
        inOutState: r.inOutState,
      });
    }

    const employeesMap = new Map();
    for (const emp of allEmployees) {
      const empData = {
        id: emp.id,
        nik: emp.employeeCode || String(emp.id),
        fullName: emp.fullName,
        departmentId: emp.departmentId,
        departmentName: emp.departmentName || "Umum",
      };
      employeesMap.set(emp.id, empData);
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
      const hrScope = requireHrScope(req as any);
      for (const rec of result.processedRecords) {
        if (!rec.employeeId) continue;
        let owner;
        try {
          owner = await requireScopedEmployee(hrScope, rec.employeeId);
        } catch {
          continue;
        }
        const [previous] = await db
          .select()
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.employeeId, rec.employeeId),
              eq(attendanceRecords.workDate, rec.workDate)
            )
          );
        if (previous && previous.groupId !== owner.groupId) continue;

        const effectiveScheduleIn = previous?.scheduleIn || rec.scheduleIn || '08:00';
        const effectiveScheduleOut = previous?.scheduleOut || rec.scheduleOut || '17:00';
        const merged = mergeAttendanceScans(previous, {
          scanIn: rec.scanIn,
          scanOut: rec.scanOut,
          scheduleIn: effectiveScheduleIn,
          scheduleOut: effectiveScheduleOut,
          attendanceStatus: rec.attendanceStatus,
        });

        await db
          .insert(attendanceRecords)
          .values({
            groupId: owner.groupId,
            organizationId: owner.organizationId,
            employeeId: rec.employeeId,
            workDate: rec.workDate,
            shift: rec.shiftName || previous?.shift,
            scheduleIn: effectiveScheduleIn,
            scheduleOut: effectiveScheduleOut,
            scanIn: merged.scanIn,
            scanOut: merged.scanOut,
            rawScanIn: merged.scanIn,
            rawScanOut: merged.scanOut,
            lateMinutes: merged.lateMinutes,
            earlyMinutes: merged.earlyMinutes,
            attendanceStatus: merged.attendanceStatus,
          })
          .onConflictDoUpdate({
            target: [attendanceRecords.employeeId, attendanceRecords.workDate],
            set: {
              shift: rec.shiftName || previous?.shift,
              scheduleIn: effectiveScheduleIn,
              scheduleOut: effectiveScheduleOut,
              scanIn: merged.scanIn,
              scanOut: merged.scanOut,
              rawScanIn: merged.scanIn,
              rawScanOut: merged.scanOut,
              lateMinutes: merged.lateMinutes,
              earlyMinutes: merged.earlyMinutes,
              attendanceStatus: merged.attendanceStatus,
              updatedAt: new Date(),
            },
          });
      }
    }

    res.json({
      success: true,
      message: `Kalkulasi selesai: ${result.totalProcessed} absensi berhasil dihitung, ${result.totalUnassigned} tanpa shift`,
      data: {...result, totalUnmappedRawLogs},
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
