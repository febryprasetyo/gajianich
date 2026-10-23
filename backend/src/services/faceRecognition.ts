import sharp from 'sharp';
import path from 'node:path';
import * as faceapi from '@vladmandic/face-api/dist/face-api.node-wasm.js';
import * as tf from '@tensorflow/tfjs';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
export const FACE_DESCRIPTOR_VERSION = 'face-api-resnet-v1';
let initialization: Promise<void> | undefined;
async function initialize() {
  if (!initialization) initialization = (async () => {
    const wasm = path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm')) + path.sep;
    setWasmPaths(wasm);
    await tf.setBackend('wasm');
    await tf.ready();
    const modelDir = path.join(path.dirname(require.resolve('@vladmandic/face-api/package.json')), 'model');
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(modelDir),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir),
      faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir),
    ]);
  })().catch(error => { initialization = undefined; throw error; });
  return initialization;
}
export async function extractPhotoFace(photo: string): Promise<{ descriptor: number[]; photoUrl: string }> {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(photo) || photo.length > 8_000_000) throw new Error('Foto wajah tidak valid atau terlalu besar.');
  const buffer = Buffer.from(photo.substring(photo.indexOf(',') + 1), 'base64');
  const image = sharp(buffer, { limitInputPixels: 20_000_000 }).rotate().resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true });
  const { data, info } = await image.clone().removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  await initialize();
  const tensor = faceapi.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
  try {
    const faces = await faceapi.detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.7 })).withFaceLandmarks().withFaceDescriptors();
    if (faces.length !== 1) throw new Error(faces.length ? 'Pastikan hanya satu wajah berada dalam foto.' : 'Wajah tidak terdeteksi. Ulangi dengan pencahayaan yang cukup.');
    return { descriptor: Array.from(faces[0].descriptor), photoUrl: `data:image/webp;base64,${(await image.webp({ quality: 80 }).toBuffer()).toString('base64')}` };
  } finally { tensor.dispose(); }
}
