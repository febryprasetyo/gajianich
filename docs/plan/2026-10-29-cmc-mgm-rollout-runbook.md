# Runbook CMC/MGM

Implementasi scope HR, GA, inventaris, akun, dokumen berversi dan pemilih kelompok tersedia. Aktivasi operasional memerlukan mapping dan membership yang disetujui. Dokumen resmi memerlukan identitas/logo/template yang benar; profil yang belum tersedia menolak finalisasi, tanpa fallback MGM ke CMC.

## Data final dan migrasi

Karyawan dan absensi adalah data final. Jangan menjalankan seed umum atau reset pada development maupun produksi. Migrasi additive 0026–0029 sudah diterapkan pada development `ams_dev_db`, journal 30 entri. Fingerprint seluruh kolom lama pada 19 tabel master/karyawan/absensi cocok: 369 karyawan dan 1.684 attendance_records tetap utuh. Tidak melakukan backfill pemilik historis.

Metadata pemilik lama tetap null sampai ada bukti dan persetujuan. SuperAdmin dapat meninjau data belum terpetakan melalui cakupan gabungan; akun operasional tidak mendapatkannya. Setelah group_id riwayat terkunci, trigger database menolak penggantian pemilik. Versi identitas/template dan snapshot dokumen tersimpan juga tidak dapat ditulis ulang.

## Mapping dan membership

1. Jalankan `./node_modules/.bin/tsx scripts/preview-organization-scope.ts` dari backend dengan target terverifikasi. Preview memakai transaksi READ ONLY/repeatable-read dan timeout; tidak memuat PII.
2. Cocokkan database, environment ID, ID/code departemen dan lokasi dengan [manifest](2026-10-29-cmc-mgm-mapping-manifest.md). Manifest development bukan persetujuan produksi. Departemen baru/null tidak otomatis CMC.
3. Operator menetapkan `gajianich.organization_environment_id` yang unik per database. Rotasi identifier pada clone; sambungkan ulang pool. Nilai kosong atau berbeda menolak apply.
4. Siapkan katalog CMC/MGM dan organisasi anak yang disetujui. `ApprovedManifest` memuat targetDatabase, targetEnvironmentId, approvalReference dan pasangan ID/code/group/organization. Jangan mengarang enam identitas organisasi.
5. Panggil `applyOrganizationManifest` sebagai operasi operator dalam satu transaksi. Service memakai advisory lock, menolak konflik pemilik, dan idempotent untuk mapping yang sama. Tidak ada endpoint publik untuk mengirim approvalReference.
6. Tetapkan membership HR/GA/IT berdasarkan akun yang disetujui. Akun tanpa pegawai tidak otomatis global. Permission tindakan dan membership wajib sama-sama memenuhi syarat. SuperAdmin tetap dapat mengakses kedua induk; transfer inventaris lintas induk hanya SuperAdmin dan diaudit.
7. Verifikasi dengan akun nyata tiap kelompok: daftar, count, detail/deep-link, ekspor, lampiran dan mutasi. Inventaris mengikuti Primary Facility Location, bukan custodian. Shared hardware ingress hanya antrean; pemetaan tujuan harus eksplisit.

## Dokumen resmi

Operator menerbitkan baris baru pada `document_template_versions` dan `document_identity_versions`, dengan approved_reference, kelompok, jenis dokumen, versi dan identitas organisasi yang sesuai. Hubungkan melalui `document_profiles`. Layout yang didukung saat ini: `cmc-ga-v1`, `cmc-leave-f4-v1`, `cmc-leave-f4-new-v1`. Jangan menautkan MGM ke layout CMC sebagai pengganti template resmi yang belum diberikan.

Perubahan profil hanya memengaruhi pengajuan baru. Dokumen lama memakai snapshot tersimpan. Template/identitas versi lama hanya dapat dinonaktifkan, bukan ditulis ulang atau dihapus. Pengajuan resmi tanpa profil valid ditolak dengan pesan ketidaktersediaan. Draft GA masih dapat disimpan sesuai aturan aplikasi.

## Reproduksi verifikasi

Backend: gunakan PostgreSQL disposable loopback dengan nama `gajianich_ci_db`, `HR_AUDIT_TEST_DATABASE_URL` yang menunjuk ke sana, role runtime terpisah, dan secret sintetis. Migrasikan dan seed **database tes saja**, lalu `npm test` dan `./node_modules/.bin/tsc --noEmit`. Helper membuat database turunan disposable dan menolak target lain.

Frontend: Node 24, `npm test`, `npm run lint`, `./node_modules/.bin/tsc --noEmit`, `npm run build`.

Browser:

1. Buat database loopback disposable bernama `ams_scope_e2e_test`, migrasikan dan seed. Jalankan `./node_modules/.bin/tsx scripts/setup-organization-scope-e2e.ts` dari backend dengan DATABASE_URL database tersebut. Script menolak database lain dan katalog yang sudah berisi data. Output default `/tmp/ams-scope-e2e-fixture.json` hanya berisi akun sintetis.
2. Jalankan `createApp()` pada port API tersendiri tanpa scheduler perangkat. Jalankan salinan frontend dengan `INTERNAL_API_URL=http://127.0.0.1:5105/api/v1` pada port 3105. Hindari `.next` server development pengguna.
3. Dari root: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3105 SCOPE_E2E_FIXTURE=/tmp/ams-scope-e2e-fixture.json ./node_modules/.bin/playwright test tests/organization-scope.spec.ts --project=chromium --workers=1 --reporter=line`.
4. Gunakan proses API baru saat mengulang banyak login agar limiter produksi tetap diuji tanpa menonaktifkannya. Hapus hanya database/container/proses sementara yang dibuat untuk tes.

## Aktivasi dan pemulihan

Migrasi schema mendahului aplikasi. Katalog/mapping/membership development masih kosong; kode tersedia tetapi pemisahan operasional belum diprovisikan. Persetujuan historis absensi, identitas/template resmi dan manifest produksi tetap diperlukan sebelum bagian terkait diaktifkan.

Sebelum deploy produksi, lakukan backup serta uji restore pada target terpisah dan verifikasi manifest/provisioning. Tidak ada deploy produksi dalam pekerjaan ini. Saat rollback aplikasi, pertahankan metadata additive dan jangan membuka kembali endpoint lama tanpa scope setelah membership operasional aktif. Baca [checkpoint](2026-10-29-cmc-mgm-organization-scope-checkpoint.md) untuk bukti dan batas pengujian.
