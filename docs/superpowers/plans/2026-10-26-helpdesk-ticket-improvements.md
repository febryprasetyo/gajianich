# Implementation Plan: Peningkatan Halaman Sistem Tiket Helpdesk IT

- **Tanggal**: 2026-10-26
- **Status**: Siap Direview (Pending User Approval)
- **Referensi Spec**: [Design Spec](../specs/2026-10-26-helpdesk-ticket-improvements-design.md)

---

## 1. Shared Types & Interfaces

```typescript
// frontend/src/modules/ticket/types.ts & backend/src/modules/ticket/types.ts
export type TicketKpiFilterKey = "open" | "in_progress" | "resolved" | "critical" | "sla_breached";

export interface TicketFilterParams {
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  origin?: string;
  departmentId?: number | string;
  isInternal?: "all" | "true" | "false";
  slaStatus?: "BREACHED" | "COMPLIANT";
  page?: number;
  limit?: number;
}
```

---

## 2. Phase-by-Phase Tasks

### Phase 1: Database & Dummy Data Total Reset
- [x] Buat script reset administratif `backend/scripts/reset-helpdesk-data.ts`.
- [x] Jalankan script pembersihan tabel:
  - Nonaktifkan trigger append-only audit sementara.
  - Hapus seluruh records `helpdesk_attachments`, `helpdesk_ticket_comments`, `helpdesk_ticket_audit`, `helpdesk_tickets`.
  - Reset tabel `helpdesk_ticket_counters`.
  - Aktifkan kembali trigger append-only audit.
- [x] Verifikasi database kosong bersih dari dummy records.

### Phase 2: Format Keterlambatan Pencatatan Minimal +N Hari
- [x] Buat fungsi utilitas `calculateDelayDays(reportedAt: string, createdAt: string): number` dan `formatDelayText(reportedAt: string, createdAt: string): string | null` di `frontend/src/modules/ticket/constants.ts`.
- [x] Tulis automated unit tests untuk memverifikasi skenario:
  - Laporan & pencatatan di hari yang sama (misal 08:00 vs 08:30) -> `null` (tidak menampilkan delay).
  - Laporan & pencatatan selang jam di hari yang sama (misal 09:00 vs 17:00) -> `null`.
  - Laporan tanggal 2026-10-25 jam 23:00 dan dicatat 2026-10-26 jam 08:00 -> `+1 hari kemudian`.
  - Laporan tanggal 2026-10-20 dan dicatat 2026-10-23 -> `+3 hari kemudian`.
- [x] Update `TicketList.tsx` (tampilan tabel desktop dan kartu mobile) agar menggunakan `formatDelayText`.
- [x] Update `TicketDetail.tsx` agar menampilkan `Hari yang sama (Tepat Waktu)` jika hari kalender sama, atau `+N hari kemudian` jika terlambat.

### Phase 3: Hapus Rata-Rata Delay & Implementasi KPI Filter Interaktif
- [x] Backend: Update `listTickets` di `backend/src/modules/ticket/service.ts` & `controller.ts` untuk mendukung query `slaStatus=BREACHED`.
- [x] Frontend: Update `TicketStats.tsx`:
  - Hapus kartu "Rata-rata Delay".
  - Sesuaikan grid menjadi 5 kolom (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`).
  - Tambahkan interaktivitas klik, hover style, active outline/ring indicator.
  - Panggil callback `onSelectFilter(key)` saat diklik (toggle on/off).
- [x] Frontend: Update `frontend/src/app/dashboard/tickets/page.tsx`:
  - Hubungkan state `activeKpiFilter` dengan query parameter filter.
  - Sinkronkan dropdown di `TicketFilters.tsx` saat filter KPI aktif (atau reset).
- [x] Frontend: Update `TicketFilters.tsx` agar menyertakan tombol reset atau tag indikator jika `slaStatus=BREACHED` aktif.

### Phase 4: Automated Verification Loop & Final Sign-Off
- [x] Jalankan backend unit test: `npm test` di `backend/`.
- [x] Jalankan frontend typecheck: `npx tsc --noEmit` di `frontend/`.
- [x] Jalankan frontend test suite: `npm test` di `frontend/`.
- [x] Jalankan frontend build check: `npm run build` di `frontend/`.
- [x] Update checklist di `docs/todo/06-helpdesk-tiket-it.md`.
- [x] Git commit atomic dengan conventional commit.

---

## 3. Verification Commands

```bash
# 1. Reset helpdesk data & verifikasi
node -e 'const { pool } = require("./backend/dist/db"); ...'

# 2. Test backend
npm --prefix backend test

# 3. Test frontend
npm --prefix frontend test

# 4. Typecheck frontend
npm --prefix frontend run build
```
