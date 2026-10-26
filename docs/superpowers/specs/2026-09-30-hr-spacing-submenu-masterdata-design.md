# Design Specification: HR Layout Spacing, Search Input Fix, & Sub-Menu Categorization

**Date:** 2026-09-30  
**Status:** Approved  
**Author:** Pair Programming Agent  

---

## 1. Summary & Problem Statement

Users identified three user-experience and access issues in the HR and Navigation module:
1. **Component Spacing & Search Input Placeholder Collision**:
   - Across HR pages (`/dashboard/attendance/*`), components lack consistent visual rhythm (`space-y-5` with cramped toolbars, tight date/status controls).
   - In `SearchInput`, `.hr-input` specifies `padding: 8px 12px;` which collides with the search icon (placed at `left: 12px` / 0.75rem), causing input placeholder text and typed text to overlap directly on top of the search icon.
2. **Top-Level Master Data Menu Leaking to HR Role**:
   - Users with the `HR Attendance & Time` role (`hr_attendance`) see the top-level "Master Data" menu group (IT departments, equipment types, vendors, employees, asset custodians) because `'master.view'` was included in `DEFAULT_ROLE_PERMISSIONS.hr_attendance` and assigned in the database.
   - The top-level Master Data belongs to IT/Asset Management and must be completely hidden and inaccessible to `HR Attendance & Time`.
3. **Flat HR Menu Lacking Sub-Menu Structure**:
   - In `DashboardLayout`, all HR items (operational attendance pages and HR master data pages) are dumped flat into a single list of 10 items.
   - Users need categorized sub-menus separating **Attendance Operations** and **HR Master Data** within the HR menu.

---

## 2. Goals & Non-Goals

### Goals
- **Fix Search Input**: Ensure search icon is vertically centered and search text has comfortable left padding (`42px` / `2.625rem`) so text never overlaps with the icon.
- **Harmonize Spacing**: Standardize component spacing to `space-y-6`, with clear `gap-3` / `gap-4` in action bars, properly sized date/select inputs, and clean breathing room between headers, filter panels, metrics, tables, and pagination.
- **Revoke IT Master Data for HR**:
  - Remove `'master.view'` from `hr_attendance` in `backend/src/domain/rbac.ts` and revoke it in PostgreSQL for `role_id = 9`.
  - In `DashboardLayout.tsx`, ensure `visibleNavGroups` hides the top-level "Master Data" group for HR roles.
- **Create Categorized HR Sub-Menus**:
  - Enhance `NavItem` in `DashboardLayout.tsx` to support expandable/collapsible sub-menu categories with `children`.
  - Group HR items into:
    1. **Attendance (Operasional Kehadiran)**: Data Absensi, Impor Absensi, Kartu Absensi, Laporan Absensi, Aktivitas Absensi.
    2. **Master Data (Master Data HR)**: Karyawan Absensi, Departemen Absensi, Lokasi Absensi, Pemetaan Identitas, Akses Absensi.
  - Automatically expand the active sub-menu on navigation while allowing smooth toggle.

### Non-Goals
- Altering the backend business logic or endpoints of attendance calculation.
- Changing IT Admin or SuperAdmin access to IT Master Data (`/dashboard/master/*`).

---

## 3. Architecture & UI/UX Design

### 3.1 Search Input & Spacing (Item 1)
- In `attendance.css`:
  - Add `.hr-search-input, .hr-input.hr-search-input { padding-left: 2.625rem !important; }`
  - Enhance `.hr-input` with smooth focus transitions (`focus:ring-2 ring-red-500/20`).
- In `shared.tsx`:
  - Center search icon vertically using `absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400`.
  - Add `.hr-search-input !pl-10` to `<input>`.
  - Update `Heading` with subtle bottom border (`border-b border-slate-200/70 pb-3`) and clean typography.
- In `AttendanceDataPage`, `AttendanceReportsPage`, `AttendanceImportsPage`, `AttendanceDirectoryPage`, `AttendanceActivityPage`:
  - Update outer spacing to `space-y-6`.
  - Structure filter toolbars with explicit container widths (`w-44` for date inputs, `w-72` for search).

### 3.2 Role Permission Adjustment (Item 2)
- Update `backend/src/domain/rbac.ts`:
  ```ts
  hr_attendance: [
    'attendance.view',
    'attendance.import',
    'attendance.manage',
  ],
  ```
- PostgreSQL: Remove `master.view` from `role_permissions` where `role_id = 9`.
- In `DashboardLayout.tsx`:
  Explicitly filter out the top-level `"Master Data"` nav group if the user is in an HR role (`isHrRole`).

### 3.3 Sub-Menu Structure (Item 3)
```ts
interface NavSubItem {
  name: string;
  href: string;
  icon?: React.ElementType;
  permission?: string;
  badge?: string;
}

interface NavItem {
  name: string;
  href?: string;
  icon: React.ElementType;
  permission?: string;
  badge?: string;
  disabled?: boolean;
  adminOnly?: boolean;
  children?: NavSubItem[];
}
```
- In `DashboardLayout.tsx`:
  When `item.children` exists:
  - Auto-open submenu if any child matches `pathname`.
  - Click on parent toggles open/close state.
  - Render children with an elegant indented vertical timeline guide (`border-l border-slate-200 ml-4 pl-3 space-y-1`).
  - Active child receives red accent highlight (`bg-red-50 text-red-600 font-bold`).

---

## 4. Verification Plan
- `npm --prefix frontend test`: All route and attendance unit tests must pass.
- `npm --prefix backend test`: All RBAC and domain tests must pass.
- Visual and role verification:
  - Login as `regina@mail.com` (`HR Attendance & Time`):
    - Top-level "Master Data" is NOT visible in the sidebar.
    - HR menu has two categorized sub-menus: "Attendance" and "Master Data".
    - Search inputs have no text/icon overlap.
    - Component spacing is generous, clean, and balanced.
