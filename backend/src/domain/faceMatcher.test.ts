import { test } from "node:test";
import assert from "node:assert";
import {
  euclideanDistance,
  calculateFaceSimilarity,
  verifyBiometricMatch,
  parseFaceDescriptor,
} from "./faceMatcher";

test("parseFaceDescriptor parses arrays, json strings, and comma-separated values", () => {
  assert.deepStrictEqual(parseFaceDescriptor([0.1, 0.2, 0.3]), [0.1, 0.2, 0.3]);
  assert.deepStrictEqual(parseFaceDescriptor("[0.1, 0.2, 0.3]"), [0.1, 0.2, 0.3]);
  assert.deepStrictEqual(parseFaceDescriptor("0.1, 0.2, 0.3"), [0.1, 0.2, 0.3]);
  assert.strictEqual(parseFaceDescriptor("invalid"), null);
  assert.strictEqual(parseFaceDescriptor(null), null);
});

test("euclideanDistance calculates correct geometric distance", () => {
  const v1 = [0, 0, 0];
  const v2 = [0, 3, 4];
  assert.strictEqual(euclideanDistance(v1, v2), 5);
  assert.throws(() => euclideanDistance([1], [1, 2]));
});

test("verifyBiometricMatch correctly detects match and mismatch thresholds", () => {
  // Identical vectors -> 100% similarity, distance 0
  const master = [0.12, 0.45, -0.23, 0.88];
  const exact = [0.12, 0.45, -0.23, 0.88];
  const matchResult = verifyBiometricMatch(exact, master);
  assert.strictEqual(matchResult.isMatch, true);
  assert.strictEqual(matchResult.distance, 0);
  assert.strictEqual(matchResult.similarityPercentage, 100);

  // Slight variance (same person with different light/angle, distance ~0.15)
  const slightVariation = [0.15, 0.48, -0.21, 0.85];
  const closeResult = verifyBiometricMatch(slightVariation, master);
  assert.strictEqual(closeResult.isMatch, true);
  assert.ok(closeResult.distance! < 0.2);
  assert.ok(closeResult.similarityPercentage! > 90);

  // Distinct person (large distance > 0.8)
  const differentPerson = [-0.6, -0.2, 0.7, -0.4];
  const mismatchResult = verifyBiometricMatch(differentPerson, master);
  assert.strictEqual(mismatchResult.isMatch, false);
  assert.ok(mismatchResult.distance! > 0.5);
  assert.ok(mismatchResult.reason !== undefined);
});
