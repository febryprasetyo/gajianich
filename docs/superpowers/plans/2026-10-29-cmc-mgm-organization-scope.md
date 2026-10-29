# CMC/MGM Organization Scope Implementation Plan

> Status terbaru: integrasi Task 1–9 tersedia; verifikasi Task 10 dicatat pada checkpoint. Aktivasi produksi dan konfigurasi resmi tetap mengikuti gerbang data/persetujuan. Checkbox mengikuti commit terverifikasi, bukan sekadar perubahan lokal.

**Goal:** Memisahkan data dan akses CMC/MGM dengan mempertahankan master karyawan/departemen/lokasi serta menyediakan profil dokumen cuti/GA per induk dan identitas organisasi.

**Architecture:** Tambahkan katalog kelompok/organisasi, mapping departemen/lokasi, serta membership akun di atas schema lama. Permission tindakan dan scope server diperiksa bersama. Transaksi menyimpan pemilik serta versi/snapshot dokumen; UI tidak menjadi batas keamanan.

**Tech Stack:** Express, TypeScript, Drizzle ORM, PostgreSQL; Next.js 16, React 19, Tailwind, node:test/tsx. Tidak membutuhkan database baru atau Supabase.

**Spec:** [Spesifikasi](../specs/2026-10-29-cmc-mgm-organization-scope-design.md).

## Global Constraints

- Pengguna kini mengizinkan implementasi todo 15; batas dokumentasi saja berlaku pada sesi perencanaan awal. Tidak ada izin deploy produksi. Karyawan dan absensi adalah data final, wajib dipertahankan; tidak menjalankan seed/reset pada data tersebut.
- Dua kelompok utama adalah CMC dan MGM; total enam organisasi, daftar resmi lengkap belum diberikan.
- Pertahankan data dan departemen lama. Pemetaan master menentukan kelompok tanpa klasifikasi ulang karyawan satu per satu.
- Batas cakupan mencakup semua menu HR, GA, dan manajemen pengguna. Ini bukan pemberian semua permission kepada semua akun HR/GA.
- Primary Facility Location menjadi dasar identifikasi dan akses inventaris sesuai organisasi.
- Departemen baru/null/tidak dikenal tidak otomatis CMC. Rename tidak mengubah mapping berbasis ID.
- Gunakan migrasi additive/idempotent; jangan mengubah ID, nomor pegawai, barcode, FK atau keunikan global lama untuk pekerjaan ini.
- Semua keputusan D1-D6 di spec harus dihormati. Task yang tidak bergantung boleh maju; aktivasi bagian yang bergantung tetap tertahan.
- Ikuti AGENTS.md dan kedua master desain; tidak membuat refresh manual atau merombak halaman lain.
- Pertahankan pekerjaan lain di checkout; tidak membuat commit/deploy otomatis pada sesi dokumentasi ini.

## Review Focus

1. Departemen/lokasi null atau baru tidak bocor ke default CMC (Task 1, 2, 4, 7).
2. Akun tanpa pegawai, stale token, fallback nama role, reset password dan perubahan membership tidak menaikkan akses (Task 3, 5).
3. Export, jumlah statistik, lampiran dan proses background tidak melewati filter yang hanya ada di daftar (Task 4, 6, 7, 10).
4. Mutasi departemen/lokasi dan perubahan logo/template tidak menulis ulang pemilik atau hasil cetak historis (Task 2, 6, 7, 8).
5. Pergantian kelompok antar-tab atau respons lambat tidak mencampur cache dan tujuan write (Task 3, 9, 10).

## Urutan dan gerbang

Task 1-3 membentuk fondasi, Task 4-7 mengintegrasikan modul, Task 8 profil dokumen, Task 9 UI, Task 10 integrasi/rollout. Setiap task menghasilkan bagian yang dapat diuji sendiri, bukan izin membuka kelompok kedua sebelum seluruh permukaan terkait aman.

