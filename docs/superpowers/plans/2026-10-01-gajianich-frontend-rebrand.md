# GAJIANICH Frontend Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the existing frontend from GAJIANICH to GAJIANICH without changing routes, menu labels/order, permission behavior, APIs, or business workflows.

**Architecture:** Add a small brand contract and a local SVG cat mascot, then apply them through global tokens, the persistent shell, authentication states, and the existing module components. Presentation migrations are grouped by module so each group can be checked independently while the data and interaction interfaces stay intact.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Lucide React, Node built-in test runner, ESLint.

**Spec:** `docs/superpowers/specs/2026-10-01-gajianich-rebrand-design.md`

## Global Constraints

- Product name is `GAJIANICH`; tagline is `Biar Kantor Jalan, Semua Kebagian.`
- The cat mascot is a local accessible SVG React component, not a shipped raster dependency.
- Preserve every existing route, navigation group title, navigation item label, navigation order, icon, permission rule, and role-specific visibility rule.
- Preserve every API, data model, CRUD action, and page-level business workflow.
- Use emerald `#059669` as primary, mint `#10B981` as supporting color, amber `#F59E0B` as warm accent, `#F8FAFC` canvas, and red only for destructive/error states.
- Use Plus Jakarta Sans for product text; use monospace only for identifiers and technical values.
- Do not add a search or notification feature. Remove the currently inert Quick Search and notification controls from the shell.
- Every interactive control needs a visible `focus-visible` state. Error, loading, and empty states must remain explicit and informative.
- Do not use red/rose gradients, shield branding, decorative grid backgrounds, glow blobs, or generic glass cards as GAJIANICH identity.

## Review Focus

- HR Attendance roles still see only the exact allowed navigation and routes after the shell changes. Task 4 pins this with the existing route-permission test suite and a navigation-label snapshot test.
- Destructive confirmations remain red while normal save/confirm actions become emerald. Task 3 pins this in `confirmModal.test.mjs`.
- Legacy brand terms cannot return in the root, login, redirect, or shell. Task 5 adds a source-level regression test over those entry points.
- Keyboard users can identify focused inputs, buttons, links, the mobile menu trigger, and modal controls. Task 3 adds a focus-contract test; Task 8 verifies it in a browser.
- Narrow-width users can open, close, and scroll the mobile drawer without page overflow or hidden final items. Task 4 verifies its markup contract; Task 8 verifies it at runtime.

---

### Task 1: Create the GAJIANICH brand contract

**Files:**
- Create: `frontend/src/lib/gajianichBrand.ts`
- Create: `frontend/src/lib/gajianichBrand.test.mjs`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: none.
- Produces: `BRAND_NAME`, `BRAND_TAGLINE`, `BRAND_DESCRIPTION`, and `BRAND_COLORS` exported from `gajianichBrand.ts` for layouts and branded views.

- [ ] **Step 1: Write the failing brand-contract tests**

```js
import { BRAND_COLORS, BRAND_DESCRIPTION, BRAND_NAME, BRAND_TAGLINE } from './gajianichBrand.ts';

assert.equal(BRAND_NAME, 'GAJIANICH');
assert.equal(BRAND_TAGLINE, 'Biar Kantor Jalan, Semua Kebagian.');
assert.equal(BRAND_DESCRIPTION, 'Grup Administrasi, Jadwal, & Informasi Internal');
assert.deepEqual(BRAND_COLORS, {
  primary: '#059669', mint: '#10B981', amber: '#F59E0B', canvas: '#F8FAFC', ink: '#0F172A',
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npm test --prefix frontend -- src/lib/gajianichBrand.test.mjs`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the immutable GAJIANICH brand exports in `frontend/src/lib/gajianichBrand.ts`**

Export the exact constants specified in the test. Do not put Tailwind class strings, layout behavior, or feature copy in this module.

- [ ] **Step 4: Add the brand test to the frontend `test` script and verify it passes**

