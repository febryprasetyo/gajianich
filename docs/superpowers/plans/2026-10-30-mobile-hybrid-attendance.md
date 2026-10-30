# Implementation Plan: Mobile Attendance Destination Group & Hybrid Machine-Mobile Linking

## Overview
This plan implements the multi-tenant destination group resolution for mobile attendance and face request approvals, along with two-way hybrid attendance linking between physical biometric devices and the mobile app.

---

## Phase 1: Destination Group Error Fix on Mobile Approval
- [ ] Task 1.1: Enhance `backend/src/middleware/organizationScope.ts` to inspect `req.body.groupId` when `X-Organization-Group-Id` header is omitted.
- [ ] Task 1.2: Add pre-middleware resolution in `backend/src/routes/mobileAttendanceRoutes.ts` (`/verify`) and `backend/src/routes/mobileApprovalRoutes.ts` (`/face-requests/:id/review`) to infer target `groupId` from database entity when header is not supplied.
- [ ] Task 1.3: Update `frontend/src/components/attendance/MobileApprovalsPage.tsx` and `FaceApprovalsPage.tsx` to explicitly supply `selected.groupId` in request header and body.
- [ ] Task 1.4: Add automated integration test verifying that an admin with access to multiple groups can approve mobile attendance when `selectedGroupId` is omitted.

---

## Phase 2: Hybrid Attendance Linking - Machine IN + Mobile OUT
- [ ] Task 2.1: Update `getMobileTodaySummary` in `backend/src/services/mobileAttendanceService.ts` to inspect `attendanceRecords` for today's `scanIn` from physical machine, presenting `CHECKED_IN` status to the employee.
- [ ] Task 2.2: Update `recordMobileClock` in `backend/src/services/mobileAttendanceService.ts` to allow `OUT` clocking when `existingRecord.scanIn` is present even if no mobile `IN` log exists.
- [ ] Task 2.3: Update `projectApprovedLog` in `backend/src/services/mobileAttendanceService.ts` to merge mobile `OUT` with machine `scanIn` on `storedRecord` rather than rejecting with conflict error.
- [ ] Task 2.4: Add unit and integration tests verifying Machine IN + Mobile OUT hybrid linking.

---

## Phase 3: Hybrid Attendance Linking - Mobile IN + Machine OUT
- [ ] Task 3.1: Update `calculateAttendanceHandler` in `backend/src/controllers/attendanceDeviceController.ts` when merging with `previous` `attendanceRecords`:
  - When `previous.scanIn` exists and machine has a single later punch, preserve `previous.scanIn` as `scanIn` and assign machine punch to `scanOut`.
  - Recalculate late and early minutes accurately based on the merged scans.
- [ ] Task 3.2: Ensure `projectApprovedLog` also retains existing machine `storedRecord.scanOut` if mobile `IN` is approved after machine calculation has run.
- [ ] Task 3.3: Add unit and integration tests verifying Mobile IN + Machine OUT hybrid linking.

---

## Phase 4: Verification Loop & Quality Assurance
- [ ] Task 4.1: Run targeted unit and integration tests (`mobileAttendanceService.test.ts`, `attendanceCalculationService.test.ts`, `mobileApprovals.integration.test.ts`).
- [ ] Task 4.2: Run TypeScript compiler check (`npx tsc --noEmit` in backend and frontend).
- [ ] Task 4.3: Git commit with conventional commit message per SDD standard.
