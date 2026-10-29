# Checkpoint perencanaan CMC/MGM — 29 Oktober 2026

Status terbaru: fondasi backend Task 1-3 telah diimplementasikan dan terverifikasi lokal; Task 4-10 belum selesai. Tidak ada commit/deploy produksi. Bagian perencanaan di bawah merupakan catatan historis; pembaruan implementasi ada di akhir dokumen.

## Otorisasi dan keluaran

Pengguna awalnya meminta analisis read-only dan kemudian secara eksplisit mengizinkan pembuatan dokumen agar dipahami agen AI. Izin tulis terbatas pada dokumentasi; tidak mengubah kode aplikasi, database, konfigurasi, AGENTS.md, atau aturan Git.

- [Spesifikasi](../superpowers/specs/2026-10-29-cmc-mgm-organization-scope-design.md): keputusan pengguna, arsitektur usulan, model mapping/scope, dokumen berversi, batas migrasi dan D1-D6.
- [Rencana implementasi](../superpowers/plans/2026-10-29-cmc-mgm-organization-scope.md): sepuluh task dengan path, antarmuka, tes dan gerbang aktivasi.
- [Checklist handoff](../todo/15-cmc-mgm-organization-scope.md): titik masuk ringkas agen.
- [Indeks roadmap](../todo/README.md): inisiatif 15 dan checkpoint dokumentasi.

## Bukti pemeriksaan sebelumnya

Pembacaan kode serta transaksi database READ ONLY pada localhost:5433/ams_dev_db. Total karyawan 369, berdepartemen 243, tanpa departemen 126; departemen terpakai 24. Seluruh karyawan belum mempunyai location_id. Aset berlokasi 4 (ACCOUNTING), tanpa Primary Facility Location 73. Data produksi belum diverifikasi; angka ini tidak boleh dipakai sebagai manifest produksi atau alasan menghapus data.

User memastikan departemen tidak bercampur: MULTI GAS MEDIKA dan MEDICARE SOLUSI INDONESIA adalah MGM; departemen lainnya CMC. Pemisahan inventaris mengikuti Primary Facility Location. Isi dokumen mengikuti induk dengan logo/identitas organisasi anak. Data lama tidak diminta dinormalisasi ulang.

## Review dan verifikasi dokumentasi

Builder check read-only pada spesifikasi: tidak ditemukan ambiguitas material tambahan di luar D1-D6 yang sudah eksplisit. Kontrak teknis dalam plan adalah usulan, bukan klaim implementasi atau jawaban pengguna atas keputusan terbuka.

Hasil pemeriksaan dokumentasi (29 Oktober 2026):

- Validator Python: exit 0; empat dokumen baru, sepuluh tautan lokal, enam belas referensi source existing, urutan sepuluh task, D1-D6, checkbox implementasi kosong, dan satu entri roadmap 15 diperiksa; seluruhnya lulus.
- git diff --check: exit 0. Diff README hanya menambahkan satu baris inisiatif dan checkpoint baru, tanpa mengubah isi historis.
- git status --short --untracked-files=all: hanya docs/todo/README.md berubah dan empat Markdown baru; tidak ada source/config/migrasi berubah. Berkas baru terdeteksi Git sebagai untracked, tidak memerlukan perubahan .gitignore.
- Self-review rencana: U1-U9 dipetakan ke Task 1-9, verifikasi lintas modul Task 10; kontrak scope, metadata dokumen, batas keputusan dan tidak adanya fallback CMC diperiksa. Ini verifikasi dokumentasi, bukan bukti perilaku aplikasi.

## Batas dan tindak lanjut

Tidak menjalankan unit/integration test, lint atau build produk karena perubahan hanya Markdown. Perintah verifikasi dalam plan adalah untuk fase implementasi, bukan hasil sesi ini. Tidak ada DDL/DML, seed, migrasi atau deploy. Jangan mulai implementasi tanpa instruksi pengguna berikutnya.

D1-D6 harus ditutup sebelum aktivasi bagian yang bergantung. Mulai dari preview manifest target setelah implementasi diotorisasi; jangan memaksa pembersihan/perubahan karyawan satu per satu. Template resmi menyusul; jangan membuat format MGM atau daftar enam identitas sendiri.

