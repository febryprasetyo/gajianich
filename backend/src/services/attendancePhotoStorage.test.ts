import { test } from "node:test";
import assert from "node:assert";
import path from "node:path";
import os from "node:os";
import fsPromises from "node:fs/promises";
import {
  saveAttendancePhoto,
  purgeExpiredAttendancePhotos,
} from "./attendancePhotoStorage";

test("saveAttendancePhoto saves valid WebP image to disk", async () => {
  const tmpDir = path.join(os.tmpdir(), "gajianich-selfies-test-" + Date.now());
  await fsPromises.mkdir(tmpDir, { recursive: true });

  // 1x1 transparent PNG base64
  const sampleBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const txHash = "TX-TEST-20261022-001";

  const savedPath = await saveAttendancePhoto(txHash, sampleBase64, tmpDir);
  assert.ok(savedPath, "Saved path should be returned");
  assert.ok(savedPath.endsWith(".webp"), "Saved file should have .webp extension");

  const exists = await fsPromises.stat(savedPath).then(() => true).catch(() => false);
  assert.strictEqual(exists, true, "File should exist on disk");

  // Cleanup
  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test("purgeExpiredAttendancePhotos deletes photo files older than retention threshold and updates DB", async () => {
  const tmpDir = path.join(os.tmpdir(), "gajianich-purge-test-" + Date.now());
  await fsPromises.mkdir(tmpDir, { recursive: true });

  const oldFile = path.join(tmpDir, "old-selfie.webp");
  await fsPromises.writeFile(oldFile, "dummy image content");

  let updatedRecordId = null;
  let updatedFields = null;

  // Mock DB
  const mockDb = {
    select: () => ({
      from: () => ({
        where: () => [
          {
            id: 99,
            photoUrl: oldFile,
            createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
          },
        ],
      }),
    }),
    update: () => ({
      set: (fields) => ({
        where: () => {
          updatedRecordId = 99;
          updatedFields = fields;
          return Promise.resolve();
        },
      }),
    }),
  };

  const purgedCount = await purgeExpiredAttendancePhotos(mockDb as any, 7);
  assert.strictEqual(purgedCount, 1);
  assert.strictEqual(updatedRecordId, 99);
  assert.strictEqual(updatedFields?.photoUrl, null);
  assert.ok(updatedFields?.photoPurgedAt instanceof Date);

  const fileStillExists = await fsPromises.stat(oldFile).then(() => true).catch(() => false);
  assert.strictEqual(fileStillExists, false, "Old file should be unlinked from disk");

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});