D1 mengunci kebijakan inventaris; D2 aturan cuti/approval; D3 identitas dan template resmi; D4 manifest target; D5 perubahan kebijakan SuperAdmin; D6 riwayat dan mutasi. Lihat spec untuk batas masing-masing. Jangan membuat pertanyaan baru untuk pilihan teknis rutin yang sudah ditentukan kontrak di sini.

Semua path berikut relatif root repo. Jalankan perintah backend di backend/ dan frontend di frontend/. File berlabel Create adalah usulan baru; validasi benturan nama sebelum membuat. Migrasi harus mengikuti journal terbaru, bukan nomor yang di-hardcode di rencana.

## Task 1: Inventarisasi read-only dan manifest pemetaan

**Files:** Create backend/src/domain/organizationScope.ts, backend/src/domain/organizationScope.test.ts, backend/scripts/preview-organization-scope.ts; Create docs/plan/2026-10-29-cmc-mgm-mapping-manifest.md sebagai output ringkas tanpa PII saat implementasi.

**Interfaces:** GroupCode = 'CMC' | 'MGM'. MappingCandidate = { source: 'department' | 'location'; sourceId: number; sourceCode: string; sourceName: string; groupCode: GroupCode | null; organizationCode: string | null; evidence: 'USER_CONFIRMED' | 'REQUIRES_REVIEW' }. Preview menghasilkan counts, candidates, unresolved; tidak mengeluarkan daftar nama karyawan/rahasia. Manifest belum applied.

- [ ] Tulis tes buildDepartmentCandidates(rows): dua nama MGM tepat menjadi kandidat MGM; departemen lama lain menjadi kandidat CMC untuk review, bukan auto-apply; null/entri baru di luar manifest tidak dianggap CMC. Rename dengan ID sama mempertahankan mapping existing. Lokasi tanpa bukti tetap unresolved.
- [ ] Jalankan ./node_modules/.bin/tsx --test src/domain/organizationScope.test.ts; pastikan kegagalan karena perilaku belum tersedia.
- [ ] Implementasikan fungsi pure buildDepartmentCandidates(rows: MasterRow[]): MappingCandidate[] dan preview dalam BEGIN TRANSACTION READ ONLY dengan statement timeout. Jangan menggunakan import db yang menjalankan seed/migrate; koneksi langsung mengikuti env target dan tidak mencetak connection string berpassword.
- [ ] Jalankan tes yang sama hingga lulus. Verifikasi preview tidak memiliki INSERT/UPDATE/DELETE/DDL dan rekonsiliasi jumlah total = mapped + unresolved.
- [ ] Tulis manifest dengan ID nyata target, bukti, tanggal, status belum disetujui/applied. D4 harus ditutup sebelum target produksi disentuh; jangan mengubah karyawan/lokasi untuk mengejar cakupan.

## Task 2: Schema additive dan penerapan manifest

**Files:** Create backend/src/db/schema/organizations.ts, backend/src/db/schema/organizations.test.ts, backend/src/services/organizationMappings.ts, backend/src/services/organizationMappings.integration.test.ts; Modify backend/src/db/index.ts; Create migrasi/journal Drizzle berikutnya setelah memeriksa backend/drizzle/meta/_journal.json.

**Interfaces:** MappingResolution = { groupId: number; groupCode: GroupCode; organizationId: number | null } | null. resolveDepartmentMapping(tx, departmentId: number | null): Promise<MappingResolution>; resolveLocationMapping(tx, locationId: number | null): Promise<MappingResolution>. applyOrganizationManifest(tx, manifest: ApprovedManifest): Promise<{ inserted: number; unchanged: number; unresolved: number }>. ApprovedManifest menyertakan targetDatabase, targetEnvironmentId yang cocok dengan PostgreSQL `current_setting('gajianich.organization_environment_id', true)`, dan approvalReference. Bukan boolean/request browser; setting lingkungan kosong menolak apply.

