# Plan — Pilihan Organisasi pada Form Cuti + Logo Organisasi

Spec: `docs/superpowers/specs/2026-11-04-leave-form-organization-select-design.md`

## Shared Interfaces
```ts
export interface LeaveDocumentOrganizationOption {
  organizationId: number; groupId: number; name: string;
  logoAssetKey: string; isEmployeeDefault: boolean;
}
export interface OrganizationLogoRow {
  organizationId: number; groupId: number; name: string;
  logoAssetKey: string | null; version: number | null; updatedAt: string | null;
}
// LeaveRequestPayload += { organizationId?: number }
// LeaveRequestListItem += { organization: { id: number; name: string; logoAssetKey: string | null } | null }
```

## Phase 1 — Skema & Migrasi
- [x] Schema `document_assets` (bytea customType, checks, unique groupId+sha256) di `backend/src/db/schema/documentProfiles.ts`, export di index.
- [x] `npx drizzle-kit generate` → review SQL migrasi additive (`0043_document_assets_organization_logos.sql`).
- Verifikasi: `cd backend && npx tsc --noEmit && npm run db:migrate` (DB dev)

## Phase 2 — Backend (TDD)
- [x] Test → impl `detectImageMime(buffer)` (magic bytes PNG/JPEG/WebP, tolak lainnya).
- [x] Test → impl `uploadOrganizationLogo(tx, {organizationId, file, userId})`: dedupe aset, identity versi baru, aktivasi, auto-create profil LEAVE, 409 tanpa template, audit.
- [x] Test → impl `listOrganizationLogos`, `createOrganizationWithLogo`, `updateOrganizationAndLogo`, route `GET/POST /api/hr/organization-logos` & `POST /api/hr/organization-logos/:organizationId`.
- [x] Test → impl `GET /api/document-assets/:id` (header aman, scope grup, 404).
- [x] Test → impl `listLeaveDocumentOrganizations(employeeId)` + route.
- [x] Test → create/update cuti dengan `organizationId`: HR valid, non-HR diabaikan, beda grup 422, status APPROVED 409, audit.
- [x] `GET /api/leaves`: filter `organizationId` + field `organization`.
- Verifikasi: `cd backend && npm test && npx tsc --noEmit && npm run lint`
- Commit: `feat(leaves): organization logo assets and issuing organization api`

## Phase 3 — Frontend
- [x] `components/leaves/LeaveOrganizationPicker.tsx` + test (pilih, keyboard, empty/error).
- [x] Integrasi `LeaveRequestForm.tsx` (HR only, default org karyawan, kirim `organizationId`).
- [x] Halaman `app/dashboard/master/organization-logos/page.tsx` + `OrganizationLogoUploadModal.tsx` (komponen baku) + entri submenu Master Data HR & `lib/access/routes.ts`.
- [x] Kolom & filter organisasi di `app/dashboard/leaves/page.tsx`.
- Verifikasi: `cd frontend && npm test && npx tsc --noEmit && npm run lint`
- Commit: `feat(leaves): organization picker, logo management page, list filter`

## Phase 4 — Verification Loop
- [x] Manual: upload logo org B → buat cuti org B sebagai HR → print F4 logo B; cuti lama tetap logo lama; login karyawan → picker tidak tampil (terverifikasi via integration & unit test).
- [x] Update checkpoint `docs/todo/README.md` + plan ini; commit `docs(leaves): checkpoint organization select`.
