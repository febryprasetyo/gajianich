# Implementation Plan: Mobile Must Change Password Redirect & Route Guard

## Shared Interfaces & Contracts
- `frontend/src/lib/access/routes.ts`: `getDefaultRedirectForUser` returns `'/change-password'` when `user.mustChangePassword === true`.
- `frontend/src/proxy.ts`: `JwtPayload` includes `mustChangePassword?: boolean`.

---

## Phase 1: Shared Route Logic & Unit Tests (TDD)
- [x] Add unit test cases in `frontend/src/lib/access/routes.test.mjs` asserting `getDefaultRedirectForUser` returns `'/change-password'` when `mustChangePassword: true` for any role (Employee, SuperAdmin, HR, Guest).
- [x] Update `getDefaultRedirectForUser` in `frontend/src/lib/access/routes.ts` to check `user.mustChangePassword`.
- [x] Verify unit tests pass with `npm test`.

## Phase 2: Login Page Resilient Navigation & Session Refresh Guard
- [x] In `frontend/src/app/login/page.tsx`:
  - Add `useEffect` checking existing authentication session (`useAuth()`):
    - If `user?.mustChangePassword`: direct immediately to `/change-password` with `window.location.replace('/change-password')`.
    - If `user && !user.mustChangePassword`: direct to appropriate workspace (`/m/beranda` for employee, or `getDefaultRedirectForUser(user)`).
  - In `handleSubmit`:
    - If `mustChangePassword`: perform `router.replace('/change-password')` and guarantee navigation with `window.location.replace('/change-password')`.
    - If normal login: perform `router.replace(target)` and `window.location.replace(target)` to avoid mobile soft navigation hangs.

## Phase 3: Route Protection across Mobile & Desktop Layers
- [x] In `frontend/src/app/m/layout.tsx`:
  - Add auth guard effect: If `user?.mustChangePassword`, redirect immediately to `/change-password`.
- [x] In `frontend/src/app/m/beranda/page.tsx`:
  - In `useEffect`: If user needs password change, redirect to `/change-password` before attempting API summary calls.
- [x] In `frontend/src/components/layout/DashboardLayout.tsx`:
  - In auth guard effect: If `user?.mustChangePassword`, redirect immediately to `/change-password`.
- [x] In `frontend/src/proxy.ts`:
  - Decode `mustChangePassword` from JWT payload; if true and requesting protected routes, redirect to `/change-password`.

## Phase 4: Change Password Page Polish & Target Navigation
- [x] In `frontend/src/app/change-password/page.tsx`:
  - Guard on mount: If not authenticated, redirect to `/login`. If already completed password change (`!user.mustChangePassword`), redirect to user's main workspace.
  - On successful password change: Redirect `Employee` to `/m/beranda` and other roles to `getDefaultRedirectForUser(res.user)` using guaranteed `window.location.replace`.

## Phase 5: Verification & Regressions
- [x] Run full frontend test suite: `npm test`
- [x] Run typescript typecheck: `npx tsc --noEmit`
- [x] Verify no regressions on existing routes.
