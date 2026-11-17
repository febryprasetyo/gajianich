/**
 * Pure domain utility for biometric face descriptor comparison
 * using Euclidean distance and similarity scoring.
 */

export const DEFAULT_FACE_MATCH_THRESHOLD = 0.55; // Standard ResNet-34 128-D Euclidean distance threshold for real-world lighting/camera variance

export function parseFaceDescriptor(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const nums = raw.map(Number);
    return nums.every((n) => !isNaN(n)) && nums.length > 0 ? nums : null;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const nums = parsed.map(Number);
        return nums.every((n) => !isNaN(n)) && nums.length > 0 ? nums : null;
      }
    } catch {
      // Try comma-separated
      const nums = raw.split(",").map((s) => Number(s.trim()));
      return nums.every((n) => !isNaN(n)) && nums.length > 0 ? nums : null;
    }
  }
  return null;
}

export function euclideanDistance(v1: number[], v2: number[]): number {
  if (!v1 || !v2 || v1.length === 0 || v1.length !== v2.length) {
    throw new Error("Vectors must be non-empty and of identical dimensions");
  }
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    const diff = v1[i] - v2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function calculateFaceSimilarity(distance: number): number {
  if (distance <= 0) return 100;
  // Normalized score: 0 distance = 100%, 0.45 distance ~ 85%, 1.0 distance <= 50%
  const score = Math.max(0, Math.min(100, (1 - distance * 0.35) * 100));
  return Math.round(score * 10) / 10;
}

export function verifyBiometricMatch(
  liveDescriptor: unknown,
  masterDescriptor: unknown,
  threshold: number = DEFAULT_FACE_MATCH_THRESHOLD
): {
  isMatch: boolean;
  distance: number | null;
  similarityPercentage: number | null;
  reason?: string;
} {
  const vLive = parseFaceDescriptor(liveDescriptor);
  const vMaster = parseFaceDescriptor(masterDescriptor);

  if (!vLive || !vMaster) {
    return {
      isMatch: false,
      distance: null,
      similarityPercentage: null,
      reason: !vMaster ? "Profil wajah belum terdaftar (belum enrollment)" : "Vektor wajah tidak valid",
    };
  }

  if (vLive.length !== vMaster.length) {
    return {
      isMatch: false,
      distance: null,
      similarityPercentage: null,
      reason: "Dimensi vektor wajah tidak cocok",
    };
  }

  const dist = euclideanDistance(vLive, vMaster);
  const similarity = calculateFaceSimilarity(dist);
  const isMatch = dist <= threshold;

  return {
    isMatch,
    distance: Math.round(dist * 1000) / 1000,
    similarityPercentage: similarity,
    reason: isMatch ? undefined : "Wajah tidak cocok dengan data biometrik master",
  };
}

export function verifyBiometricMatchAny(
  liveDescriptors: unknown[],
  masterDescriptors: unknown[],
  threshold: number = DEFAULT_FACE_MATCH_THRESHOLD
): {
  isMatch: boolean;
  distance: number | null;
  similarityPercentage: number | null;
  reason?: string;
} {
  const validLive = liveDescriptors.filter((d) => parseFaceDescriptor(d) !== null);
  const validMaster = masterDescriptors.filter((d) => parseFaceDescriptor(d) !== null);

  if (validMaster.length === 0) {
    return {
      isMatch: false,
      distance: null,
      similarityPercentage: null,
      reason: "Profil wajah belum terdaftar (belum enrollment)",
    };
  }

  if (validLive.length === 0) {
    return {
      isMatch: false,
      distance: null,
      similarityPercentage: null,
      reason: "Vektor wajah tidak valid",
    };
  }

  let bestResult: {
    isMatch: boolean;
    distance: number | null;
    similarityPercentage: number | null;
    reason?: string;
  } | null = null;

  for (const live of validLive) {
    for (const master of validMaster) {
      const result = verifyBiometricMatch(live, master, threshold);
      if (result.isMatch) {
        if (!bestResult || !bestResult.isMatch || (result.distance !== null && (bestResult.distance === null || result.distance < bestResult.distance))) {
          bestResult = result;
        }
      } else if (!bestResult || (!bestResult.isMatch && result.distance !== null && (bestResult.distance === null || result.distance < bestResult.distance))) {
        bestResult = result;
      }
    }
  }

  return bestResult ?? verifyBiometricMatch(validLive[0], validMaster[0], threshold);
}
