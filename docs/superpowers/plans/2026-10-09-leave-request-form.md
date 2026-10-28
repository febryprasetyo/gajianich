# Implementation Plan: Pengajuan Cuti Karyawan & Cetak Dokumen F4 Full Page

**Status**: Ready for Review & Approval
**Spec**: [Design Spec](../specs/2026-10-09-leave-request-form-design.md)

---

## 1. Shared TypeScript Interfaces

```typescript
// types/leaves.ts
export type LeaveType = 'ANNUAL' | 'SPECIAL';

export type SpecialLeaveReason = 'Menikah' | 'Melahirkan' | 'Kematian' | 'Khitanan' | 'Lain-lain';

export type LeaveRequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type ApprovalStage = 'APPLICANT' | 'DIRECT_SUPERVISOR' | 'HRD' | 'HIGHER_SUPERVISOR';

export interface LeaveHistoryItem {
  no: number;
  description: string;
}

export interface EmployeeProfileSummary {
  id: number;
  employeeCode: string;
  fullName: string;
  department: string;
  position: string;
  joinDate: string | null;
}

export interface LeaveBalanceSummary {
  employee: EmployeeProfileSummary;
  year: number;
  baseQuota: number;              // Misal: 12
  collectiveLeaveDays: number;    // Misal: 10
  cleanAnnualQuota: number;       // baseQuota - collectiveLeaveDays (Misal: 2)
  usedQuota: number;              // Cuti yang sudah diambil sebelumnya
  availableBalance: number;       // Sisa Hak Cuti yang bisa diambil (Misal: 2)
  historyItems: LeaveHistoryItem[]; // Rincian 1-5 cuti yang sudah diambil sebelumnya
}

export interface CalculateLeaveDurationInput {
  employeeId: number;
  startDate: string;
  endDate: string;
}

export interface CalculateLeaveDurationOutput {
  durationDays: number;
  resumeWorkDate: string;
  isValid: boolean;
  overlappingHolidays: string[];
}

export interface LeaveRequestFormData {
  employeeId: number;
  leaveType: LeaveType;
  specialLeaveReason?: string;
  reason: string;
  startDate: string;
  endDate: string;
  handoverToEmployeeId?: number;
  handoverTask?: string;
  emergencyPhone?: string;
}

export interface LeaveApprovalItem {
  stage: ApprovalStage;
  approverName?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  signatureDate?: string | null;
  notes?: string;
}

export interface FullLeaveDocumentData {
  id: number;
  requestNumber: string;
  formNumber: string; // '001'
  revisionCode: string; // 'REV. 170208-1-W'
  createdAt: string;
  employee: EmployeeProfileSummary;
  balanceYear: number;
  baseQuota: number;
  collectiveLeaveDays: number;
  cleanAnnualQuota: number;
  historyItems: LeaveHistoryItem[];
  availableBefore: number;
  leaveDaysRequested: number;
  remainingAfter: number;
  leaveType: LeaveType;
  specialLeaveReason?: string;
  reason: string;
  startDate: string;
  endDate: string;
  resumeWorkDate: string;
  hrdNotes?: string;
  handover: {
    recipientName?: string;
    taskDescription?: string;
    emergencyPhone?: string;
  };
  approvals: {
    applicant: LeaveApprovalItem;
    directSupervisor: LeaveApprovalItem;
    hrd: LeaveApprovalItem;
    higherSupervisor: LeaveApprovalItem;
  };
}
```

---

## 2. Phase-by-Phase Tasks

### Phase 1: Database Schema & Migration
- [x] 1.1 Buat skema Drizzle di `backend/src/db/schema/leaves.ts` mencakup tabel:
  - `leave_holiday_calendars` (Kalender cuti bersama & hari libur)
  - `leave_balances` (Saldo cuti tahunan per karyawan)
  - `leave_requests` (Entitas permohonan cuti dan snapshot saldo)
  - `leave_approvals` (Alur 4 tahap tanda tangan persetujuan)
- [x] 1.2 Daftarkan schema `leaves.ts` ke `backend/src/db/schema/index.ts`.
- [x] 1.3 Jalankan migrasi basis data (Drizzle push/migrate).
- [x] 1.4 Buat seed data awal kalender cuti bersama dan saldo cuti karyawan (contoh tahun 2024 & 2026).

