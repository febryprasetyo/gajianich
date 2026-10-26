# GA Approvals (Odoo Approvals Style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun alur administrasi Pengajuan GA (Goods Request) bergaya katalog Odoo Approvals dengan verifikasi fisik melalui tanda tangan basah (wet signature), mencakup draft, transisi status administrasi, audit trail, dan arsip dokumen fisik bertanda tangan.

**Architecture:** Modul backend Express dengan Drizzle ORM memperluas tabel `ga_goods_requests` dengan status administrasi, judul/alasan, log status, dan arsip dokumen bertanda tangan. Frontend Next.js mengadopsi katalog Odoo Approvals berbalut tema GAJIANICH / Emerald Enterprise tanpa engine approval digital, di mana seluruh pembaruan status dan arsip dikelola langsung oleh petugas GA.

**Tech Stack:** TypeScript, Node.js (Express), Drizzle ORM (PostgreSQL), Sharp, Next.js 16 (App Router / React 19), Tailwind CSS, Node native test runner (`tsx --test`).

**Spec:** [docs/superpowers/specs/2026-10-20-ga-approvals-design.md](file:///home/fastpec/code/ams-app/docs/superpowers/specs/2026-10-20-ga-approvals-design.md)

## Global Constraints

- Tema visual wajib GAJIANICH / Emerald Enterprise (palette emerald `#059669` / `#10b981`, slate canvas `#f8fafc`, panel putih `#ffffff`, radius dan fokus konsisten sesuai `UI_DESIGN_SYSTEM_GUIDE.md`).
- Tidak ada digital approval workflow (tidak ada akun approver, tombol setujui/tolak digital, atau notifikasi keputusan digital).
- Persetujuan dilakukan secara manual menggunakan 5 kolom tanda tangan basah pada dokumen cetak (*Diajukan*, *Diketahui Oleh*, *Diperiksa*, *Disetujui*, *Penjual*).
- Petugas GA dengan permission `ga.requests.*` adalah operator tunggal di aplikasi.
- Tahap awal hanya mengaktifkan kategori "Pembelian Barang"; kategori lain tidak boleh ditampilkan sebagai layanan aktif.
- Responsif mobile (360px, 390px, 768px, 1280px) dan kepatuhan WCAG 2.2 AA.
- Kompatibilitas mundur: data pengajuan barang yang sudah ada di database harus tetap dapat dibaca, dicetak, dan memiliki fallback status yang aman.

## Review Focus

1. **Simpan Draft tanpa Item/Bukti**: Form draft boleh disimpan tanpa item barang atau tanpa lampiran bukti harga, tetapi status Siap Cetak wajib memvalidasi minimal 1 item lengkap beserta bukti harga.
2. **Perlindungan Akses Arsip Fisik**: File scan/foto tanda tangan basah hanya boleh diunduh/dilihat oleh pengguna dengan izin `ga.requests.view`.
3. **Validasi Mesin FSM Status**: Perubahan status harus mengikuti alur yang valid; status tidak boleh melompat sembarangan (misal dari `draft` langsung ke `completed`).
4. **Catatan Wajib pada Pembatalan**: Transisi status ke `cancelled` wajib menyertakan alasan pembatalan pada log status.
5. **Idempotensi & Transaksi Database**: Pembaruan status dan pencatatan audit log harus berada dalam satu transaksi database (`db.transaction`).

---

### Task 1: Database Schema & Migration for GA Approvals

**Files:**
- Modify: `backend/src/db/schema/goodsRequests.ts`
- Create: `backend/src/db/schema/goodsRequests.test.ts`

**Interfaces:**
- Consumes: `users` dari `backend/src/db/schema/users.ts`
- Produces:
  - `goodsRequests` (updated columns: `title`, `purpose`, `status`, `version`)
  - `goodsRequestStatusLogs` table & types
  - `goodsRequestSignedDocuments` table & types

- [x] **Step 1: Write the failing test**

```typescript
// backend/src/db/schema/goodsRequests.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { goodsRequests, goodsRequestStatusLogs, goodsRequestSignedDocuments } from './goodsRequests';

test('goodsRequests schema exposes title, purpose, status, and version columns', () => {
  const columns = getTableColumns(goodsRequests);
  assert.ok(columns.title, 'title column must exist');
  assert.ok(columns.purpose, 'purpose column must exist');
  assert.ok(columns.status, 'status column must exist');
  assert.ok(columns.version, 'version column must exist');
});

test('goodsRequestStatusLogs schema exposes required audit columns', () => {
  const columns = getTableColumns(goodsRequestStatusLogs);
  assert.ok(columns.id, 'id column must exist');
  assert.ok(columns.requestId, 'requestId column must exist');
  assert.ok(columns.fromStatus, 'fromStatus column must exist');
  assert.ok(columns.toStatus, 'toStatus column must exist');
  assert.ok(columns.notes, 'notes column must exist');
  assert.ok(columns.changedBy, 'changedBy column must exist');
  assert.ok(columns.createdAt, 'createdAt column must exist');
});

test('goodsRequestSignedDocuments schema exposes archive columns', () => {
  const columns = getTableColumns(goodsRequestSignedDocuments);
  assert.ok(columns.id, 'id column must exist');
  assert.ok(columns.requestId, 'requestId column must exist');
  assert.ok(columns.storageKey, 'storageKey column must exist');
  assert.ok(columns.fileName, 'fileName column must exist');
  assert.ok(columns.size, 'size column must exist');
  assert.ok(columns.uploadedBy, 'uploadedBy column must exist');
  assert.ok(columns.createdAt, 'createdAt column must exist');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test backend/src/db/schema/goodsRequests.test.ts`
Expected: FAIL with missing columns or tables.

- [x] **Step 3: Write minimal implementation**

Update `backend/src/db/schema/goodsRequests.ts` to include `title`, `purpose`, `status`, `version`, `goodsRequestStatusLogs`, and `goodsRequestSignedDocuments`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test backend/src/db/schema/goodsRequests.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/src/db/schema/goodsRequests.ts backend/src/db/schema/goodsRequests.test.ts
git commit -m "feat(ga): add title, purpose, status, status logs, and signed docs schema"
```

---

### Task 2: GA Status Transitions and Domain Validation

**Files:**
- Modify: `backend/src/domain/goodsRequest.ts`
- Create: `backend/src/domain/goodsRequest.test.ts`

**Interfaces:**
- Produces:
  - `GoodsRequestStatus` enum/type
  - `isValidStatusTransition(from: GoodsRequestStatus, to: GoodsRequestStatus): boolean`
  - `validateGoodsRequest(input: unknown, isDraft?: boolean): ValidatedGoodsRequest`

- [x] **Step 1: Write the failing test**

```typescript
// backend/src/domain/goodsRequest.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidStatusTransition, validateGoodsRequest, GoodsInputError } from './goodsRequest';

test('status transition follows physical wet signature workflow', () => {
  assert.equal(isValidStatusTransition('draft', 'ready_to_print'), true);
  assert.equal(isValidStatusTransition('ready_to_print', 'pending_signature'), true);
  assert.equal(isValidStatusTransition('pending_signature', 'approved_manually'), true);
  assert.equal(isValidStatusTransition('approved_manually', 'processing'), true);
  assert.equal(isValidStatusTransition('processing', 'completed'), true);
  
  assert.equal(isValidStatusTransition('pending_signature', 'draft'), true);
  assert.equal(isValidStatusTransition('ready_to_print', 'draft'), true);
  assert.equal(isValidStatusTransition('draft', 'cancelled'), true);
  assert.equal(isValidStatusTransition('pending_signature', 'cancelled'), true);

  assert.equal(isValidStatusTransition('draft', 'approved_manually'), false);
  assert.equal(isValidStatusTransition('draft', 'completed'), false);
  assert.equal(isValidStatusTransition('completed', 'draft'), false);
});

test('validateGoodsRequest allows draft with zero items', () => {
  const draft = {
    title: 'Pembelian Meja',
    purpose: 'Kebutuhan tim baru',
    requestDate: '2026-10-20',
    requesterName: 'Budi',
    jobTitle: 'Staff',
    division: 'Umum',
    items: [],
  };
  const validated = validateGoodsRequest(draft, true);
  assert.equal(validated.status, 'draft');
  assert.equal(validated.items.length, 0);
});

test('validateGoodsRequest rejects ready_to_print without items', () => {
  const ready = {
    title: 'Pembelian Meja',
    purpose: 'Kebutuhan tim baru',
    requestDate: '2026-10-20',
    requesterName: 'Budi',
    jobTitle: 'Staff',
    division: 'Umum',
    items: [],
  };
  assert.throws(() => validateGoodsRequest(ready, false), (err: unknown) => {
    return err instanceof GoodsInputError && /minimal satu barang/i.test(err.message);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test backend/src/domain/goodsRequest.test.ts`
Expected: FAIL with undefined exports.

- [x] **Step 3: Write minimal implementation**

Implement `ALLOWED_STATUS_TRANSITIONS`, `isValidStatusTransition`, `GoodsInputError`, and `validateGoodsRequest` with optional `isDraft` parameter in `backend/src/domain/goodsRequest.ts`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test backend/src/domain/goodsRequest.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/src/domain/goodsRequest.ts backend/src/domain/goodsRequest.test.ts
git commit -m "feat(ga): implement status transitions FSM and draft validation"
```

---

### Task 3: Backend API Endpoints for Drafts, Status Transitions, and Signed Document Upload

**Files:**
- Modify: `backend/src/routes/goodsRequestRoutes.ts`
- Modify: `backend/src/services/goodsEvidence.ts`
- Modify: `backend/src/routes/goodsRequest.integration.test.ts`

**Interfaces:**
- Produces:
  - `POST /api/v1/ga/requests` (supports draft mode)
  - `PUT /api/v1/ga/requests/:id` (edit draft)
  - `POST /api/v1/ga/requests/:id/status` (status transition + status log creation)
  - `GET /api/v1/ga/requests/:id/history` (status logs)
  - `POST /api/v1/ga/requests/:id/signed-document` (upload scanned wet signature PDF/image)
  - `GET /api/v1/ga/requests/:id/signed-documents` (list signed docs)
  - `GET /api/v1/ga/requests/:id/signed-document/:docId` (download signed doc)

- [x] **Step 1: Write the failing integration test**

Extend `backend/src/routes/goodsRequest.integration.test.ts` to verify:
1. POST as draft with empty items returns 201 with `status: 'draft'`.
2. Transition to `ready_to_print` then to `pending_signature` with reason.
3. GET `/:id/history` returns accurate chronological logs.
4. Uploading signed document attachment returns 201 and is accessible via GET.

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test backend/src/routes/goodsRequest.integration.test.ts`
Expected: FAIL on new routes.

- [x] **Step 3: Implement route handlers and database transaction**

Implement status change, history endpoint, and signed document upload/download in `backend/src/routes/goodsRequestRoutes.ts`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test backend/src/routes/goodsRequest.integration.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/src/routes/goodsRequestRoutes.ts backend/src/services/goodsEvidence.ts backend/src/routes/goodsRequest.integration.test.ts
git commit -m "feat(ga): implement status transition, history, and signed doc upload API"
```

---

### Task 4: Frontend Shared Types, Status UI Helper, and Unit Tests

**Files:**
- Create: `frontend/src/types/goodsRequest.ts`
- Create: `frontend/src/lib/ga/goodsRequestStatus.ts`
- Create: `frontend/src/lib/ga/goodsRequestStatus.test.mjs`

**Interfaces:**
- Produces:
  - TypeScript types: `GoodsRequest`, `GoodsRequestStatus`, `StatusLog`, `SignedDocument`
  - Helper functions: `getStatusBadgeConfig(status: GoodsRequestStatus)`, `getStatusLabel(status: GoodsRequestStatus)`

- [x] **Step 1: Write the failing test**

```javascript
// frontend/src/lib/ga/goodsRequestStatus.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { getStatusBadgeConfig, getStatusLabel } from './goodsRequestStatus.ts';

test('getStatusLabel returns human friendly Indonesian label', () => {
  assert.equal(getStatusLabel('draft'), 'Draft');
  assert.equal(getStatusLabel('ready_to_print'), 'Siap Cetak');
  assert.equal(getStatusLabel('pending_signature'), 'Menunggu Tanda Tangan');
  assert.equal(getStatusLabel('approved_manually'), 'Persetujuan Manual Lengkap');
  assert.equal(getStatusLabel('processing'), 'Diproses');
  assert.equal(getStatusLabel('completed'), 'Selesai');
  assert.equal(getStatusLabel('cancelled'), 'Dibatalkan');
});

test('getStatusBadgeConfig returns valid Emerald Enterprise token styles', () => {
  const config = getStatusBadgeConfig('approved_manually');
  assert.ok(config.bgClass.includes('emerald'));
  assert.ok(config.textClass.includes('emerald'));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test frontend/src/lib/ga/goodsRequestStatus.test.mjs`
Expected: FAIL with module not found.

- [x] **Step 3: Write minimal implementation**

Create `frontend/src/types/goodsRequest.ts` and `frontend/src/lib/ga/goodsRequestStatus.ts` adhering to GAJIANICH / Emerald Enterprise tokens.

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test frontend/src/lib/ga/goodsRequestStatus.test.mjs`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add frontend/src/types/goodsRequest.ts frontend/src/lib/ga/goodsRequestStatus.ts frontend/src/lib/ga/goodsRequestStatus.test.mjs
git commit -m "feat(ga): add status labels, badge tokens, and shared types"
```

---

### Task 5: Frontend Catalog & Request List View (Odoo Approvals Style)

**Files:**
- Create: `frontend/src/components/ga/GAApprovalsCatalog.tsx`
- Modify: `frontend/src/components/ga/GoodsRequestList.tsx`

**Interfaces:**
- Consumes: `goodsRequestStatus.ts`, `StatusBadge.tsx`
- Produces: Odoo-style category catalog card + request data table with status pill filters.

- [x] **Step 1: Write component contract / unit test**

Create `frontend/src/lib/ga/catalogView.test.mjs` asserting that only 'Pembelian Barang' is active and non-goals are marked coming-soon.

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test frontend/src/lib/ga/catalogView.test.mjs`
Expected: FAIL

- [x] **Step 3: Implement Catalog & List components**

Implement `GAApprovalsCatalog.tsx` and upgrade `GoodsRequestList.tsx` with status tab filters and metrics summary.

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test frontend/src/lib/ga/catalogView.test.mjs`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/ga/GAApprovalsCatalog.tsx frontend/src/components/ga/GoodsRequestList.tsx frontend/src/lib/ga/catalogView.test.mjs
git commit -m "feat(ga): implement Odoo Approvals catalog and status filtered list"
```

---

### Task 6: Frontend Form (Draft vs Siap Cetak) & Print Document Sheet

**Files:**
- Modify: `frontend/src/components/ga/GoodsRequestForm.tsx`
- Modify: `frontend/src/components/ga/GoodsRequestDocument.tsx`

**Interfaces:**
- Consumes: `validateGoodsRequest` rules, `GoodsRequest` types
- Produces:
  - Form with "Simpan Draft" and "Simpan & Siap Cetak" action buttons
  - Updated Print view rendering Title, Purpose, and 5 Wet Signature blocks

- [x] **Step 1: Write unit test for form actions**

Create `frontend/src/lib/ga/goodsFormValidation.test.mjs` testing draft vs full validation logic.

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test frontend/src/lib/ga/goodsFormValidation.test.mjs`
Expected: FAIL

- [x] **Step 3: Implement Form & Document Updates**

Update `GoodsRequestForm.tsx` (add title/purpose, dual buttons) and `GoodsRequestDocument.tsx` (render header metadata and 5 physical signature columns).

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test frontend/src/lib/ga/goodsFormValidation.test.mjs`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/ga/GoodsRequestForm.tsx frontend/src/components/ga/GoodsRequestDocument.tsx frontend/src/lib/ga/goodsFormValidation.test.mjs
git commit -m "feat(ga): add draft support in form and update print sheet"
```

---

### Task 7: Frontend Detail View (Status Transition, Audit History & Signed Document Archive)

**Files:**
- Modify: `frontend/src/components/ga/GoodsRequestDetail.tsx`
- Create: `frontend/src/components/ga/StatusTransitionModal.tsx`
- Create: `frontend/src/components/ga/SignedDocumentArchive.tsx`

**Interfaces:**
- Consumes: Status FSM rules, signed doc API endpoints
- Produces:
  - Status management panel with "Perbarui Status" modal
  - Timeline of status transitions & notes
  - Upload & preview area for scanned wet-signed document

- [x] **Step 1: Write helper tests for allowed UI actions**

Create `frontend/src/lib/ga/statusActions.test.mjs` checking that only allowed next transitions are returned.

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test frontend/src/lib/ga/statusActions.test.mjs`
Expected: FAIL

- [x] **Step 3: Implement Detail Components**

Implement `StatusTransitionModal.tsx`, `SignedDocumentArchive.tsx`, and integrate into `GoodsRequestDetail.tsx`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test frontend/src/lib/ga/statusActions.test.mjs`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/ga/GoodsRequestDetail.tsx frontend/src/components/ga/StatusTransitionModal.tsx frontend/src/components/ga/SignedDocumentArchive.tsx frontend/src/lib/ga/statusActions.test.mjs
git commit -m "feat(ga): implement status modal, history timeline, and signed doc archive"
```

---

### Task 8: Full Verification Loop & Backward Compatibility Verification

**Files:**
- Run verification across backend and frontend.

- [x] **Step 1: Run Backend Tests**

Run: `npm test --prefix backend`
Expected: All tests pass.

- [x] **Step 2: Run Backend Typecheck & Build**

Run: `npm run build --prefix backend`
Expected: No TypeScript errors.

- [x] **Step 3: Run Frontend Tests & Lint**

Run: `npm test --prefix frontend && npm run lint --prefix frontend`
Expected: All tests pass and lint clean.

- [x] **Step 4: Run Frontend Build**

Run: `npm run build --prefix frontend`
Expected: Build succeeds cleanly.

- [x] **Step 5: Final Git Status Check & Commit**

Verify clean working directory and all commits conform to Conventional Commits.
