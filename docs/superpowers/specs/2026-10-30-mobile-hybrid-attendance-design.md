# Design Spec: Mobile Attendance Destination Group Fix & Hybrid Machine-Mobile Linking

## 1. Summary & Problem Statement
Users encountered two critical issues in attendance processing:
1. **Destination Group Error on Mobile Approval:**
   When HR or Admin attempts to approve a mobile attendance log from `/dashboard/attendance/approvals` (or face enrollment requests), the backend returns:
   `400 Bad Request: Choose a destination group`.
   This occurs because multi-tenant organization scoping requires a specific destination group for write operations (`requireOrganizationScope('hr', 'write')`). When an administrator is viewing "Semua Kelompok" (all groups) or has multiple groups assigned, `x-organization-group-id` is omitted from the request, causing `resolveRequestScope` to reject the write request.
2. **Hybrid Machine & Mobile Attendance Disconnect:**
   When an employee clocks IN on a physical biometric machine and clocks OUT via the mobile app (or vice versa: clocks IN on mobile and clocks OUT on machine), the system treats them as conflicting or isolated logs:
   - Clock IN on Machine -> Clock OUT on Mobile: The mobile app does not recognize machine check-in (`checkedIn: false`), blocks checkout with `Belum melakukan presensi masuk`, and HR approval throws `Konflik: Record absensi pada tanggal ini milik mesin/impor/manual dan tidak dapat ditimpa`.
   - Clock IN on Mobile -> Clock OUT on Machine: Machine attendance calculation treats the single afternoon machine punch as a new `scanIn` at 17:00, overwriting mobile `scanIn` (08:00) and recording the employee as 540 minutes late with no checkout.

## 2. Goals & Non-Goals

### Goals
- **Seamless Mobile Approval:** Administrators can approve or reject mobile attendance logs and face registration requests regardless of whether an active group is selected in the global switcher. The system automatically infers the target group from the log itself while strictly validating that the administrator has access permissions for that group.
- **Mutual Hybrid Connection (Machine + Mobile):**
  - **Machine IN + Mobile OUT:** Employee scans IN on physical machine, opens mobile app which reflects `CHECKED_IN`, submits mobile checkout (OUT), and upon approval it connects into a unified attendance record (`scanIn` from machine, `scanOut` from mobile) with accurate work hours and late/early calculations.
  - **Mobile IN + Machine OUT:** Employee clocks IN on mobile app, punches OUT on physical machine; machine attendance calculation (`calculateAttendanceHandler`) merges with mobile `scanIn`, setting machine punch as `scanOut` rather than overwriting `scanIn`.
- **Preserve Integrity & Multi-tenant Boundaries:** Group scoping, advisory locks, audit logs, and conflict checks for duplicate same-event punches remain 100% intact.

### Non-Goals
- Altering physical biometric device communication protocols or ZKTeco firmware commands.
- Allowing duplicate clock-in events (two different IN punches on the same day from different sources will still flag conflict or resolve earliest).

## 3. Data Model & Schema Impact
No new tables or schema migrations needed. The existing `attendance_records`, `attendance_self_logs`, and `attendance_device_raw_logs` tables already contain all necessary columns (`groupId`, `organizationId`, `scanIn`, `scanOut`, `rawScanIn`, `rawScanOut`, `attendanceStatus`, `lateMinutes`, `earlyMinutes`).

## 4. API & Service Specifications

### A. Organization Scope Resolution for Approvals
1. **Frontend (`MobileApprovalsPage.tsx` & `FaceApprovalsPage.tsx`):**
   - Include `headers: selected.groupId ? { 'X-Organization-Group-Id': String(selected.groupId) } : undefined`.
   - Include `groupId: selected.groupId` in request body.
2. **Middleware (`organizationScope.ts`):**
   - If `x-organization-group-id` header is missing, check `req.body?.groupId` (parsed via `parseGroupSelection`).
3. **Route Pre-handlers (`mobileAttendanceRoutes.ts` & `mobileApprovalRoutes.ts`):**
   - For `/verify`, if `x-organization-group-id` is missing and `req.body.logId` is provided, look up `attendanceSelfLogs.groupId` for `logId` and set header.
   - For `/face-requests/:id/review`, if `x-organization-group-id` is missing and `req.params.id` is provided, look up `attendanceFaceRequests.groupId` and set header.
   - Downstream `resolveRequestScope` still runs and verifies user has authorized access to that group.

### B. Hybrid Attendance Linking
1. **Mobile Summary (`getMobileTodaySummary`):**
   - Look up `attendanceRecords` for `(employee.id, workDate)`.
   - If `existingRecord?.scanIn` exists, treat employee as checked in:
     `checkedIn = Boolean(inLog || existingRecord?.scanIn)`
     `checkInTime = inLog?.scanTime || existingRecord?.scanIn || null`
     `checkedOut = Boolean(outLog || existingRecord?.scanOut)`
     `status = checkedOut ? 'COMPLETED' : checkedIn ? 'CHECKED_IN' : 'NOT_CHECKED_IN'`
2. **Mobile Clock Action (`recordMobileClock`):**
   - When `payload.eventType === 'OUT'`, allow clocking out if `entry` exists OR `existingRecord?.scanIn` exists.
   - If checking out against `existingRecord.scanIn`, evaluate checkout cooldown against `existingRecord.scanIn`.
3. **Approval Projection (`projectApprovedLog`):**
   - When projecting approved mobile log:
     - If `log.eventType === 'OUT'`, do NOT throw conflict when `storedRecord.scanIn` exists.
     - Connect: `scanIn = inLog?.scanTime || storedRecord?.scanIn || null`.
     - `rawScanIn = inLog?.scanTime || storedRecord?.rawScanIn || storedRecord?.scanIn || null`.
     - `scanOut = outLog?.scanTime || storedRecord?.scanOut || null`.
     - Recompute `lateMinutes`, `earlyMinutes`, `overtimeMinutes` using combined scans.
4. **Machine Attendance Calculation (`calculateAttendanceHandler`):**
   - When saving/upserting machine calculation results to `attendanceRecords`:
     - If `previous` `attendanceRecord` already exists:
       - If `previous.scanIn` exists (e.g. from mobile) and machine has afternoon punch `rec.scanIn` (with `rec.scanOut == null`):
         - Set `finalScanIn = previous.scanIn`.
         - Set `finalScanOut = rec.scanIn`.
       - If both have scans, resolve earliest `scanIn` and latest `scanOut`.
       - Recalculate late and early minutes using combined scans.

## 5. Security & Verification
- Strict verification that user cannot approve logs outside their permitted `groupIds`.
- Automated tests covering:
  - Mobile approval with `selectedGroupId === null` (all groups view).
  - Machine IN + Mobile OUT approval flow.
  - Mobile IN + Machine OUT calculation flow.
  - Preserving duplicate IN rejection.

