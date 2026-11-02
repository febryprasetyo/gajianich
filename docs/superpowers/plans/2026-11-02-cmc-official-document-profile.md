# Implementation Plan: Profil Dokumen Resmi CMC (Permohonan Cuti F4)

- **Tanggal**: 2026-11-02
- **Design Spec**: [2026-11-02-cmc-official-document-profile-design.md](../specs/2026-11-02-cmc-official-document-profile-design.md)
- **Status**: Completed

---

## Shared Interfaces

```typescript
// Shared DocumentProfileSnapshot type
export interface DocumentProfileSnapshot {
  groupId: number;
  organizationId: number;
  kind: 'LEAVE' | 'GA';
  templateVersionId: number;
  identityVersionId: number;
  layoutKey: string;
  identity: {
    name: string;
    address: string | null;
    logoAssetKey: string;
  };
  labels: Record<string, string>;
  signatories: Array<{ key: string; label: string; name: string | null }>;
}
```

---

## Phase Checklist

### Phase 1: Database Migration & Seeding
- [x] Buat file migrasi `backend/drizzle/0041_seed_cmc_official_document_profiles.sql`
- [x] Daftarkan migrasi pada `backend/drizzle/meta/_journal.json`
- [x] Terapkan migrasi ke database development `ams_dev_db`
- [x] Verifikasi tabel `organizations`, `document_template_versions`, `document_identity_versions`, `document_profiles`, dan `department_organization_mappings`

### Phase 2: Backend Dynamic Snapshot Resolution
- [x] Perbarui `getLeaveRequestById` di `backend/src/controllers/leaveController.ts` agar otomatis me-resolve profil dokumen jika `documentProfileSnapshot` pada row masih null
- [x] Simpan snapshot ke database jika row sebelumnya null
- [x] Jalankan typecheck backend (`npx tsc --noEmit`) dan automated tests

### Phase 3: Frontend View & Layout Integration
- [x] Selaraskan `LeaveFormF4Document.tsx` dan `LeaveFormF4NewDocument.tsx` agar memanfaatkan `documentProfileForRender` secara konsisten
- [x] Jalankan typecheck frontend (`npx tsc --noEmit`) dan tests

### Phase 4: Automated Verification & Verification Loop
- [x] Verifikasi endpoint API `GET /api/v1/leaves/requests/:id` mengembalikan `documentProfileSnapshot` dengan properti lengkap
- [x] Verifikasi halaman print F4 render normal tanpa pesan warning amber
- [x] Jalankan backend tests: `npm test`
- [x] Jalankan frontend tests: `npm test`
- [x] Git commit atomic dengan conventional commit
