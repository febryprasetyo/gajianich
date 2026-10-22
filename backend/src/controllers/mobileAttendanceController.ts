import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  getMobileTodaySummary,
  recordMobileClock,
  getMobileAttendanceHistory,
  getFaceProfile,
  updateFaceEnrollment,
  listPendingVerifications,
  verifyAttendanceRecord,
} from "../services/mobileAttendanceService";
import { z } from "zod";

const clockPayloadSchema = z.object({
  eventType: z.enum(["IN", "OUT"]),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scanTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  address: z.string().nullable().optional(),
  photoBase64: z.string().nullable().optional(),
  deviceInfo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  txHash: z.string().optional(),
});

const verifyPayloadSchema = z.object({
  logId: z.number().positive(),
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});

const enrollFacePayloadSchema = z.object({
  isEnrolled: z.boolean().optional(),
  faceDescriptor: z.any().optional(),
  faceDescriptorHash: z.string().optional(),
  samplePhotoBase64: z.string().optional(),
});

export async function getTodaySummaryController(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const data = await getMobileTodaySummary(userId);
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    const isClientError = err.message?.includes("dikaitkan") || err.message?.includes("tidak ditemukan");
    return res.status(isClientError ? 403 : 500).json({
      success: false,
      error: err.message || "Gagal mengambil rekap presensi hari ini",
    });
  }
}

export async function clockAttendanceController(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const parsed = clockPayloadSchema.parse(req.body);
    const result = await recordMobileClock(userId, parsed);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validasi data presensi gagal",
        details: err.issues,
      });
    }
    const isConflict = err.message?.includes("sudah tercatat") || err.message?.includes("Belum melakukan presensi masuk");
    const isForbidden = err.message?.includes("dikaitkan") || err.message?.includes("tidak ditemukan");
    const statusCode = isConflict ? 409 : isForbidden ? 403 : 400;

    return res.status(statusCode).json({
      success: false,
      error: err.message || "Gagal mencatat presensi",
    });
  }
}

export async function getAttendanceHistoryController(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const period = (req.query.period === "PREVIOUS" ? "PREVIOUS" : "CURRENT") as "CURRENT" | "PREVIOUS";
    const data = await getMobileAttendanceHistory(userId, period);
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Gagal mengambil riwayat presensi",
    });
  }
}

export async function enrollFaceController(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const parsed = enrollFacePayloadSchema.parse(req.body);
    const result = await updateFaceEnrollment(userId, parsed);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Validasi gagal", details: err.issues });
    }
    return res.status(500).json({
      success: false,
      error: err.message || "Gagal memperbarui status pendaftaran wajah",
    });
  }
}

export async function getVerificationsController(_req: AuthenticatedRequest, res: Response) {
  try {
    const list = await listPendingVerifications();
    return res.status(200).json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Gagal mengambil daftar verifikasi presensi",
    });
  }
}

export async function verifyAttendanceController(req: AuthenticatedRequest, res: Response) {
  try {
    const verifierUserId = req.user?.userId;
    if (!verifierUserId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const parsed = verifyPayloadSchema.parse(req.body);
    const result = await verifyAttendanceRecord(verifierUserId, parsed);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Validasi gagal", details: err.issues });
    }
    return res.status(400).json({
      success: false,
      error: err.message || "Gagal memverifikasi presensi",
    });
  }
}


export async function getFaceProfileController(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const result = await getFaceProfile(userId);
    return res.status(200).json(result);
  } catch (err: any) {
    const message = err.message || "Gagal mengambil data profil wajah";
    if (message.includes("Akun Anda belum dikaitkan")) {
      return res.status(403).json({ success: false, error: message });
    }
    return res.status(500).json({ success: false, error: message });
  }
}
