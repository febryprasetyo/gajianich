# Helpdesk Tiket IT — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistem pencatatan tiket helpdesk dengan tiga identitas (requester/created_by/assigned_to), sumber laporan, waktu laporan, SLA dari `reported_at`, dan pemisahan tiket internal vs. karyawan.

**Architecture:** 4 tabel relasional (`helpdesk_tickets`, `helpdesk_ticket_comments`, `helpdesk_ticket_audit`, `helpdesk_attachments`). API REST Express + Drizzle ORM. Frontend Next.js/React. Audit trail append-only dengan trigger DB.

**Tech Stack:** TypeScript, Express, Drizzle ORM, PostgreSQL, Next.js/React, node:test via tsx.

**Spec:** [2026-10-12-helpdesk-ticket-design.md](../specs/2026-10-12-helpdesk-ticket-design.md)

**Status:** Selesai (Completed & Verified). Task 1–8 selesai diimplementasikan sesuai Screaming Architecture modular (`src/modules/ticket/`) dan diverifikasi penuh.

---

## Global Constraints

- `created_by` selalu dari JWT; client tidak boleh mengirim field ini.
- `requester_employee_id` harus ada di tabel `employees`; validasi server.
- `reported_at` wajib <= `created_at`; validasi server.
- `helpdesk_ticket_audit` append-only; trigger DB memblokir UPDATE/DELETE dari role runtime.
- Perubahan `reported_at` wajib permission `helpdesk.admin` dan dicatat audit trail.
- Tiket `is_internal = true` tidak masuk metrik layanan karyawan.
- `feedback_source` selalu `STAFF_RECORDED` di tahap ini; tidak menerima nilai lain dari klien.
- Nomor tiket `TKT-YYYYMM-NNNN` digenerate server; tidak dapat diubah klien.
- Upload lampiran: max 10 MB/file, validasi MIME type server-side.
- Tidak ada endpoint DELETE tiket di tahap ini.

---

## Kontrak Tipe Lintas Task

Definisikan tipe berikut pada `backend/src/domain/helpdesk.ts`:

```ts
type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type TicketCategory = 'HARDWARE' | 'SOFTWARE' | 'NETWORK' | 'ACCESS' | 'PRINTER' | 'PERIPHERAL' | 'OTHER';
type TicketOrigin = 'WHATSAPP' | 'PHONE' | 'EMAIL' | 'WALK_IN' | 'INTERNAL_FINDING';
type TicketAuditAction = 'CREATE' | 'UPDATE' | 'ASSIGN' | 'STATUS_CHANGE' | 'COMMENT' | 'RESOLVE' | 'CLOSE' | 'REOPEN';
type ConfirmationChannel = 'WHATSAPP' | 'PHONE' | 'EMAIL' | 'WALK_IN' | 'SYSTEM';

type TicketIdentity = {
  userId?: number;          // null untuk requester yang bukan user
  employeeId?: number;      // null untuk created_by/assigned_to
  nameSnapshot: string;
  departmentSnapshot?: string;
};

type TicketSummary = {
  id: string;
  ticketNumber: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  origin: TicketOrigin;
  isInternal: boolean;
  reportedAt: string;        // ISO UTC
  createdAt: string;
  requester: TicketIdentity;
  createdBy: TicketIdentity;
  assignedTo: TicketIdentity | null;
};

type TicketDetail = TicketSummary & {
  description: string;
  reportEvidence: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  resolutionConfirmedBy: string | null;
  resolutionConfirmedAt: string | null;
  resolutionConfirmationChannel: ConfirmationChannel | null;
  feedbackScore: number | null;
  feedbackNote: string | null;
  feedbackSource: 'STAFF_RECORDED' | null;
  affectedAsset: { id: string; label: string } | null;
  affectedEmployee: { id: string; label: string } | null;
  firstResponseAt: string | null;
  slaResponseMinutes: number | null;
  comments: TicketComment[];
};

type TicketComment = {
  id: string;
  authorName: string;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
};

type Page<T> = { items: T[]; nextCursor: string | null; totalCount: number };
```

