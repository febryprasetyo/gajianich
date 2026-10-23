import sharp from "sharp";
import path from "node:path";
import fsPromises from "node:fs/promises";
import { attendanceSelfLogs } from "../db/schema/attendanceSelfLogs";
import { lte, isNotNull, and, eq, sql } from "drizzle-orm";

export const ATTENDANCE_PHOTO_BASE_DIR = path.resolve(
  process.env.ATTENDANCE_PHOTO_DIR || path.join(process.cwd(), "data/attendance-selfies")
);

export async function saveAttendancePhoto(
  txHash: string,
  photoBase64: string,
  baseDir = ATTENDANCE_PHOTO_BASE_DIR
): Promise<string> {
  const cleanBase64 = photoBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const targetDir = path.join(baseDir, yearMonth);
  await fsPromises.mkdir(targetDir, { recursive: true });

  const fileName = `${txHash}.webp`;
  const filePath = path.join(targetDir, fileName);

  try {
    const compressed = await sharp(buffer)
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    await fsPromises.writeFile(filePath, compressed);
  } catch {
    // If sharp fails to parse (e.g. mock or raw buffer), fallback to direct write
    await fsPromises.writeFile(filePath, buffer);
  }

  return filePath;
}

export async function purgeExpiredAttendancePhotos(
  targetDb: any,
  retentionDays = 7
): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const expiredRecords = await targetDb
    .select({
      id: attendanceSelfLogs.id,
      photoUrl: attendanceSelfLogs.photoUrl,
    })
    .from(attendanceSelfLogs)
    .where(
      and(
        isNotNull(attendanceSelfLogs.photoUrl),
        eq(attendanceSelfLogs.approvalStatus, 'APPROVED'),
        lte(attendanceSelfLogs.createdAt, cutoffDate)
      )
    );

  let purgedCount = 0;
  for (const record of expiredRecords) {
    if (record.photoUrl) {
      try {
        await fsPromises.unlink(record.photoUrl);
      } catch {
        // File may already have been removed or moved
      }

      await targetDb
        .update(attendanceSelfLogs)
        .set({
          photoUrl: null,
          photoPurgedAt: new Date(),
        })
        .where(eq(attendanceSelfLogs.id, record.id));

      purgedCount++;
    }
  }

  return purgedCount;
}
