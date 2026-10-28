# Asset Detail View Edit Action Design

## Summary

Currently, updating an asset in GAJIANICH can only be initiated from the main asset catalog list table (`/dashboard/assets`). When an administrator or technician views an individual asset's detail page (`/dashboard/assets/[id]`), the header offers actions for "Print Asset Tag QR", "Log Maintenance", and "Dispose Asset", but lacks an "Edit Asset" action. If any detail needs to be updated (e.g., serial number, brand/model name, condition, location, notes, processor/RAM/disk hardware specifications, or attached accessories), the user is forced to return to the catalog table, locate the item again, and click the edit icon.

This design introduces a seamless "Edit Asset" action inside the Asset Detail View (`/dashboard/assets/[id]`), backed by a shared and reusable `AssetFormModal` component (`frontend/src/components/assets/AssetFormModal.tsx`). Upon saving changes, the asset detail view refreshes in place, updating all specification cards, custodian info, and audit history logs without navigating away.

## Goals

- Add an accessible, role-guarded (`canManageAssets`) "Edit Asset" button to the header of the Asset Detail page (`/dashboard/assets/[id]`).
- Extract and standardize the asset form and modal logic into a reusable `AssetFormModal` component in `frontend/src/components/assets/AssetFormModal.tsx`.
- Support full editing capabilities in the detail view:
  - Equipment category, asset tag code, name/model, serial number, condition, location, custodian (via `CustodianPicker`), and general notes.
  - Computer hardware specifications (CPU, RAM size, RAM slots, primary disk, secondary disk).
  - Attached accessories list (add, remove, edit type, description, quantity, condition).
- Immediately refresh asset detail information and audit logs upon successful update (`fetchAssetData()`).
- Maintain consistent styling adhering to the GAJIANICH design system (glassmorphism, Tailwind CSS, responsive mobile-friendly layout, modal backdrop, inline loading spinner, in-modal error banners).
- Reuse `AssetFormModal` across both `/dashboard/assets` (list) and `/dashboard/assets/[id]` (detail) to eliminate code duplication.
- Ensure full type safety, zero linter warnings/errors, and complete test suite passes.

## Non-goals

- Altering backend API endpoints (`PUT /api/assets/:id` already provides full update capabilities).
- Altering the asset lifecycle disposal flow or maintenance log flow (which remain dedicated modals).

## Architecture & Component Design

### 1. Reusable `AssetFormModal` (`frontend/src/components/assets/AssetFormModal.tsx`)
A unified modal component handling both asset creation and asset editing:
- **Props**:
  - `isOpen: boolean`: Controls modal visibility.
  - `onClose: () => void`: Handler to dismiss modal.
  - `asset?: AssetItem | AssetDetail | null`: If provided, the modal operates in "Edit Asset Record" mode pre-populated with the asset's current data. If omitted or null, it operates in "Register New Hardware Inventory" mode with blank defaults.
  - `categories?: CategoryItem[]`: Optional list of equipment categories; auto-fetches from `/assets/categories` if not supplied.
  - `locations?: LocationItem[]`: Optional list of facility locations; auto-fetches from `/master/locations` if not supplied.
  - `canManage?: boolean`: Permission flag passed to `CustodianPicker` for manual custodian creation.
  - `onSuccess: (updatedOrCreatedAsset?: any) => void`: Callback triggered after successful PUT/POST request.
- **Internal Form State**:
  - Encapsulates form values (`name`, `categoryId`, `assetCode`, `serialNumber`, `locationId`, `custodian`, `condition`, `notes`, `cpuName`, `ramSizeGb`, `ramSlotCount`, `disk1SizeGb`, `disk2SizeGb`, `accessories`).
  - Automatically derives `isComputerType` when category changes.
  - Validates using `canSubmitAssetForm` from `@/lib/assetForm`.
  - Submits payload using `buildCustodianSelectionPayload` and `buildComputerSpecsPayload`.

### 2. Integration in Asset Detail View (`frontend/src/app/dashboard/assets/[id]/page.tsx`)
- Import `useAuth` and `canManageAssets` to determine edit authorization.
- Import `Edit` icon from `lucide-react`.
- Add `isEditModalOpen` state.
- Render "Edit Asset" action button in the header next to "Print Asset Tag QR" and "Log Maintenance".
- Render `<AssetFormModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} asset={asset} canManage={canManage} onSuccess={fetchAssetData} />`.
- When updated, `fetchAssetData` refetches the asset from `/assets/:id` and updates the page state seamlessly.

### 3. Integration in Asset List View (`frontend/src/app/dashboard/assets/page.tsx`)
- Replace the inline modal JSX (lines 983–1320) and duplicate form states with `<AssetFormModal ... />`, passing `editingAsset` and reusing cached `categories` and `locations`.

## Security & Access Control
- Edit action button is visible only if `canManageAssets(user?.roleName)` is true (Superadmin, IT Admin).
- Backend enforces role authorization via `requireRole(['Superadmin', 'ITAdmin'])` on `PUT /api/assets/:id`.

## Verification Plan
1. Automated Tests:
   - Run `npm test --prefix frontend` (including unit tests).
   - Run `npm test --prefix backend`.
2. Static Analysis & Build:
   - Run `npm run lint --prefix frontend`.
   - Run `npm run build --prefix frontend`.
3. Functional Verification:
   - Verify "Edit Asset" button appears on `/dashboard/assets/[id]` for authorized users.
   - Verify modal opens with pre-populated values matching the asset.
   - Verify saving updates values in-place and triggers data refresh.