## Pembaruan implementasi fondasi pada sesi lanjutan

Pengguna meminta pengerjaan todo 15 sehingga implementasi kini diotorisasi. Konfirmasi tambahan:

- Inventaris dibatasi per induk CMC/MGM; SuperAdmin keduanya.
- Aturan cuti/approval sama. Antislop diterapkan selama pengerjaan UI.
- Karyawan dan absensi di database ini adalah data final. Data lain percobaan boleh direset bila diperlukan. Tidak melakukan reset/seed; mempertahankan semua data lama.

### Keluaran Task 1-3

Task 1: domain kandidat dan script preview READ ONLY/repeatable-read/timeout; manifest development ID/code tanpa PII. Karyawan 369 = 243 kandidat + 126 unresolved, aset 77 unresolved. Kandidat tidak diterapkan dan bukan persetujuan produksi. ID master yang tidak ada dalam manifest tidak mendapat default CMC.

Task 2: schema dan migrasi Drizzle 0026 dengan lima tabel katalog kelompok, organisasi, mapping departemen/lokasi, membership; FK organisasi+kelompok dan uniqueness. Service operator apply memakai transaksi/advisory lock, target database+ID lingkungan, approval reference, validasi ID/code, dan menolak overwrite pemilik. Apply ulang identik tidak menggandakan data. ID lingkungan dibaca dari setting PostgreSQL; belum dikonfigurasi pada development sehingga manifest tetap tidak bisa diaplikasikan.

Task 3: resolusi pilihan read/write dan middleware scope, membership terkini, validasi header/body tujuan; autentikasi membaca ulang akun/role/status/password requirement/permission dari DB. `/auth/me` menyertakan organizationAccess dan availableGroups. Token stale tidak dapat mempertahankan role/permission/membership yang dicabut. Akun tanpa pegawai tidak otomatis global. Global read masih bisa meninjau unresolved ketika hanya satu kelompok aktif.

Perubahan fixture tes diperlukan karena fixture lama mengganti role hanya di JWT atau mengandalkan default SuperAdmin. Fixture kini menggunakan identitas database terpisah untuk setiap role; pemeriksaan audit penugasan mengikuti aktor sebenarnya. Tidak mengurangi pemeriksaan otorisasi agar tes lulus.

### Verifikasi akhir

Semua perintah backend dijalankan dari backend/. Database test terpisah: container sementara postgres:16-alpine pada loopback port 32768, gajianich_ci_db beserta database disposable turunan yang dijaga helper. Tidak menjalankan suite test pada ams_dev_db.

- `npm test`: exit **0**, **393 tests / 393 pass / 0 fail / 0 skipped**, empat suite, durasi sekitar 199 detik. Output penuh saat sesi: `/tmp/ams-scope-final-suite.log` (artefak sementara, tidak dijanjikan tersedia setelah sesi).
- `./node_modules/.bin/tsc --noEmit`: exit **0**. Backend tidak menyediakan script lint; tidak mengklaim lint backend dijalankan.
- `git diff --check`: exit **0**.
- Schema/manifest integration membuktikan constraint lintas kelompok, uniqueness, rollback atomik, idempotency, rename berbasis ID, serta penolakan environment kosong/salah.
- Upgrade dari journal legacy lalu migrator terbaru dua kali: seluruh field fixture karyawan dan attendance_records, ID, barcode, nomor dan FK tetap sama; membership lama tidak otomatis diberi akses.
- HTTP test membuktikan permission AND membership, pilihan MGM tanpa izin ditolak, header invalid/body tujuan berbeda ditolak, write gabungan ditolak, /auth/me hanya memuat kelompok tersedia, dan revocation berlaku untuk JWT sama.
- Regresi real HTTP perintah lock absensi: sebelum fix **403**, setelah permission DB diteruskan **200**; pencabutan grant mengembalikan **403** dengan token sama. Seluruh mutasi tes hanya terjadi pada PostgreSQL disposable.

