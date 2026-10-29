import { eq } from "drizzle-orm";
import { db } from "../db";
import { employees } from "../db/schema/employees";
import { attendanceIdentities } from "../db/schema/attendanceWorkspace";
import { attendanceDeviceRawLogs } from "../db/schema/attendanceDevices";
import { resolveImportEmployee } from "../domain/attendanceImportMapping";

export async function repairAttendanceDeviceRawLogs(options: { apply?: boolean } = {}) {
  const apply = options.apply ?? false;
  console.log(`[repairAttendanceDeviceRawLogs] Starting repair in mode: ${apply ? "APPLY" : "PREVIEW"}`);

  const allEmployees = await db.select().from(employees);
  const identities = await db.select().from(attendanceIdentities);
  const allLogs = await db.select().from(attendanceDeviceRawLogs);

  const changes: {
    logId: number;
    pin: string;
    oldEmployeeId: number | null;
    oldName: string;
    newEmployeeId: number | null;
    newName: string;
  }[] = [];

  for (const log of allLogs) {
    const correctEmpId = resolveImportEmployee(log.pin, log.deviceId, allEmployees, identities);
    if (log.employeeId !== correctEmpId) {
      const oldEmp = allEmployees.find((e) => e.id === log.employeeId);
      const newEmp = allEmployees.find((e) => e.id === correctEmpId);
      changes.push({
        logId: log.id,
        pin: log.pin,
        oldEmployeeId: log.employeeId,
        oldName: oldEmp ? `${oldEmp.fullName} (${oldEmp.employeeCode})` : "null",
        newEmployeeId: correctEmpId,
        newName: newEmp ? `${newEmp.fullName} (${newEmp.employeeCode})` : "null",
      });
    }
  }

  console.log(`[repairAttendanceDeviceRawLogs] Found ${changes.length} mismatched raw logs out of ${allLogs.length} total logs.`);

  if (changes.length > 0) {
    console.log("Sample changes (up to 10):");
    console.table(changes.slice(0, 10));
  }

  if (apply && changes.length > 0) {
    console.log(`[repairAttendanceDeviceRawLogs] Applying fixes to database...`);
    // Batch update by newEmployeeId and PIN or by log ID
    for (const change of changes) {
      await db
        .update(attendanceDeviceRawLogs)
        .set({ employeeId: change.newEmployeeId })
        .where(eq(attendanceDeviceRawLogs.id, change.logId));
    }
    console.log(`[repairAttendanceDeviceRawLogs] Successfully updated ${changes.length} raw logs.`);
  }

  return { totalChecked: allLogs.length, fixedCount: changes.length, mode: apply ? "APPLY" : "PREVIEW" };
}

if (process.argv[1] && process.argv[1].endsWith("repairAttendanceDeviceRawLogs.ts")) {
  const isApply = process.argv.includes("--apply");
  repairAttendanceDeviceRawLogs({ apply: isApply })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal repair error:", err);
      process.exit(1);
    });
}
