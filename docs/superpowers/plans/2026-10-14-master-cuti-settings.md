# Master Cuti, Pengaturan Cuti Bersama Tahunan & Rekap Saldo Cuti Karyawan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Membangun modul Master Cuti terpusat yang mencakup konfigurasi Cuti Bersama tahunan, auto-rollover carry forward dari tahun $(N-1)$, bulk-sync transaksional saldo cuti seluruh karyawan aktif dengan proteksi custom override, tabel rekap saldo komprehensif, modal penyesuaian individual, serta antarmuka SmartHR berbahasa Indonesia di `/dashboard/leaves/settings`.

**Architecture:** 
- Database: Tabel `annual_leave_configs` dan penambahan flag `is_custom_quota`, `is_custom_carry_forward` serta unique constraint pada `leave_balances(employee_id, year)`.
- Domain & Backend: Fungsi murni `calculateLeaveBalances` dan `calculateRolloverCarryForward` yang dites secara independen (TDD), diintegrasikan dengan transaksi `db.transaction()` untuk bulk-sync dan endpoints master di `/api/v1/leaves/master/*` dengan RBAC `attendance.manage`.
- Frontend: Halaman konfigurasi dan rekap `/dashboard/leaves/settings` yang responsif dan berstandar SmartHR, dilengkapi form kebijakan master, widget ringkasan statistik, toolbar filter, tabel saldo berindikator visual, dan modal koreksi individual.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Drizzle ORM, PostgreSQL, TailwindCSS, Lucide Icons, Node.js Test Runner (`tsx --test`).