Run: `npm test --prefix frontend -- src/lib/gajianichBrand.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit the brand contract**

```bash
git add frontend/src/lib/gajianichBrand.ts frontend/src/lib/gajianichBrand.test.mjs frontend/package.json
git commit -m "feat: add gajianich brand contract"
```

### Task 2: Add the local office-cat mascot and root theme

**Files:**
- Create: `frontend/src/components/branding/GajianichMascot.tsx`
- Create: `frontend/src/lib/gajianichMascot.test.mjs`
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: `BRAND_NAME`, `BRAND_COLORS` from `@/lib/gajianichBrand`.
- Produces: `GajianichMascot({ size?: 'compact' | 'hero', decorative?: boolean, className?: string })` for the shell and authentication views.

- [ ] **Step 1: Write failing mascot and root-theme tests**

Test the mascot source contract: both `compact` and `hero` sizes exist; decorative use renders `aria-hidden`; informative use has an accessible GAJIANICH label. Test that the root metadata consumes `BRAND_NAME`, the document uses `lang="id"`, and global CSS declares the five contract color values plus a visible global `:focus-visible` rule.

- [ ] **Step 2: Run the mascot/root-theme tests to verify they fail**

Run: `npm test --prefix frontend -- src/lib/gajianichMascot.test.mjs`  
Expected: FAIL because the mascot and theme contracts are absent.

- [ ] **Step 3: Implement `GajianichMascot` as a self-contained SVG React component**

Use a cream office cat, an emerald lanyard, and an amber coffee cup. Keep the compact silhouette legible at 40px; only show the extra coffee/face detail in the hero variant. Use `title`/`aria-hidden` behavior based on `decorative`; no external image or animation dependency.

- [ ] **Step 4: Replace root legacy presentation in `globals.css` and `layout.tsx`**

Use the brand variables as the single source of CSS color values, set the light root canvas, preserve Plus Jakarta Sans as the display/body face, remove red `glass-panel` and `text-gradient-red` identity rules, add high-contrast emerald `:focus-visible`, and honor `prefers-reduced-motion`. Change metadata to GAJIANICH and Indonesian document language.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --prefix frontend -- src/lib/gajianichBrand.test.mjs src/lib/gajianichMascot.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit the mascot and root theme**

```bash
git add frontend/src/components/branding/GajianichMascot.tsx frontend/src/lib/gajianichMascot.test.mjs frontend/src/app/globals.css frontend/src/app/layout.tsx
git commit -m "feat: add gajianich mascot and theme"
```

### Task 3: Re-theme shared controls without changing their behavior

**Files:**
- Modify: `frontend/src/components/ui/StatusBadge.tsx`
- Modify: `frontend/src/components/ui/ModalShell.tsx`
- Modify: `frontend/src/components/ui/ConfirmDeleteModal.tsx`
- Modify: `frontend/src/lib/confirmModal.ts`
- Modify: `frontend/src/lib/confirmModal.test.mjs`
- Modify: `frontend/src/components/attendance/attendance.css`
- Create: `frontend/src/lib/focusContract.test.mjs`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: global brand variables and the existing `ConfirmVariant` interface.
- Produces: unchanged `StatusBadgeProps`, `ModalShellProps`, `ConfirmDeleteModalProps`, `resolveConfirmText`, and `resolveVariantStyles` APIs with new class values.

- [ ] **Step 1: Update failing confirmation-style tests**

Change the existing primary assertions to require emerald classes while keeping danger assertions red/rose and warning assertions amber. Add an assertion that `resolveConfirmText` behavior remains unchanged.

- [ ] **Step 2: Write the failing shared focus-contract test**

Read the shared CSS/control sources and assert: global `:focus-visible` exists, attendance focus uses the emerald primary value, `ModalShell` close button has a `focus-visible` style, and no shared source has `focus:outline-none` without a `focus-visible` replacement.

- [ ] **Step 3: Run the shared-control tests to verify they fail**

Run: `npm test --prefix frontend -- src/lib/confirmModal.test.mjs src/lib/focusContract.test.mjs`  
Expected: FAIL because primary controls and attendance focus still use legacy red.

- [ ] **Step 4: Migrate the shared control classes and attendance stylesheet**

Map primary actions to emerald, retain amber warnings and red destructive/error variants, use soft off-white surfaces, and add focus-visible treatments without changing props, event handlers, Escape behavior, focus trapping, or modal close behavior.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --prefix frontend -- src/lib/confirmModal.test.mjs src/lib/focusContract.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit shared control migration**

```bash
git add frontend/src/components/ui frontend/src/components/attendance/attendance.css frontend/src/lib/confirmModal.ts frontend/src/lib/confirmModal.test.mjs frontend/src/lib/focusContract.test.mjs frontend/package.json
git commit -m "feat: re-theme shared gajianich controls"
```

### Task 4: Rebrand the persistent dashboard shell while preserving navigation

**Files:**
- Modify: `frontend/src/components/layout/DashboardLayout.tsx`
- Create: `frontend/src/lib/dashboardShell.test.mjs`
- Modify: `frontend/package.json`
- Existing test: `frontend/src/lib/access/routes.test.mjs`

**Interfaces:**
- Consumes: `GajianichMascot`, `BRAND_NAME`, existing `navGroups`, `ROUTE_PERMISSION_MAP`, authentication context, and role/permission utilities.
- Produces: unchanged `DashboardLayout` props and exported navigation data; no search or notification click target.

- [ ] **Step 1: Write failing dashboard-shell regression tests**

Read the shell source and assert the exact existing menu group/item labels remain present in their current order, `GajianichMascot` and `BRAND_NAME` are used, the breadcrumb root is GAJIANICH, Quick Search/Bell button markup is absent, and menu trigger/close buttons retain Indonesian aria labels and 44px minimum target classes.

- [ ] **Step 2: Run the shell and route-permission tests to verify the new shell test fails**

Run: `npm test --prefix frontend -- src/lib/dashboardShell.test.mjs src/lib/access/routes.test.mjs`  
Expected: dashboard shell test FAILS for the old GAJIANICH/shield/inert controls; route tests PASS.

- [ ] **Step 3: Apply GAJIANICH presentation to `DashboardLayout.tsx`**

Replace only the brand lockup, color classes, root breadcrumb, non-menu microcopy, and focus/mobile drawer styling. Delete the inert Quick Search and notification buttons. Do not alter `navGroups`, `ROUTE_PERMISSION_MAP`, any href, icon, name, permission, visibility predicate, redirect, or logout behavior.

- [ ] **Step 4: Run shell and route-permission tests to verify they pass**

Run: `npm test --prefix frontend -- src/lib/dashboardShell.test.mjs src/lib/access/routes.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit shell rebrand**

