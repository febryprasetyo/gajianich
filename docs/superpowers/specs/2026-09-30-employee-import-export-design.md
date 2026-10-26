# Design Specification: Employee Master Data Import & Export (Talenta Compatibility)

**Date**: 2026-09-30  
**Status**: Draft (Awaiting User Review)  
**Feature**: Employee Master Data Import & Export with Full Talenta Compatibility  
**Author**: Antigravity / Pair Programmer

---

## 1. Summary & Problem Statement

Sistem Asset Management System (AMS) mengelola aset, lisensi, tiket operasional, dan kepemilikan aset (*custodian*) yang terikat langsung dengan data karyawan (*employees*). Saat ini:
1. Input data karyawan hanya dapat dilakukan satu per satu secara manual melalui form modal di halaman Employee Directory.
2. Perusahaan memiliki data master karyawan aktif dalam format Excel dari HRIS Talenta (`docs/TARIKAN TALENTA KARYAWAN AKTIF.xlsx`) berisi 242+ karyawan dan 33 kolom data lengkap (identitas, jabatan, departemen/organisasi, kompensasi/rekening, BPJS, tanggal bergabung, dan data kependudukan).
3. Tabel database `employees` yang ada saat ini hanya memuat beberapa kolom dasar (`employeeCode`, `fullName`, `email`, `phone`, `departmentId`, `locationId`, `position`, `status`), sehingga informasi penting HR dari Talenta belum dapat disimpan.

Fitur ini menyediakan mekanisme **Import** (2-Step: Upload & Preview -> Commit Transaction) dan **Export** data karyawan dalam format `.xlsx` yang 100% kompatibel dengan format tarikan Talenta, termasuk auto-provisioning departemen/organisasi baru dan perlindungan duplikasi dengan aturan *Reject*.

---

## 2. Goals & Non-Goals

### Goals
- **Full Talenta Field Support**: Menambahkan kolom database pada tabel `employees` untuk menampung seluruh 33 kolom data dari file tarikan Talenta.
- **Auto-create Departments**: Jika nama `Organization` pada file Excel belum terdaftar di tabel master `departments`, sistem secara otomatis membuat departemen baru dengan kode departemen unik (misal `CMC III` -> `CMC-III`).
- **Strict Duplicate Protection (Reject Policy)**: Jika terdapat NIK / `Employee ID` yang sudah ada di database atau duplikat dalam file upload, proses import ditolak secara atomik (transaksi di-rollback penuh, tidak ada data yang masuk setengah-setengah).
- **2-Step Import Workflow**:
  - Step 1: Upload file Excel (.xlsx) dengan opsi unduh template kosong atau contoh data.
  - Step 2: Validasi & tampilan Preview Bento (Total Rows, Valid Rows, Error Rows, New Departments to be created) dan tabel data sebelum commit.
- **Export to XLSX**: Endpoint dan tombol export di UI untuk mengunduh seluruh data master karyawan aktif dalam file Excel dengan susunan kolom standar Talenta.
- **RBAC Enforcement**: Membatasi aksi ekspor/template pada izin `master.view` dan aksi import preview/commit pada izin `master.manage`.

### Non-Goals
- Tidak mengotomatisasi pembuatan akun login pengguna (`users`) untuk setiap karyawan yang di-import (akun aplikasi tetap dikelola terpisah di User Management).
- Tidak melakukan sinkronisasi dua arah real-time dengan API Talenta (menggunakan file `.xlsx` berbasis file upload/download).
- Tidak mengubah logika kepemilikan aset (`assetCustodians`) secara otomatis saat import karyawan, namun karyawan yang di-import akan langsung tersedia untuk ditunjuk sebagai custodian aset.

---

## 3. Data Model & Schema Diffs

### Database Schema Extension (`backend/src/db/schema/employees.ts`)

Menambahkan 25 atribut baru pada tabel `employees`:

```typescript
import { pgTable, bigint, varchar, text, date, timestamp } from 'drizzle-orm/pg-core';
import { departments, locations } from './master';

export const employees = pgTable('employees', {
  // Existing Columns
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  employeeCode: varchar('employee_number', { length: 50 }).notNull().unique(), // Employee ID / NIK
  fullName: varchar('full_name', { length: 150 }).notNull(),
  email: varchar('email', { length: 150 }).notNull().unique(),
  phone: varchar('phone', { length: 50 }),
  departmentId: bigint('department_id', { mode: 'number' }).references(() => departments.id),
  locationId: bigint('location_id', { mode: 'number' }).references(() => locations.id),
  position: varchar('position', { length: 100 }),
  status: varchar('status', { length: 30 }).default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),

  // New Columns for 33 Talenta Fields Compatibility
  barcode: varchar('barcode', { length: 100 }),
  jobLevel: varchar('job_level', { length: 100 }),
  joinDate: date('join_date'),
  employmentStatus: varchar('employment_status', { length: 50 }), // Kontrak, Permanent, dll.
  birthDate: date('birth_date'),
  age: varchar('age', { length: 50 }),
  birthPlace: varchar('birth_place', { length: 100 }),
  citizenIdAddress: text('citizen_id_address'),
  residentialAddress: text('residential_address'),
  npwp: varchar('npwp', { length: 50 }),
  ptkpStatus: varchar('ptkp_status', { length: 20 }),
  employeeTaxStatus: varchar('employee_tax_status', { length: 50 }),
  bankName: varchar('bank_name', { length: 50 }),
  bankAccount: varchar('bank_account', { length: 50 }),
  bankAccountHolder: varchar('bank_account_holder', { length: 150 }),
  bpjsKetenagakerjaan: varchar('bpjs_ketenagakerjaan', { length: 50 }),
  bpjsKesehatan: varchar('bpjs_kesehatan', { length: 50 }),
  nikKtp: varchar('nik_ktp', { length: 50 }),
  mobilePhone: varchar('mobile_phone', { length: 50 }),
  secondaryPhone: varchar('secondary_phone', { length: 50 }),
  religion: varchar('religion', { length: 30 }),
  gender: varchar('gender', { length: 20 }),
  maritalStatus: varchar('marital_status', { length: 30 }),
  bloodType: varchar('blood_type', { length: 10 }),
  nationalityCode: varchar('nationality_code', { length: 20 }),
  currency: varchar('currency', { length: 10 }).default('IDR'),
  lengthOfService: varchar('length_of_service', { length: 100 }),
  npwp16Digit: varchar('npwp_16_digit', { length: 50 }),
});
```

### Migration Plan
- Generate migrasi Drizzle (`npm run db:generate --prefix backend`) atau eksekusi DDL `ALTER TABLE employees ADD COLUMN ...` yang idempotent.
- Semua kolom baru bersifat *nullable* sehingga tidak merusak data lama yang sudah ada.

---

## 4. API Specifications

Semua endpoint diautentikasi melalui `authenticateToken`.