- [ ] Tulis tes schema/integrasi disposable: CMC/MGM unik; satu mapping per departmentId/locationId; organizationId harus satu group dengan mapping; membership unik; null/unmapped menghasilkan null; dua kali apply tidak menggandakan data.
- [ ] Jalankan ./node_modules/.bin/tsx --test src/db/schema/organizations.test.ts src/services/organizationMappings.integration.test.ts pada database disposable dengan penolakan eksplisit target non-test sebelum operasi setup/drop.
- [ ] Implementasikan katalog dan mapping sesuai spec. Gunakan FK/constraint untuk konsistensi kelompok/identitas dan index join. Jangan mengisi daftar enam organisasi secara spekulatif. Registrasikan schema di db/index.ts.
- [ ] Buat migrasi melalui workflow journal proyek, review SQL, dan uji upgrade dari fixture schema lama. Apply manifest hanya melalui transaksi tervalidasi; perubahan mapping yang berpengaruh pada riwayat wajib audit dan kebijakan D6, bukan overwrite tanpa jejak.
- [ ] Jalankan ulang tes hingga lulus dan ./node_modules/.bin/tsc --noEmit. Buktikan jumlah/ID/nomor/barcode/FK karyawan dan data historis tidak berubah oleh migrasi additive.

## Task 3: Resolusi akses server dan kontrak autentikasi

**Files:** Create backend/src/services/organizationScope.ts, backend/src/middleware/organizationScope.ts, backend/src/middleware/organizationScope.test.ts; Modify backend/src/middleware/auth.ts, backend/src/utils/jwt.ts, backend/src/controllers/authController.ts; Extend backend/src/middleware/rbacAuth.test.ts.

**Interfaces:** ScopeModule = 'hr' | 'ga' | 'users' | 'assets'. GroupAccess = { groupIds: number[]; isGlobalAdministrator: boolean }. RequestScope = { module: ScopeModule; groupIds: number[]; includeUnmapped: boolean; selectedGroupId: number | null }. loadGroupAccess(userId: number): Promise<GroupAccess>; resolveRequestScope({ access, module, selectedGroupId, mode: 'read' | 'write' }): RequestScope; requireOrganizationScope(module, mode) middleware. Permission modul harus sudah lulus sebelum scope dipakai. Scope lokasi/organisasi aset diperluas di Task 7 sesuai D1.

- [ ] Tulis tes: pilih MGM tanpa membership ditolak; write multi-group tanpa tujuan ditolak; single-group dapat dipilih server; global administrator eksplisit dapat review unresolved; IT tanpa permission HR tetap ditolak; akun tanpa employeeId tidak otomatis global.
- [ ] Tambah regresi stale JWT/membership dicabut dan fallback role: cek membership/status efektif dari DB setiap request; jangan percaya daftar kelompok dari token lama atau localStorage. Role/status yang dipakai bypass global juga harus terkini.
- [ ] Jalankan ./node_modules/.bin/tsx --test src/middleware/organizationScope.test.ts src/middleware/rbacAuth.test.ts hingga tes baru terbukti gagal, implementasi resolver/middleware, lalu ulang hingga lulus.
- [ ] Gunakan header X-Organization-Group-Id untuk pilihan request, validasi numeric ID server; body groupId pada write harus cocok. Header bukan bukti izin. selectedGroupId null hanya read gabungan yang diizinkan, tidak pernah wildcard implisit.
- [ ] Tambahkan organizationAccess dan availableGroups pada /auth/me; existing roleId/permissions dan mustChangePassword tetap kompatibel. Jangan memberi membership global otomatis kepada semua akun lama. Catat provisioning akun admin awal di manifest D4.

## Task 4: Isolasi seluruh HR dan riwayat

