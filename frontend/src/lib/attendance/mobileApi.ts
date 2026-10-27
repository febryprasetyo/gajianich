import { apiFetch } from "@/lib/api";

export interface MobileEmployeeProfile {
  photoUrl?: string | null;
  id: number;
  employeeCode: string;
  fullName: string;
  position: string;
  department: string;
  workLocation: string;
  avatarInitial: string;
}

export interface MobileShiftInfo {
  id: number;
  code: string;
  name: string;
  category: "OFFICE" | "PRODUCTION";
  scheduleIn: string;
  scheduleOut: string;
  officeLatitude: number;
  officeLongitude: number;
  geofenceRadiusMeters: number;
}

export interface MobileTodayAttendance {
  timeZone: string;
  timeZoneLabel: string;
  events: MobileAttendanceEvent[];
  workDate: string;
  checkedIn: boolean;
  checkedOut: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalHours: string;
  status: "NOT_CHECKED_IN" | "CHECKED_IN" | "COMPLETED";
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  approvalNote: string;
  txHash: string | null;
  isLateAfternoon?: boolean;
  strictClock?: boolean;
  isCheckoutCooldown?: boolean;
  cooldownRemainingMinutes?: number;
  checkInOccurredAt?: string | null;
  shiftWindow?: {
    scheduleIn: string;
    scheduleOut: string;
    canDirectOut: boolean;
  };
}

export interface MobileFaceEnrollment {
  changeStatus?: string | null;
  changeNote?: string | null;
  isFaceEnrolled: boolean;
  faceId: string | null;
}

export interface MobileSummaryData {
  employee: MobileEmployeeProfile;
  shift: MobileShiftInfo;
  attendance: MobileTodayAttendance;
  faceEnrollment: MobileFaceEnrollment;
}

export interface MobileClockRequest {
  eventType: "IN" | "OUT";
  isDirectOut?: boolean;
  workDate?: string;
  scanTime?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  address?: string | null;
  photoBase64?: string | null;
  deviceInfo?: string | null;
  notes?: string | null;
  txHash?: string;
}

export interface MobileClockResponse {
  success: boolean;
  message: string;
  data: {
    timeZoneLabel: string;
    txHash: string;
    eventType: "IN" | "OUT";
    scanTime: string;
    workDate: string;
    isWithinGeofence: boolean;
    distanceMeters: number | null;
    status: "CHECKED_IN" | "COMPLETED";
    approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
    approvalNote: string;
    mapUrl: string | null;
    googleMapsUrl: string | null;
  };
}

export interface MobileHistoryItem {
  events: MobileAttendanceEvent[];
  id: number;
  workDate: string;
  dayShort: string;
  dateStr: string;
  clockIn: string;
  clockOut: string;
  workHours: string;
  status: string;
  statusText: string;
  isAbsent: boolean;
  approvalStatus?: string;
  approvalNote: string;
  serverRef: string;
  mapUrl: string | null;
  googleMapsUrl: string | null;
  address: string | null;
  schedule: string;
  employeeName: string;
  photoUrl: string | null;
}

export interface MobileHistoryData {
  period: "CURRENT" | "PREVIOUS";
  monthName: string;
  records: MobileHistoryItem[];
}

export async function fetchMobileSummary(): Promise<MobileSummaryData> {
  const res = await apiFetch<{ success: boolean; data: MobileSummaryData }>("/attendance/mobile/summary");
  return res.data;
}

export async function postMobileClock(payload: MobileClockRequest): Promise<MobileClockResponse> {
  return await apiFetch<MobileClockResponse>("/attendance/mobile/clock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMobileHistory(period: "CURRENT" | "PREVIOUS" = "CURRENT"): Promise<MobileHistoryData> {
  const res = await apiFetch<{ success: boolean; data: MobileHistoryData }>(
    `/attendance/mobile/history?period=${period}`
  );
  return res.data;
}


export interface FaceProfileData {
  employeeId: number;
  employeeName: string;
  isEnrolled: boolean;
  faceDescriptor: string | null;
  samplePhotoUrl: string | null;
  enrolledAt: string | null;
}

export async function fetchFaceProfile(): Promise<FaceProfileData> {
  const res = await apiFetch<{ success: boolean; data: FaceProfileData }>("/attendance/mobile/face-profile");
  return res.data;
}

export async function postEnrollFace(payload: {
  faceDescriptor?: unknown;
  isEnrolled?: boolean;
  faceDescriptorHash?: string;
  samplePhotoBase64?: string;
}): Promise<{ success: boolean; message: string; isEnrolled: boolean }> {
  return await apiFetch<{ success: boolean; message: string; isEnrolled: boolean }>(
    "/attendance/mobile/enroll-face",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export interface MobileAttendanceEvent {
  id: number;
  eventType: 'IN' | 'OUT';
  scanTime: string;
  scanDate: string;
  timeZoneLabel: string;
  approvalStatus: string;
  approvalNote: string | null;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  photoUrl: string | null;
  notes?: string | null;
  reviewHistory: { status: string; note: string; actorId: number; at: string }[];
}
