import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GoodsInputError } from '../domain/goodsRequest';

export const GOODS_STORAGE_ROOT = path.resolve(process.env.GA_STORAGE_DIR || path.join(process.cwd(), 'data/ga-evidence'));

export async function saveGoodsEvidence(directory: string, buffer: Buffer) {
  if (buffer.length > 512000) throw new GoodsInputError('Ukuran gambar maksimal 500 KB setelah kompresi.');
  let compressed: Buffer;
  try {
    const source = sharp(buffer, { limitInputPixels: 20000000, failOn: 'warning' });
    const metadata = await source.metadata();
    if (!['png', 'jpeg', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) throw new Error('format');
    compressed = await source.rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch { throw new GoodsInputError('Lampiran harus berupa gambar PNG, JPEG, atau WebP yang valid.'); }
  const storageKey = randomUUID() + '-' + createHash('sha256').update(compressed).digest('hex') + '.webp';
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, storageKey), compressed);
  return { storageKey, size: compressed.length };
}

export async function saveSignedDocument(directory: string, buffer: Buffer, originalName: string) {
  if (buffer.length > 10 * 1024 * 1024) throw new GoodsInputError('Ukuran file dokumen bertanda tangan maksimal 10 MB.');
  const isPdf = buffer.length > 4 && buffer.slice(0, 4).toString('ascii') === '%PDF';
  let storageKey: string;
  let finalBuffer: Buffer;
  if (isPdf) {
    finalBuffer = buffer;
    storageKey = 'signed-' + randomUUID() + '-' + createHash('sha256').update(buffer).digest('hex') + '.pdf';
  } else {
    try {
      const source = sharp(buffer, { limitInputPixels: 30000000 });
      const metadata = await source.metadata();
      if (!['png', 'jpeg', 'webp'].includes(metadata.format || '')) throw new Error('format');
      finalBuffer = await source.rotate().webp({ quality: 85 }).toBuffer();
      storageKey = 'signed-' + randomUUID() + '-' + createHash('sha256').update(finalBuffer).digest('hex') + '.webp';
    } catch {
      throw new GoodsInputError('Dokumen fisik harus berupa file PDF atau gambar (PNG, JPEG, WebP) yang valid.');
    }
  }
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, storageKey), finalBuffer);
  return { storageKey, size: finalBuffer.length, fileName: originalName };
}