Review kode independen untuk fondasi menemukan dua Important dan satu Minor. Semua diperbaiki dengan reproduksi RED→GREEN: permission command absensi hilang saat penggantian payload JWT; approval manifest hanya terikat nama DB; review unresolved hilang ketika tinggal satu kelompok aktif. Temuan terakhir dinaikkan prioritas karena memengaruhi keterlihatan riwayat bagi administrator. Percobaan reproduksi reviewer pada controller sempat ditolak auto-review karena potensi mutasi; reproduksi final dilakukan melalui HTTP pada database test terisolasi yang sudah disiapkan, dan berhasil. Tidak ada tindakan yang masih tertahan oleh penolakan tersebut.

### Migrasi development dan pelestarian data final

Journal ams_dev_db sebelum upgrade: 26 entri, terakhir 0025. Guard memeriksa loopback + nama database + baseline journal + tidak adanya target migrasi berbeda. Migrasi additive 0026 diterapkan; journal sesudahnya 27 entri.

Snapshot READ ONLY sebelum/sesudah membandingkan jumlah dan fingerprint seluruh baris, termasuk ID/FK, pada 19 tabel employees/departments/locations/attendance. Seluruhnya cocok: **369 employees, 1.684 attendance_records**, tanpa perubahan data final. SQL 0026 tidak mengubah tabel lama. Katalog kelompok=0, organisasi=0, membership=0, mapping departemen=0, mapping lokasi=0 setelah migrasi: tidak ada backfill/provisioning spekulatif.

### Batas yang masih berlaku

**Todo 15 belum selesai.** Task 4-10 belum mengintegrasikan predikat ke seluruh query/endpoint HR, mobile, user, GA, aset, file, job, riwayat; snapshot dokumen dan UI/per-tab/cache juga belum tersedia. Middleware yang belum dipakai endpoint bukan bukti isolasi. Jangan memprovisikan akun operasional CMC/MGM sebelum integrasi dan tes lintas modul selesai. Tidak mengklaim browser E2E, frontend lint/build, finalisasi template atau isolasi produksi.

[Manifest](2026-10-29-cmc-mgm-mapping-manifest.md) dan [runbook](2026-10-29-cmc-mgm-rollout-runbook.md). D1 tingkat akses inventaris dan D2 kesamaan aturan telah dijawab. D3 identitas/template, D4 manifest produksi/membership, dan bukti riwayat final D6 tetap memerlukan tindak lanjut sesuai fase. Kontrak SuperAdmin lama dipertahankan; kebijakan HR tambahan D5 tidak diubah.

Keputusan teknis: transfer lintas induk dibatasi konservatif ke SuperAdmin dengan audit sampai delegasi ditetapkan (biaya jika terlalu sempit: hak transfer operasional perlu didesain kemudian); environment ID PostgreSQL wajib dirotasi pada clone (biaya jika setting disalin keliru: validasi operator harus memperbaikinya); checkout yang ada dipakai, tanpa commit otomatis (biaya: perubahan tetap lokal). Integrasi endpoint wajib tetap menjadi pekerjaan berikutnya; fondasi ini tidak dapat dipasang sebagai jaminan isolasi kedua kelompok.

Tidak ada commit, push atau deploy produksi. Checkbox commit tetap kosong sesuai README. Perubahan dokumentasi awal pengguna dipertahankan dan status terkini ditambahkan.

## Checkpoint integrasi akhir — 29 Oktober 2026

Bagian ini menggantikan status fondasi saja di atas. Implementasi Task 1–9 dan verifikasi teknis Task 10 selesai pada branch `feature/cmc-mgm-organization-scope`. Aktivasi operasional/produksi tetap menunggu konfigurasi yang disetujui.

### Perubahan

