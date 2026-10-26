# Delete Action Confirmation Modal Design

## Summary

Currently, several dashboard management pages in AMS Portal use native browser dialogs (`window.confirm(...)` and `window.alert(...)`) for destructive actions like deleting or deactivating records. These browser dialogs are visually jarring, block the browser thread, offer no item preview context or loading indicators, and degrade the user experience.

This design introduces a reusable, polished, accessible, and high-fidelity confirmation modal component (`ConfirmDeleteModal`) styled consistently with the AMS design system (Tailwind CSS, Plus Jakarta Sans, glassmorphism, responsive mobile-friendly layouts, inline loading spinner, and in-modal error banners) and replaces all native `confirm`/`alert` calls across all pages.

## Goals

- Eliminate all native `window.confirm` and `window.alert` calls used for delete and status modification actions across all pages.
- Provide a unified, reusable `ConfirmDeleteModal` component in `frontend/src/components/ui/ConfirmDeleteModal.tsx`.
- Support destructive ('danger') and non-destructive ('warning' / 'primary') confirmations with customizable titles, descriptions, item name/detail badges, button texts, and loading states.
- Render in-modal error banners when deletion API calls fail, rather than triggering native alerts.
- Ensure keyboard accessibility (ESC key to dismiss), backdrop click to cancel, and disabled controls during active API submissions.
- Maintain full type safety, zero linter regressions, and clean test verification.

## Non-goals

- Altering backend deletion endpoints, permissions, cascade behaviors, or database models.
- Overhauling form inputs or edit modal workflows unrelated to delete/confirmation actions.

## Impacted Pages & Actions

1. **Master Equipment Types (`/dashboard/master/equipment-types`)**:
   - Delete equipment type: Replace `window.confirm` and `window.alert` with `ConfirmDeleteModal`.
2. **Master Vendors (`/dashboard/master/vendors`)**:
   - Delete vendor: Replace `window.confirm` and `alert` with `ConfirmDeleteModal`.
3. **Master Departments (`/dashboard/master/departments`)**:
   - Delete department: Replace `window.confirm` and `alert` with `ConfirmDeleteModal`.
4. **Master Employees (`/dashboard/master/employees`)**:
   - Deactivate/Delete employee: Replace `window.confirm` and `alert` with `ConfirmDeleteModal`.
5. **Master Locations (`/dashboard/master/locations`)**:
   - Delete location: Replace `window.confirm` and `alert` with `ConfirmDeleteModal`.
6. **Master Asset Custodians (`/dashboard/master/asset-custodians`)**:
   - Deactivate / Reactivate custodian: Replace `window.confirm` with `ConfirmDeleteModal` (variant warning/danger).
7. **Hardware Audits (`/dashboard/hardware-audits`)**:
   - Single audit deletion: Replace `confirm(...)` with `ConfirmDeleteModal`.
   - Clear all synced audits: Replace `confirm(...)` with `ConfirmDeleteModal`.
8. **Software Licenses (`/dashboard/licenses`)**:
   - Delete license: Standardize inline modal & error handling with `ConfirmDeleteModal`.
9. **Software License Details (`/dashboard/licenses/[id]`)**:
   - Delete license: Standardize inline modal & error handling with `ConfirmDeleteModal`.
10. **Assets (`/dashboard/assets`)**:
    - Delete asset: Ensure consistency with the shared `ConfirmDeleteModal`.

## Component Specification: `ConfirmDeleteModal`

### Props Interface

```typescript
export interface ConfirmDetailItem {
  label: string;
  value: React.ReactNode;
}

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  itemName?: string;
  itemDetails?: ConfirmDetailItem[];
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  error?: string | null;
}
```

### Visual & UX Characteristics

- **Overlay**: `fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4` with fade-in animation.
- **Card**: `bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4`.
- **Header Icon**:
  - Danger: Circular soft-red badge (`bg-rose-50 text-rose-600`) with `Trash2` icon.
  - Warning: Circular soft-amber badge (`bg-amber-50 text-amber-600`) with `AlertTriangle` icon.
- **Item Preview**: If `itemName` or `itemDetails` are supplied, an item summary card is displayed (`bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs`).
- **Error Banner**: If `error` is provided, an in-modal alert (`bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs`) displays the failure message.
- **Actions**:
  - Cancel button: secondary neutral slate (`bg-slate-100 hover:bg-slate-200 text-slate-700`).
  - Confirm button: primary destructive red (`bg-rose-600 hover:bg-rose-700 text-white`) or warning amber (`bg-amber-600 hover:bg-amber-700 text-white`) with loading spinner (`Loader2`) when `isLoading` is active.
- **Keyboard & Click Interaction**:
  - Pressing `Escape` invokes `onClose` when not loading.
  - Clicking outside the modal container invokes `onClose` when not loading.

## Verification & Quality Standards

- **Type Safety**: Fully typed TypeScript props and zero lint errors.
- **Unit Testing**: Unit test suite for modal configuration and helper behavior.
- **Build Verification**: Complete `npm run build` passing without errors.
