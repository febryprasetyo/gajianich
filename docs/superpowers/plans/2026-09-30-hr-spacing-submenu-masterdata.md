# Implementation Plan: HR Layout Spacing, Search Input Fix, & Sub-Menu Categorization

**Spec:** `docs/superpowers/specs/2026-09-30-hr-spacing-submenu-masterdata-design.md`  
**Date:** 2026-09-30  
**Status:** Completed  

---

## Phase 1: Search Input Overlap Fix & Spacing Refactor
- [x] Task 1.1: Fix `SearchInput` in `frontend/src/components/attendance/shared.tsx` with centered icon and `!pl-10`.
- [x] Task 1.2: Add `.hr-search-input` rule in `frontend/src/components/attendance/attendance.css` with `padding-left: 2.625rem !important;`.
- [x] Task 1.3: Update component margins and spacing across `AttendanceWorkspace.tsx`, `AttendanceDataPage.tsx`, `AttendanceDirectoryPage.tsx`, `AttendanceImportsPage.tsx`, `AttendanceReportsPage.tsx`, `AttendanceActivityPage.tsx`.

## Phase 2: Role Permission & IT Master Data Removal for HR
- [x] Task 2.1: Update `backend/src/domain/rbac.ts` removing `'master.view'` from `hr_attendance`.
- [x] Task 2.2: Delete `master.view` permission for `role_id = 9` in PostgreSQL database.
- [x] Task 2.3: In `frontend/src/components/layout/DashboardLayout.tsx`, filter out top-level "Master Data" nav group for HR roles.
- [x] Task 2.4: Update `frontend/src/lib/access/routes.test.mjs` to reflect that HR role does not access `/dashboard/master/*`.

## Phase 3: Categorized HR Sub-Menus in DashboardLayout
- [x] Task 3.1: Support `children` in `NavItem` in `DashboardLayout.tsx`.
- [x] Task 3.2: Reorganize HR items into "Attendance" and "Master Data" categories with collapsible accordion behavior.
- [x] Task 3.3: Verify breadcrumbs and active state routing for sub-menu items.

## Phase 4: Automated Verification & Manual Sanity Check
- [x] Task 4.1: Run `npm --prefix frontend test` (49/49 passing).
- [x] Task 4.2: Run `npm --prefix backend test` (98/98 passing).
- [x] Task 4.3: Validate token & UI for `regina@mail.com` (verified 403 on `/api/v1/master/departments`, 307 redirect on `/dashboard/master/departments`, 200 OK on HR routes).
