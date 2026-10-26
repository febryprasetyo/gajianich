# Delete Action Confirmation Modal Implementation Plan

## Overview

Replace all native browser `window.confirm` and `window.alert` dialogs across the dashboard with a reusable, highly styled, and accessible confirmation modal component (`ConfirmDeleteModal`).

## Proposed Changes

### 1. UI Component Layer
- **`frontend/src/components/ui/ConfirmDeleteModal.tsx`**:
  - Implement reusable `ConfirmDeleteModal` with support for `danger` and `warning` variants.
  - Include backdrop blur, animated transitions, icon badge (`Trash2` / `AlertTriangle`), loading spinner (`Loader2`), in-modal error display, and keyboard accessibility.

### 2. Page Integrations
- **Master Data Pages**:
  - `frontend/src/app/dashboard/master/equipment-types/page.tsx`:
    - Add delete confirmation state (`deletingEquipmentType`, `isDeleting`, `deleteError`).
    - Replace `window.confirm` and `window.alert` with `ConfirmDeleteModal`.
  - `frontend/src/app/dashboard/master/vendors/page.tsx`:
    - Add delete confirmation state (`deletingVendor`, `isDeleting`, `deleteError`).
    - Replace `window.confirm` and `alert` with `ConfirmDeleteModal`.
  - `frontend/src/app/dashboard/master/departments/page.tsx`:
    - Add delete confirmation state (`deletingDept`, `isDeleting`, `deleteError`).
    - Replace `window.confirm` and `alert` with `ConfirmDeleteModal`.
  - `frontend/src/app/dashboard/master/employees/page.tsx`:
    - Add delete confirmation state (`deletingEmployee`, `isDeleting`, `deleteError`).
    - Replace `window.confirm` and `alert` with `ConfirmDeleteModal`.
  - `frontend/src/app/dashboard/master/locations/page.tsx`:
    - Add delete confirmation state (`deletingLocation`, `isDeleting`, `deleteError`).
    - Replace `window.confirm` and `alert` with `ConfirmDeleteModal`.
  - `frontend/src/app/dashboard/master/asset-custodians/page.tsx`:
    - Add status confirmation state (`confirmingCustodian`, `isSubmittingStatus`, `statusError`).
    - Replace `window.confirm` for deactivate/reactivate with `ConfirmDeleteModal`.

- **Audit & License Pages**:
  - `frontend/src/app/dashboard/hardware-audits/page.tsx`:
    - Replace `confirm(...)` for single audit deletion and clear-synced deletion with `ConfirmDeleteModal`.
  - `frontend/src/app/dashboard/licenses/page.tsx`:
    - Adopt `ConfirmDeleteModal` for license deletion, replacing alert on failure with in-modal error.
  - `frontend/src/app/dashboard/licenses/[id]/page.tsx`:
    - Adopt `ConfirmDeleteModal` for license deletion, replacing alert on failure with in-modal error.
  - `frontend/src/app/dashboard/assets/page.tsx`:
    - Adopt `ConfirmDeleteModal` for consistent deletion UX and code reduction.

### 3. Verification & Testing
- Unit tests: Add unit test in `frontend/src/lib/confirmModal.test.mjs` verifying configuration and callbacks.
- Run `npm --prefix frontend test`.
- Run `npm --prefix frontend run lint`.
- Run `npm --prefix frontend run build`.
