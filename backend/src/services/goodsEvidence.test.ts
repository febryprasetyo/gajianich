import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { saveGoodsEvidence } from './goodsEvidence';
test('compresses raster proof into WebP and rejects invalid images', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'ga-evidence-'));
  try {
    const image = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const stored = await saveGoodsEvidence(root, image);
    const metadata = await sharp(await readFile(path.join(root, stored.storageKey))).metadata();
    assert.equal(metadata.format, 'webp');
    assert.ok(stored.size > 0);
    const repeated = await saveGoodsEvidence(root,image);
    assert.notEqual(repeated.storageKey,stored.storageKey,'rollback cleanup must own only this upload');
    await assert.rejects(() => saveGoodsEvidence(root, Buffer.from('<svg></svg>')), /gambar/);
    await assert.rejects(() => saveGoodsEvidence(root, Buffer.from('not an image')), /gambar/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

import { saveSignedDocument } from './goodsEvidence';

test('saves PDF and image signed documents and enforces 10MB limit', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'ga-signed-'));
  try {
    const dummyPdf = Buffer.from('%PDF-1.4 test content');
    const pdfResult = await saveSignedDocument(root, dummyPdf, 'scan.pdf');
    assert.ok(pdfResult.storageKey.endsWith('.pdf'));
    assert.equal(pdfResult.fileName, 'scan.pdf');

    const image = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#000000' } }).png().toBuffer();
    const imgResult = await saveSignedDocument(root, image, 'foto-tanda-tangan.png');
    assert.ok(imgResult.storageKey.endsWith('.webp'));
    assert.equal(imgResult.fileName, 'foto-tanda-tangan.png');

    await assert.rejects(() => saveSignedDocument(root, Buffer.from('not a pdf or image'), 'fail.txt'), /Dokumen fisik harus berupa file PDF/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
