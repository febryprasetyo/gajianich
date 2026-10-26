# Asset Management Dashboard & Role-Based Super App Landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun Dashboard Asset Management analitik untuk Admin & IT, direct routing cerdas per role (Admin/IT, HR, Employee, Management), menu kontekstual "Dashboard" di sidebar, dan dedicated welcome landing page untuk role lain.

**Architecture:** Menambahkan kolom operasional `purchase_date` & `warranty_expiry` pada skema aset, membuat controller & endpoint `GET /api/assets/dashboard-summary` dengan agregasi SQL riil, memperbarui helper access routing (`getDefaultRedirectForUser`) dan route guards, serta membangun halaman UI analitik modern di `/dashboard/assets/overview` dan modular welcome workspace di `/dashboard/employee/overview` dan `/dashboard/management/overview`.

**Tech Stack:** Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL, Next.js (App Router), React 19, Tailwind CSS v4, Lucide React, Node Test Runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-10-08-asset-dashboard-role-landing-design.md`

## Global Constraints
- Jangan menambahkan kolom harga beli (`purchase_price`) atau kalkulasi depresiasi finansial ke dalam implementasi (sesuai instruksi pengguna).
- Halaman tabel inventaris `/dashboard/assets` tidak boleh dirusak atau dihilangkan fungsinya.
- Backward compatibility: Jika kolom `purchase_date` kosong (null), gunakan fallback `created_at` untuk tren pengadaan.
- Gunakan Tailwind CSS dan semantic HTML yang mematuhi accessibility WCAG 2.2 AA tanpa template generik AI-slop.

## Review Focus
- Validasi role matching: Role Admin (`super_admin`, `it_admin`, `it_staff`) harus selalu direct ke `/dashboard/assets/overview`, bukan lagi ke `/dashboard/master/departments`.
- Fallback role: Role yang tidak terdaftar spesifik harus mendarat di `/dashboard/welcome` tanpa error 500/404.
- Route collision Express: Endpoint `/dashboard-summary` harus didaftarkan sebelum route berparameter `/:id` pada `assetRoutes.ts`.
- Ketahanan kalkulasi agregasi: Aset yang belum ditugaskan (custodian/employee null) harus dihitung dengan rapi ke kelompok "Belum Ditetapkan / Pool".
- Responsivitas tampilan: Baris KPI, chart bar tren, distribusi departemen/kategori, dan tabel ringkas harus dapat tampil bersih di mobile dan desktop.

---

### Task 1: Database Schema Migration & Asset Operational Columns

**Files:**
- Modify: `backend/src/db/schema/assets.ts`
- Create: `backend/src/db/assetOperationalColumnsMigration.test.ts`

**Interfaces:**
- Produces: `assets.purchaseDate`, `assets.warrantyExpiry` columns in Drizzle schema.

- [x] **Step 1: Write the failing test for schema migration**

```typescript
// backend/src/db/assetOperationalColumnsMigration.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { assets } from './schema/assets';

