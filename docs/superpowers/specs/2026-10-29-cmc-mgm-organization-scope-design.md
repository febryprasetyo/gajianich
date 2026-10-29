# Pemisahan CMC/MGM dan identitas dokumen GAJIANICH

Tanggal: 29 Oktober 2026 (Asia/Jakarta). Status terbaru: implementasi fondasi backend Task 1-3 terverifikasi; integrasi operasional Task 4-10 belum selesai. [Checkpoint](../../plan/2026-10-29-cmc-mgm-organization-scope-checkpoint.md) mencatat bukti terbaru.

## 1. Instruksi untuk agen penerus

Baca dokumen ini, [rencana implementasi](../plans/2026-10-29-cmc-mgm-organization-scope.md), [checkpoint](../../plan/2026-10-29-cmc-mgm-organization-scope-checkpoint.md), dan AGENTS.md. Instruksi pengguna terbaru mengizinkan implementasi todo 15; pembatasan dokumentasi pada sesi sebelumnya bersifat historis. Tidak ada izin deploy produksi. Jangan menganggap keputusan terbuka sebagai keputusan pengguna.

Konfirmasi terbaru: inventaris per induk CMC/MGM, SuperAdmin keduanya; aturan cuti/approval sama. Karyawan dan absensi di database ini adalah data final yang wajib dipertahankan; data lain percobaan boleh direset bila diperlukan. Tidak ada reset dilakukan pada fondasi. Antislop dipilih selama pengerjaan. Transfer lintas induk secara konservatif hanya SuperAdmin dengan audit sampai hak tambahan ditetapkan; riwayat final tidak diklasifikasi ulang tanpa bukti.

## 2. Tujuan dan batas pekerjaan

Satu aplikasi, satu database PostgreSQL, satu struktur tabel dan jalur update untuk enam organisasi di bawah CMC dan MGM. HR, GA, manajemen pengguna, serta inventaris memiliki batas data yang benar; administrator/IT bersama. Pertahankan pengelompokan karyawan yang sudah dipakai, tanpa memilah ulang setiap karyawan.

Jangan membuat database/aplikasi per organisasi, menduplikasi modul CMC/MGM, mengganti ID karyawan, mengimpor ulang seluruh karyawan, atau mengubah nomor pegawai/barcode untuk pemisahan ini. Jangan sekaligus menjalankan perombakan modular atau desain halaman lain. Format final dokumen dapat menyusul.

## 3. Keputusan pengguna

| ID | Keputusan |
|---|---|
| U1 | Dua kelompok utama adalah CMC dan MGM; total enam organisasi, daftar resmi lengkap belum diberikan. |
| U2 | Departemen tidak bercampur antarinduk. MULTI GAS MEDIKA dan MEDICARE SOLUSI INDONESIA adalah MGM. Departemen lainnya masuk CMC menurut pengguna; ENGINEERING dan MARKETING adalah contoh yang dikonfirmasi. |
| U3 | Pertahankan data dan departemen lama. Pemetaan master menentukan kelompok tanpa klasifikasi ulang karyawan satu per satu. |
| U4 | Batas cakupan mencakup semua menu HR, GA, dan manajemen pengguna. Ini bukan pemberian semua permission kepada semua akun HR/GA. |
| U5 | Administrator/IT bersama. Kewenangan tindakan tetap mengikuti peran; IT bersama tidak otomatis berhak membaca seluruh informasi HR. |
| U6 | Pengajuan GA dipisahkan CMC/MGM. |
| U7 | Primary Facility Location menjadi dasar identifikasi dan akses inventaris sesuai organisasi. |
| U8 | Cuti dan GA mempunyai profil per induk. Organisasi di bawahnya dapat memakai struktur/konten induk dengan logo dan identitas berbeda; contoh Arvirotech di bawah CMC. |
| U9 | Contoh final template menyusul; fondasinya wajib sudah dipisahkan dalam perencanaan. |

Persetujuan umum tidak ditafsirkan sebagai pilihan spesifik pada pertanyaan alternatif yang belum dijawab. Lihat bagian 10.

## 4. Bukti repositori dan database

Database diperiksa dalam transaksi READ ONLY pada koneksi backend lokal localhost:5433/ams_dev_db. Ini bukti development, bukan konfirmasi kondisi produksi. Tidak ada kredensial atau data pribadi disalin ke dokumen.

| Temuan development | Hasil |
|---|---|
| Record employees | 369: 243 mempunyai departemen, 126 tanpa departemen |
| Departemen yang dipakai | 24 |
| Karyawan dengan location_id | 0 |
| Aset dengan Primary Facility Location | 4, seluruhnya ACCOUNTING |
| Aset tanpa Primary Facility Location | 73 |

