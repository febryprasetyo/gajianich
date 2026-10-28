# GAJIANICH frontend rebrand design

**Date:** 2026-10-01  
**Status:** Approved direction, awaiting review of this written specification  
**Scope:** Frontend identity and visual-system rebrand only. APIs, permissions, page routes, menu labels, menu order, and user workflows remain unchanged.

## Purpose

Replace the current GAJIANICH security-console presentation with GAJIANICH, a friendly Indonesian internal-office platform. GAJIANICH stands for *Grup Administrasi, Jadwal, & Informasi Internal* and uses the tagline:

> Biar Kantor Jalan, Semua Kebagian.

The product should make routine office work feel less formal without making work data feel casual or unreliable. Existing users must be able to find every module in the same place and under the same label.

## Brand direction

### Identity

- Product name: `GAJIANICH`
- Tagline: `Biar Kantor Jalan, Semua Kebagian.`
- Mascot: a friendly office cat who is visibly over-caffeinated, wearing an emerald lanyard and holding an amber coffee cup.
- The mascot is an identity device, not a navigation replacement. It appears prominently on login and small in selected loading and empty states. The persistent shell uses a simplified version that stays legible at 40px.
- The approved image exploration is a reference for mood and proportion only. The shipped mark will be a local SVG React component so it remains crisp, accessible, and light.

### Palette and type

| Role | Value | Use |
| --- | --- | --- |
| Primary | `#059669` | Primary action, active navigation, keyboard focus |
| Supporting mint | `#10B981` | Secondary emphasis and positive states |
| Warm accent | `#F59E0B` | Coffee/mascot details and attention states |
| Canvas | `#F8FAFC` | Page background |
| Soft surface | `#F1F5F9` | Quiet controls and table headers |
| Ink | `#0F172A` | Main text |
| Danger | Existing accessible red family | Destructive actions and errors only |

Plus Jakarta Sans is the product typeface. Monospace stays limited to IDs, codes, and technical values. Geist and security-console visual cues will not be used as product identity.

### Visual rules

- Remove brand-level shields, red-to-rose gradients, grid backgrounds, glow blobs, ping indicators, and glass treatment.
- Use cards for grouping information, not as default decoration. Cards have a restrained radius, a single subtle border, and a compact shadow only where elevation is meaningful.
- Use pills for statuses and compact metadata only. Buttons, fields, and cards remain recognizably different shapes.
- Status always combines a label with color and, where useful, an icon.
- Red remains meaningful for failure, deletion, and other destructive actions.

## Persistent application shell

`DashboardLayout` remains responsible for authentication guard, permission filtering, route access handling, collapsible sidebar, and mobile drawer behavior.

The rebrand changes only its presentation:

- Replace the shield logo and GAJIANICH PRO lockup with a compact GAJIANICH cat mark, product name, and short descriptor.
- Retain the existing nav groups, group titles, item labels, item order, icons, URLs, permission checks, and role-specific visibility rules exactly as they are today.
- Replace red active/hover treatments with emerald equivalents and use amber only as a small warm accent.
- Keep breadcrumbs, but change the root crumb from `Platform` to `GAJIANICH`.
- Remove the non-functional Quick Search control and notification bell. Do not substitute cosmetic controls for missing features.
- Keep session/profile information and logout; relabel only its non-menu copy to natural Indonesian.
- Preserve the mobile drawer, adding robust `focus-visible` treatment, 44px minimum tap targets, and enough scroll padding for the user card and final navigation item.

## Pages, forms, and data views

All existing routes, data structures, CRUD actions, API calls, permissions, and primary page titles remain intact.

Shared presentation rules:

- Page headers use the module icon and emerald emphasis, not a security-shield motif.
- Primary buttons are emerald. Danger buttons and destructive confirmations stay red.
- Tables retain their columns and interaction behavior. Their header, row hover, selected, and empty states use the new token system.
- Inputs, selects, buttons, links, and modal controls receive a shared emerald `focus-visible` outline with contrast sufficient to be visible on white and pale surfaces.
- Error messages remain explicit. Their language may be localized, but their error causes and retry actions are not hidden behind jokes.
- Empty and loading states use casual Indonesian microcopy with a subtle cat accent only when an existing state already exists. They must not be added as decorative dead ends.

### Authentication and transition views

Login, home redirect, dashboard redirect, password-change, and unauthorized pages share the GAJIANICH theme:

- Login carries the main cat mascot, GAJIANICH wordmark, and tagline.
- Remove the generic corporate English copy and firewall-like security framing; retain truthful password and authentication guidance.
- Login fields and password controls remain keyboard-accessible with labels and visible focus.
- Password change and unauthorized screens use the smaller mark, purposeful status color, and plain Indonesian explanations.

## Accessibility and responsive requirements

- Keep semantic controls and `aria-label`s for icon-only buttons.
- Add `focus-visible` rather than relying on hover; do not use `outline: none` without a visible replacement.
- Verify text/background and focus/adjacent-surface contrast with the project contrast tool or equivalent formula before delivery.
- Preserve distinct loading, empty, and error states for data-driven pages.
- Test the shell at phone, tablet, and desktop widths. No horizontal page overflow; the drawer remains reachable, scrollable, and dismissible by keyboard.

## Expected code boundaries

| Area | Responsibility |
| --- | --- |
| `src/app/globals.css` | Global tokens, base type, focus, shared surfaces, scrollbar |
| `src/app/layout.tsx` | Metadata, document language, font setup, root canvas |
| `src/components/branding/GajianichMascot.tsx` | Local accessible SVG mascot variants for large and compact uses |
| `src/components/layout/DashboardLayout.tsx` | Existing shell logic with GAJIANICH presentation; navigation data untouched |
| `src/app/login/page.tsx` | Login-specific brand application and Indonesian copy |
| `src/app/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/change-password/page.tsx`, `src/app/dashboard/unauthorized/page.tsx` | Transitional/auth state presentation |
| Existing page and shared UI components | Token/class migration only where they use the legacy red identity or lack focus states; retain behavior and data interfaces |

## Verification

1. Add focused tests for brand component variants and any changed conditional UI behavior before implementation code.
2. Run the existing frontend tests, ESLint, and production build.
3. Inspect login, a representative master-data table, attendance workspace, a form modal, loading, empty, error, unauthorized, and mobile navigation in a browser.
4. Check keyboard traversal, Escape-to-close behavior for dialogs/drawer, and 200% zoom on a narrow viewport.
5. Confirm no functional navigation group title, item label, item order, route, or permission rule has changed.

## Out of scope

- Backend changes, database migration, auth model changes, new search, notification, or mascot animation systems.
- Renaming existing functional menus, routes, API resources, or permission keys.
- Rewriting page-level business copy beyond legacy-brand references and incidental English microcopy required by the rebrand.