### 1. Download Import Template
- **Method & Path**: `GET /api/v1/employees/import/template`
- **Permission**: `master.view`
- **Response**: `200 OK` dengan binary stream Excel (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
- **Filename**: `ams-employee-import-template.xlsx`. Berisi 33 header standar Talenta dengan 2 contoh baris dummy untuk panduan pengisian.

### 2. Preview Import
- **Method & Path**: `POST /api/v1/employees/import/preview`
- **Permission**: `master.manage`
- **Content-Type**: `multipart/form-data` (file key: `file`)
- **Response Body (`200 OK`)**:
```json
{
  "valid": true,
  "summary": {
    "totalRows": 242,
    "validCount": 242,
    "errorCount": 0,
    "newDepartmentsCount": 3,
    "newDepartments": ["CMC III", "AURORA GREENLAND INDONESIA", "INTERNUSA JAYA RAYA"]
  },
  "errors": [],
  "previewData": [
    {
      "rowNumber": 2,
      "employeeCode": "30002",
      "fullName": "ABDUL AZIZ ZA",
      "organization": "CMC III",
      "position": "STAFF",
      "email": "ABDULAZIZZA501@GMAIL.COM",
      "status": "Kontrak",
      "isValid": true,
      "notes": []
    }
  ]
}
```
- **Error Response (`400 Bad Request`)**: Jika ada NIK duplikat di file atau sudah terdaftar di database, `valid: false` dan array `errors` berisi detail baris yang bermasalah.

### 3. Commit Import
- **Method & Path**: `POST /api/v1/employees/import/commit`
- **Permission**: `master.manage`
- **Content-Type**: `multipart/form-data` (file key: `file`)
- **Process**:
  1. Parse workbook dalam buffer.
  2. Buka database transaction (`db.transaction`).
  3. Cek duplikasi NIK dan Email terhadap database. Jika ditemukan bentrok, lempar error untuk memicu rollback otomatis.
  4. Ambil semua `Organization`. Jika ada yang belum ada di tabel `departments`, lakukan insert dengan kode unik slug (contoh: `CMC III` -> `CMC-III`).
  5. Bulk insert baris karyawan ke tabel `employees`.
  6. Catat entri ke `audit_logs`.
  7. Commit transaksi.
- **Response Body (`200 OK`)**:
```json
{
  "message": "Successfully imported 242 employees",
  "importedCount": 242,
  "createdDepartmentsCount": 3
}
```

### 4. Export Employees
- **Method & Path**: `GET /api/v1/employees/export`
- **Permission**: `master.view`
- **Query Params**: `?status=Active` (opsional filter status)
- **Response**: `200 OK` binary file Excel (`ams-karyawan-aktif-<YYYY-MM-DD>.xlsx`) dengan 33 kolom lengkap Talenta.

---

## 5. Mapping Atribut 33 Kolom Talenta

| No | Header Excel Talenta | Field Tabel `employees` | Tipe Data & Aturan |
|:---|:---------------------|:------------------------|:-------------------|
| 1  | Employee ID          | `employeeCode`          | String (Required, Unique, NIK) |
| 2  | Full Name            | `fullName`              | String (Required) |
| 3  | Barcode              | `barcode`               | String (Nullable) |
| 4  | Organization         | `departmentId`          | Relasi ke `departments` (Auto-create jika baru) |
| 5  | Job Position         | `position`              | String (Nullable) |
| 6  | Job Level            | `jobLevel`              | String (Nullable) |
| 7  | Join Date            | `joinDate`              | Date format (YYYY-MM-DD) |
| 8  | Status Employee      | `employmentStatus`      | String ('Kontrak', 'Permanent', dll) |
| 9  | Email                | `email`                 | String (Required, Unique format) |
| 10 | Birth Date           | `birthDate`             | Date format (YYYY-MM-DD) |
| 11 | Age                  | `age`                   | String (Nullable) |
| 12 | Birth Place          | `birthPlace`            | String (Nullable) |
| 13 | Citizen ID Address   | `citizenIdAddress`      | Text (Nullable) |
| 14 | Residential Address  | `residentialAddress`    | Text (Nullable) |
| 15 | NPWP                 | `npwp`                  | String (Nullable) |
| 16 | PTKP Status          | `ptkpStatus`            | String (Nullable) |
| 17 | Employee Tax Status  | `employeeTaxStatus`     | String (Nullable) |
| 18 | Bank Name            | `bankName`              | String (Nullable) |
| 19 | Bank Account         | `bankAccount`           | String (Nullable) |
| 20 | Bank Account Holder  | `bankAccountHolder`     | String (Nullable) |
| 21 | BPJS Ketenagakerjaan | `bpjsKetenagakerjaan`   | String (Nullable) |
| 22 | BPJS Kesehatan       | `bpjsKesehatan`         | String (Nullable) |
| 23 | NIK (NPWP 16 Digit)  | `nikKtp`                | String (Nullable) |
| 24 | Mobile Phone         | `mobilePhone`           | String (Nullable) |
| 25 | Phone                | `secondaryPhone`        | String (Nullable) |
| 26 | Religion             | `religion`              | String (Nullable) |
| 27 | Gender               | `gender`                | String (Nullable) |
| 28 | Marital Status       | `maritalStatus`         | String (Nullable) |
| 29 | Blood Type           | `bloodType`             | String (Nullable) |
| 30 | Nationality Code     | `nationalityCode`       | String (Nullable) |
| 31 | Currency             | `currency`              | String (Default 'IDR') |
| 32 | Length Of Service    | `lengthOfService`       | String (Nullable) |
| 33 | NPWP 16 digit (new)  | `npwp16Digit`           | String (Nullable) |

---

## 6. Frontend & UX Specifications

### Perubahan Halaman `Employee Directory` (`frontend/src/app/dashboard/master/employees/page.tsx`)
1. **Header Action Buttons**:
   - Tombol **Export Excel** (ikon `Download`): Mengunduh file `.xlsx` data terkini secara langsung.
   - Tombol **Import Excel** (ikon `Upload`): Membuka Modal Import Karyawan 2-Tahap.
   - Tombol **New Employee** (ikon `Plus`): Tetap untuk input satuan.
2. **Komponen Modal `EmployeeImportModal.tsx`**:
   - **Step 1 - File Dropzone**:
     - Upload drag-and-drop file `.xlsx`.
     - Tombol "Download Template Import".
     - Button "Lanjut ke Preview" (menghubungi endpoint `/preview`).
   - **Step 2 - Validation Summary & Preview**:
     - Bento summary card: Total Rows, Valid Rows, Error Rows, New Departments Found.
     - Warning box jika ditemukan departemen baru yang akan dibuat otomatis.
     - Error callout list jika ada baris error (misal: "Baris 14: NIK 30045 sudah ada di database").
     - Preview Table: Menampilkan 10 baris pertama sampel data import.
     - Action footer: Tombol "Kembali" dan tombol "Konfirmasi Import" (hanya aktif jika `errorCount === 0`).
   - State `isSubmitting` dengan spinner dan disable form saat proses commit berlangsung.

---

## 7. Security, Concurrency & Data Integrity

1. **Atomic Transaction**:
   - Seluruh proses simpan dan auto-create department dilakukan dalam `db.transaction`. Jika baris ke-200 gagal, baris 1 s/d 199 dan departemen yang baru terbuat akan di-rollback tanpa meninggalkan sampah data.
2. **File Validation & Multer Security**:
   - File dibatasi maksimal 10 MB dan hanya menerima mime type XLSX (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
   - Parsing dilakukan dari in-memory buffer (`multer.memoryStorage()`) untuk mencegah race condition penulisan file temporer di disk server.
3. **RBAC Guard**:
   - `master.manage` diwajibkan untuk endpoint import.
   - `master.view` diwajibkan untuk endpoint export & template.

---

## 8. Verification & Testing Strategy

1. **Unit & Integration Test (Backend)**:
   - Tes parsing file Excel Talenta real (`docs/TARIKAN TALENTA KARYAWAN AKTIF.xlsx`) memastikan 242 baris terurai dengan benar.
   - Tes penolakan (*Reject*) jika ada duplikasi NIK.
   - Tes auto-creation departemen baru.
   - Tes endpoint export menghasilkan workbook Excel yang valid dengan 33 header yang sesuai.
2. **Verification Loop Commands**:
   - Backend tests: `npm test --prefix backend`
   - Frontend tests & lint: `npm test --prefix frontend && npm run lint --prefix frontend`
   - Typecheck: `npx tsc --noEmit --project backend/tsconfig.json`
