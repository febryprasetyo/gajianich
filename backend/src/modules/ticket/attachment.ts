import { Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { randomBytes } from "node:crypto";
import { pool } from "../../db";
import { AuthenticatedRequest } from "../../middleware/auth";
import { resolveTicketActor } from "./controller";

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
]);

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function getHelpdeskStorageDir(): string {
  const dir = process.env.HELPDESK_STORAGE_DIR || path.resolve(process.cwd(), "uploads/helpdesk");
  return dir;
}

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
}).single("file");

export function handleAttachmentUpload(req: Request, res: Response, next: NextFunction): void {
  uploadMiddleware(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "Ukuran file melebihi batas maksimal 10 MB" });
        return;
      }
      res.status(400).json({ error: err.message || "Gagal mengunggah file" });
      return;
    }
    next();
  });
}

export async function uploadAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const ticketId = parseInt(req.params.id, 10);
  if (isNaN(ticketId)) {
    res.status(400).json({ error: "ID tiket tidak valid" });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "File lampiran wajib disertakan (field: file)" });
    return;
  }

  // 1. Validasi MIME Type
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    res.status(400).json({
      error: `Tipe file tidak diizinkan: ${file.mimetype}. File yang diperbolehkan: JPG, PNG, GIF, PDF, DOC, DOCX, XLS, XLSX, ZIP`
    });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 2. Periksa tiket
    const tRes = await client.query("SELECT id, ticket_number FROM helpdesk_tickets WHERE id = $1 FOR UPDATE", [ticketId]);
    if (tRes.rowCount === 0) {
      res.status(404).json({ error: "Tiket tidak ditemukan" });
      await client.query("ROLLBACK");
      return;
    }

    const actor = await resolveTicketActor(req);

    // 3. Simpan file fisik dengan nama unik (storage_path !== filename)
    const storageDir = getHelpdeskStorageDir();
    await fs.mkdir(storageDir, { recursive: true });

    const ext = path.extname(file.originalname) || "";
    const uniqueName = `tkt_${ticketId}_${Date.now()}_${randomBytes(8).toString("hex")}${ext}`;
    const targetPath = path.join(storageDir, uniqueName);

    await fs.writeFile(targetPath, file.buffer);

    // 4. Catat di tabel helpdesk_attachments
    const insertRes = await client.query(
      `INSERT INTO helpdesk_attachments (
        ticket_id, filename, storage_path, mime_type, size_bytes, uploaded_by_user_id, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING *`,
      [
        ticketId,
        file.originalname,
        uniqueName, // disimpan sebagai nama file storage relatif
        file.mimetype,
        file.size,
        actor.userId,
      ]
    );

    const attachment = insertRes.rows[0];

    // 5. Catat ke audit trail
    await client.query(
      `INSERT INTO helpdesk_ticket_audit (
        ticket_id, actor_user_id, actor_name_snapshot, action, field_changed, new_value, note, occurred_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [
        ticketId,
        actor.userId,
        actor.name,
        "UPDATE",
        "attachment",
        file.originalname,
        `Lampiran diunggah: ${file.originalname} (${Math.round(file.size / 1024)} KB)`
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      data: {
        id: String(attachment.id),
        ticketId: String(attachment.ticket_id),
        filename: attachment.filename,
        storagePath: attachment.storage_path,
        mimeType: attachment.mime_type,
        sizeBytes: Number(attachment.size_bytes),
        uploadedByUserId: Number(attachment.uploaded_by_user_id),
        uploadedAt: new Date(attachment.uploaded_at).toISOString(),
      }
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message || "Gagal menyimpan lampiran" });
  } finally {
    client.release();
  }
}

export async function downloadAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const ticketId = parseInt(req.params.id, 10);
  const attachmentId = parseInt(req.params.attachmentId, 10);

  if (isNaN(ticketId) || isNaN(attachmentId)) {
    res.status(400).json({ error: "ID tiket atau lampiran tidak valid" });
    return;
  }

  try {
    const aRes = await pool.query(
      "SELECT * FROM helpdesk_attachments WHERE id = $1 AND ticket_id = $2",
      [attachmentId, ticketId]
    );

    if (aRes.rowCount === 0) {
      res.status(404).json({ error: "Lampiran tidak ditemukan" });
      return;
    }

    const att = aRes.rows[0];
    const storageDir = getHelpdeskStorageDir();
    const filePath = path.join(storageDir, att.storage_path);

    if (!existsSync(filePath)) {
      res.status(404).json({ error: "File fisik lampiran tidak ditemukan di server" });
      return;
    }

    res.setHeader("Content-Type", att.mime_type);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(att.filename)}"`);
    res.setHeader("Content-Length", att.size_bytes);

    createReadStream(filePath).pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal mengunduh lampiran" });
  }
}