```bash
git add frontend/src/components/layout/DashboardLayout.tsx frontend/src/lib/dashboardShell.test.mjs frontend/package.json
git commit -m "feat: rebrand gajianich dashboard shell"
```

### Task 5: Rebrand authentication and transition states

**Files:**
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/src/app/change-password/page.tsx`
- Modify: `frontend/src/app/dashboard/unauthorized/page.tsx`
- Create: `frontend/src/lib/brandEntryPoints.test.mjs`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `GajianichMascot`, brand contract constants, existing auth context and API calls.
- Produces: unchanged submit, quick-demo, redirect, logout, password-validation, and unauthorized-route behavior with GAJIANICH presentation and Indonesian microcopy.

- [ ] **Step 1: Write failing entry-point regression tests**

Read the five entry-point sources and assert each has no GAJIANICH title/portal string, no brand shield import, no grid/glow class, and login contains `BRAND_NAME`, `BRAND_TAGLINE`, and `GajianichMascot`. Assert password security conditions and `router` destinations remain unchanged in their source contracts.

- [ ] **Step 2: Run the entry-point test to verify it fails**

Run: `npm test --prefix frontend -- src/lib/brandEntryPoints.test.mjs`  
Expected: FAIL because legacy branding and security-console decoration remain.

- [ ] **Step 3: Replace entry-point visual and copy treatment**

Use the hero mascot on login, compact mascot elsewhere, emerald primary actions, amber coffee accents, plain Indonesian status text, and purpose-specific error/danger colors. Retain all fields, validation rules, API payloads, auth transitions, and user actions. Do not hide the existing demo credential behavior; relabel it accurately.

- [ ] **Step 4: Run the entry-point tests to verify they pass**

Run: `npm test --prefix frontend -- src/lib/brandEntryPoints.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit authentication rebrand**

```bash
git add frontend/src/app/login/page.tsx frontend/src/app/page.tsx frontend/src/app/dashboard/page.tsx frontend/src/app/change-password/page.tsx frontend/src/app/dashboard/unauthorized/page.tsx frontend/src/lib/brandEntryPoints.test.mjs frontend/package.json
git commit -m "feat: rebrand gajianich entry points"
```

### Task 6: Migrate non-attendance feature surfaces to the shared theme

**Files:**
- Modify: `frontend/src/app/dashboard/access/page.tsx`, `assets/page.tsx`, `assets/[id]/page.tsx`, `hardware-audits/page.tsx`, `infrastructure/page.tsx`, `licenses/page.tsx`, `licenses/[id]/page.tsx`, `tickets/page.tsx`, `tickets/[id]/page.tsx`
- Modify: `frontend/src/app/dashboard/master/{departments,equipment-types,locations,vendors,employees,asset-custodians}/**/*.{tsx,css}`
- Modify: `frontend/src/components/{access,assets,custodians,hardware-audits,infrastructure,licenses,master,tickets}/**/*.tsx`
- Create: `frontend/src/lib/featureThemeAudit.test.mjs`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: shared global tokens and unchanged feature component props.
- Produces: the same page/component exports, API use, callbacks, filters, table columns, modal contracts, and status semantics.

- [ ] **Step 1: Write the failing non-attendance theme audit test**

