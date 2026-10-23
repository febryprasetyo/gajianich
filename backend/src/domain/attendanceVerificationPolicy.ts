export type ShiftCategory = 'OFFICE' | 'PRODUCTION';
export type AttendanceEventType = 'IN' | 'OUT';
export type AttendanceApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface AttendanceApprovalResult {
  requiresVerification: boolean;
  approvalStatus: AttendanceApprovalStatus;
  approvalNote: string;
}
export function determineShiftCategory(shift?: { code?: string; name?: string } | null): ShiftCategory {
  return /PROD|SHIFT|produksi|production/i.test(`${shift?.code || ''} ${shift?.name || ''}`) ? 'PRODUCTION' : 'OFFICE';
}
export function evaluateAttendanceApproval(
  shift: { autoApproveIn?: boolean; autoApproveOut?: boolean } | null,
  eventType: AttendanceEventType,
  _isWithinGeofence?: boolean,
): AttendanceApprovalResult {
  const automatic = (eventType === 'IN' ? shift?.autoApproveIn : shift?.autoApproveOut) === true;
  return {
    requiresVerification: !automatic,
    approvalStatus: automatic ? 'APPROVED' : 'PENDING',
    approvalNote: automatic ? 'Disetujui otomatis sesuai pengaturan shift.' : 'Menunggu pemeriksaan HRD.',
  };
}