### Phase 2: Domain Services & Backend APIs (TDD)
- [x] 2.1 Buat domain service `backend/src/domain/leaveCalculation.ts`:
  - Perhitungan hari kerja efektif (mengabaikan hari Sabtu, Minggu, dan tanggal cuti bersama / libur nasional).
  - Penentuan tanggal kembali bekerja (`resumeWorkDate`).
  - Unit test `backend/src/domain/leaveCalculation.test.ts` (TDD: tes failing terlebih dahulu, lalu implementasi).
- [x] 2.2 Buat controller & routes `backend/src/controllers/leaveController.ts` & `backend/src/routes/leaveRoutes.ts`:
  - `GET /api/leaves/balance-summary`: Perhitungan kuota bersih (12 - cuti bersama), daftar riwayat cuti 1-5, dan saldo sisa.
  - `POST /api/leaves/calculate-days`: Kalkulasi realtime durasi dan tanggal masuk kembali.
  - `POST /api/leaves/requests`: Validasi Zod, simpan permohonan cuti, inisialisasi 4 kolom approval dalam 1 transaksi DB.
  - `GET /api/leaves/requests/:id`: Mengambil seluruh data form lengkap untuk tampilan dokumen cetak F4.
- [x] 2.3 Registrasi route leaves di `backend/src/app.ts`.

### Phase 3: Frontend UI Components & F4 Full Page Print Layout
- [x] 3.1 Buat komponen cetak F4 `frontend/src/components/leaves/LeaveFormF4Document.tsx`:
  - Mereplikasi layout [docs/FORM_CUTI_2024_(Office).xlsx](file:///home/fastpec/code/gajianich/docs/FORM_CUTI_2024_(Office).xlsx) secara pixel-perfect:
    - Header: Logo PT Cahaya Mas Cemerlang, Form Number: 001, REV. 170208-1-W, Judul Dokumen `PERMOHONAN CUTI KARYAWAN`.
    - Seksi 1: DATA KARYAWAN (Nama, NIP, Dept, Jabatan, Tanggal Join).
    - Seksi 2: HAK DAN SISA CUTI KARYAWAN (12 - Cuti Bersama = Hak Bersih, 5 Slot Riwayat, Sisa Kuota, Cuti Diambil, Sisa Akhir).
    - Seksi 3: CUTI YANG AKAN DIAMBIL (Alasan, Checkbox Cuti Tahunan vs Cuti Khusus, Rentang Tanggal, Tanggal Masuk Kembali).
    - Seksi 4: CATATAN HRD.
    - Seksi 5: SERAH TERIMA TUGAS SELAMA CUTI (Kepada, Tugas yang Diserahkan, Telp Darurat, Tanda Tangan Penerima).
    - Seksi 6: 4 KOLOM TANDA TANGAN PERSETUJUAN (Pemohon, Atasan Langsung, HRD, Atasan dari Atasan Langsung) dengan Tanggal.
    - Footer: Catatan kaki *) & **).
  - Tambahkan stylesheet cetak F4 `@page { size: 215mm 330mm; margin: 10mm 12mm; }` agar tepat **1 lembar penuh F4**.
  - Tombol aksi `Cetak Form F4` (`window.print()`).
- [x] 3.2 Buat formulir pengajuan cuti `frontend/src/components/leaves/LeaveRequestForm.tsx`:
  - Reactive balance card, date range picker interaktif, kalkulasi realtime durasi hari & tanggal masuk kembali.
  - Selector delegasi rekan kerja (`handoverToEmployeeId`), alasan cuti, dan nomor telepon darurat.
  - Tombol simpan dan tombol pratinjau cetak langsung.
- [x] 3.3 Integrasikan rute halaman di frontend:
  - Halaman pengajuan cuti: `frontend/src/pages/leaves/LeaveCreatePage.tsx`
  - Halaman cetak dokumen: `frontend/src/pages/leaves/LeavePrintPage.tsx`
  - Link menu Cuti di Sidebar navigasi karyawan & HR.

### Phase 4: Verification Loop & Quality Assurance
- [x] 4.1 Jalankan typecheck TypeScript: `npx tsc --noEmit`
- [x] 4.2 Jalankan linter: `npm run lint`
- [x] 4.3 Jalankan automated unit tests: `npm test`
- [x] 4.4 Pengujian visual cetak browser: pastikan format pas di kertas F4 (215 mm x 330 mm) dalam 1 halaman.
- [x] 4.5 Commit milestone dengan conventional commit (`feat(leaves): implement leave request form and F4 single-page print`).

---

## 3. Verification Commands

```bash
# 1. Typecheck
npx tsc --noEmit

# 2. Automated tests
npm test

# 3. Linter
npm run lint
```
