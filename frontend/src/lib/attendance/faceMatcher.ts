/**
 * Client-Side Lightweight Biometric Face Matcher & Liveness Verifier
 * Pure TypeScript, zero heavy dependencies, < 2ms calculation time.
 */

export const DEFAULT_FACE_MATCH_THRESHOLD = 0.45;

export interface BiometricMatchResult {
  isMatch: boolean;
  distance: number;
  similarity: number;
  status: "MATCH" | "MISMATCH" | "UNENROLLED" | "INVALID";
  message: string;
}

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
  const score = Math.max(0, Math.min(100, (1 - distance * 0.35) * 100));
  return Math.round(score * 10) / 10;
}

export function verifyFaceMatch(
  liveDescriptor: unknown,
  masterDescriptor: unknown,
  threshold = DEFAULT_FACE_MATCH_THRESHOLD
): BiometricMatchResult {
  const vLive = parseFaceDescriptor(liveDescriptor);
  const vMaster = parseFaceDescriptor(masterDescriptor);

  if (!vMaster) {
    return {
      isMatch: false,
      distance: 1.0,
      similarity: 0,
      status: "UNENROLLED",
      message: "Profil wajah belum didaftarkan di sistem.",
    };
  }

  if (!vLive) {
    return {
      isMatch: false,
      distance: 1.0,
      similarity: 0,
      status: "INVALID",
      message: "Wajah belum terdeteksi dengan jelas.",
    };
  }

  if (vLive.length !== vMaster.length) {
    return {
      isMatch: false,
      distance: 1.0,
      similarity: 0,
      status: "INVALID",
      message: "Format dimensi biometrik tidak sesuai.",
    };
  }

  const dist = euclideanDistance(vLive, vMaster);
  const similarity = calculateFaceSimilarity(dist);
  const isMatch = dist <= threshold;

  return {
    isMatch,
    distance: Math.round(dist * 1000) / 1000,
    similarity,
    status: isMatch ? "MATCH" : "MISMATCH",
    message: isMatch
      ? `Wajah terverifikasi cocok (${similarity}%)`
      : `Wajah tidak cocok dengan profil karyawan (${similarity}%)`,
  };
}

/**
 * Eye Aspect Ratio (EAR) calculation for passive blink / liveness detection.
 * EAR drops sharply below ~0.2 when eyes close (blink).
 */
export function calculateEyeAspectRatio(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
  p5: { x: number; y: number },
  p6: { x: number; y: number }
): number {
  // Vertical distances
  const d1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const d2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  // Horizontal distance
  const dHorizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y);

  if (dHorizontal === 0) return 0;
  return (d1 + d2) / (2.0 * dHorizontal);
}

export function isBlinkDetected(ear: number, threshold = 0.22): boolean {
  return ear < threshold;
}