Scan the listed module sources and assert: no `text-gradient-red`, no red/rose primary button gradient, no brand `ShieldCheck` usage outside a genuine permission/security message, every `focus:outline-none` instance has a local `focus-visible` replacement, and any `bg-red-*` primary action is converted while explicit destructive/error branches remain allowed.

- [ ] **Step 2: Run the feature theme audit to verify it fails**

Run: `npm test --prefix frontend -- src/lib/featureThemeAudit.test.mjs`  
Expected: FAIL with the current legacy red-primary source paths.

- [ ] **Step 3: Migrate access, master data, assets, custodians, audits, infrastructure, licenses, and tickets by existing module**

Convert legacy primary red treatments to emerald and use amber only for attention states. Retain error/destructive red states, data column names, filters, page headings, operation handlers, disabled logic, and all import/export/print workflows. Use the compact mascot only in existing empty/loading state space where it does not displace information.

- [ ] **Step 4: Run the feature theme audit to verify it passes**

Run: `npm test --prefix frontend -- src/lib/featureThemeAudit.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit non-attendance feature migration**

```bash
git add frontend/src/app/dashboard frontend/src/components/access frontend/src/components/assets frontend/src/components/custodians frontend/src/components/hardware-audits frontend/src/components/infrastructure frontend/src/components/licenses frontend/src/components/master frontend/src/components/tickets frontend/src/lib/featureThemeAudit.test.mjs frontend/package.json
git commit -m "feat: apply gajianich theme to operations modules"
```

### Task 7: Migrate attendance surfaces to the shared theme

**Files:**
- Modify: `frontend/src/app/dashboard/attendance/**/*.tsx`
- Modify: `frontend/src/components/attendance/*.tsx`
- Modify: `frontend/src/components/attendance/attendance.css`
- Create: `frontend/src/lib/attendanceThemeAudit.test.mjs`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: existing attendance workspace props, record dialogs, shared helpers, and `.hr-*` class names.
- Produces: unchanged attendance pages, import/edit actions, reports, role checks, and attendance component interfaces.

- [ ] **Step 1: Write the failing attendance theme audit test**

Assert that `attendance.css` uses the contract primary color for `.hr-btn-primary` and focus, existing `.hr-table-wrap` horizontal containment remains, and attendance page/component sources contain no legacy red primary class except explicit failure/destructive messages.

- [ ] **Step 2: Run the attendance audit to verify it fails**

Run: `npm test --prefix frontend -- src/lib/attendanceThemeAudit.test.mjs`  
Expected: FAIL because attendance primary buttons and focus styles are red.

- [ ] **Step 3: Update attendance CSS and components in place**

Apply the same emerald primary, amber attention, readable off-white surface, and visible focus treatment. Keep `.hr-*` selectors, table overflow behavior, date/time inputs, dialogs, and all attendance import/export/edit/report behavior unchanged.

- [ ] **Step 4: Run the attendance audit to verify it passes**

Run: `npm test --prefix frontend -- src/lib/attendanceThemeAudit.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit attendance rebrand**

```bash
git add frontend/src/app/dashboard/attendance frontend/src/components/attendance frontend/src/lib/attendanceThemeAudit.test.mjs frontend/package.json
git commit -m "feat: apply gajianich theme to attendance"
```

### Task 8: Run full verification and the post-implementation visual audit

**Files:**
- Create: `anti-slop/audit-003-2026-10-01.md`
- Modify: only files needed to resolve verified findings.

**Interfaces:**
- Consumes: completed frontend source and audit requirements.
- Produces: a passing frontend build/test/lint baseline and a written visual/accessibility audit with approved fixes applied.

- [ ] **Step 1: Run the complete automated verification suite**

Run:

```bash
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Expected: all commands exit 0 with no new warnings that indicate a GAJIANICH regression.

- [ ] **Step 2: Run browser checks against the local production-equivalent frontend**

Inspect login, a master-data table, attendance workspace, a modal, loading, empty, error, unauthorized, and dashboard shell at phone, tablet, desktop, and 200% zoom. Verify keyboard focus, Escape close, drawer reachability, no horizontal overflow, and that the final content is not hidden behind fixed shell UI.

- [ ] **Step 3: Write `anti-slop/audit-003-2026-10-01.md`**

Record the visual evidence, final delivery-gate checks, and any remaining known limitations. Resolve findings introduced by this implementation before calling the rebrand complete.

- [ ] **Step 4: Commit final verification artifacts and fixes**

```bash
git add frontend anti-slop/audit-003-2026-10-01.md
git commit -m "feat: complete gajianich frontend rebrand"
```
