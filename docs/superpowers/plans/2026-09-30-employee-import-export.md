# Employee Master Data Import & Export (Talenta Compatibility) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghadirkan fitur import (2-Step: Upload & Preview -> Commit) dan export data master karyawan berbasis file Excel (.xlsx) dengan kompatibilitas penuh 33 kolom data HRIS Talenta, auto-creation departemen baru, dan validasi reject atomik.

**Architecture:** Memperluas skema tabel `employees` Drizzle ORM dengan 25 kolom baru. Membuat modul backend parser/validator murni (`employeeImport.ts`) dan controller transactional (`employeeImportController.ts`, `employeeExportController.ts`) menggunakan `exceljs` dan `multer.memoryStorage`. Menghubungkan frontend Next.js pada halaman Employee Directory dengan tombol Export dan Modal 2-Step Import interaktif.

**Tech Stack:** TypeScript, Node.js (Express), Drizzle ORM (PostgreSQL), ExcelJS, Multer, Zod, React 19 / Next.js 16, Tailwind CSS v4, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-09-30-employee-import-export-design.md`

## Global Constraints

- Wajib mendukung 33 kolom persis seperti susunan file `docs/TARIKAN TALENTA KARYAWAN AKTIF.xlsx`.
- Strict Reject Policy: Jika ditemukan NIK/Employee ID duplikat di file atau sudah ada di database, batalkan transaksi import secara penuh.
- Auto-create Department: Kolom `Organization` jika belum ada di tabel `departments` otomatis dibuatkan baris baru dengan slug code unik.
- Parsing Excel menggunakan in-memory buffer (`multer.memoryStorage()`) untuk menghindari penyimpanan file sementara di disk.
- Semua endpoint backend dilindungi JWT middleware (`authenticateToken`), izin `master.view` untuk export & template, dan `master.manage` untuk import preview & commit.
- Immutable updates dan sanitasi input, mematuhi WCAG 2.2 AA pada komponen UI frontend.

## Review Focus

1. **Date Parsing Variatif**: Format tanggal lahir / join date pada Excel bisa berupa string (`YYYY-MM-DD`), objek Date dari ExcelJS, atau serial number Excel (contoh: 43019). Parser harus menangani ketiganya tanpa throw error.
2. **Missing/Blank Organization**: Jika ada baris karyawan tanpa Organization, harus tetap dapat diproses sebagai unassigned (`departmentId: null`).
3. **Leading Zeros pada NIK & Telepon**: NIK (misal `30002` atau `085711342895`) tidak boleh terpotong atau terkonversi menjadi format saintifik (`3e4`) saat dibaca dari Excel.
4. **Header Whitespace Tolerance**: Header Excel dengan spasi ekstra di awal/akhir (misal `" Full Name "`) harus tetap dikenali melalui normalisasi trim.
5. **Rollback Integrity**: Kegagalan pada baris ke-N tidak boleh menyisakan data karyawan maupun data departemen baru di database.

---

## Shared Interfaces

```typescript
// Shared Types for Employee Import/Export
export interface EmployeeImportRowData {
  rowNumber: number;
  employeeCode: string;
  fullName: string;
  barcode?: string | null;
  organization?: string | null;
  position?: string | null;
  jobLevel?: string | null;
  joinDate?: string | null; // ISO YYYY-MM-DD
  employmentStatus?: string | null;
  email: string;
  birthDate?: string | null; // ISO YYYY-MM-DD
  age?: string | null;
  birthPlace?: string | null;
  citizenIdAddress?: string | null;
  residentialAddress?: string | null;
  npwp?: string | null;
  ptkpStatus?: string | null;
  employeeTaxStatus?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankAccountHolder?: string | null;
  bpjsKetenagakerjaan?: string | null;
  bpjsKesehatan?: string | null;
  nikKtp?: string | null;
  mobilePhone?: string | null;
  secondaryPhone?: string | null;
  religion?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  bloodType?: string | null;
  nationalityCode?: string | null;
  currency?: string | null;
  lengthOfService?: string | null;
  npwp16Digit?: string | null;
}

export interface EmployeeImportSummary {
  totalRows: number;
  validCount: number;
  errorCount: number;
  newDepartmentsCount: number;
  newDepartments: string[];
}

export interface EmployeeImportValidationError {
  rowNumber: number;
  employeeCode?: string;
  field?: string;
  message: string;
}

