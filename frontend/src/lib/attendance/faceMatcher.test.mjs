import { test } from "node:test";
import assert from "node:assert/strict";
import {
  euclideanDistance,
  calculateFaceSimilarity,
  verifyFaceMatch,
  calculateEyeAspectRatio,
  isBlinkDetected,
  parseFaceDescriptor,
} from "./faceMatcher.ts";

test("parseFaceDescriptor safely converts string/array/json into float array", () => {
  assert.deepStrictEqual(parseFaceDescriptor([0.5, 0.2]), [0.5, 0.2]);
  assert.deepStrictEqual(parseFaceDescriptor("[0.5, 0.2]"), [0.5, 0.2]);
  assert.deepStrictEqual(parseFaceDescriptor("0.5, 0.2"), [0.5, 0.2]);
  assert.strictEqual(parseFaceDescriptor(null), null);
  assert.strictEqual(parseFaceDescriptor("not-a-number"), null);
});

test("euclideanDistance computes exact distance for multi-dimensional vectors", () => {
  const v1 = [0, 0, 0];
  const v2 = [0, 3, 4];
  assert.strictEqual(euclideanDistance(v1, v2), 5);
});

test("verifyFaceMatch handles unenrolled, match, and mismatch states", () => {
  // Unenrolled
  const unenrollRes = verifyFaceMatch([0.1, 0.2], null);
  assert.strictEqual(unenrollRes.status, "UNENROLLED");
  assert.strictEqual(unenrollRes.isMatch, false);

  // Exact Match
  const master = [0.12, 0.34, 0.56, 0.78];
  const exact = [0.12, 0.34, 0.56, 0.78];
  const matchRes = verifyFaceMatch(exact, master);
  assert.strictEqual(matchRes.status, "MATCH");
  assert.strictEqual(matchRes.isMatch, true);
  assert.strictEqual(matchRes.similarity, 100);

  // Mismatch
  const stranger = [0.99, -0.45, -0.88, 0.12];
  const mismatchRes = verifyFaceMatch(stranger, master);
  assert.strictEqual(mismatchRes.status, "MISMATCH");
  assert.strictEqual(mismatchRes.isMatch, false);

  // Lighting/camera variance (~0.50 <= 0.55) matches
  const lightingVar = [0.37, 0.59, 0.81, 1.03]; // dist = 0.50
  const lightingRes = verifyFaceMatch(lightingVar, master);
  assert.strictEqual(lightingRes.status, "MATCH");
  assert.strictEqual(lightingRes.isMatch, true);

  // Over 0.55 threshold fails
  const farVar = [0.42, 0.64, 0.86, 1.08]; // dist = 0.60
  const farRes = verifyFaceMatch(farVar, master);
  assert.strictEqual(farRes.status, "MISMATCH");
  assert.strictEqual(farRes.isMatch, false);
});

test("calculateEyeAspectRatio detects open vs closed eye blink", () => {
  // Open eye points
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 5, y: 5 };
  const p3 = { x: 10, y: 5 };
  const p4 = { x: 15, y: 0 };
  const p5 = { x: 10, y: -5 };
  const p6 = { x: 5, y: -5 };

  const earOpen = calculateEyeAspectRatio(p1, p2, p3, p4, p5, p6);
  assert.ok(earOpen > 0.3, "Open eye EAR should be > 0.3");
  assert.strictEqual(isBlinkDetected(earOpen), false);

  // Closed eye points (vertical distances near 0)
  const p2Close = { x: 5, y: 0.5 };
  const p3Close = { x: 10, y: 0.5 };
  const p5Close = { x: 10, y: -0.5 };
  const p6Close = { x: 5, y: -0.5 };

  const earClosed = calculateEyeAspectRatio(p1, p2Close, p3Close, p4, p5Close, p6Close);
  assert.ok(earClosed < 0.2, "Closed eye EAR should be < 0.2");
  assert.strictEqual(isBlinkDetected(earClosed), true);
});