126 karyawan tanpa departemen cocok dengan pola kode indikatif test/seed/awalan EMP dan tidak punya barcode. Ini tidak membuktikan bahwa mereka data uji. Jangan dihapus, diabaikan, atau otomatis diklasifikasikan.

Titik kode yang diperiksa:

- backend/src/db/schema/employees.ts: departmentId; nomor pegawai unik global.
- backend/src/db/schema/master.ts: master departemen/lokasi global.
- backend/src/db/schema/users.ts: satu roleId dan employeeId; belum ada cakupan kelompok.
- backend/src/middleware/auth.ts: bypass SuperAdmin dan fallback nama peran belum membatasi organisasi.
- backend/src/controllers/userController.ts: pembatas role employee untuk HR belum membatasi kelompok.
- frontend/src/components/assets/AssetFormModal.tsx: Primary Facility Location memakai assets.locationId, bukan lokasi custodian.
- backend/src/controllers/assetController.ts: filter lokasi belum menjadi otorisasi.
- frontend/src/components/leaves/LeaveFormF4Document.tsx dan LeaveFormF4NewDocument.tsx: logo CMC ditentukan langsung.
- frontend/src/components/ga/GoodsRequestDocument.tsx: logo CMC dan kolom pengesahan tetap.
- backend/src/db/schema/leaves.ts: konfigurasi cuti global unik per tahun; snapshot saldo sudah ada, bukan snapshot identitas/template.

## 5. Alternatif dan pilihan

| Alternatif | Konsekuensi | Keputusan |
|---|---|---|
| Aplikasi/database tersendiri | Update dan operasi berulang | Ditolak tujuan pengguna |
| Normalisasi ulang semua perusahaan/departemen/pegawai | Pemilahan besar dan risiko relasi lama | Tidak dipilih |
| Pemetaan kelompok/identitas di atas master lama | Menjaga ID/relasi; memberi batas akses dan profil dokumen | Arah yang dipilih |

Nama tabel/antarmuka berikut merupakan usulan teknis, bukan struktur yang sudah ada.

## 6. Model yang diusulkan

### 6.1 Kelompok dan identitas

- organization_groups: id, code unik CMC/MGM, nama, status aktif.
- organizations: id, groupId, code unik, nama resmi, status. Jangan mengarang daftar enam organisasi dari departments. Organisasi bukan departemen atau lokasi.
- department_organization_mappings: departmentId unik, groupId wajib, organizationId opsional. Jika organizationId diisi, wajib satu induk dengan groupId.
- location_organization_mappings: locationId unik, groupId wajib, organizationId opsional. Keharusan organizationId menunggu D1.
- user_organization_group_access: userId + groupId unik. Tetap gunakan role/permission yang ada; jangan menduplikasi role HR_CMC/HR_MGM atau sekaligus mengubah ke banyak role.

Dua departemen MGM dicocokkan dengan ID/code/nama aktual. Departemen lama lainnya dibuat sebagai kandidat CMC eksplisit untuk ditinjau dan diterapkan sekali. Departemen baru/null/tidak dikenal tidak otomatis CMC. Rename tidak mengubah mapping berbasis ID.

organizationId kosong tidak mengizinkan fallback ke logo perusahaan lain. Jika identitas belum diketahui, finalisasi dokumen tertahan kecuali pengguna menyetujui profil induk sebagai identitas sah untuk kasus itu.

### 6.2 Cakupan dan permission

Hak akses efektif = permission tindakan AND cakupan data. Membership diperiksa server; query/header/localStorage hanya menyampaikan pilihan. Satu kelompok dapat dipilih otomatis; akun lintas kelompok wajib menyebut tujuan write. View gabungan hanya untuk read yang diizinkan. Null tidak pernah berarti boleh semua.

IT lintas kelompok hanya mendapat akses modul sesuai permission. SuperAdmin merupakan kewenangan global eksplisit yang diaudit sesuai kontrak lama, bukan akibat employeeId kosong atau nama peran mengandung IT/HR. Kebijakan baru pembatasan HR untuk SuperAdmin adalah D5. Fallback permission lama tidak boleh melewati pemeriksaan cakupan.

Manajemen pengguna mencakup list/detail, reset password, employee picker, role assignment, aktivasi/nonaktif, dan membership. Jangan izinkan eskalasi ke kelompok/peran di luar kewenangan. Akun global atau mempunyai cakupan di luar pemanggil dikelola admin global. Akun tanpa pegawai tidak otomatis global. Definisi role/permission bersama tetap dikelola admin global.