**Spec:** [docs/superpowers/specs/2026-10-14-master-cuti-settings-design.md](file:///home/fastpec/code/ams-app/docs/superpowers/specs/2026-10-14-master-cuti-settings-design.md)

## Global Constraints
- Bahasa Indonesia baku yang konsisten untuk seluruh UI label, pesan sukses, pesan kesalahan, dan konfirmasi.
- Tidak ada hardcoded API credentials atau secrets.
- Hak akses: `attendance.manage` untuk semua aksi mutasi master konfigurasi dan penyesuaian saldo; `attendance.view` untuk melihat data.
- Isolasi variabel: Bulk-sync tidak boleh menimpa `base_quota` atau `carried_over_quota` yang telah di-override manual oleh HR (`isCustomQuota = true` atau `isCustomCarryForward = true`).
- WCAG 2.2 AA: Form controls memiliki label semantik yang terhubung, kontras warna badge memadai (Hijau >= 4, Kuning 1-3, Merah 0), serta dialog modal yang mendukung keyboard trapping dan ESC close.

## Review Focus
1. Sinkronisasi massal saat karyawan belum memiliki record saldo di tahun $N$: pastikan di-insert secara aman dengan nilai default tanpa menduplikasi data (idempotent).
2. Perubahan Cuti Bersama di tengah tahun: potongan `collective_leave_deduction` terbarui untuk seluruh karyawan tanpa membatalkan kuota khusus karyawan yang bernilai selain 12 hari.
3. Carry forward di tahun baru ketika karyawan tahun sebelumnya $(N-1)$ memiliki sisa saldo: rollover terhitung otomatis sesuai formula $\min(\text{prevRemaining}, \text{maxCarryForwardDays})$, dan bernilai 0 jika fitur dinonaktifkan.
4. Input angka negatif atau tidak valid pada modal koreksi saldo: tertolak di Zod backend validator dengan pesan ramah pengguna.
5. Filter pencarian dan departemen pada tabel rekap saldo: bekerja secara instan dan reaktif tanpa memicu refetch yang berlebihan.

---

### Task 1: Database Schema & Migration for Master Leave Configuration and Balance Flags

**Files:**
- Modify: `backend/src/db/schema/leaves.ts`
- Modify: `backend/src/db/schema/leaves.test.ts`

**Interfaces:**
- Produces:
  - `annualLeaveConfigs` table definition: `id`, `year` (unique), `baseQuota`, `collectiveLeaveDays`, `allowCarryForward`, `maxCarryForwardDays`, `notes`, `createdAt`, `updatedAt`.
  - `leaveBalances` columns: `isCustomQuota` (boolean, default false), `isCustomCarryForward` (boolean, default false).

- [x] **Step 1: Write failing schema tests in leaves.test.ts**
  Tambahkan unit test untuk memverifikasi ekspor tabel `annualLeaveConfigs` dan kolom baru `isCustomQuota`, `isCustomCarryForward` pada `leaveBalances`.
- [x] **Step 2: Run test to verify it fails**
  Run: `npm --prefix backend test`
  Expected: FAIL with missing `annualLeaveConfigs` export.
- [x] **Step 3: Implement schema definition in leaves.ts**
  Tambahkan tabel `annualLeaveConfigs` dan perbarui tabel `leaveBalances` di `backend/src/db/schema/leaves.ts`. Jalankan migrasi/DDL sync database.
- [x] **Step 4: Run test to verify it passes**
  Run: `npm --prefix backend test`
  Expected: PASS
- [x] **Step 5: Commit**
  Run: `git add backend/src/db/schema/leaves.ts backend/src/db/schema/leaves.test.ts`
  `git commit -m "feat(leaves): add annualLeaveConfigs table and custom override flags to leaveBalances"`

---

### Task 2: Domain Calculation Logic & Unit Tests for Rollover & Leave Balances

**Files:**
- Modify: `backend/src/domain/leaveCalculation.ts`
- Modify: `backend/src/domain/leaveCalculation.test.ts`

**Interfaces:**
- Consumes: Angka kuota dasar, cuti bersama, saldo tahun sebelumnya, dan kuota terpakai.
- Produces:
  - `calculateRolloverCarryForward(input: { prevBaseQuota: number; prevCollectiveLeave: number; prevCarriedOver: number; prevUsedQuota: number; maxCarryForwardDays: number; isCarryForwardEnabled: boolean }): number`
  - `calculateLeaveBalances(input: CalculateLeaveBalancesInput): CalculateLeaveBalancesOutput` (menghasilkan `cleanAnnualQuota`, `totalEntitlement`, `availableBefore`, `remainingAfter`, `hasSufficientBalance`).

- [x] **Step 1: Write failing calculation tests in leaveCalculation.test.ts**
  Tambahkan pengujian untuk:
  - Kalkulasi Hak Bersih (`baseQuota - collectiveLeaveDays`).
  - Total Hak Cuti Aktif (`cleanAnnualQuota + carriedOverQuota`).
  - Sisa Cuti (`totalEntitlement - usedQuota`).
  - Auto-rollover carry forward dengan limit `maxCarryForwardDays`.
  - Auto-rollover ketika `isCarryForwardEnabled = false` (menghasilkan 0).
  - Kasus sisa cuti tahun lalu bernilai 0 atau negatif (menghasilkan 0).
- [x] **Step 2: Run test to verify it fails**
  Run: `npm --prefix backend test`
  Expected: FAIL with undefined function / missing output properties.
- [x] **Step 3: Implement calculation logic in leaveCalculation.ts**
  Implementasikan fungsi kalkulasi sesuai formula yang telah disepakati.
- [x] **Step 4: Run test to verify it passes**
  Run: `npm --prefix backend test`
  Expected: PASS
- [x] **Step 5: Commit**
  Run: `git add backend/src/domain/leaveCalculation.ts backend/src/domain/leaveCalculation.test.ts`
  `git commit -m "feat(leaves): implement leave rollover calculation and entitlement formulas"`

---

### Task 3: Backend Controller & Services for Master Leave Configuration & Transactional Bulk-Sync

**Files:**
- Modify: `backend/src/controllers/leaveController.ts`
- Modify: `backend/src/controllers/leaveController.test.ts`

**Interfaces:**
- Produces:
  - `getAnnualLeaveConfig(req: Request, res: Response): Promise<Response>`
  - `saveAnnualLeaveConfig(req: Request, res: Response): Promise<Response>` (Zod validation, upsert config, bulk-sync transactional)
  - `getMasterLeaveBalances(req: Request, res: Response): Promise<Response>` (mengambil seluruh saldo karyawan aktif untuk tahun YYYY beserta agregat statistik)
  - `updateEmployeeLeaveBalance(req: Request, res: Response): Promise<Response>` (update individual saldo dengan `isCustomQuota` / `isCustomCarryForward`)

- [x] **Step 1: Write failing controller unit tests in leaveController.test.ts**
  Tambahkan test suite untuk pengujian:
  - Validasi Zod schema konfigurasi cuti tahunan (menolak angka negatif).
  - Logika bulk sync: inisialisasi karyawan baru, update cuti bersama, proteksi custom quota.
  - Endpoint update individual balance: menandai custom override flag.
- [x] **Step 2: Run test to verify it fails**
  Run: `npm --prefix backend test`
  Expected: FAIL with missing functions.
- [x] **Step 3: Implement controller functions in leaveController.ts**
  Tulis implementasi lengkap keempat handler dengan error handling ketat, logging, dan transaksi database (`db.transaction`).
- [x] **Step 4: Run test to verify it passes**
  Run: `npm --prefix backend test`
  Expected: PASS
- [x] **Step 5: Commit**
  Run: `git add backend/src/controllers/leaveController.ts backend/src/controllers/leaveController.test.ts`
  `git commit -m "feat(leaves): implement master config, transactional bulk-sync, and balance adjustment controllers"`

---

### Task 4: Backend Route Registration & RBAC Authorization

**Files:**
- Modify: `backend/src/routes/leaveRoutes.ts`
- Modify: `backend/src/routes/leaveRoutes.test.ts`

**Interfaces:**
- Routes:
  - `GET /api/v1/leaves/master/config` -> `requirePermission([attendance.view, attendance.manage])`
  - `POST /api/v1/leaves/master/config` -> `requirePermission([attendance.manage])`
  - `GET /api/v1/leaves/master/balances` -> `requirePermission([attendance.view, attendance.manage])`
  - `PUT /api/v1/leaves/master/balances/:id` -> `requirePermission([attendance.manage])`

- [x] **Step 1: Write failing route tests in leaveRoutes.test.ts**
  Uji bahwa rute baru terdaftar dan dilindungi permission guard yang tepat.
- [x] **Step 2: Run test to verify it fails**
  Run: `npm --prefix backend test`
  Expected: FAIL.
- [x] **Step 3: Register routes in leaveRoutes.ts**
  Daftarkan rute-rute baru dengan middleware RBAC auth.
- [x] **Step 4: Run test to verify it passes**
  Run: `npm --prefix backend test`
  Expected: PASS
- [x] **Step 5: Commit**
  Run: `git add backend/src/routes/leaveRoutes.ts backend/src/routes/leaveRoutes.test.ts`
  `git commit -m "feat(leaves): register master leave routes with attendance.manage RBAC protection"`

---

### Task 5: Frontend Shared Types & Navigation Configuration

**Files:**
- Modify: `frontend/src/types/leaves.ts`
- Modify: `frontend/src/components/layout/DashboardLayout.tsx`
- Modify: `frontend/src/lib/access/routes.ts`

**Interfaces:**
- Shared Types:
  - `AnnualLeaveConfig`: `{ id?: number; year: number; baseQuota: number; collectiveLeaveDays: number; allowCarryForward: boolean; maxCarryForwardDays: number; notes: string | null; }`
  - `MasterLeaveBalanceItem`: `{ balanceId: number; employeeId: number; employeeCode: string; fullName: string; department: string; position: string; year: number; baseQuota: number; collectiveLeaveDeduction: number; cleanAnnualQuota: number; carriedOverQuota: number; totalEntitlement: number; usedQuota: number; remainingQuota: number; isCustomQuota: boolean; isCustomCarryForward: boolean; }`
  - `MasterLeaveBalancesResponse`: `{ year: number; totalEmployees: number; totalAllocatedQuota: number; averageRemainingDays: number; totalUsedDays: number; balances: MasterLeaveBalanceItem[]; }`
  - `UpdateLeaveBalancePayload`: `{ baseQuota?: number; carriedOverQuota?: number; }`
- Navigation:
  - Item `Pengaturan Cuti` di sidebar navigasi (`/dashboard/leaves/settings`) dengan permission `attendance.manage`.
  - Konfigurasi izin rute di `frontend/src/lib/access/routes.ts`.

- [x] **Step 1: Add types in frontend/src/types/leaves.ts**
  Definisikan tipe-tipe TypeScript untuk respons API master cuti dan rekap saldo.
- [x] **Step 2: Add sidebar navigation item in DashboardLayout.tsx**
  Tambahkan submenu `Pengaturan Cuti` (`/dashboard/leaves/settings`) di bawah kelompok menu Cuti/Attendance.
- [x] **Step 3: Configure route permission in routes.ts**
  Daftarkan `/dashboard/leaves/settings` dengan hak akses `attendance.manage`.
- [x] **Step 4: Verify frontend type check**
  Run: `npm --prefix frontend run build` atau `npx --prefix frontend tsc --noEmit`
  Expected: PASS
- [x] **Step 5: Commit**
  Run: `git add frontend/src/types/leaves.ts frontend/src/components/layout/DashboardLayout.tsx frontend/src/lib/access/routes.ts`
  `git commit -m "feat(leaves): add master leave types and configure sidebar navigation and route guard"`

---

### Task 6: Frontend Settings UI - Master Leave Configuration & Carry-Forward Form

**Files:**
- Create: `frontend/src/components/leaves/AnnualLeaveConfigCard.tsx`
- Create: `frontend/src/components/leaves/AnnualLeaveStatsCards.tsx`
- Create: `frontend/src/app/dashboard/leaves/settings/page.tsx`

**Interfaces:**
- `AnnualLeaveConfigCard`: Form konfigurasi tahunan dengan kontrol:
  - Tahun Kalender (Selector / Input).
  - Hak Cuti Dasar Default (Hari).
  - Total Cuti Bersama Tahunan (Hari) beserta keterangan bantuan.
  - Switch/Toggle Izinkan Carry Forward beserta batas maksimal hari.
  - Catatan Kebijakan HR (Textarea).
  - Tombol Simpan dengan status loading, toast feedback, dan dialog konfirmasi bulk-sync.
- `AnnualLeaveStatsCards`: 4 kartu ringkasan metrik (Total Karyawan Aktif, Rata-rata Sisa Cuti, Total Terpakai, Total Kuota Dialokasikan).
- Page: Container utama yang mengintegrasikan form dan kartu ringkasan dengan state synchronization.

- [x] **Step 1: Implement AnnualLeaveStatsCards.tsx**
  Buat komponen 4 kartu statistik ringkasan dengan ikon modern dan animasi halus.
- [x] **Step 2: Implement AnnualLeaveConfigCard.tsx**
  Buat form konfigurasi master cuti berbahasa Indonesia lengkap dengan validasi client-side, toggle carry-forward, dan modal konfirmasi penerapan saldo.
- [x] **Step 3: Setup initial settings/page.tsx**
  Integrasikan form dan statistik di `frontend/src/app/dashboard/leaves/settings/page.tsx` dengan fetch data `GET /api/v1/leaves/master/config?year=YYYY`.
- [x] **Step 4: Verify frontend type check**
  Run: `npx --prefix frontend tsc --noEmit`
  Expected: PASS
- [x] **Step 5: Commit**
  Run: `git add frontend/src/components/leaves/AnnualLeaveConfigCard.tsx frontend/src/components/leaves/AnnualLeaveStatsCards.tsx frontend/src/app/dashboard/leaves/settings/page.tsx`
  `git commit -m "feat(leaves): implement annual leave master configuration card and summary statistics"`

---

### Task 7: Frontend Balance Recap Table & Manual Override Modal

**Files:**
- Create: `frontend/src/components/leaves/MasterLeaveBalancesTable.tsx`
- Create: `frontend/src/components/leaves/LeaveBalanceEditModal.tsx`
- Modify: `frontend/src/app/dashboard/leaves/settings/page.tsx`

**Interfaces:**
- `MasterLeaveBalancesTable`:
  - Toolbar pencarian (Nama / NIP).
  - Filter dropdown Departemen.
  - Filter status saldo (Semua, Aman $\ge 4$, Menipis $1-3$, Habis $0$).
  - Tabel dengan kolom: Karyawan, Hak Dasar, Cuti Bersama, Hak Bersih, Carry Over, Terpakai, Sisa Cuti (Badge warna), dan Tombol Aksi Edit.
- `LeaveBalanceEditModal`:
  - Form dialog untuk mengubah `baseQuota` dan `carriedOverQuota` perorangan.
  - Tampilan pratinjau kalkulasi instan (`Hak Bersih`, `Total Hak`, dan `Sisa Cuti`) sebelum disimpan.
  - Tombol Simpan & Batal dengan penanganan error.

- [x] **Step 1: Implement LeaveBalanceEditModal.tsx**
  Buat modal koreksi saldo individual dengan pratinjau instan sisa cuti.
- [x] **Step 2: Implement MasterLeaveBalancesTable.tsx**
  Buat tabel rekap komprehensif seluruh karyawan dengan toolbar filter, indikator badge visual (Hijau, Kuning, Merah), badge penanda custom override, dan tombol edit.
- [x] **Step 3: Integrate Table & Modal into settings/page.tsx**
  Hubungkan tabel dan modal ke halaman utama, sehingga saat simpan master config atau edit individual saldo dilakukan, data tabel dan metrik statistik langsung ter-refresh otomatis.
- [x] **Step 4: Verify frontend type check**
  Run: `npx --prefix frontend tsc --noEmit`
  Expected: PASS
- [x] **Step 5: Commit**
  Run: `git add frontend/src/components/leaves/MasterLeaveBalancesTable.tsx frontend/src/components/leaves/LeaveBalanceEditModal.tsx frontend/src/app/dashboard/leaves/settings/page.tsx`
  `git commit -m "feat(leaves): implement master leave balances recap table and individual balance override modal"`

---

### Task 8: Verification Loop & Quality Assurance

**Files:**
- All touched files

- [x] **Step 1: Run Backend Tests**
  Run: `npm --prefix backend test`
  Expected: All tests PASS with 0 failures.
- [x] **Step 2: Run Backend and Frontend Typechecks**
  Run: `npx --prefix backend tsc --noEmit && npx --prefix frontend tsc --noEmit`
  Expected: No TypeScript errors.
- [x] **Step 3: Final Verification Commit**
  Commit any remaining cleanup or formatting if needed.
