# Asset Detail View Edit Action Implementation Plan

## Overview
Implement an in-place "Edit Asset" action in the Asset Detail View (`/dashboard/assets/[id]`) by creating a unified, reusable `AssetFormModal` component that supports both asset creation and editing, and wiring it into both the detail view and catalog list view.

## Proposed Changes

### 1. Reusable Component Layer
- **`frontend/src/components/assets/AssetFormModal.tsx`**:
  - Extract and encapsulate the Create/Edit Asset modal dialog.
  - Support pre-population from `AssetDetail` or `AssetItem`.
  - Provide fallback auto-fetching for categories and locations when not supplied by parent.
  - Integrate `CustodianPicker` with role-aware `allowManual={canManage}`.
  - Implement full computer specifications (CPU, RAM, Disks) and accessories sub-forms for computer equipment types.
  - Implement validation (`canSubmitAssetForm`) and formatted payload creation.
  - Provide inline error alerts and loading spinners during asynchronous submission.

### 2. Asset Detail Page
- **`frontend/src/app/dashboard/assets/[id]/page.tsx`**:
  - Import `useAuth` from `@/context/AuthContext` and `canManageAssets` from `@/lib/rbac`.
  - Import `Edit` icon from `lucide-react`.
  - Add `isEditModalOpen` state.
  - Add "Edit Asset" button in the header action buttons row (guarded by `canManage`).
  - Render `<AssetFormModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} asset={asset} canManage={canManage} onSuccess={fetchAssetData} />`.

### 3. Asset Catalog List Page (Refactoring)
- **`frontend/src/app/dashboard/assets/page.tsx`**:
  - Replace inline modal JSX and local form states with `<AssetFormModal ... />`.
  - Ensure zero regression in the existing asset creation and editing flows.

### 4. Verification & Testing
- Unit tests: verify helper functions and modal behavior.
- Run `npm test --prefix frontend`.
- Run `npm run lint --prefix frontend`.
- Run `npm run build --prefix frontend`.
- Commit changes using conventional commit following the project Git workflow.