Data belum terpetakan tidak terlihat/dapat dimutasi pengguna operasional; dapat diperiksa admin/IT hanya sesuai permission modul dengan penanda jelas. Laporan tidak boleh diam-diam menghilangkan data unresolved tanpa penjelasan jumlahnya.

### 6.3 Modul dan riwayat

- Directory pegawai memakai mapping departemen; ID, departmentId, barcode, nomor pegawai tetap.
- Scope seluruh absensi, jadwal, saldo, koreksi, audit HR, mobile approval, foto/biometrik, laporan, ekspor/impor, dan pengaturan terkait. Mesin/PIN bukan bukti kelompok pegawai.
- Cuti baru menyimpan groupId, organizationId sesuai identitas, dan snapshot dokumen. Kelompok mengikuti pegawai, bukan akun pembuat.
- GA baru menyimpan groupId wajib, organizationId sesuai identitas penanggung yang terverifikasi, serta snapshot dokumen. Pilihan kelompok diperiksa server.
- GA lama tidak selalu punya relasi pegawai; jangan menebak kelompok dari teks divisi/nama pengaju atau logo CMC hardcoded. Pakai bukti tepercaya dan daftar unresolved.
- Akses aset mengikuti assets.locationId dan mapping lokasi, bukan custodian.locationId atau kelompok pemegang. Perubahan pemegang tidak memindahkan scope. Perubahan lokasi lintas batas adalah transfer berizin dan diaudit (D1).
- Lampiran, anak transaksi, dokumen bertanda tangan, download, statistik, notifikasi dan audit mewarisi pemeriksaan induk; menyembunyikan menu tidak cukup.
- Riwayat transaksi tidak boleh pindah kelompok ketika pegawai pindah departemen atau mapping berubah. Gunakan snapshot pemilik dan prosedur mutasi efektif bertanggal. Riwayat lama tanpa bukti pemilik mengikuti D6; jangan menciptakan sejarah dengan join mapping sekarang untuk semua transaksi lama.

### 6.4 Dokumen berversi

- document_template_versions: kind LEAVE/GA, groupId, version, layoutKey, konfigurasi label/pengesahan, status. Versi yang dipakai immutable.
- organization_document_identities: organisasi, versi identitas, nama, alamat, logo/asset key. Identitas tidak menduplikasi keseluruhan template.
- Pengajuan menyimpan groupId, organizationId, templateVersionId dan snapshot identitas/label/penyetuju relevan. Versi dikunci pada submit resmi pertama. Draft boleh memakai versi terbaru saat submit dengan validasi ulang.
- Perubahan template/logo setelah submit tidak memengaruhi cetak ulang. Pertahankan file final bertanda tangan dan otorisasi unduhnya.
- Konten/input bisnis bersama. Layout alternatif hanya jika diperlukan. Tidak membuat editor template bebas atau modul per organisasi.
- Pisahkan kolom tanda tangan tercetak dari proses persetujuan digital. Format MGM tidak boleh dikarang; finalisasi menunggu template dan identitas sah, tanpa fallback diam-diam ke CMC.

## 7. Pengalaman pengguna dan desain

Tampilkan kelompok aktif; pilih otomatis untuk akun satu kelompok. Scope request eksplisit dan terisolasi antar-tab, bukan satu mutable session global. Pergantian kelompok membatalkan request lama, membersihkan pilihan/form yang tidak sesuai, dan menggunakan cache key berkelompok. Respons lama tidak boleh tampil di kelompok baru.

Cuti menampilkan kelompok pegawai; GA menampilkan tujuan dan identitas dokumen; inventaris mempertahankan Primary Facility Location. UI bukan batas keamanan.

Sebelum frontend baca AGENTS.md, UI_DESIGN_SYSTEM_GUIDE.md, DESIGN.md dan panduan Next lokal. Gunakan PageHeader, KpiGrid/KpiCard, FilterToolbar, TableShell, TablePagination, RowActionButton, StatusBadge, ModalShell/ConfirmDeleteModal. Kontainer daftar space-y-6; tanpa refresh manual dan tanpa merombak halaman lain.

## 8. Migrasi dan peluncuran