**Files:** Modify backend/src/controllers/employeeController.ts, employeeImportController.ts, employeeExportController.ts, attendanceController.ts, attendanceCommandController.ts, attendanceDeviceController.ts, mobileAttendanceController.ts, leaveController.ts; backend/src/routes/employeeRoutes.ts, attendanceRoutes.ts, attendanceDeviceRoutes.ts, mobileAttendanceRoutes.ts, mobileApprovalRoutes.ts, leaveRoutes.ts; backend/src/services/attendanceWorkspace.ts, hrMasterMutations.ts, hrMutation.ts, hrActivityQuery.ts, mobileAttendanceService.ts, attendanceCalculationService.ts; backend/src/db/schema/leaves.ts dan attendance terkait jika metadata pemilik diperlukan. Create backend/src/services/hrOrganizationScope.integration.test.ts dan backend/src/routes/organizationScopeCoverage.test.ts.

**Interfaces:** RequestScope dari Task 3; mapping pegawai dari Task 2. Query service menerima scope wajib tanpa default global. Pengajuan baru menyimpan groupId/organizationId terverifikasi. Metadata historis dan prosedur mutasi mengikuti D6.

- [ ] Buat daftar seluruh endpoint/menu HR, mobile, audit, pengaturan, foto, impor/ekspor, report, dan job beserta sumber scope, read/write dan tes. Coverage test harus gagal jika route sensitif belum dipetakan; jangan sekadar memeriksa string middleware.
- [ ] Tulis integrasi fixture CMC/MGM: employee detail by-ID, export, preview/commit import, picker, saldo/cuti, koreksi absensi, mobile approval/foto, audit dan statistik. CMC tidak mendapat record/jumlah/nama MGM. Import dengan departmentId kelompok lain ditolak sebelum commit; FK handover ke luar scope ditolak.
- [ ] Jalankan ./node_modules/.bin/tsx --test src/services/hrOrganizationScope.integration.test.ts src/routes/organizationScopeCoverage.test.ts dan pastikan tes menangkap akses silang sebelum memperbaiki query.
- [ ] Terapkan scope dalam query/join dan pemeriksaan mutasi sebelum mengembalikan atau menulis data; list/count memakai predikat sama. Job unduh/kalkulasi mesin tidak membuat scope pegawai berdasarkan nama/IP mesin saja. Unmatched PIN tetap unresolved.
- [ ] Audit annual_leave_configs, holiday calendar, jadwal, dan setting global. D2 menentukan schema config per kelompok dan policy approval; jangan menyalin kuota/kalender sebagai fakta. Jangan mempersempit pengaturan hanya di UI.
- [ ] Uji mutasi departemen/mapping tidak memindahkan riwayat lama; data historis tanpa bukti tetap unresolved sampai D6 ditutup. Jalankan ulang tes fokus dan backend typecheck sampai lulus.

## Task 5: Manajemen pengguna tanpa eskalasi cakupan

**Files:** Modify backend/src/controllers/userController.ts, roleController.ts; backend/src/routes/userRoutes.ts, roleRoutes.ts; Create backend/src/controllers/userOrganizationScope.integration.test.ts.

**Interfaces:** loadGroupAccess/RequestScope dan membership Task 2-3. Perubahan target user lintas kewenangan hanya admin global; untuk akun operasional semua groupIds target harus subset cakupan pengelola dan assignment role mengikuti batas kewenangan lama.

- [ ] Tulis tes CMC tidak melihat/reset/nonaktifkan akun MGM; tidak menautkan employeeId MGM; tidak menambah membership MGM atau role SuperAdmin; akun multi-group/global tidak dapat diambil alih admin satu kelompok; akun tanpa pegawai tidak otomatis tersedia global.
- [ ] Tulis tes HR yang boleh mengelola employee tetap boleh melakukannya di kelompok sendiri; keanggotaan tidak memberikan access.roles.manage. Definisi role/permission global tidak dapat diubah admin kelompok.
- [ ] Jalankan ./node_modules/.bin/tsx --test src/controllers/userOrganizationScope.integration.test.ts; implementasikan validasi target, role, membership dan transaksi provisioning; ulang sampai lulus. Pertahankan proteksi last active SuperAdmin dan reset initial password.

