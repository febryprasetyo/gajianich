# Design Spec: Pengajuan Cuti Karyawan & Cetak Dokumen F4 Full Page

## 1. Summary & Problem Statement

Perusahaan PT Cahaya Mas Cemerlang mengelola administrasi permohonan cuti karyawan dengan formulir standar (`FORM_CUTI_2024_(Office).xlsx`, Form Number: 001, REV. 170208-1-W). Saat ini, pengajuan cuti masih dilakukan secara manual/semi-manual di lembar Excel atau cetak kertas fisik, yang menimbulkan beberapa kendala:
1. Perhitungan saldo cuti tahunan, pengurangan cuti bersama pemerintah, dan akumulasi cuti yang sudah diambil sebelumnya rentan terhadap *human error* dan tidak terintegrasi secara realtime dengan profil karyawan.
2. Proses pengajuan, delegasi serah terima tugas (*handover*), dan persetujuan bertingkat (Pemohon, Atasan Langsung, HRD, Atasan dari Atasan Langsung) membutuhkan waktu dan sering tercecer.
3. Dokumen fisik yang dicetak dari sistem sering tidak pas dengan standar kertas operasional di Indonesia, yaitu **F4 / Folio (215 mm × 330 mm)**, sehingga terpotong menjadi 2 lembar atau format batas tabelnya tidak rapi.

Fitur ini mengintegrasikan seluruh alur cuti ke dalam aplikasi AMS/Gajianich:
- **Input Web UI**: Formulir digital yang otomatis mengisi identitas karyawan, menghitung kuota cuti bersih secara realtime (setelah dikurangi cuti bersama), memvalidasi ketersediaan saldo, mencatat delegasi tugas (*handover*), dan mendukung alur persetujuan.
- **Output Cetak Dokumen F4 Full Page**: Tampilan dokumen dan pratinjau cetak (*print preview/PDF*) yang mereplikasi format Excel secara *pixel-perfect* dalam ukuran **F4 (215 mm × 330 mm)** tepat **1 halaman penuh (single full page)** tanpa overflow.

---

## 2. Goals & Non-Goals

### Goals
1. **Model Data Kuota & Cuti Komprehensif**:
   - Skema database untuk konfigurasi tahunan cuti bersama (`leave_holiday_calendars`), saldo cuti karyawan (`leave_balances`), pengajuan cuti (`leave_requests`), dan delegasi/persetujuan bertingkat (`leave_approvals`).
2. **Kalkulasi Kuota Cuti Otomatis**:
   - Kuota Dasar Tahunan (default 12 hari).
   - Pengurangan Cuti Bersama resmi tahun berjalan (misal: 10 hari) menghasilkan Hak Cuti Pribadi Bersih (misal: 12 - 10 = 2 hari).
   - Riwayat cuti yang sudah diambil sebelumnya (daftar riwayat terperinci hingga 5 item terakhir pada format form).
   - Kalkulasi durasi kerja antara `Dari Tanggal` s/d `Sampai Tanggal` (otomatis melewati hari libur / cuti bersama).
   - Penentuan tanggal kembali bekerja (`Kembali Bekerja Tgl`) secara otomatis pada hari kerja efektif berikutnya.
3. **Formulir Input Terintegrasi (Web App)**:
   - Auto-fill data pemohon (Nama, NIP, Departemen, Jabatan, Tanggal Join).
   - Validasi saldo: mencegah pengajuan jika durasi melebihi sisa kuota yang tersedia atau bertabrakan dengan hari libur/cuti bersama.
   - Pilihan Jenis Cuti: Cuti Tahunan (`ANNUAL`) atau Cuti Khusus (`SPECIAL`: Menikah, Melahirkan, Kematian, Khitanan, dll).
   - Bagian Serah Terima Tugas (*Handover*): Pemilihan rekan kerja penerima tugas (`handoverToEmployeeId`), uraian tugas yang dialihkan, dan nomor telepon aktif selama cuti.
