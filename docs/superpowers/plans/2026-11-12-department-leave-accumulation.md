# Implementation Task Plan: Fitur Cuti Akumulasi Khusus Departemen (Unlimited)

## Shared Interfaces & Contracts
- Endpoint: `/api/leaves/master/config` (GET & POST)
- Endpoint: `/api/leaves/master/balances` (GET)
- Interface TypeScript: `AnnualLeaveConfig` with `accumulatedDepartmentIds?: number[]`

## Phase-by-Phase Checklist

- [x] **Phase 1: Database Schema & Migration**
  - [x] Tambahkan tabel `leaveAccumulatedDepartments` di `backend/src/db/schema/leaves.ts`
  - [x] Buat file migrasi `backend/drizzle/0054_leave_accumulated_departments.sql`
  - [x] Verifikasi schema export dan build database

- [x] **Phase 2: Backend Domain & Controllers (TDD)**
  - [x] Tulis unit test di `backend/src/domain/leaveCalculation.test.ts` untuk skenario akumulasi unlimited & reset
  - [x] Update `calculateRolloverCarryForward` di `backend/src/domain/leaveCalculation.ts`
  - [x] Update controller `getAnnualLeaveConfig` dan `saveAnnualLeaveConfig` di `backend/src/controllers/leaveController.ts`
  - [x] Update `getMasterLeaveBalances` untuk menyertakan `isAccumulationActive`
  - [x] Update/tambah controller unit test di `backend/src/controllers/leaveController.test.ts`
  - [x] Jalankan backend tests: `npm --prefix backend test`

- [x] **Phase 3: Frontend UI Components**
  - [x] Update tipe `AnnualLeaveConfig` dan `MasterLeaveBalanceItem` di `frontend/src/types/leaves.ts`
  - [x] Update `AnnualLeaveConfigCard.tsx` dengan checklist multi-departemen
  - [x] Update `frontend/src/app/dashboard/leaves/settings/page.tsx` untuk load departments dan menampilkan status badge akumulasi pada tabel
  - [x] Jalankan frontend typecheck: `npm --prefix frontend run typecheck`

- [x] **Phase 4: End-to-End Verification & Commit**
  - [x] Run full test suite & linting
  - [x] Git commit atomic dengan conventional commits