## Task 6: GA per kelompok, termasuk file dan riwayat

**Files:** Modify backend/src/db/schema/goodsRequests.ts, backend/src/routes/goodsRequestRoutes.ts, backend/src/services/goodsEvidence.ts; Create backend/src/routes/goodsRequestOrganizationScope.integration.test.ts. Tambahkan migrasi additive sesuai journal.

**Interfaces:** groupId/organizationId pada header permintaan; anak item/evidence/status log/signed document mengikuti header. Tujuan diseleksi RequestScope write; snapshot dokumen terhubung di Task 8.

- [ ] Tulis tes list/count/search/detail/update/delete/status GA CMC tidak mengakses MGM. Unduh evidence dan signed-document memakai otorisasi parent, termasuk child-ID milik parent lain. Bad request tidak meninggalkan orphan file baru.
- [ ] Tulis tes pembuat multi-group wajib menyatakan tujuan; grup browser berbeda dari body ditolak. Status transition dan kebijakan edit/delete yang ada tetap berlaku.
- [ ] Jalankan ./node_modules/.bin/tsx --test src/routes/goodsRequestOrganizationScope.integration.test.ts src/routes/goodsRequest.integration.test.ts; implementasikan scoped queries/mutasi dan otorisasi file, lalu ulang sampai lulus.
- [ ] Preview GA lama dengan bukti tepercaya, jumlah mapped/unresolved, tanpa inferensi dari logo/divisi free text. D4/D6 mengunci backfill; laporan menampilkan batas cakupan data lama.

## Task 7: Inventaris melalui Primary Facility Location

**Files:** Modify backend/src/controllers/assetController.ts, assetDashboardController.ts, assetCustodianController.ts, assetLifecycleController.ts, assetImportController.ts; backend/src/services/assetAssignment.ts, assetCustodianRead.ts, hardwareAuditService.ts; backend/src/routes/assetRoutes.ts, assetCustodianRoutes.ts, hardwareAuditRoutes.ts; Create backend/src/services/assetOrganizationScope.integration.test.ts.

**Interfaces:** resolveLocationMapping(tx, assets.locationId) adalah sumber cakupan. Setelah D1 diputuskan, perluas RequestScope assets dengan allowedOrganizationIds bila batas lebih sempit dari induk. Jangan menerapkan group-only sementara lalu mengklaim isolasi organisasi sudah selesai.

- [ ] Sebelum implementasi keputusan akses aset, tutup D1 dan catat hasil di spec/manifest. Audit permukaan aset yang dapat diakses via hardware agent, lisensi, QR/tag, export dan custodian; modul IT bersama tetap menurut permission, jalur operasional tidak boleh menjadi bypass.
- [ ] Tulis tes lokasi MGM hanya terlihat bagi scope yang sesuai; custodian CMC tidak mengubah scope aset MGM; null location/mapping hanya jalur review berizin; list, KPI, detail, export/import dan tag/QR memeriksa scope sama.
- [ ] Tulis tes perubahan lokasi lintas batas ditolak jika tidak berwenang, serta allowed transfer bersifat atomik dan diaudit; sejarah assignment tetap milik transaksi sebelumnya.
- [ ] Jalankan ./node_modules/.bin/tsx --test src/services/assetOrganizationScope.integration.test.ts; implementasikan predikat scope lokasi dan pemeriksaan write/transfer yang sama, ulang sampai lulus. Jangan otomatis mengisi 73 aset development tanpa lokasi dengan CMC.

## Task 8: Profil dokumen dan snapshot versi