1. Inventarisasi read-only lingkungan target; validasi environment tanpa mencetak rahasia/PII. Angka development bukan manifest produksi.
2. Buat manifest mapping ID departemen/lokasi, kelompok, identitas, bukti, jumlah dan unresolved. Preview tidak menulis database.
3. Migrasi additive katalog/mapping/membership/metadata snapshot. Nomor migrasi mengikuti journal terbaru, tidak ditetapkan sekarang.
4. Apply manifest disetujui secara idempotent dan transaksional. Pertahankan ID, nomor, FK dan keunikan global lama kecuali kebutuhan terpisah disetujui.
5. Selesaikan seluruh jalur akses sebelum mengaktifkan kelompok kedua. Tampilan tersembunyi bukan perlindungan endpoint.
6. Uji staging kedua kelompok, ID/URL langsung dan proses otomatis. Tutup keputusan terbuka yang relevan sebelum aktivasi fase.
7. Deployment membutuhkan backup/restore teruji dan persetujuan. Jika gagal, tutup akses operasional terkait; jangan rollback ke API tanpa scope saat kedua kelompok masih masuk. Jangan drop metadata baru sebagai rollback.

## 9. Kriteria penerimaan

- HR/GA CMC tidak membaca/mengubah MGM dan sebaliknya melalui list/detail, ID langsung, statistik, search, ekspor/impor, file, atau mobile API.
- Membership tidak menambah permission; permission tidak menambah membership. IT bersama hanya sesuai modul; manajemen akun tidak menjadi eskalasi.
- Rename tidak memengaruhi mapping; departemen/lokasi baru atau null tetap unresolved.
- ID, nomor pegawai, barcode, FK, riwayat absensi dan saldo cuti tetap utuh; rekonsiliasi memakai sumber target yang diverifikasi.
- Aset mengikuti Primary Facility Location; transfer scope diperiksa dan diaudit.
- GA terpisah dan cuti mengikuti pegawai; lampiran/arsip tidak bocor.
- Arvirotech dapat memakai layout CMC dengan identitas Arvirotech sah. Tidak ada fallback logo CMC untuk MGM.
- Dokumen submitted tidak berubah karena versi template, logo atau mapping master berubah.
- Semua jalur, pengaturan dan job relevan membawa scope. Riwayat ambigu tidak otomatis diberi kelompok.
- Status implementasi selesai hanya setelah bukti pengujian; bukan karena dokumen tersedia.

## 10. Keputusan terbuka dan gerbang aktivasi

| ID | Yang perlu dipastikan | Pekerjaan yang dapat maju | Yang tertahan |
|---|---|---|---|
| D1 | Aset dibatasi per induk atau organisasi? Siapa boleh memindah Primary Facility Location lintas batas? | Audit dan mapping lokasi; fondasi scope | Aktivasi inventaris operasional dan transfer lintas batas |
| D2 | Kuota, kalender, perhitungan, dan tahap persetujuan CMC/MGM sama atau berbeda? | Fondasi profil; audit setting global | Aktivasi kebijakan cuti/approval; jangan menganggap config global sudah disetujui untuk keduanya |
| D3 | Daftar resmi enam organisasi, induk, mapping identitas dan logo | Dua kelompok dan mapping yang pasti | Finalisasi dokumen identitas yang belum diketahui |
| D4 | Database target/produksi, kelengkapan null/test/legacy dan manifest | Rencana/pemeriksaan development | Backfill dan aktivasi produksi |
| D5 | Pembatasan tambahan pembacaan HR oleh SuperAdmin? | Pertahankan kontrak lama eksplisit; batasi IT menurut permission | Perubahan kebijakan SuperAdmin di luar kontrak lama |
| D6 | Bukti pemilik historis jika pernah ada mutasi, dan prosedur mutasi berikutnya | Preview riwayat; snapshot transaksi baru | Aktivasi riwayat yang belum terbukti kelompoknya |

Detail template memang menyusul, bukan alasan menunda fondasi. Placeholder tidak boleh diklaim sebagai format resmi. Tidak perlu meminta semua keputusan sekaligus untuk pekerjaan yang tidak bergantung padanya.

## 11. Verifikasi dan handoff

Tes isolasi memakai database disposable/staging, bukan produksi. Verifikasi perubahan produk menggunakan test/backend typecheck, frontend test/lint/typecheck/build relevan dan browser end-to-end. RLS PostgreSQL boleh dievaluasi sebagai lapisan tambahan, bukan pengganti scope aplikasi atau alasan memasang Supabase.

Sesi perencanaan awal hanya dokumentasi. Implementasi fondasi kini memiliki bukti test/typecheck dan migrasi development di checkpoint, tetapi aplikasi belum diklaim terisolasi lintas modul. Update checkpoint dan docs/todo/README.md setelah bukti tiap fase tersedia. Pertahankan pekerjaan lain. Jangan mengubah .gitignore atau membuat commit tanpa otorisasi.
