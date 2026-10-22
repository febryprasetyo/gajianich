/**
 * Verification Policy for Mobile Attendance:
 * - Office employees: HRD only verifies Clock In (IN). Clock Out (OUT) is auto-approved if within geofence.
 * - Production employees: HRD must verify BOTH Clock In (IN) and Clock Out (OUT).
 */

export type ShiftCategory = "OFFICE" | "PRODUCTION";
export type AttendanceEventType = "IN" | "OUT";
export type AttendanceApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AttendanceApprovalResult {
  requiresVerification: boolean;
  approvalStatus: AttendanceApprovalStatus;
  approvalNote: string;
}

export function determineShiftCategory(shift?: { code?: string; name?: string } | null): ShiftCategory {
  if (!shift) return "OFFICE";
  const code = (shift.code || "").toUpperCase();
  const name = (shift.name || "").toLowerCase();

  if (code.includes("PROD") || name.includes("produksi") || name.includes("production") || code.includes("SHIFT")) {
    return "PRODUCTION";
  }

  return "OFFICE";
}

export function evaluateAttendanceApproval(
  shiftCategory: ShiftCategory,
  eventType: AttendanceEventType,
  isWithinGeofence: boolean
): AttendanceApprovalResult {
  if (shiftCategory === "OFFICE") {
    if (eventType === "IN") {
      return {
        requiresVerification: true,
        approvalStatus: "PENDING",
        approvalNote: isWithinGeofence
          ? "Menunggu verifikasi masuk oleh HRD"
          : "Menunggu verifikasi HRD (Presensi masuk di luar radius kantor / Dinas Luar)",
      };
    } else {
      // Office Clock Out
      if (!isWithinGeofence) {
        return {
          requiresVerification: true,
          approvalStatus: "PENDING",
          approvalNote: "Menunggu verifikasi HRD (Presensi pulang di luar radius kantor)",
        };
      }
      return {
        requiresVerification: false,
        approvalStatus: "APPROVED",
        approvalNote: "Otomatis disetujui (Karyawan Office)",
      };
    }
  }

  // Production Shift: Both Clock In and Clock Out require HRD verification
  if (eventType === "IN") {
    return {
      requiresVerification: true,
      approvalStatus: "PENDING",
      approvalNote: isWithinGeofence
        ? "Menunggu verifikasi masuk oleh HRD (Produksi)"
        : "Menunggu verifikasi HRD (Presensi masuk Produksi di luar radius area kerja)",
    };
  } else {
    return {
      requiresVerification: true,
      approvalStatus: "PENDING",
      approvalNote: isWithinGeofence
        ? "Menunggu verifikasi pulang oleh HRD (Produksi)"
        : "Menunggu verifikasi HRD (Presensi pulang Produksi di luar radius area kerja)",
    };
  }
}