export interface EmployeeImportPreviewResult {
  valid: boolean;
  summary: EmployeeImportSummary;
  errors: EmployeeImportValidationError[];
  previewRows: Array<EmployeeImportRowData & { isValid: boolean; errors: string[] }>;
}
```

---

### Task 1: Database Schema Extension & Migration

**Files:**
- Modify: `backend/src/db/schema/employees.ts`
- Create / Run Migration: `backend/src/db/migrations/add_talenta_columns.sql` atau via runner
- Test: `backend/src/db/schema/employees.test.ts`

**Interfaces:**
- Consumes: PostgreSQL connection via `db`
- Produces: Updated `employees` Drizzle table definition with 25 new nullable columns

- [ ] **Step 1: Write the failing test**
  Buat test `backend/src/db/schema/employees.test.ts` yang memverifikasi kolom baru ada pada skema `employees`.
  ```typescript
  import { test } from 'node:test';
  import assert from 'node:assert';
  import { employees } from './employees';

  test('employees schema has all 33 Talenta compatible columns', () => {
    assert.ok(employees.barcode);
    assert.ok(employees.jobLevel);
    assert.ok(employees.joinDate);
    assert.ok(employees.employmentStatus);
    assert.ok(employees.birthDate);
    assert.ok(employees.bankName);
    assert.ok(employees.bankAccount);
    assert.ok(employees.nikKtp);
    assert.ok(employees.bpjsKetenagakerjaan);
    assert.ok(employees.bpjsKesehatan);
    assert.ok(employees.npwp16Digit);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test --prefix backend src/db/schema/employees.test.ts`
  Expected: FAIL (`employees.barcode is undefined`)

- [ ] **Step 3: Implement minimal code in `backend/src/db/schema/employees.ts`**
  Tambahkan 25 kolom baru di `employees.ts` seperti yang dispesifikasikan di Design Spec. Eksekusi DDL migration (`ALTER TABLE employees ADD COLUMN IF NOT EXISTS ...`) pada database PostgreSQL.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test --prefix backend src/db/schema/employees.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add backend/src/db/schema/employees.ts backend/src/db/schema/employees.test.ts
  git commit -m "feat(backend): extend employees schema with talenta hr columns"
  ```

---

### Task 2: Excel Parser, Validator & Lookups Library

**Files:**
- Create: `backend/src/lib/employeeImport.ts`
- Create: `backend/src/lib/employeeImport.test.ts`

**Interfaces:**
- Consumes: Raw buffer XLSX file
- Produces: `parseEmployeeWorkbook(buffer): Promise<EmployeeImportRowData[]>`, `validateEmployeeImport(rows, existingCodes, existingEmails, existingDeptNames): EmployeeImportPreviewResult`, `buildEmployeeImportTemplate(): Promise<Buffer>`

- [ ] **Step 1: Write the failing test**
  Buat test unit di `backend/src/lib/employeeImport.test.ts` yang menguji:
  1. Parsing file real `docs/TARIKAN TALENTA KARYAWAN AKTIF.xlsx` menghasilkan 242 baris.
  2. Deteksi duplikasi NIK menghasilkan error dengan reject flag.
  3. Format tanggal (Date object, string, number) terkonversi ke ISO `YYYY-MM-DD`.
  4. Template generator menghasilkan binary buffer Excel yang valid.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test --prefix backend src/lib/employeeImport.test.ts`
  Expected: FAIL (`Cannot find module ./employeeImport`)

- [ ] **Step 3: Implement `backend/src/lib/employeeImport.ts`**
  Implementasikan fungsi:
  - `parseEmployeeWorkbook(buffer: Buffer): Promise<EmployeeImportRowData[]>`
  - `validateEmployeeImport(rows, lookups): EmployeeImportPreviewResult`
  - `buildEmployeeImportTemplate(): Promise<Buffer>`
  - Normalisasi header trim, parsing format tanggal, parsing nomor rekening dan NIK sebagai string murni.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test --prefix backend src/lib/employeeImport.test.ts`
  Expected: PASS (Semua tes parser & template berhasil 100%)

- [ ] **Step 5: Commit**
  ```bash
  git add backend/src/lib/employeeImport.ts backend/src/lib/employeeImport.test.ts
  git commit -m "feat(backend): implement employee excel parser and validator library"
  ```

---

### Task 3: Backend Controller & Routes for Template, Preview, and Commit

**Files:**
- Create: `backend/src/controllers/employeeImportController.ts`
- Modify: `backend/src/routes/employeeRoutes.ts`
- Create: `backend/src/controllers/employeeImport.integration.test.ts`

**Interfaces:**
- Consumes: Express Request (with Multer single file `file`) & Auth context
- Produces:
  - `GET /api/v1/employees/import/template`
  - `POST /api/v1/employees/import/preview`
  - `POST /api/v1/employees/import/commit`

- [ ] **Step 1: Write the failing integration test**
  Buat test `backend/src/controllers/employeeImport.integration.test.ts`:
  1. Endpoint `GET /import/template` mengembalikan 200 dengan header spreadsheetml.
  2. Endpoint `POST /import/preview` mengembalikan summary preview dari file valid.
  3. Endpoint `POST /import/preview` mengembalikan error jika NIK sudah ada di database.
  4. Endpoint `POST /import/commit` berhasil insert karyawan dan auto-create departemen baru secara transactional.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test --prefix backend src/controllers/employeeImport.integration.test.ts`
  Expected: FAIL (`Route not found / Controller undefined`)

- [ ] **Step 3: Implement `employeeImportController.ts` and register in `employeeRoutes.ts`**
  Implementasikan:
  - Multer middleware in-memory storage (`upload.single('file')`).
  - `downloadEmployeeTemplate`: streams Excel template.
  - `previewEmployeeImport`: memuat lookups DB, validasi baris, mengembalikan JSON preview.
  - `commitEmployeeImport`: `db.transaction(async (tx) => { ... })` yang auto-create departments dan bulk-insert employees, mencatat audit log, dan rollback jika terjadi bentrok NIK.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test --prefix backend src/controllers/employeeImport.integration.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add backend/src/controllers/employeeImportController.ts backend/src/routes/employeeRoutes.ts backend/src/controllers/employeeImport.integration.test.ts
  git commit -m "feat(backend): add employee import template, preview, and commit endpoints"
  ```

---

### Task 4: Backend Controller & Route for Employee Export XLSX

**Files:**
- Create: `backend/src/controllers/employeeExportController.ts`
- Modify: `backend/src/routes/employeeRoutes.ts`
- Create: `backend/src/controllers/employeeExport.test.ts`

**Interfaces:**
- Consumes: Query params `status` (optional)
- Produces: `GET /api/v1/employees/export` streaming XLSX file with 33 columns

- [ ] **Step 1: Write the failing test**
  Buat test `backend/src/controllers/employeeExport.test.ts` yang memverifikasi file Excel yang dihasilkan memiliki 33 header identik dengan Talenta dan memuat baris data karyawan aktif.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test --prefix backend src/controllers/employeeExport.test.ts`
  Expected: FAIL (`Cannot find module ./employeeExportController`)

- [ ] **Step 3: Implement `employeeExportController.ts`**
  Implementasikan fungsi `exportEmployeesToExcel(req, res)`:
  - Query database `employees` join `departments` dan `locations`.
  - Buat Excel workbook menggunakan `exceljs`.
  - Format header dengan style tebal (bold) dan background header profesional.
  - Set response headers attachment filename `ams-karyawan-<date>.xlsx`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test --prefix backend src/controllers/employeeExport.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add backend/src/controllers/employeeExportController.ts backend/src/routes/employeeRoutes.ts backend/src/controllers/employeeExport.test.ts
  git commit -m "feat(backend): add employee export to excel endpoint"
  ```

---

### Task 5: Frontend 2-Step Import Modal & Export Button Integration

**Files:**
- Create: `frontend/src/components/master/EmployeeImportModal.tsx`
- Modify: `frontend/src/app/dashboard/master/employees/page.tsx`
- Create / Run Frontend Test: `frontend/src/lib/employeeImportUI.test.mjs`

**Interfaces:**
- Consumes: Backend endpoints `/employees/import/preview`, `/employees/import/commit`, `/employees/import/template`, `/employees/export`
- Produces: Interactive modal with file dropzone, Bento stats summary, preview table, error badge list, commit trigger, and direct export download button.

- [ ] **Step 1: Write unit test for UI helper/state formatting**
  Buat test `frontend/src/lib/employeeImportUI.test.mjs` untuk memvalidasi formatting summary card dan status badge validasi preview.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test --prefix frontend src/lib/employeeImportUI.test.mjs`
  Expected: FAIL

- [ ] **Step 3: Implement `EmployeeImportModal.tsx` and integrate in `page.tsx`**
  - Buat komponen modal `EmployeeImportModal`:
    - Step 1: Upload box, download template link, file size limit info.
    - Step 2: Bento summary grid, warning untuk departemen baru, list error jika ada bentrok NIK, preview table 10 baris pertama, tombol konfirmasi.
  - Update `frontend/src/app/dashboard/master/employees/page.tsx`:
    - Tambahkan tombol **Export Excel** (panggil download API stream).
    - Tambahkan tombol **Import Excel** yang membuka modal.
    - Pasang refresh data otomatis (`fetchData()`) setelah import sukses.

- [ ] **Step 4: Run test and verify build & lint**
  Run: `npm test --prefix frontend && npm run build --prefix frontend`
  Expected: PASS (semua route dan build frontend Next.js berhasil)

- [ ] **Step 5: Commit**
  ```bash
  git add frontend/src/components/master/EmployeeImportModal.tsx frontend/src/app/dashboard/master/employees/page.tsx frontend/src/lib/employeeImportUI.test.mjs
  git commit -m "feat(frontend): add 2-step employee import modal and export button"
  ```

---

### Task 6: Full Verification Loop & Real Talenta File Import Run

**Files:**
- Verification only

- [ ] **Step 1: Execute full test suite backend & frontend**
  Run:
  - `npm test --prefix backend`
  - `npx tsc --noEmit --project backend/tsconfig.json`
  - `npm test --prefix frontend`
  - `npm run lint --prefix frontend`

- [ ] **Step 2: Test Import real file `docs/TARIKAN TALENTA KARYAWAN AKTIF.xlsx`**
  Jalankan script verifikasi import langsung terhadap file real Talenta, memastikan 242 baris masuk ke database dan departemen terbuat otomatis.

- [ ] **Step 3: Test Export to Excel and verify 33 headers match**
  Jalankan curl / node script untuk memicu export dan memvalidasi file Excel hasil export.

- [ ] **Step 4: Final commit & documentation update**
  ```bash
  git commit -m "chore: verify employee import export feature end-to-end"
  ```