**Files:** Create backend/src/db/schema/documentProfiles.ts, backend/src/services/documentProfile.ts, backend/src/services/documentProfile.test.ts; Modify backend/src/db/index.ts, db/schema/leaves.ts, db/schema/goodsRequests.ts, controllers/leaveController.ts, routes/goodsRequestRoutes.ts; frontend/src/types/leaves.ts, lib/goodsRequests.ts, components/leaves/LeaveFormF4Document.tsx, LeaveFormF4NewDocument.tsx, components/ga/GoodsRequestDocument.tsx, GoodsRequestDetail.tsx; Create frontend/src/lib/leaves/organizationDocumentProfile.test.mjs, frontend/src/lib/ga/organizationDocumentProfile.test.mjs.

**Interfaces:** DocumentKind = 'LEAVE' | 'GA'; DocumentProfileSnapshot = { groupId: number; organizationId: number; kind: DocumentKind; templateVersionId: number; layoutKey: string; identity: { name: string; address: string | null; logoAssetKey: string }; labels: Record<string,string>; signatories: Array<{ key: string; label: string; name: string | null }> }. resolveDocumentProfile(tx, { groupId, organizationId, kind }): Promise<DocumentProfileSnapshot>; lockDocumentProfile(tx, request, profile) pada submit resmi pertama. Tidak menerima snapshot identitas tepercaya dari browser.

- [ ] Tulis tes Arvirotech memakai layout CMC dengan identitas sendiri; organisasi tidak satu kelompok ditolak; MGM tanpa template/logo sah ditahan, tanpa fallback CMC; versi lama immutable; perubahan master tidak mengubah cetak ulang.
- [ ] Jalankan ./node_modules/.bin/tsx --test src/services/documentProfile.test.ts hingga perilaku baru terbukti gagal; implementasikan profile/version/snapshot additive dengan konsistensi FK grup, jenis dokumen dan organisasi; registrasikan schema lalu ulang tes sampai lulus.
- [ ] Pada draft lakukan resolusi untuk preview; submit mengunci versi dan identitas atomik dengan transisi status. Pengajuan existing tidak boleh diam-diam diberi versi terbaru; migrasi versi legacy membutuhkan bukti dan D3/D6.
- [ ] Adaptasi renderer membaca snapshot bersama; jangan menciptakan kop/format MGM. Pertahankan format CMC lama sebagai renderer versi legacy bila identitas/pemilik terbukti. Tanda tangan tercetak tidak otomatis mengubah approval digital.
- [ ] Jalankan npm test dari frontend/ (glob leaves/ga mencakup tes baru). Setelah referensi format diberikan, bandingkan print F4/GA CMC, MGM dan satu organisasi anak; sampai itu tersedia, catat profil belum aktif, bukan selesai visual.

## Task 9: Konteks kelompok dan UI sesuai master desain

**Files:** Modify frontend/src/context/AuthContext.tsx, frontend/src/lib/api.ts, frontend/src/components/layout/DashboardLayout.tsx, frontend/src/lib/access/types.ts; Create frontend/src/context/OrganizationScopeContext.tsx, frontend/src/lib/access/organizationScope.ts, frontend/src/lib/access/organizationScope.test.mjs, frontend/src/components/layout/OrganizationScopeSelector.tsx. Integrasikan form/filter HR/GA/inventaris terkait tanpa menduplikasi halaman.

**Interfaces:** OrganizationScopeContext = { availableGroups: Array<{ id:number; code:'CMC'|'MGM'; name:string }>; selectedGroupId:number|null; selectGroup(id:number):void }. api mengirim X-Organization-Group-Id dari konteks request. Hak akses tetap server Task 3; read gabungan hanya muncul jika diizinkan. Scope dipersist per-tab, bukan mengubah semua tab melalui localStorage bersama.

