# Design Spec: Migrasi Arsitektur Modular Package-by-Feature (Screaming Architecture)

**Tanggal:** 23 Oktober 2026  
**Status:** DRAFT (Menunggu Persetujuan Pengguna)  
**Dokumen Rencana:** [Implementation Plan](../plans/2026-10-23-modular-architecture-migration.md)  
**Pelacak Todo:** [Todo 08](../../todo/08-arsitektur-modular-package-by-feature.md)

---

## 1. Background & Executive Summary

Saat ini monorepo GAJIANICH (`gajianich`) menggunakan arsitektur berbasis layer teknis konvensional:
- **Backend:** `backend/src/` terbagi menjadi `controllers/` (38 file), `services/` (32 file), `domain/` (44 file), `routes/` (27 file), dan `db/schema/` (24 file).
- **Frontend:** `frontend/src/` terbagi menjadi `app/` (69 file), `components/` (128 file), dan `lib/` (83 file).
- **Total:** ~980 file (termasuk 500+ file tes) dengan 83.000+ baris kode.

**Permasalahan:**
1. **Low Cohesion & High Coupling:** Untuk memahami atau mengubah satu fitur (misal: *Tickets* atau *Leave*), developer/AI harus melompat ke 6-7 folder terpisah.
2. **Token Inefficiency untuk AI Agent:** Karena kode satu fitur tersebar di mana-mana, AI agent harus membaca file dari berbagai penjuru direktori yang cepat menghabiskan token limit dan memicu kompresi konteks (*context compaction*).
3. **Risiko Refactor Massal (*Big Bang*):** Mengubah seluruh 980 file sekaligus hampir pasti memicu breaking changes, konflik merge, dan puluhan tes gagal.

**Solusi Arsitektur:**
Menerapkan **Package-by-Feature / Screaming Architecture** yang dimigrasikan secara bertahap melalui **7 Sprint Terisolasi**, dengan strategi **Backward-Compatible Facade (Re-export)** sehingga:
- Modul yang sudah dimigrasikan mandiri di dalam `src/modules/<feature>/`.
- Kode legacy yang belum dimigrasikan tetap berjalan tanpa ada file import yang patah.
- Rangkaian pengujian (309 tes backend, 192 tes frontend) **tetap 100% hijau** di setiap commit.

---

## 2. Struktur Standar Modul (`src/modules/<fitur>/`)

Setiap fitur bisnis mandiri akan memiliki bentuk direktori seragam:

```text
src/modules/<feature-name>/
├── schema.ts            # Drizzle ORM table definitions untuk fitur ini
├── types.ts             # Zod schema, input DTO, dan inferred TypeScript types
├── service.ts           # Business logic, domain rules, dan Drizzle database queries
├── controller.ts        # (Backend) Thin request handler / HTTP mapper
├── routes.ts            # (Backend) Express router lokal untuk fitur ini
├── components/          # (Frontend) Komponen UI privat khusus fitur ini
└── index.ts             # Public API / Barrel export (hanya mengekspor yang boleh diakses luar)
```

### Prinsip Enkapsulasi & Boundary:
- File internal suatu modul tidak boleh diimpor langsung oleh modul lain (misal: dilarang `import from '@/modules/ticket/service'`).
- Akses antar modul hanya diizinkan melalui public entry point `index.ts` (misal: `import { getTicketById } from '@/modules/ticket'`).

---

## 3. Strategi Keamanan Database (Drizzle ORM Zero-Drop Guarantee)

Perubahan lokasi file skema Drizzle berisiko tinggi memicu `drizzle-kit` membuat migration script destruktif (mengira tabel lama dihapus).  
**Solusi Pencegahan:**
1. Buat aggregator pusat di `backend/src/shared/db/schema.ts`.
2. Aggregator ini me-reexport semua tabel modul baru DAN tabel legacy yang belum dimigrasikan.
3. Update `drizzle.config.ts` untuk mengarah ke `src/shared/db/schema.ts` (atau glob pattern yang teruji).
4. Jalankan `npx drizzle-kit check` sebelum setiap commit untuk menjamin **0 diff skema yang tidak diinginkan**.

---

## 4. Strategi Token-Efficient untuk AI Agent

Agar refaktor ini tidak membakar kuota token AI atau melampaui context limit:
1. **Single-Module Bounded Context:** Setiap prompt pengerjaan hanya menangani 1 modul tertentu (misal: *hanya Sprint 2 Ticket*). AI dilarang menyentuh file di luar modul aktif.
2. **Backward-Compatible Stubs:** Saat file dipindahkan dari `backend/src/services/ticketService.ts` ke `backend/src/modules/ticket/service.ts`, buat stub re-export di lokasi lama:
   ```ts
   // backend/src/services/ticketService.ts (stub sementara)
   export * from '@/modules/ticket';
   ```
   Ini mencegah keharusan mengedit ratusan file lain/file tes sekaligus dalam satu turn.
3. **Checklist Sederhana & Atomik:** Setiap task memiliki tes verifikasi lokal yang cepat (< 5 detik) sehingga feedback loop instan.

---

## 5. Rencana Pembagian 7 Sprint

| Sprint | Fokus / Modul | Alasan Pemilihan & Tingkat Risiko |
| :--- | :--- | :--- |
| **Sprint 1** | **Fondasi Shared (`src/shared/`)** | Sangat Rendah. Menyiapkan database client aggregator, base types, dan response formatters tanpa menyentuh kode bisnis. |
| **Sprint 2** | **Pilot Feature: Helpdesk Ticket (`modules/ticket/`)** | Rendah. Modul mandiri, ukuran kecil (~5% sistem), sedikit dependensi ke modul lain. Uji coba pola arsitektur. |
| **Sprint 3** | **Modul Cuti / Leave (`modules/leave/`)** | Rendah-Sedang. Mengelompokkan formulir F4, saldo master, dan service cuti. |
| **Sprint 4** | **Modul Pengadaan GA (`modules/ga/`)** | Sedang. Alur pengadaan barang dan approval GA. |
| **Sprint 5** | **Modul Asset & Hardware (`modules/asset/`)** | Sedang. Mengelompokkan hardware, spek laptop, peripheral, dan rekonsiliasi custodian. |
| **Sprint 6** | **Modul Kepegawaian (`modules/employee/`)** | Sedang-Tinggi. Master karyawan, departemen, jabatan, dan import/export Excel. |
| **Sprint 7** | **Modul Presensi / Attendance (`modules/attendance/`)** | Tinggi (Terbesar). Presensi mesin, mobile PWA biometrik, shift, approvals. Dikerjakan terakhir setelah semua pola terbukti stabil. |