DTO transport dicerminkan pada `frontend/src/lib/helpdesk/types.ts`.

---

## Task 1 — Schema DB, Migrasi, dan Proteksi Audit Append-Only

**Files:** Create `backend/src/db/schema/helpdesk.ts`, `backend/src/db/schema/helpdesk.test.ts`; modify `backend/src/db/index.ts`; generate migrasi Drizzle.

**Interfaces:** Export `helpdeskTickets`, `helpdeskTicketComments`, `helpdeskTicketAudit`, `helpdeskAttachments`.

- [x] Tulis test schema: insert tiket berhasil; FK ke `employees` wajib ada; update/delete audit ditolak role runtime; rollback membatalkan semua insert terkait; snapshot tersedia setelah sumber dihapus.
- [x] Jalankan `cd backend && npx tsx --test src/db/schema/helpdesk.test.ts`; expected fail.
- [x] Implementasikan 4 tabel sesuai spec §3: kolom, constraint, indeks, trigger append-only pada `helpdesk_ticket_audit`. Trigger memblokir UPDATE/DELETE/TRUNCATE dari role runtime.
- [x] Implementasikan generator nomor tiket `TKT-YYYYMM-NNNN` — fungsi PostgreSQL atau sequence per bulan yang aman dari race condition.
- [x] Jalankan `cd backend && npm run db:generate`; review SQL agar tidak menyentuh tabel lain. Terapkan `npm run db:migrate` hanya pada DB test.
- [x] Ulangi test dan `cd backend && npm run build`; expected pass. Commit `feat(helpdesk): add ticket schema and append-only audit`.

---

## Task 2 — Domain Service: Identitas, Validasi, dan Audit Trail

**Files:** Create `backend/src/domain/helpdesk.ts`, `backend/src/domain/helpdesk.test.ts`, `backend/src/services/helpdesk.ts`, `backend/src/services/helpdesk.integration.test.ts`.

**Interfaces:**
- `resolveTicketActor(req): Promise<TicketActor>` — actor dari JWT, tidak dari body.
- `createTicket(actor, input): Promise<TicketDetail>` — validasi requester, snapshot, nomor tiket, insert + audit `CREATE`.
- `updateTicket(actor, id, patch): Promise<TicketDetail>` — validasi transisi status, update snapshot assignment, audit trail per field.
- `addComment(actor, ticketId, body, isInternal): Promise<TicketComment>` — insert komentar, set `first_response_at` bila belum diisi.
- `validateStatusTransition(current, next): void | never` — lempar error bila transisi tidak valid.

- [x] Tulis test: `created_by` tidak dapat diubah klien; `requester_employee_id` wajib ada di DB; `reported_at` > `created_at` ditolak; transisi status tidak valid ditolak; perubahan `reported_at` tanpa `helpdesk.admin` ditolak; snapshot tersimpan meski sumber dihapus; komentar publik pertama mengisi `first_response_at`; tiket `is_internal = true` teridentifikasi terpisah.
- [x] Jalankan `cd backend && npx tsx --test src/domain/helpdesk.test.ts src/services/helpdesk.integration.test.ts`; expected fail.
- [x] Implementasikan service: query `employees` untuk snapshot requester; query `users` untuk snapshot actor dan assignee. Jangan menerima snapshot dari klien. Gunakan transaksi untuk INSERT tiket + audit `CREATE` secara atomik.
- [x] Implementasikan audit trail per field pada update: simpan `field_changed`, `old_value`, `new_value`. Perubahan `reported_at` wajib cek permission `helpdesk.admin` dan catat di audit.
- [x] Ulangi test dan build; expected pass. Commit `feat(helpdesk): add ticket domain service and audit`.

---

## Task 3 — API Backend: CRUD Tiket, Komentar, dan Lookup

**Files:** Create `backend/src/controllers/helpdeskController.ts`, `backend/src/routes/helpdeskRoutes.ts`, `backend/src/routes/helpdeskRoutes.test.ts`; modify `backend/src/app.ts`.

