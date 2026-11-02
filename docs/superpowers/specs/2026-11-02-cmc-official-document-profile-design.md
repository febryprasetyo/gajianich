# Design Spec: Profil Dokumen Resmi CMC (Permohonan Cuti F4)

- **Tanggal**: 2026-11-02
- **Status**: Draft / Proposed
- **Author**: Antigravity Pair Programmer
- **Terkait**: `docs/plan/2026-10-29-cmc-mgm-rollout-runbook.md`, `docs/plan/2026-10-29-cmc-mgm-mapping-manifest.md`

---

## 1. Summary & Problem Statement

Saat pengguna membuka halaman pratinjau/cetak formulir cuti F4 (`/dashboard/leaves/[id]/print` atau `/dashboard/leaves/[id]/print/new`), sistem menampilkan status amber penahanan cetak:
> *"Profil dokumen resmi belum tersedia. Pratinjau dan cetak ditahan sampai identitas dan format organisasi disahkan."*

### Penyebab Akar (Root Cause):
1. Tabel `organizations`, `document_template_versions`, `document_identity_versions`, dan `document_profiles` belum berisi data (0 baris di database pengembangan `ams_dev_db`).
2. Tabel `department_organization_mappings` memiliki `group_id = 1` (CMC) tetapi `organization_id = NULL`.
3. Akibatnya, pada pembuatan pengajuan cuti (`createLeaveRequest`), `owner.organizationId` bernilai `null` sehingga `resolveDocumentProfile` dilewati, dan kolom `document_profile_snapshot` pada `leave_requests` bernilai `NULL`.
4. Komponen frontend (`LeaveFormF4Document` dan `LeaveFormF4NewDocument`) memanggil `documentProfileForRender(data, 'LEAVE')`. Karena snapshot bernilai `null`, fungsi mengembalikan `null`, memicu fallback penahanan dokumen resmi.

---

## 2. Goals & Non-Goals

### Goals
- **Provisi Dokumen Resmi CMC**: Menerbitkan profil dokumen resmi kanonikal untuk CMC (`groupId = 1`), mencakup template F4 (`cmc-leave-f4-v1`), identitas organisasi PT Cahaya Mas Cemerlang (`/images/logo-cmc.png`), dan profil dokumen resmi berstatus aktif.
- **Pemetaan Departemen CMC**: Memperbarui `department_organization_mappings` untuk departemen CMC agar merujuk ke entitas organisasi CMC yang sah.
- **Resolusi Snapshot Reaktif & Backfill**:
  - Pada `GET /api/v1/leaves/requests/:id`, jika request historis memiliki `document_profile_snapshot` bernilai `null`, sistem secara otomatis me-resolve profil dokumen resmi aktif berdasarkan departemen/organisasi pemohon dan menguncinya ke database (diizinkan oleh trigger `protect_submitted_document_snapshot` karena snapshot sebelumnya `NULL`).
  - Menjalankan migrasi backfill untuk permohonan cuti CMC yang sudah ada.
- **Kesesuaian Tampilan Frontend**: Memastikan baik format standar F4 (`/print`) maupun live view (`/print/new`) dapat merender dokumen dengan profil resmi CMC tanpa pesan penahanan.
- **Isolasi MGM Tetap Fail-Closed**: MGM (`groupId = 2`) tetap tidak memiliki profil dokumen resmi dan tidak boleh dialihkan/fallback ke profil atau logo CMC.

### Non-Goals
- Membuat profil dokumen palsu untuk MGM sebelum dokumen resmi MGM disahkan oleh manajemen.
- Mengubah struktur atau relasi skema tabel yang sudah ada (hanya migrasi data additive dan Drizzle journal registration).

---

## 3. Data Model & Schema Diffs

Tidak ada perubahan struktur tabel DDL (semua tabel skema `document_profiles`, `document_template_versions`, `document_identity_versions`, `organizations` sudah ada sejak migrasi `0026` dan `0027`).

