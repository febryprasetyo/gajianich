# Implementation Plan: Migrasi Arsitektur Modular (Sprint 1 s/d Sprint 7)

**Tanggal:** 23 Oktober 2026  
**Status:** DRAFT (Menunggu Persetujuan Pengguna)  
**Dokumen Terkait:** [Design Spec](../specs/2026-10-23-modular-architecture-migration-design.md)  
**Pelacak Todo:** [Todo 08](../../todo/08-arsitektur-modular-package-by-feature.md)

---

## Aturan Keselamatan & Token Efficiency (Guardrails)
1. **Aturan 1 Modul Per Sprint:** Jangan mencampuradukkan pekerjaan modul lain dalam sprint yang sedang berjalan.
2. **Zero Breaking Imports:** Gunakan re-export facade pada lokasi file lama sehingga file tes dan modul konsumen tidak patah.
3. **Verification Gate:** Wajib menjalankan `npm test`, `npx tsc --noEmit`, dan `npm run lint` sebelum setiap commit.
4. **Drizzle Integrity:** Jalankan `npx drizzle-kit check` untuk memastikan tidak ada perubahan tabel yang tidak disengaja.

---

## Sprint 1: Fondasi Shared (`src/shared/`)
*Tujuan: Menyediakan pondasi bersama tanpa memodifikasi kode bisnis yang berjalan.*

### Tasks:
- [ ] **Task 1.1 Backend Shared DB:**
  - Buat `backend/src/shared/db/schema.ts` sebagai sentral re-export semua skema Drizzle yang ada saat ini di `backend/src/db/schema/*.ts`.
  - Pastikan `backend/src/db/index.ts` mengimpor skema dari sentral aggregator.
- [ ] **Task 1.2 Backend Shared Response & Types:**
  - Buat `backend/src/shared/types/api.ts` (`ApiResponse<T>`, `PaginatedResponse<T>`, `ApiError`).
  - Buat `backend/src/shared/utils/response.ts` (`sendSuccess`, `sendError`).
- [ ] **Task 1.3 Frontend Shared Foundation:**
  - Siapkan `frontend/src/shared/types/api.ts`.
  - Siapkan `frontend/src/shared/components/` untuk base UI primitif yang lintas modul (Button, ModalShell, Input).
- [ ] **Task 1.4 Verifikasi Sprint 1:**
  - Jalankan `cd backend && npm test && npx tsc --noEmit`.
  - Jalankan `cd frontend && npm test && npx tsc --noEmit`.
  - Commit milestone: `refactor(arch): establish shared database aggregator and common types (sprint 1)`.

---

## Sprint 2: Pilot Feature Module - Helpdesk Ticket (`modules/ticket/`)
*Tujuan: Membuktikan pola package-by-feature pada modul kecil dan terisolasi.*

### Tasks:
- [ ] **Task 2.1 Backend Ticket Module:**
  - Buat `backend/src/modules/ticket/`:
    - `schema.ts`: Pindahkan skema tiket dari `backend/src/db/schema/tickets.ts`.
    - `types.ts`: DTO Zod dan inferred types.
    - `service.ts`: Query Drizzle dan logika tiket.
    - `controller.ts` & `routes.ts`: Handler tiket.
    - `index.ts`: Barrel export fungsi publik.
  - Pasang re-export stub di lokasi lama agar tidak mematahkan tes atau controller lain.
  - Hubungkan `schema.ts` tiket ke aggregator `backend/src/shared/db/schema.ts`.
- [ ] **Task 2.2 Frontend Ticket Module:**
  - Buat `frontend/src/modules/ticket/` (komponen tiket & hook).
  - Hubungkan rute `frontend/src/app/dashboard/tickets/` sebagai thin transport layer.
- [ ] **Task 2.3 Verifikasi Sprint 2:**
  - Jalankan test suite tiket backend & frontend.
  - Typecheck dan lint lulus 100%.
  - Commit milestone: `refactor(ticket): migrate helpdesk ticket to feature module (sprint 2)`.

---

## Sprint 3: Modul Cuti & Izin (`modules/leave/`)
### Tasks:
- [ ] **Task 3.1 Backend Leave Module:** Pindahkan skema cuti, service perhitungan kuota, dan controller cuti ke `backend/src/modules/leave/`.
- [ ] **Task 3.2 Frontend Leave Module:** Kelompokkan komponen Form F4, saldo master, dan view pengajuan cuti ke `frontend/src/modules/leave/`.
- [ ] **Task 3.3 Verifikasi Sprint 3:** 100% tes cuti lulus, verifikasi layout cetak Folio F4 tetap presisi. Commit milestone Sprint 3.

---

## Sprint 4: Modul Pengadaan & GA (`modules/ga/`)
### Tasks:
- [ ] **Task 4.1 Backend GA Module:** Pindahkan skema pengadaan barang, ga_requests, dan approval logic ke `backend/src/modules/ga/`.
- [ ] **Task 4.2 Frontend GA Module:** Pindahkan halaman dan komponen request barang ke `frontend/src/modules/ga/`.
- [ ] **Task 4.3 Verifikasi Sprint 4:** Tes approval GA lulus. Commit milestone Sprint 4.

---

## Sprint 5: Modul Asset Management & Hardware (`modules/asset/`)
### Tasks:
- [ ] **Task 5.1 Backend Asset Module:** Pindahkan skema komputer, spek laptop, peripheral, audit hardware, dan rekonsiliasi custodian ke `backend/src/modules/asset/`.
- [ ] **Task 5.2 Frontend Asset Module:** Pindahkan komponen asset overview, detail edit, dan custodian selector ke `frontend/src/modules/asset/`.
- [ ] **Task 5.3 Verifikasi Sprint 5:** Tes impor Excel spek laptop dan rekonsiliasi custodian lulus. Commit milestone Sprint 5.

---

## Sprint 6: Modul Master Karyawan & Organisasi (`modules/employee/`)
### Tasks:
- [ ] **Task 6.1 Backend Employee Module:** Pindahkan tabel employees, departments, positions, service import/export ke `backend/src/modules/employee/`.
- [ ] **Task 6.2 Frontend Employee Module:** Pindahkan halaman master data karyawan, kartu profil, dan department master ke `frontend/src/modules/employee/`.
- [ ] **Task 6.3 Verifikasi Sprint 6:** Tes master karyawan dan filter pencarian lulus. Commit milestone Sprint 6.

---

## Sprint 7: Modul Presensi & Rekap Kehadiran (`modules/attendance/`)
### Tasks:
- [ ] **Task 7.1 Backend Attendance Module:** Pindahkan sistem presensi (mesin, shift, mobile biometrik, approval, geofence, self logs, batch sync) ke `backend/src/modules/attendance/`.
- [ ] **Task 7.2 Frontend Attendance Module:** Pindahkan komponen PWA mobile, DayDetailSheet, AttendanceMap, dan dashboard rekap ke `frontend/src/modules/attendance/`.
- [ ] **Task 7.3 Pembersihan Stub & Final Audit:** Hapus stub re-export sementara, validasi `drizzle-kit check`, jalankan E2E Playwright.
- [ ] **Task 7.4 Verifikasi Menyeluruh Sprint 7:** Seluruh 309 tes backend, 192 tes frontend, build, dan Playwright lulus. Update status TODO 08 menjadi **Selesai**.