- [ ] Baca ulang kedua panduan desain dan dokumentasi Next lokal sebelum perubahan TSX. Gunakan komponen reusable yang diwajibkan; tidak menambah refresh manual.
- [ ] Tulis tes pure: satu kelompok auto-select; multi-group write butuh pilihan; cache key memuat groupId; hasil request scope lama dibuang setelah switch/logout; revoked group tidak tersimpan sebagai pilihan valid.
- [ ] Jalankan npm test dari frontend/ hingga tes baru menangkap perilaku yang belum ada; implementasikan context, pilihan kelompok dan pembatalan request. Bersihkan selection/form data yang tidak sesuai tanpa mengirim ke kelompok baru secara diam-diam.
- [ ] UI cuti menampilkan kelompok pegawai, GA tujuan dan identitas dokumen, inventaris lokasi. Sediakan tampilan unresolved hanya untuk pihak berwenang dan error jelas tanpa mengungkap record kelompok lain.
- [ ] Ulang frontend test/lint/typecheck; uji dua tab kelompok berbeda dan respons lambat melalui browser. Jangan membuat perubahan visual halaman lain.

## Task 10: Verifikasi lintas modul dan aktivasi

**Files:** Extend tests Task 3-9 dan manifest endpoint Task 4; Create docs/plan/2026-10-29-cmc-mgm-rollout-runbook.md saat implementasi; Update checkpoint dan docs/todo/15-cmc-mgm-organization-scope.md serta docs/todo/README.md.

**Interfaces:** Seluruh resolver dan snapshot di atas; matriks fixture: global admin, IT kedua kelompok tanpa HR, HR CMC, HR MGM, GA CMC, GA MGM, employee, akun tanpa pegawai, akun revoked dan data unresolved. Jika D1 memilih tingkat organisasi, tambahkan dua organisasi dalam induk sama.

- [ ] Uji E2E browser → API → database → file: role/kelompok, deep-link lintas kelompok, export/KPI, unduh lampiran, reset password, mobile, input lintas kelompok, transfer aset, snapshot cetak dan dua tab. Tes membuktikan hasil, bukan sekadar keberadaan middleware.
- [ ] Pada fixture disposable, buktikan migrasi dua kali aman, legacy ID/FK/nomor/barcode tidak berubah, total rekonsiliasi tepat, dan akun lama tidak otomatis mendapat akses global. Simulasikan deployment parsial, mapping hilang, dan rollback akses tertutup.
- [ ] Jalankan dari backend/: npm test; ./node_modules/.bin/tsc --noEmit. Dari frontend/: npm test; npm run lint; ./node_modules/.bin/tsc --noEmit; npm run build. Siapkan env test terisolasi sesuai helper proyek, jangan arahkan integration suite ke produksi. Tidak ada npm install otomatis hanya untuk merencanakan.
- [ ] Catat command, exit code, jumlah pass/fail, target lingkungan tanpa rahasia, hasil browser dan batas yang belum diuji. Kegagalan baseline dibedakan dari regresi tanpa mengklaim suite hijau.
- [ ] Verifikasi D1-D4/D6 sesuai fase sudah ditutup dan D5 ditutup jika kebijakan diubah. Buat backup/restore/runbook dan minta persetujuan deployment setelah hasil konkret dapat direview. Jangan mengaktifkan kedua kelompok pada API lama yang belum scoped.
- [ ] Update checkpoint setelah bukti tersedia; semua checkbox implementasi tetap kosong sampai benar-benar dijalankan. Ikuti aturan checkpoint commit repo; commit hanya jika diminta/diotorisasi dan jangan menyertakan pekerjaan lain.

## Pemeriksaan rencana dokumentasi

Pemetaan requirement: U1-U3 → Task 1-2; U4-U5 → Task 3-5/9; U6 → Task 6; U7 → Task 7; U8-U9 → Task 8. Semua acceptance criteria bagian 9 spec memiliki task dan validasi di Task 10. D1-D6 tetap gerbang yang eksplisit, bukan diisi tebakan.

Perintah test di atas adalah instruksi fase implementasi, bukan bukti sudah dijalankan pada sesi ini. Dokumen tidak memerlukan product test/build karena tidak mengubah produk; verifikasi sesi ini mencakup link/path, konsistensi keputusan, diff dan batas perubahan dokumentasi.