4. **Output Dokumen Cetak Ukuran F4 Full Page (215 mm × 330 mm)**:
   - Layout presisi meniru `FORM_CUTI_2024_(Office).xlsx`: Header logo perusahaan, Form Number 001, REV. 170208-1-W, Data Karyawan, Hak dan Sisa Cuti, Cuti yang Diambil, Catatan HRD, Serah Terima Tugas, 4 Kolom Tanda Tangan Persetujuan, dan Catatan Kaki.
   - Pengaturan CSS `@page { size: 215mm 330mm; margin: 10mm 12mm; }` dengan kontrol baris kompak agar terjamin **tepat 1 lembar F4 penuh (tidak terpecah ke halaman 2)**.
   - Dukungan cetak langsung dari browser (`window.print()`) dan opsi export PDF.

### Non-Goals
- Tidak mengotomasi payroll potongan gaji untuk cuti di luar tanggungan (*unpaid leave*) pada fase ini (fokus pada cuti berbayar tahunan dan khusus).
- Tidak mengimplementasikan OCR untuk tanda tangan fisik (persetujuan digital dilakukan via login user; dokumen cetak menyediakan kolom paraf/tanda tangan basah atau stempel status).

---

## 3. Data Model & Schema Diffs

### 3.1. Drizzle ORM Schema (`backend/src/db/schema/leaves.ts`)