### Migrasi Additive Data (`0041_seed_cmc_official_document_profiles.sql`):
1. **`organizations`**:
   - `group_id`: `1` (CMC)
   - `code`: `'CMC'`
   - `name`: `'PT Cahaya Mas Cemerlang'`
   - `is_active`: `true`
2. **`department_organization_mappings`**:
   - `organization_id` diisi `(SELECT id FROM organizations WHERE code = 'CMC')` untuk seluruh baris dengan `group_id = 1`.
3. **`document_template_versions`**:
   - `kind`: `'LEAVE'`, `version`: `1`, `layout_key`: `'cmc-leave-f4-v1'`
   - `labels`: `{"formNumber": "001", "revisionCode": "REV. 170208-1-W", "title": "PERMOHONAN CUTI KARYAWAN"}`
   - `signatories`: `[{"key": "applicant", "label": "Pemohon", "name": null}, {"key": "direct_supervisor", "label": "Atasan Langsung", "name": null}, {"key": "hrd", "label": "HRD", "name": null}, {"key": "higher_supervisor", "label": "Atasan dari Atasan Langsung", "name": null}]`
   - `approved_reference`: `'2026-10-29-cmc-mgm-mapping-manifest'`, `is_active`: `true`
   - Tambahan untuk GA (`cmc-ga-v1`) agar modul GA juga memiliki template resmi.
4. **`document_identity_versions`**:
   - `group_id`: `1`, `organization_id`: id CMC, `version`: `1`
   - `name`: `'PT Cahaya Mas Cemerlang'`
   - `logo_asset_key`: `'/images/logo-cmc.png'`
   - `approved_reference`: `'2026-10-29-cmc-mgm-mapping-manifest'`, `is_active`: `true`
5. **`document_profiles`**:
   - Mengaitkan template version 1 dan identity version 1 untuk kind `'LEAVE'` dan `'GA'`.
6. **`leave_requests` (Backfill Snapshot)**:
   - Mengisi `organization_id` dan `document_profile_snapshot` untuk data cuti CMC historis yang snapshot-nya masih `null`.

---

## 4. API & Controller Behavior

### `backend/src/controllers/leaveController.ts`:
- **`getLeaveRequestById`**:
  Jika `request.documentProfileSnapshot` bernilai `null`:
  - Cari `organizationId` dari request atau pemetaan departemen karyawan pemohon.
  - Panggil `resolveDocumentProfile(db, { groupId: request.groupId, organizationId, kind: 'LEAVE' })`.
  - Simpan kembali snapshot ke `leave_requests` jika snapshot masih `null`.
  - Kembalikan `documentProfileSnapshot` dalam response JSON.

---

## 5. Frontend UX & Komponen

- `frontend/src/components/leaves/LeaveFormF4Document.tsx`:
  - Periksa `profile = documentProfileForRender(data, 'LEAVE')`.
  - Jika `!profile`, tampilkan peringatan status profil belum tersedia.
  - Jika valid, render dokumen F4 lengkap dengan logo `/images/logo-cmc.png`, kop `PT Cahaya Mas Cemerlang`, nomor formulir `001`, kode revisi `REV. 170208-1-W`, dan tabel data pemohon serta riwayat cuti.
- `frontend/src/components/leaves/LeaveFormF4NewDocument.tsx`:
  - Menyelaraskan verifikasi profil agar dapat merender profil dokumen resmi LEAVE yang valid.

---

## 6. Security & Integrity

- **Fail-Closed Isolation**: MGM (`groupId = 2`) tetap tidak dapat mencetak dokumen menggunakan logo/template CMC. `resolveDocumentProfile` memverifikasi kesesuaian foreign key `(groupId, organizationId)`.
- **Immutabilitas Snapshot**: Trigger `protect_submitted_document_snapshot` menolak modifikasi apa pun jika snapshot sudah terisi (`OLD.document_profile_snapshot IS NOT NULL`).
