# Implementation Plan: AMS Master Desain Standar Global

- **Spec**: `docs/superpowers/specs/2026-10-27-master-design-standard-design.md`
- **Date**: 2026-10-27
- **Status**: Completed

---

## 1. Shared Interfaces & Component Definitions

### `PageHeaderProps` (`frontend/src/components/ui/PageHeader.tsx`)
```ts
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
}
```

### `KpiCardItem` & `KpiGridProps` (`frontend/src/components/ui/KpiGrid.tsx`)
```ts
export interface KpiCardItem<T extends string = string> {
  id: T;
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  bgColor?: string;
  helper?: string;
}

export interface KpiGridProps<T extends string = string> {
  items: KpiCardItem<T>[];
  loading?: boolean;
  activeFilter?: T | null;
  onSelectFilter?: (id: T) => void;
  skeletonCount?: number;
}
```

### `FilterToolbarProps` (`frontend/src/components/ui/FilterToolbar.tsx`)
```ts
export interface FilterToolbarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  scopeOptions?: Array<{ label: string; value: string; activeColor?: string }>;
  activeScope?: string;
  onScopeChange?: (val: string) => void;
  dropdownFilters?: React.ReactNode;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
}
```

### `TableShellProps` (`frontend/src/components/ui/TableShell.tsx`)
```ts
export interface TableShellProps {
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}
```

### `TablePaginationProps` (`frontend/src/components/ui/TablePagination.tsx`)
```ts
export interface TablePaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (newPage: number) => void;
  itemName?: string; // e.g. "tiket", "aset", "karyawan"
}
```

### `RowActionButtonProps` (`frontend/src/components/ui/RowActionButton.tsx`)
```ts
export interface RowActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "emerald" | "amber" | "rose";
  className?: string;
}
```

---

## 2. Phase-by-Phase Checklist

### Phase 1: Master Guidelines & Agent Rules Hardening
- [x] Update `UI_DESIGN_SYSTEM_GUIDE.md` with:
  - Header standard (Logo/Icon + Title + Subtitle + Action buttons)
  - Interactive Filterable KPI cards
  - Search & Filter bar standard
  - Workspace container width policy (Unified width in `DashboardLayout`, forbidden `max-w-7xl`/`max-w-5xl` wrappers on list pages)
  - Data table, status tagging, icon-only actions, and pagination standards
- [x] Update `DESIGN.md` to reference `UI_DESIGN_SYSTEM_GUIDE.md` as mandatory rule #1.
- [x] Update `AGENTS.md`, `GEMINI.md`, and `frontend/AGENTS.md` to instruct AI agents to always open and check `UI_DESIGN_SYSTEM_GUIDE.md` before planning or writing any new page.
- [x] Update `.agents/workflows/master-design.md` workflow file.

### Phase 2: Build Reusable Master UI Components
- [x] Create `frontend/src/components/ui/PageHeader.tsx`
- [x] Create `frontend/src/components/ui/KpiGrid.tsx`
- [x] Create `frontend/src/components/ui/FilterToolbar.tsx`
- [x] Create `frontend/src/components/ui/TableShell.tsx`
- [x] Create `frontend/src/components/ui/TablePagination.tsx`
- [x] Create `frontend/src/components/ui/RowActionButton.tsx`
- [x] Export them in `frontend/src/components/ui/index.ts` (if needed or direct imports)

### Phase 3: Verification & Quality Assurance
- [x] Run TypeScript typecheck: `npm run typecheck` or `npx tsc --noEmit` in `frontend`
- [x] Verify test suite compatibility
- [x] Update `docs/todo/README.md` and checkpoint files

### Phase 4: Commit and Delivery
- [x] Git commit with conventional commit: `feat(design): implement master design standard and reusable ui components`