```typescript
import { pgTable, bigint, varchar, text, date, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';

// 1. Kalender Cuti Bersama & Libur Perusahaan per Tahun
export const leaveHolidayCalendars = pgTable('leave_holiday_calendars', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  year: integer('year').notNull(),
  holidayDate: date('holiday_date').notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  isCollectiveLeave: boolean('is_collective_leave').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Saldo Cuti Karyawan per Tahun
export const leaveBalances = pgTable('leave_balances', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  baseQuota: integer('base_quota').default(12).notNull(),
  collectiveLeaveDeduction: integer('collective_leave_deduction').default(0).notNull(),
  usedQuota: integer('used_quota').default(0).notNull(),
  carriedOverQuota: integer('carried_over_quota').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Permohonan Cuti Karyawan
export const leaveRequests = pgTable('leave_requests', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  requestNumber: varchar('request_number', { length: 50 }).notNull().unique(),
  employeeId: bigint('employee_id', { mode: 'number' }).notNull().references(() => employees.id, { onDelete: 'restrict' }),
  leaveType: varchar('leave_type', { length: 30 }).notNull(), // 'ANNUAL' | 'SPECIAL'
  specialLeaveReason: varchar('special_leave_reason', { length: 100 }),
  reason: text('reason').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  durationDays: integer('duration_days').notNull(),
  resumeWorkDate: date('resume_work_date').notNull(),
  
  // Serah Terima Tugas (Handover)
  handoverToEmployeeId: bigint('handover_to_employee_id', { mode: 'number' }).references(() => employees.id),
  handoverTask: text('handover_task'),
  emergencyPhone: varchar('emergency_phone', { length: 50 }),
  
  // Status & Catatan HRD
  hrdNotes: text('hrd_notes'),
  status: varchar('status', { length: 30 }).default('PENDING').notNull(), // 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  
  // Snapshot Saldo saat Pengajuan (untuk keperluan histori & cetak form F4)
  balanceYear: integer('balance_year').notNull(),
  snapshotBaseQuota: integer('snapshot_base_quota').notNull(),
  snapshotCollectiveLeave: integer('snapshot_collective_leave').notNull(),
  snapshotAvailableBefore: integer('snapshot_available_before').notNull(),
  snapshotRemainingAfter: integer('snapshot_remaining_after').notNull(),

  createdById: bigint('created_by_id', { mode: 'number' }).references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Persetujuan Bertingkat (4 Kolom Sesuai Form Cetak F4)
export const leaveApprovals = pgTable('leave_approvals', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  leaveRequestId: bigint('leave_request_id', { mode: 'number' }).notNull().references(() => leaveRequests.id, { onDelete: 'cascade' }),
  stage: varchar('stage', { length: 30 }).notNull(), // 'APPLICANT' | 'DIRECT_SUPERVISOR' | 'HRD' | 'HIGHER_SUPERVISOR'
  approverEmployeeId: bigint('approver_employee_id', { mode: 'number' }).references(() => employees.id),
  approverName: varchar('approver_name', { length: 150 }),
  status: varchar('status', { length: 30 }).default('PENDING').notNull(),
  signatureDate: date('signature_date'),
  notes: text('notes'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

---

## 4. API Specifications

### 4.1. Get Leave Balance & Calculation Summary
- **Endpoint**: `GET /api/leaves/balance-summary?employeeId=:id&year=:year`
- **Response Shape**:
  ```json
  {
    "employee": {
      "id": 1,
      "employeeCode": "EMP-001",
      "fullName": "Febri Joko Prasetyo",
      "department": "IT",
      "position": "Staff IT",
      "joinDate": "2022-01-15"
    },
    "year": 2024,
    "baseQuota": 12,
    "collectiveLeaveDays": 10,
    "cleanAnnualQuota": 2,
    "usedQuota": 1,
    "availableBalance": 1,
    "historyItems": [
      { "no": 1, "description": "8 = Cuti bersama pemerintah Idul Fitri" },
      { "no": 2, "description": "2 = Idul Adha 2024" },
      { "no": 3, "description": "1 = Cuti tahunan tgl 05 Jan 2024" }
    ]
  }
  ```

### 4.2. Calculate Working Days & Return Date
- **Endpoint**: `POST /api/leaves/calculate-days`
- **Payload**:
  ```json
  {
    "startDate": "2024-05-10",
    "endDate": "2024-05-11",
    "employeeId": 1
  }
  ```
- **Response**:
  ```json
  {
    "durationDays": 1,
    "resumeWorkDate": "2024-05-13",
    "isValid": true,
    "overlappingHolidays": []
  }
  ```

### 4.3. Create Leave Request
- **Endpoint**: `POST /api/leaves/requests`
- **Payload Validation**: Zod schema dengan verifikasi kuota, sanitasi teks alasan, dan pencegahan overlap tanggal.

### 4.4. Get Leave Request Details (For F4 Print & View)
- **Endpoint**: `GET /api/leaves/requests/:id`
- **Response**: Mengembalikan seluruh entitas komprehensif termasuk data snapshot kalkulasi kuota, data serah terima tugas, dan 4 kolom persetujuan lengkap dengan tanggal tandatangan.

---

## 5. Frontend & Mobile UX

### 5.1. Input Form Pengajuan Cuti (`/dashboard/leaves/new` & Modal)
- Auto-fill data pemohon, reactive balance calculator.
- Date range picker dengan disable untuk hari libur & cuti bersama.
- Handover task section dengan employee selector.

### 5.2. Output Dokumen Cetak F4 Full Page (`LeaveFormF4Document.tsx`)
- Dimensi cetak: **215 mm × 330 mm** (F4 / Folio).
- Header: Logo PT Cahaya Mas Cemerlang, Form Number: 001, REV. 170208-1-W, judul tengah `PERMOHONAN CUTI KARYAWAN`.
- Seksi 1: Data Karyawan (Nama, NIP, Dept, Jabatan, Join Date).
- Seksi 2: Hak dan Sisa Cuti Karyawan (Periode Cuti Tahunan, Kuota Bersih, 5 Riwayat Pengambilan, Sisa Kuota, Cuti Diambil, Sisa Akhir).
- Seksi 3: Cuti yang Diambil (Alasan, Checklist Cuti Tahunan / Khusus, Rentang Tanggal, Tanggal Masuk Kembali).
- Seksi 4: Catatan HRD.
- Seksi 5: Serah Terima Tugas Selama Cuti (Kepada, Tugas, Nomor Telp Darurat, Tanda Tangan Penerima).
- Seksi 6: 4 Kolom Tanda Tangan Persetujuan (Pemohon, Atasan Langsung, HRD, Atasan dari Atasan Langsung) dengan Tanggal.
- Footer: Catatan checklist kaki.
- Fitur Tombol `Cetak Form F4 (Print / PDF)` yang otomatis membuka dialog print browser dengan ukuran kertas F4 satu halaman pas.

---

## 6. Verification & Success Criteria

- Lulus typecheck (`npx tsc --noEmit`), linter (`npm run lint`), dan unit tests.
- Form F4 print preview pas tepat 1 halaman tanpa tumpah ke halaman kedua pada ukuran kertas F4 (215 mm x 330 mm).