**Interfaces:** Endpoint sesuai spec §7. Validasi request dengan Zod. Response sesuai tipe `TicketSummary`, `TicketDetail`, `Page<TicketSummary>`.

- [x] Tulis test: 401 tanpa token; 403 tanpa permission; 400 jika `requester_employee_id` tidak ada; 400 jika `reported_at` > `created_at`; 400 jika transisi status tidak valid; 400 jika klien mengirim `created_by`/`ticket_number`/snapshot; 404 tiket tidak ditemukan; 409 jika konflik update.
- [x] Test filter list: `status`, `priority`, `category`, `origin`, `is_internal`, `assignedTo`, `requesterDept`, `startDate`, `endDate`, `q`, `cursor`, `limit`. Tanggal WIB. Default 30 hari, limit 1–100.
- [x] Jalankan `cd backend && npx tsx --test src/routes/helpdeskRoutes.test.ts`; expected fail.
- [x] Implementasikan semua endpoint. `GET /employees` dan `GET /assignees` mengembalikan daftar dengan pagination cursor. Request body tidak boleh mengandung `created_by`, `ticket_number`, `created_at`, atau snapshot.
- [x] Pasang middleware `authenticateToken` dan `requirePermission` per endpoint. `helpdesk.admin` diperlukan untuk operasi sensitif (ubah `reported_at`, reopen closed, ubah `is_internal`).
- [x] Ulangi test dan `cd backend && npm test && npm run build`; expected pass. Commit `feat(helpdesk): add REST API for tickets`.

---

## Task 4 — Upload Lampiran

**Files:** Create `backend/src/controllers/helpdeskAttachmentController.ts`, `backend/src/services/helpdeskAttachment.ts`, `backend/src/routes/helpdeskAttachment.test.ts`; modify `backend/src/routes/helpdeskRoutes.ts`.

- [x] Tulis test: upload file valid berhasil; file > 10 MB ditolak 413; MIME type tidak diizinkan ditolak; path storage tidak sama dengan nama file asli; user tanpa permission ditolak.
- [x] Jalankan test; expected fail.
- [x] Implementasikan multipart upload dengan `multer` atau equivalen. Validasi MIME type (daftar: jpg, jpeg, png, gif, pdf, doc, docx, xls, xlsx, zip). Simpan ke path lokal atau storage provider. `storage_path` tidak boleh sama dengan `filename`.
- [x] Ulangi test dan build; expected pass. Commit `feat(helpdesk): add attachment upload`.

---

## Task 5 — Laporan KPI dan Endpoint Statistik

**Files:** Create `backend/src/services/helpdeskStats.ts`, `backend/src/controllers/helpdeskStatsController.ts`, `backend/src/routes/helpdeskStatsRoutes.test.ts`; modify `backend/src/routes/helpdeskRoutes.ts`.

**Interfaces:**
- `GET /api/v1/helpdesk/stats?startDate=...&endDate=...` → TicketStats
- `TicketStats`: totalTickets, totalInternal (dipisah), avgFirstResponseMinutes, avgResolutionMinutes, avgRecordingDelayMinutes, byCategory, byOrigin, byDepartment, feedbackAvg (bertanda STAFF_RECORDED).

- [x] Tulis test: `is_internal = true` tidak masuk `totalTickets` utama; SLA dihitung dari `reported_at`; `feedbackSource` ditampilkan eksplisit; filter tanggal WIB.
- [x] Implementasikan query agregasi. Pastikan pemisahan `is_internal` bukan hanya filter UI.
- [x] Ulangi test dan build; expected pass. Commit `feat(helpdesk): add KPI stats endpoint`.

---

## Task 6 — Frontend: Form Buat Tiket dan List

**Files:** Create `frontend/src/lib/helpdesk/types.ts`, `frontend/src/lib/helpdesk/api.ts`, `frontend/src/components/helpdesk/TicketList.tsx`, `frontend/src/components/helpdesk/TicketCreateForm.tsx`, `frontend/src/components/helpdesk/TicketFilters.tsx`; modify routing dan sidebar menu.