describe('Asset Schema Operational Columns', () => {
  test('assets table schema contains purchaseDate and warrantyExpiry', () => {
    assert.ok('purchaseDate' in assets, 'purchaseDate field should exist on assets schema');
    assert.ok('warrantyExpiry' in assets, 'warrantyExpiry field should exist on assets schema');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test backend/src/db/assetOperationalColumnsMigration.test.ts`
Expected: FAIL with assertion error (`purchaseDate field should exist on assets schema`).

- [x] **Step 3: Update `backend/src/db/schema/assets.ts` and add columns to DB**

Tambahkan kolom `purchaseDate` dan `warrantyExpiry` pada `backend/src/db/schema/assets.ts`:
```typescript
purchaseDate: timestamp('purchase_date'),
warrantyExpiry: timestamp('warranty_expiry'),
```
Dan pastikan script seed / migrasi mengeksekusi `ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date timestamp;` dan `ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_expiry timestamp;`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test backend/src/db/assetOperationalColumnsMigration.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/db/schema/assets.ts backend/src/db/assetOperationalColumnsMigration.test.ts
git commit -m "feat(backend): add purchaseDate and warrantyExpiry columns to asset schema"
```

---

### Task 2: Backend Dashboard Summary Controller & API Route

**Files:**
- Create: `backend/src/controllers/assetDashboardController.ts`
- Create: `backend/src/controllers/assetDashboardController.test.ts`
- Modify: `backend/src/routes/assetRoutes.ts`

**Interfaces:**
- Produces: `getAssetDashboardSummary(req: Request, res: Response)`
- Route: `GET /api/assets/dashboard-summary`

- [x] **Step 1: Write the failing unit & integration test**

```typescript
// backend/src/controllers/assetDashboardController.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { computeAssetKpis, formatPurchaseTrend } from './assetDashboardController';

describe('Asset Dashboard Controller Logic', () => {
  test('computeAssetKpis aggregates operational counts accurately', () => {
    const mockRows = [
      { status: 'Assigned' },
      { status: 'Available' },
      { status: 'Assigned' },
      { status: 'Maintenance' },
      { status: 'Damaged' },
    ];
    const kpis = computeAssetKpis(mockRows);
    assert.strictEqual(kpis.totalAssets, 5);
    assert.strictEqual(kpis.assignedAssets, 2);
    assert.strictEqual(kpis.availableAssets, 1);
    assert.strictEqual(kpis.maintenanceAssets, 1);
    assert.strictEqual(kpis.damagedAssets, 1);
    assert.strictEqual(kpis.assignedPercentage, 40);
  });

  test('formatPurchaseTrend groups acquisition counts by month', () => {
    const mockRecords = [
      { date: new Date('2026-08-10') },
      { date: new Date('2026-08-25') },
      { date: new Date('2026-09-05') },
    ];
    const trend = formatPurchaseTrend(mockRecords);
    assert.ok(Array.isArray(trend));
    const aug = trend.find(t => t.month === '2026-08');
    assert.strictEqual(aug?.count, 2);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test backend/src/controllers/assetDashboardController.test.ts`
Expected: FAIL with module/function not found.

- [x] **Step 3: Implement `backend/src/controllers/assetDashboardController.ts` and register in `backend/src/routes/assetRoutes.ts`**

Implementasikan kalkulasi agregasi SQL/in-memory aman:
1. `computeAssetKpis`: Total aset, status `Assigned`, `Available`, `Maintenance`, `Damaged`.
2. `formatPurchaseTrend`: Mengelompokkan riwayat pengadaan 6-12 bulan terakhir (fallback ke `createdAt` jika `purchaseDate` kosong).
3. Pengelompokan departemen (`byDepartment`) dengan relasi `employees` / `departments`.
4. Pengelompokan kategori (`byCategory`) dengan `assetCategories`.
5. 10 aset terbaru (`recentAssets`).
6. Daftarkan di `backend/src/routes/assetRoutes.ts` sebelum route `/:id`:
```typescript
router.get('/dashboard-summary', viewAssets, getAssetDashboardSummary);
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test backend/src/controllers/assetDashboardController.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/controllers/assetDashboardController.ts backend/src/controllers/assetDashboardController.test.ts backend/src/routes/assetRoutes.ts
git commit -m "feat(backend): implement GET /api/assets/dashboard-summary endpoint"
```

---

### Task 3: Access Control & Dynamic Super App Routing Logic

**Files:**
- Modify: `frontend/src/lib/access/routes.ts`
- Create: `frontend/src/lib/access/routes.test.mjs`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `user.roleName`, `user.permissions`
- Produces: `getDefaultRedirectForUser(user)`, `getDashboardHrefForUser(user)`, update `DASHBOARD_ROUTE_RULES`

- [x] **Step 1: Write the failing routing tests**

```javascript
// frontend/src/lib/access/routes.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getDefaultRedirectForUser, canAccessRoute } from './routes.ts';

describe('Role Redirect Routing Rules', () => {
  test('superadmin and it roles redirect to asset overview', () => {
    assert.strictEqual(getDefaultRedirectForUser({ roleName: 'SuperAdmin' }), '/dashboard/assets/overview');
    assert.strictEqual(getDefaultRedirectForUser({ roleName: 'ITAdmin' }), '/dashboard/assets/overview');
    assert.strictEqual(getDefaultRedirectForUser({ roleName: 'ITStaff' }), '/dashboard/assets/overview');
  });

  test('hr roles redirect to attendance overview', () => {
    assert.strictEqual(getDefaultRedirectForUser({ roleName: 'HR Attendance & Time' }), '/dashboard/attendance/overview');
  });

  test('employee role redirects to employee overview', () => {
    assert.strictEqual(getDefaultRedirectForUser({ roleName: 'Employee' }), '/dashboard/employee/overview');
  });

  test('management role redirects to management overview', () => {
    assert.strictEqual(getDefaultRedirectForUser({ roleName: 'Management' }), '/dashboard/management/overview');
  });

  test('unknown role redirects to fallback welcome', () => {
    assert.strictEqual(getDefaultRedirectForUser({ roleName: 'Guest' }), '/dashboard/welcome');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test frontend/src/lib/access/routes.test.mjs`
Expected: FAIL (karena SuperAdmin saat ini masih mengembalikan `/dashboard/master/departments`).

- [x] **Step 3: Update `frontend/src/lib/access/routes.ts`, `frontend/src/app/page.tsx`, and `frontend/src/app/dashboard/page.tsx`**

Perbarui:
1. `getDefaultRedirectForUser` untuk memetakan Admin/IT $\rightarrow$ `/dashboard/assets/overview`, HR $\rightarrow$ `/dashboard/attendance/overview`, Management $\rightarrow$ `/dashboard/management/overview`, Employee $\rightarrow$ `/dashboard/employee/overview`, Fallback $\rightarrow$ `/dashboard/welcome`.
2. Buat helper `getDashboardHrefForUser(user)`.
3. Daftarkan rules baru pada `DASHBOARD_ROUTE_RULES`:
   - `/dashboard/assets/overview`
   - `/dashboard/employee/overview`
   - `/dashboard/management/overview`
   - `/dashboard/welcome`
4. Di `frontend/src/app/page.tsx`, arahkan user login melalui `router.replace(getDefaultRedirectForUser(user))`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test frontend/src/lib/access/routes.test.mjs`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/lib/access/routes.ts frontend/src/lib/access/routes.test.mjs frontend/src/app/page.tsx frontend/src/app/dashboard/page.tsx
git commit -m "feat(frontend): implement role-based direct routing and access rules"
```

---

### Task 4: Dynamic "Dashboard" Navigation in Sidebar

**Files:**
- Modify: `frontend/src/components/layout/DashboardLayout.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `getDashboardHrefForUser(user)`
- Produces: Contextual "Dashboard" top-level nav item + separated "Ringkasan Aset" & "Inventaris Aset" in Asset Lifecycle.

- [x] **Step 1: Check existing `DashboardLayout.tsx` structure**
Pastikan nav items dan logic role filter saat ini tidak rusak.

- [x] **Step 2: Update `DashboardLayout.tsx`**
1. Tambahkan menu teratas:
```typescript
{
  title: 'Utama',
  items: [
    {
      name: 'Dashboard',
      href: dashboardHref, // dinamis dari getDashboardHrefForUser(user)
      icon: LayoutDashboard,
    }
  ]
}
```
2. Pada grup `Asset Lifecycle`, pisahkan:
   - `Ringkasan Aset` $\rightarrow$ `/dashboard/assets/overview` (Icon `LayoutDashboard` / `BarChart3`)
   - `Inventaris Aset` $\rightarrow$ `/dashboard/assets` (Icon `HardDrive`)
   - `Hardware Audits` $\rightarrow$ `/dashboard/hardware-audits`
   - `Software Licenses` $\rightarrow$ `/dashboard/licenses`

- [x] **Step 3: Run frontend typecheck**

Run: `npx tsc --noEmit --project frontend/tsconfig.json`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add frontend/src/components/layout/DashboardLayout.tsx
git commit -m "feat(frontend): add contextual Dashboard menu item and asset submenu in sidebar"
```

---

### Task 5: Modular Welcome Workspace & Role Landing Pages

**Files:**
- Create: `frontend/src/components/dashboard/RoleWelcomeWorkspace.tsx`
- Create: `frontend/src/app/dashboard/employee/overview/page.tsx`
- Create: `frontend/src/app/dashboard/management/overview/page.tsx`
- Create: `frontend/src/app/dashboard/welcome/page.tsx`

**Interfaces:**
- Produces: `RoleWelcomeWorkspace({ roleTitle, roleBadge, description, shortcuts })`

- [x] **Step 1: Create `frontend/src/components/dashboard/RoleWelcomeWorkspace.tsx`**
Komponen elegan dengan standar anti-slop:
- Hero card dengan nama pengguna dan badge role.
- Informasi tanggal terkini Jakarta/WIB.
- Kartu status akun & ringkasan otorisasi.
- Grid kontainer modul siap pakai (*Future Module Containers*) agar siap dikembangkan di masa mendatang.

- [x] **Step 2: Create `/dashboard/employee/overview/page.tsx`**
Halaman khusus Employee yang membungkus `RoleWelcomeWorkspace` dengan kontekstualisasi peran karyawan (shortcut ajukan permohonan aset/tiket).

- [x] **Step 3: Create `/dashboard/management/overview/page.tsx`**
Halaman khusus Management yang membungkus `RoleWelcomeWorkspace` dengan kontekstualisasi peran pimpinan/manajemen.

- [x] **Step 4: Create `/dashboard/welcome/page.tsx`**
Halaman fallback universal jika user memiliki role baru/kustom yang belum didefinisikan.

- [x] **Step 5: Run frontend typecheck**

Run: `npx tsc --noEmit --project frontend/tsconfig.json`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add frontend/src/components/dashboard/RoleWelcomeWorkspace.tsx frontend/src/app/dashboard/employee/overview/page.tsx frontend/src/app/dashboard/management/overview/page.tsx frontend/src/app/dashboard/welcome/page.tsx
git commit -m "feat(frontend): add modular RoleWelcomeWorkspace and dedicated overview pages"
```

---

### Task 6: Dedicated Asset Management Dashboard Page (`/dashboard/assets/overview`)

**Files:**
- Create: `frontend/src/app/dashboard/assets/overview/page.tsx`
- Create: `frontend/src/components/assets/dashboard/AssetKpiCard.tsx`
- Create: `frontend/src/components/assets/dashboard/AssetTrendChart.tsx`
- Create: `frontend/src/components/assets/dashboard/AssetDepartmentBar.tsx`
- Create: `frontend/src/components/assets/dashboard/AssetCategoryBreakdown.tsx`
- Create: `frontend/src/components/assets/dashboard/AssetRecentTable.tsx`

**Interfaces:**
- Consumes: `GET /api/assets/dashboard-summary`
- Produces: Halaman analitik `/dashboard/assets/overview`

- [x] **Step 1: Create Sub-Components Analitik**
1. `AssetKpiCard.tsx`: Menampilkan angka tabular, persentase utilisasi, icon, dan status color accent.
2. `AssetTrendChart.tsx`: Bar visual tren penambahan aset bulanan yang interaktif dan responsif (SVG/CSS bar chart murni, tanpa library berat eksternal).
3. `AssetDepartmentBar.tsx`: Progress distribution bar per departemen dengan counter unit.
4. `AssetCategoryBreakdown.tsx`: Proporsi kategori aset dengan badge & visual progress.
5. `AssetRecentTable.tsx`: Tabel aset aktif terkini dengan status badge (`In Use`, `Available`, `Maintenance`, `Damaged`) dan tombol direct link.

- [x] **Step 2: Create Main Page `frontend/src/app/dashboard/assets/overview/page.tsx`**
- Hubungkan dengan `api.get('/assets/dashboard-summary')`.
- State management: `loading`, `error`, `data`, `refresh`.
- Tombol aksi cepat di header: `+ Tambah Aset` (membuka AssetFormModal) dan `Buka Inventaris Penuh` (ke `/dashboard/assets`).
- Wrap dengan `DashboardLayout`.

- [x] **Step 3: Run frontend typecheck and linter**

Run: `npx tsc --noEmit --project frontend/tsconfig.json && npm run lint --prefix frontend`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/assets/overview/ frontend/src/components/assets/dashboard/
git commit -m "feat(frontend): build dedicated Asset Management Dashboard page with analytics cards"
```

---

### Task 7: Full System Verification & Regression Testing

**Files:**
- Verification only

- [x] **Step 1: Run all backend tests**

Run: `npm run test --prefix backend`
Expected: ALL PASS.

- [x] **Step 2: Run all frontend tests**

Run: `npm run test --prefix frontend`
Expected: ALL PASS.

- [x] **Step 3: Run full TypeScript typecheck**

Run: `npx tsc --noEmit --project backend/tsconfig.json && npx tsc --noEmit --project frontend/tsconfig.json`
Expected: 0 errors.

- [x] **Step 4: Final commit and summary**

```bash
git status
```