- Predikat kelompok terpasang pada HR (karyawan, absensi, cuti, mobile, audit), GA beserta lampiran, inventaris/KPI/import/custodian/lisensi/hardware, serta manajemen akun. Shared definitions tetap dibatasi administrator. Token memakai identitas DB terkini.
- Akun satu kelompok tidak dapat mengelola akun kelompok lain, multikelompok/global, atau menaikkan role/membership sendiri. Perlindungan SuperAdmin aktif terakhir dipertahankan.
- Inventaris mengikuti lokasi primer. Transfer lintas induk memerlukan SuperAdmin dan audit. Riwayat assignment/maintenance/hardware menyimpan pemilik transaksi. Tiket terkait aset memeriksa scope pada detail, perubahan dan komentar; referensi aset helpdesk diperiksa sebelum ditampilkan.
- GA/cuti menyimpan snapshot profil dokumen. Versi template/identitas immutable; perubahan profil menerbitkan versi baru. Tanpa profil resmi valid, finalisasi ditolak. Tidak membuat template MGM atau enam identitas spekulatif.
- UI memakai pilihan kelompok per tab, header request, pembatalan respons lama dan invalidasi cache/state. Inisialisasi anonim tidak mereset isian login saat tab kembali fokus.

### Bukti final

Database tes: PostgreSQL 16 disposable pada loopback, `gajianich_ci_db` beserta database turunan helper; browser memakai `ams_scope_e2e_test`. Tidak ada suite integrasi yang diarahkan ke development.

- Backend `npm test`: exit 0, **408/408**, 4 suites, 0 fail/skip. `tsc --noEmit`: exit 0. Log sesi `/tmp/ams-backend-final-tests.log` dan `/tmp/ams-backend-final-tsc.log`.
- Frontend Node 24: `npm test` **217/217**, `npm run lint`, `tsc --noEmit`, `npm run build`: seluruhnya exit 0. Log `/tmp/ams-front-final-*.log`.
- Playwright Chromium: **2/2**, exit 0. Login nyata, dua tab CMC/MGM, reload, deep-link asing, respons tertunda, viewport 390 px, overflow dan fokus selector. Log `/tmp/ams-browser-final4.log`; screenshot `/tmp/ams-scope-mobile-validation.png` diperiksa. Artefak /tmp bersifat sementara.
- Tes khusus membuktikan trigger menolak perubahan pemilik absensi, perubahan/penghapusan versi identitas, dan runtime role dapat membaca profil. Regresi tiket membuktikan PUT yang melepas assetId dan POST komentar tidak dapat melewati batas kelompok.
- Script fixture `backend/scripts/setup-organization-scope-e2e.ts` diuji pada database disposable kosong setelah migrasi/seed; guard hanya mengizinkan nama database tes loopback. Langkah reproduksi tersedia dalam runbook.
- `git diff --check`: exit 0. Tidak mengklaim lint backend, browser Firefox/WebKit, uji restore produksi, atau review independen baru atas seluruh integrasi. Review independen terdahulu hanya mencakup fondasi; integrasi akhir diperiksa melalui self-review dan tes di atas.

Kegagalan selama verifikasi diselesaikan: assertion bigint tiket dinormalisasi, fixture cookie browser dipasang sebelum navigasi, inisialisasi provider anonim tidak mereset form. Login berulang mencapai limiter 429; pengulangan memakai proses API tes baru, tanpa melonggarkan limiter aplikasi. Pemeriksaan otomatis sebelumnya menolak perluasan akses system settings; guard administrator tetap dipertahankan, tidak ada tindakan tersebut yang menunggu persetujuan.

### Migrasi development

Guard memeriksa localhost:5433/ams_dev_db dan baseline journal 27 entri. Migrasi additive 0027–0029 berhasil, journal menjadi 30. Snapshot READ ONLY membandingkan seluruh kolom lama di 19 tabel master/karyawan/absensi; fingerprint cocok seluruhnya: **369 employees dan 1.684 attendance_records**. Tidak ada reset/seed/backfill atau perubahan ID/FK/nilai lama. Katalog/mapping/membership tetap kosong.

Preview historis 1.657 CMC + 27 MGM merupakan relasi terhadap departemen saat ini, bukan persetujuan pemilik historis. Konfirmasi belum diterima sehingga group_id lama tetap null. Identitas/logo/template resmi, daftar akun/membership dan manifest produksi tetap belum diberikan. Aktivasi terkait ditahan; implementasi teknis selesai bukan klaim rollout selesai. Tidak ada push atau deploy produksi.
