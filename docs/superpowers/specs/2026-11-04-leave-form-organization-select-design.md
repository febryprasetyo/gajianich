# Pilihan Organisasi pada Form Cuti — Design Spec

## Summary & Problem Statement
Saat ini organisasi (dan logo) form cuti F4 diturunkan otomatis dari organisasi karyawan di `leaveController`.
HR perlu menerbitkan form atas nama organisasi lain dalam satu grup. Perbedaan antar organisasi **hanya logo**;
layout, label, signatory, dan alur approval sama. Logo saat ini statis (`/images/logo-cmc.png`) dan belum ada UI kelola logo.

## Keputusan (hasil klarifikasi)
| Topik | Keputusan |
|---|---|
| Daftar pilihan | Hanya organisasi aktif dalam **grup yang sama** dengan karyawan, yang punya profil dokumen LEAVE aktif |
| Siapa bisa memilih | Pengguna dengan scope `hr` write. Karyawan biasa otomatis organisasinya sendiri (field disembunyikan, `organizationId` dari payload diabaikan) |
| Edit | Boleh ganti organisasi selama status `DRAFT`/`PENDING`; selain itu 409 |
| Daftar cuti | Tambah kolom logo+nama organisasi dan filter organisasi |
| Kelola logo | Halaman baru di submenu **Master Data HR** → "Logo Organisasi" |
| Penyimpanan | Database, tabel aset immutable, disajikan via `/api/document-assets/:id` |
| Format | PNG/JPG/WebP, maks 512 KB, SVG ditolak |
| Org tanpa profil | Upload logo pertama otomatis membuat identity + profil LEAVE memakai template F4 aktif grup |

## Goals
- Pilihan organisasi (radio-card logo + nama) di form buat/edit cuti, khusus HR/Admin.
- Snapshot dokumen memakai logo organisasi terpilih; cetakan lama tidak berubah.
- Halaman Master Data HR untuk upload/ganti logo per organisasi.
- Kolom & filter organisasi di `/dashboard/leaves`.

## Non-Goals
- Tidak ada layout/label/signatory berbeda per organisasi.
- Tidak ada pengelolaan alamat/nama identitas (nama diambil dari `organizations.name`).
- Tidak memigrasi snapshot request lama; tidak mengubah approval/saldo.
- Tidak ada object storage/volume baru.

## Data Model & Schema Diffs
Tabel baru `document_assets` (immutable, tidak pernah di-update/delete):
```ts
documentAssets = pgTable('document_assets', {
  id: bigint identity PK,
  groupId: bigint notNull -> organization_groups.id,
  mimeType: varchar(50) notNull,          // check in ('image/png','image/jpeg','image/webp')
  byteSize: integer notNull,              // check > 0 and <= 524288
  sha256: varchar(64) notNull,
  content: bytea notNull,
  createdById: bigint -> users.id,
  createdAt: timestamptz defaultNow,
}, unique(groupId, sha256))
```
- `bytea` didefinisikan via `customType` Drizzle.
- Upload logo = insert aset (dedupe by sha256) → insert `document_identity_versions` versi baru dengan
  `logoAssetKey = '/api/document-assets/{id}'`, nonaktifkan versi lama, aktifkan baru, update/insert `document_profiles` (kind LEAVE) — semua dalam satu transaksi.
- Logo statis existing (`/images/logo-cmc.png`) tetap valid (backward compatible).
- Migrasi: `drizzle-kit generate` → 1 file migrasi additive, tanpa backfill.

## API Specifications
| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/document-assets/:id` | login | Kirim bytes; `Content-Type` dari DB, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=31536000, immutable`. 404 jika tidak ada / di luar grup scope |
| GET | `/api/hr/organization-logos` | `hr` read | `[{organizationId, groupId, code, name, logoAssetKey \| null, version \| null, updatedAt}]` |
| POST | `/api/hr/organization-logos` | `hr` write | multipart `name`, `code?`, `file` (logo). Buat organisasi baru di grup aktif + simpan logo & profil LEAVE dalam satu transaksi. 201 `{organizationId, code, name, logoAssetKey, version}` |
| POST | `/api/hr/organization-logos/:organizationId` | `hr` write | multipart `file?`, `name?`, `code?`. Perbarui nama/kode dan/atau unggah logo versi baru (validasi magic bytes + maks 512 KB). 201 `{organizationId, logoAssetKey, version}` |
| GET | `/api/leaves/document-organizations?employeeId=` | `hr` write | `LeaveDocumentOrganizationOption[]` dalam grup karyawan |
| POST/PUT | `/api/leaves`, `/api/leaves/:id` | existing | `organizationId?: number`. Non-HR: diabaikan. HR: wajib satu grup + profil aktif, else 422 `"Organisasi tidak valid untuk form cuti"`. PUT pada status selain DRAFT/PENDING → 409 |
| GET | `/api/leaves` | existing | Tambah query `organizationId?` + field respons `organization: {id, name, logoAssetKey}` |

## Frontend & Mobile UX
1. **`LeaveOrganizationPicker`** (di `LeaveRequestForm`, hanya HR): `role="radiogroup"`, kartu `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, logo h-10 `alt`=nama, badge "Default", aktif = ring emerald. State loading (skeleton) / empty ("Belum ada logo organisasi — form memakai organisasi karyawan") / error / success. Auto-load saat karyawan dipilih.
2. **Halaman `/dashboard/master/organization-logos`** (submenu Master Data HR): `PageHeader` (ikon emerald, H1 "Logo Organisasi"), `FilterToolbar` (search nama), `TableShell` kolom: Logo, Organisasi, Versi, Diperbarui, Aksi (`RowActionButton` ikon `Upload`, title+aria-label). Upload via `ModalShell` dengan preview, validasi klien (tipe/ukuran) + pesan error server. Tanpa tombol refresh; tanpa KPI (tidak ada metrik bermakna).
3. **Daftar cuti**: kolom "Organisasi" (logo kecil + nama) dan dropdown filter organisasi di `FilterToolbar` yang ada, ikut tombol Reset.
- Semua tap target ≥ 44px, fokus terlihat, WCAG 2.2 AA.

## Security & Integrity
- RBAC via `requireOrganizationScope('hr', ...)`; pemilihan org diputuskan server, bukan klien.
- Validasi grup server-side untuk setiap `organizationId`; aset hanya disajikan ke pengguna dalam scope grup.
- Magic-byte check, batas 512 KB di multer (`limits.fileSize`) dan constraint DB; SVG ditolak.
- Transaksi tunggal untuk upload logo dan untuk create/update cuti + snapshot.
- Audit `appendHrAudit`: upload logo (org, versi lama→baru) dan perubahan org pada cuti.
- Error client tanpa detail DB/stack.