**Interfaces:** `createTicket(input)`, `listTickets(filters, signal)` mengikuti DTO backend Task 3.

- [x] Tulis test: form tidak mengirim `created_by`/`ticket_number`; requester dipilih dari autocomplete API; `reported_at` default sekarang; filter `is_internal` tersedia terpisah; status badge warna benar.
- [x] Jalankan `cd frontend && npx tsx --test src/lib/helpdesk/*.test.mjs`; expected fail.
- [x] Implementasikan form create dengan autocomplete search karyawan (`/helpdesk/employees`). Field `created_by` ditampilkan read-only dari sesi. Toggle "Temuan Internal IT" untuk `is_internal`. Datetime picker `reported_at` default `now()`.
- [x] Implementasikan list tiket dengan filter lengkap, badge status berwarna, kolom tiga identitas.
- [x] Ulangi test, `cd frontend && npm test && npm run lint && npm run build`; expected pass. Commit `feat(helpdesk): add ticket list and create form`.

---

## Task 7 — Frontend: Halaman Detail dan Audit Trail

**Files:** Create `frontend/src/components/helpdesk/TicketDetail.tsx`, `frontend/src/components/helpdesk/TicketAuditTrail.tsx`, `frontend/src/components/helpdesk/TicketComments.tsx`, `frontend/src/components/helpdesk/TicketActions.tsx`.

- [x] Tulis test: tiga identitas tampil berdampingan; dua timestamp ditampilkan (laporan + pencatatan) beserta selisih; komentar internal berlabel "Catatan Internal"; transisi status sesuai allowed transitions; `feedback_source = STAFF_RECORDED` ditampilkan.
- [x] Implementasikan layout detail: header (nomor, judul, status, prioritas), tiga identitas card, dua timestamp + selisih ("Dicatat terlambat X menit"), komentar berurutan, tab Riwayat Perubahan.
- [x] Actions: assign (autocomplete `/helpdesk/assignees`), ubah status (hanya transisi valid), tambah komentar (toggle internal/publik), resolve (isi catatan penyelesaian + konfirmasi), close.
- [x] State loading/empty/error terpisah. Tidak memblokir halaman lain jika detail gagal.
- [x] Ulangi test dan build; expected pass. Commit `feat(helpdesk): add ticket detail and audit trail`.

---

## Task 8 — Verifikasi Lintas Sistem

**Files:** Create `tests/helpdesk-ticket.spec.ts`, `backend/src/routes/helpdeskCoverage.test.ts`; update `docs/todo/06-helpdesk-tiket-it.md`.

- [x] Buat test coverage: semua endpoint, permission per role, transisi status tidak valid, snapshot bertahan setelah karyawan/user dihapus, audit append-only (update/delete ditolak).
- [x] Tambahkan E2E: staf IT membuat tiket atas nama karyawan HR → tiket muncul di list → assign → komentar → resolve → konfirmasi → close. Cek tiga identitas tampil benar. Cek `is_internal` tidak masuk total laporan karyawan. Cek filter tanggal WIB. Viewport 390px dan keyboard.
- [x] Jalankan `cd backend && npx tsx --test src/routes/helpdeskCoverage.test.ts`, lalu `npx playwright test tests/helpdesk-ticket.spec.ts`.
- [x] Verifikasi: tidak ada field sensitif disimpan di luar `report_evidence` (max 2000 char); `created_by` tidak bisa dimanipulasi dari klien; audit trail tidak terpengaruh penghapusan sumber.
- [x] Commit `test(helpdesk): verify full ticket system coverage`. Update status TODO menjadi Selesai hanya setelah semua acceptance criteria terpenuhi.

---

## Urutan dan Gate Rilis

Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.

- Task 1–3 dapat dideploy sebagai API-only (tanpa UI) untuk verifikasi awal.
- Task 6–7 memerlukan Task 3 selesai.
- Task 8 memerlukan semua task sebelumnya green.
- Halaman UI baru saja bukan bukti selesai; acceptance criteria spec §11 adalah gate rilis.
