# Todo 08: Arsitektur Modular Package-by-Feature (Screaming Architecture) & Drizzle Full-Stack Next.js

Dokumen ini melacak tahapan eksekusi dan checkpoint progres refaktor arsitektur modular berbasis fitur (`src/modules/`) untuk proyek monorepo "GAJIANICH".

---

## Ringkasan Inisiatif
- **Tujuan**: Meningkatkan kecepatan pengembangan (developer velocity) dan kemudahan perawatan (maintainability) bagi solo developer/AI dengan mengelompokkan logika bisnis, query Drizzle, tipe Zod, dan komponen UI lokal ke dalam `src/modules/<fitur>/`.
- **Pola**: Screaming Architecture / Package-by-Feature. Next.js `src/app/` murni sebagai transport layer (thin controller & routing view), `src/modules/` sebagai business domain core.
- **Strategi Pelaksanaan**: Dibagi menjadi **7 Sprint Terisolasi** (incremental rollout) untuk mencegah breaking changes pada 500+ file tes dan menghemat token AI agent.

---

## Checkpoint Progres 7 Sprint

### Sprint 1: Fondasi Shared (`src/shared/`)
- [ ] **Task 1.1**: Buat sentral aggregator skema Drizzle di `backend/src/shared/db/schema.ts`.
- [ ] **Task 1.2**: Siapkan shared response formatter & generic types di `backend/src/shared/types/api.ts` & `utils/response.ts`.
- [ ] **Task 1.3**: Siapkan shared types dan UI base components di `frontend/src/shared/`.
- [ ] **Task 1.4**: Verifikasi (backend tests pass, frontend tests pass, zero type errors).

### Sprint 2: Pilot Feature Module - Helpdesk Ticket (`modules/ticket/`)
- [x] **Task 2.1**: Buat backend module `backend/src/modules/ticket/` (schema, types, service, controller, routes, index barrel).
- [x] **Task 2.2**: Pasang backward-compatible re-export stubs pada lokasi lama agar import konsumen tetap utuh.
- [x] **Task 2.3**: Buat frontend module `frontend/src/modules/ticket/` dan hubungkan `src/app/dashboard/tickets/` sebagai thin controller.
- [x] **Task 2.4**: Verifikasi modul tiket & commit milestone Sprint 2.

### Sprint 3: Modul Cuti & Perizinan (`modules/leave/`)
- [ ] **Task 3.1**: Migrasi backend leave (skema leaves, service perhitungan saldo & kuota, controller) ke `modules/leave/`.
- [ ] **Task 3.2**: Migrasi frontend leave (Form F4 Folio, master saldo, detail view) ke `modules/leave/`.
- [ ] **Task 3.3**: Verifikasi tes cuti & cetak dokumen F4. Commit milestone Sprint 3.

### Sprint 4: Modul Pengadaan & General Affairs (`modules/ga/`)
- [ ] **Task 4.1**: Migrasi backend GA (skema pengadaan, service request barang, approval logic) ke `modules/ga/`.
- [ ] **Task 4.2**: Migrasi frontend GA (form pengajuan, review modal, nota print) ke `modules/ga/`.
- [ ] **Task 4.3**: Verifikasi tes modul GA. Commit milestone Sprint 4.

### Sprint 5: Modul Asset & Hardware Management (`modules/asset/`)
- [ ] **Task 5.1**: Migrasi backend asset (skema hardware, laptop specs, peripheral, rekonsiliasi custodian) ke `modules/asset/`.
- [ ] **Task 5.2**: Migrasi frontend asset (asset overview, detail edit, scan custodian) ke `modules/asset/`.
- [ ] **Task 5.3**: Verifikasi tes impor spek laptop & audit hardware. Commit milestone Sprint 5.

### Sprint 6: Modul Master Karyawan & Organisasi (`modules/employee/`)
- [ ] **Task 6.1**: Migrasi backend employee (tabel employees, departemen, jabatan, import/export) ke `modules/employee/`.
- [ ] **Task 6.2**: Migrasi frontend employee (master list, profile detail, department manager) ke `modules/employee/`.
- [ ] **Task 6.3**: Verifikasi tes master karyawan. Commit milestone Sprint 6.

### Sprint 7: Modul Presensi & Rekap Kehadiran (`modules/attendance/`)
- [ ] **Task 7.1**: Migrasi backend attendance (mesin, shift, mobile biometrik PWA, approval, batch sync) ke `modules/attendance/`.
- [ ] **Task 7.2**: Migrasi frontend attendance (mobile PWA, DayDetailSheet, peta, dashboard rekap) ke `modules/attendance/`.
- [ ] **Task 7.3**: Pembersihan backward-compatible stubs dan audit akhir `drizzle-kit check`.
- [ ] **Task 7.4**: Full regression verification loop (309 backend tests, 192 frontend tests, build, Playwright E2E). Status TODO 08 berubah menjadi **Selesai**.
