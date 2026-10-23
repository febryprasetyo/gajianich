import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { extractPhotoFace } from './faceRecognition';
test('rejects invalid uploads instead of creating a face reference', async () => {
  await assert.rejects(extractPhotoFace('not-a-photo'), /tidak valid/);
});
test('real detector rejects an image with no face', async () => {
  const buffer = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#dddddd' } }).png().toBuffer();
  await assert.rejects(extractPhotoFace(`data:image/png;base64,${buffer.toString('base64')}`), /Wajah tidak terdeteksi/);
});
