# 18 – Pilihan Organisasi pada Form Cuti + Manajemen Logo Organisasi
Status: Selesai
Spec: [2026-11-04-leave-form-organization-select-design.md](../superpowers/specs/2026-11-04-leave-form-organization-select-design.md) | Plan: [2026-11-04-leave-form-organization-select.md](../superpowers/plans/2026-11-04-leave-form-organization-select.md)
Lingkup: `backend/src/db/schema/documentProfiles.ts`, `backend/drizzle/0043_document_assets_organization_logos.sql`, `backend/src/services/documentProfile.ts`, `backend/src/routes/organizationLogoRoutes.ts`, `backend/src/controllers/leaveController.ts`, `frontend/src/components/leaves/`, `frontend/src/app/dashboard/master/organization-logos/`, `frontend/src/app/dashboard/leaves/page.tsx` | Di luar lingkup: Form pengadaan barang GA, kustomisasi tata letak F4 per organisasi

## Checkpoint
- [x] CP-01 — `d3ce812` — Skema `document_assets`, migrasi `0043_document_assets_organization_logos.sql`, service logo & issuing organization, serta API cuti (`GET /leaves/document-organizations`, `GET/POST /hr/organization-logos`, `GET /document-assets/:id`, filter & kolom `organizationId` di `GET/POST/PUT /leaves`) → `cd backend && npx tsc --noEmit && npx tsx --test src/services/leaveDocumentProfile.test.ts src/controllers/leaveController.test.ts src/routes/leaveRoutes.test.ts` lulus (26/26 pass)
- [x] CP-02 — `58ea5c6` — Komponen `LeaveOrganizationPicker`, integrasi `LeaveRequestForm` (HR only), halaman Master Data HR `Logo Organisasi` (`/dashboard/master/organization-logos`), dan kolom + filter organisasi di `/dashboard/leaves` → `cd frontend && npm test && npx tsc --noEmit && npm run lint` lulus (247/247 pass)
- [x] CP-03 — Fitur Tambah Organisasi Baru + Edit Nama/Kode/Logo (`POST /hr/organization-logos` & modal `OrganizationLogoUploadModal`) serta aktivasi migrasi `0043_document_assets_organization_logos.sql` pada database (`cd backend && npm run db:migrate`) lulus

## Kriteria Selesai
- [x] Logo organisasi disimpan di `document_assets` (PNG/JPG/WebP ≤ 512 KB, validasi magic bytes, deduplikasi SHA-256 per grup, immutable versioned URL `/api/v1/document-assets/:id`).
- [x] Upload logo pertama otomatis mengaktifkan profil dokumen `LEAVE` organisasi dengan template F4 aktif grup.
- [x] HR/Admin dapat memilih organisasi penerbit form cuti dalam grup yang sama saat membuat/mengedit cuti berstatus `DRAFT` atau `PENDING`; karyawan biasa otomatis memakai organisasi asalnya.
- [x] Daftar pengajuan cuti (`/dashboard/leaves`) menampilkan kolom Organisasi beserta filter dropdown organisasi.
