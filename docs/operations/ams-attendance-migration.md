# Runbook migrasi data dan cutover Absensi AMS

Status: prosedur target, 25 September 2026. CLI exporter/migrator di bawah **belum tersedia**; perintahnya merupakan kontrak implementasi Task 8, bukan perintah yang sudah dapat dijalankan pada baseline.

Referensi: [spec](../superpowers/specs/2026-09-25-ams-attendance-migration-design.md) dan [plan](../superpowers/plans/2026-09-25-ams-attendance-migration.md). Semua path program relatif root AMS. Artefak data berada di direktori operator di luar repository dan tidak di-commit.

**Batas data:** seluruh target migrasi berada pada tabel `attendance_*`, termasuk master karyawan/departemen/lokasi, grant dan audit. Database boleh sama dengan AMS, login memakai akun AMS yang sama, tetapi tidak ada mapping ke employees/master/audit AMS. Kecocokan ID/nama/kode antarmodul tidak menjadi dasar penggabungan.

## 1. Pemilik dan prasyarat

| Peran | Tanggung jawab |
|---|---|
| HR | Memastikan pemetaan karyawan, hasil rekap, dan waktu penghentian input desktop. |
| Operator migrasi | Snapshot sumber, jalankan exporter/dry-run/apply/verify, simpan manifest dan laporan. |
| Administrator AMS | Database target, backup/restore rehearsal, akun login existing, grant absensi terpisah, kandidat rilis dan monitoring. |

- [ ] Implementasi Task 1–8 tersedia dan lulus pengujian.
- [ ] Identifikasi seluruh database Gajianich yang benar-benar dipakai. Path berasal dari app data/info perangkat, bukan asumsi `./data/gajianich.db`.
- [ ] Tetapkan database/source yang berwenang bila beberapa komputer mempunyai salinan atau periode tumpang tindih. Jangan menggabungkan semuanya otomatis.
- [ ] Catat versi/schema sumber, jumlah karyawan/batch/record/revisi/audit, rentang tanggal, serta ada/tidaknya file asli impor.
- [ ] Sediakan database staging terpisah hasil restore AMS. Tes integration tidak mengarah ke produksi.
- [ ] Sediakan akun login AMS aktif dengan grant absensi HR_ADMIN untuk audit proses migrasi; actor snapshot dihasilkan server dari akun/grant ini, tanpa FK atau write ke audit AMS.
- [ ] Catat schema dan checksum logis tabel bisnis AMS pada staging sebelum migrasi; gunakan pembanding sesudah migrasi untuk membuktikan isolasi. Jangan membandingkan database produksi yang sedang menerima perubahan unrelated tanpa snapshot konsisten.
- [ ] Pastikan ruang disk dan waktu backup mencukupi karena file impor asli akan disimpan di PostgreSQL.
- [ ] Verifikasi kebijakan backup/restore existing pada `docs/operations/database-recovery.md` dan release pada `docs/operations/release.md` AMS.

## 2. Format paket migrasi

Exporter menghasilkan direktori baru dengan manifest dan JSONL untuk enam tabel sumber:

```text
gajianich-export/
  manifest.json
  employees.jsonl
  import_batches.jsonl
  raw_attendance_records.jsonl
  attendance_records.jsonl
  attendance_revisions.jsonl
  audit_logs.jsonl
```

Manifest memuat `formatVersion: 1`, `sourceSchemaVersion`, `snapshotSha256`, waktu snapshot, dan daftar file dengan SHA-256 serta jumlah baris. `datasetSha256` dihitung dari JSON canonical field versi/schema/snapshot dan daftar file terurut; exclude field `datasetSha256` sendiri, timestamp export, serta path lokal agar export ulang snapshot yang sama mempunyai identitas sama.

Setiap JSONL menyimpan seluruh kolom sumber dan nilai null apa adanya. Query ekspor memakai urutan primary key stabil. Tidak menyimpan rahasia koneksi atau token di manifest. Snapshot dan artefak berisi data personal, disimpan dengan akses operator yang sesuai dan tidak dimasukkan Git.

Pemetaan HR disimpan dalam file CSV UTF-8 terpisah:

```csv
dataset_sha256,legacy_employee_id,source_code,external_no_id,attendance_employee_id,decision,reason
```

Setiap karyawan sumber harus memiliki tepat satu keputusan `CREATE` atau `LINK`. `CREATE` membiarkan attendance_employee_id kosong dan membuat karyawan baru pada attendance_employees dari profil sumber; `LINK` mewajibkan ID attendance_employees existing yang dipilih HR. Tidak boleh mengisi ID dari employees AMS. External_no_id diperlakukan string. Jangan membuka/menyimpan CSV melalui tool yang mengubah `001` menjadi `1`. Email/kode internal absensi boleh null; jangan membuat email palsu. Tidak ada keputusan ignore untuk melewati record tanpa rekonsiliasi.

Departemen sumber dipetakan ke attendance_departments dengan keputusan tercatat; departemen AMS tidak menjadi kandidat. Nama ambigu ditahan untuk HR, dan lokasi yang tidak ada di sumber tetap null. Pada target attendance kosong, migrasi normal menggunakan CREATE untuk semua karyawan dengan menjaga legacy ID map agar retry tidak membuat salinan baru.

## 3. Snapshot yang konsisten

1. Pada rehearsal, ambil snapshot konsisten; desktop boleh tetap dipakai untuk latihan saja.
2. Pada cutover final, hentikan input desktop pada semua komputer yang menjadi sumber resmi, catat waktunya, dan ambil snapshot final baru.
3. Exporter membuka sumber SQLite dengan URI read-only, memanggil SQLite backup API ke file snapshot baru, memeriksa `PRAGMA integrity_check`, lalu mengekspor dari snapshot tersebut. Tidak memodifikasi database sumber.
4. Jangan menyalin `.db` aktif secara terpisah dari WAL dan menganggapnya lengkap. Hash dihitung dari snapshot final setelah backup selesai.
5. Exporter menolak direktori output yang sudah berisi paket agar rehearsal/final tidak tertimpa.

Kontrak perintah exporter yang akan dibuat, dari root AMS:

```bash
python3 scripts/export-gajianich.py \
  --database "$ATTENDANCE_SOURCE_DB" \
  --snapshot "$ATTENDANCE_SNAPSHOT_PATH" \
  --output "$ATTENDANCE_EXPORT_DIR"
```

Operator menetapkan variabel `ATTENDANCE_*` ke path aktual. Program harus exit nonzero jika variabel menjadi path kosong, sumber tidak ditemukan, schema tidak didukung, integrity check gagal, atau output sudah ada. Snapshot sumber tidak otomatis membuktikan semua perangkat sumber sudah diinventarisasi.

## 4. Dry-run dan rekonsiliasi

Dry-run tidak menulis tabel tujuan, termasuk tabel migration runs. Output hanya file laporan operator. Database target dipilih melalui konfigurasi backend existing; pastikan identitas target sebelum menjalankan command.

Dari direktori backend AMS:

```bash
npx tsx src/scripts/migrateGajianich.ts \
  --mode dry-run \
  --input "$ATTENDANCE_EXPORT_DIR" \
  --mapping "$ATTENDANCE_MAPPING_CSV" \
  --report "$ATTENDANCE_DRY_RUN_REPORT"
```

Laporan wajib memuat:

- Validitas seluruh checksum, row count, dan FK sumber.
- Keputusan CREATE/LINK karyawan absensi, nomor mesin, departemen sumber, serta collision mapping. Email/kode internal yang kosong bukan blocker jika data nama dan nomor mesin sah.
- Konflik employee/date hanya dengan data attendance existing dan overlap dari dataset lain; tidak dibandingkan dengan employees AMS.
- Jumlah batch, raw rows, record efektif, revisions modern yang dapat dibentuk, dan legacy entities yang akan diarsipkan.
- Revisi yang hanya mempunyai changed-fields, actor lama tanpa user target, atau batch tanpa file asli. Semua ditandai sebagai keterbatasan historis, tidak diisi dengan data rekaan.
- Perbandingan per karyawan/periode: jumlah hadir/izin/sakit/cuti/alpha/unspecified, enam metrik menit/hari terlambat/pulang cepat/lembur, tanggal pertama/terakhir.
- Nilai invalid seperti durasi negatif atau status tidak dikenal yang tidak dapat diterima schema target.

Dry-run exit 0 hanya jika paket valid dan seluruh blocker selesai. Exit 2 untuk masalah data/pemetaan yang memerlukan koreksi. Exit 1 untuk kesalahan program, koneksi, atau file. File laporan selalu menjelaskan kelompok masalah tanpa mencetak data personal massal ke log.

## 5. Penerapan pada staging

1. Terapkan schema target melalui migrasi Drizzle pada staging; jangan memakai seed produksi atau db:push.
2. Selesaikan mapping bersama HR dan ulangi dry-run sampai tidak ada blocker.
3. Jalankan apply menggunakan akun pelaksana yang ada dan aktif.

```bash
npx tsx src/scripts/migrateGajianich.ts \
  --mode apply \
  --input "$ATTENDANCE_EXPORT_DIR" \
  --mapping "$ATTENDANCE_MAPPING_CSV" \
  --actor-user-id "$ATTENDANCE_OPERATOR_ID" \
  --report "$ATTENDANCE_APPLY_REPORT"
```

4. Apply mengambil lock migrasi dataset, memeriksa kembali konflik dalam transaksi, lalu menulis master attendance, identities, batch/rows/records/revisions/legacy entities/migration run/attendance_audit_logs secara atomik. Semua jalur penulisan absensi harus dihentikan selama apply final; unique constraints tetap melindungi race yang tidak terduga. Tidak ada write ke tabel bisnis atau audit AMS.
5. Apply dataset completed yang sama tidak membuat data baru; validasi mapping/checksum harus cocok dan hasilnya ditandai `ALREADY_APPLIED`. Dataset hash sama dengan mapping berbeda ditolak. Dataset berbeda yang overlap memerlukan penyelesaian konflik eksplisit.
6. Jalankan verify, kemudian apply kedua kali untuk membuktikan tidak terjadi duplikasi.

```bash
npx tsx src/scripts/migrateGajianich.ts \
  --mode verify \
  --input "$ATTENDANCE_EXPORT_DIR" \
  --mapping "$ATTENDANCE_MAPPING_CSV" \
  --report "$ATTENDANCE_VERIFY_REPORT"
```

Verify tidak menulis target. Bandingkan nilai efektif record satu per satu, bukan hanya total agregat yang dapat saling menutupi selisih. Pastikan seluruh entitas sumber memiliki arsip original payload dan mapping atau alasan arsip-only yang sah. Simpan original actor/timestamp lama; attendance_audit_logs proses baru menggunakan snapshot akun operator. Pada staging terkontrol, bandingkan checksum tabel bisnis/audit AMS sebelum dan sesudah apply: tidak boleh berubah akibat migrasi.

## 6. Uji penerimaan operasional

- [ ] HR memeriksa contoh setiap status kehadiran, koreksi, konflik dan scan kosong.
- [ ] Bandingkan seluruh record efektif sumber/target dan rekap periode; selisih tanpa penjelasan = tidak lulus.
- [ ] Uji unggahan file yang sama dan pastikan batch tidak berlipat.
- [ ] Uji retry commit setelah koneksi browser terputus; receipt tetap dan data tidak berlipat.
- [ ] Uji dua browser mengoreksi record sama; satu mendapat stale revision 409.
- [ ] Uji grant HR_ADMIN/HR_STAFF/REPORT_VIEWER dan akun tanpa grant; role login AMS tidak otomatis memberi akses absensi.
- [ ] Uji download CSV, karakter khusus, dan perlindungan formula spreadsheet.
- [ ] Uji enam metrik menit/hari dan ekspor dengan expectedDataVersion; perubahan data setelah laporan dibuka harus menghasilkan REPORT_CHANGED, bukan angka berbeda tanpa pemberitahuan.
- [ ] Uji dashboard desktop/mobile dan modal yang panjang sampai footer.
- [ ] Periksa master karyawan, assignment/custodian, tiket, lisensi, dan monitoring existing.
- [ ] Ubah/nonaktifkan karyawan absensi dan buktikan karyawan AMS bernama/kode sama tidak berubah; lakukan kebalikannya pada fixture uji.
- [ ] Introspeksi seluruh FK attendance_*: targetnya hanya attendance_*. Periksa tidak ada lookup/sinkronisasi tersembunyi ke master AMS.
- [ ] Backup staging pascamigrasi dipulihkan ke database terpisah; verify menghasilkan rekonsiliasi yang sama.

## 7. Cutover produksi

Cutover dijalankan setelah candidate release dan data staging lulus. Ikuti otorisasi deployment yang berlaku pada sesi pelaksanaan; dokumen ini tidak melakukan deployment.

1. Catat release/hash aplikasi, migration journal, dataset resmi dan operator.
2. Pastikan belum ada pengguna yang menulis absensi pada target. Hentikan input desktop sumber, ambil snapshot final dan ulangi export/dry-run. Snapshot rehearsal tidak digunakan sebagai snapshot final jika sumber berubah.
3. Ambil dan verifikasi backup PostgreSQL AMS sebelum perubahan data. Simpan identifier backup di laporan.
4. Terapkan migration additive melalui release workflow AMS. Jika sudah diterapkan sebelumnya, verifikasi journal; jangan menulis SQL ad hoc di production.
5. Jalankan apply paket final, kemudian verify dan penerimaan HR terhadap rekap final.
6. Jika verifikasi lulus, SuperAdmin memberi/aktifkan grant attendance pada akun login AMS existing melalui Akses Absensi. Jangan mengubah users.role/roles AMS; navigasi mengikuti permission modul pada release yang sama.
7. Tetapkan AMS sebagai satu-satunya tempat input/koreksi absensi. Gajianich dan snapshot dipertahankan sebagai arsip read-only.
8. Pantau error API, 409/422, durasi impor, query laporan, kapasitas PostgreSQL dan keberhasilan backup. Catat masalah tanpa mengirim file absensi atau token ke log.

Tidak ada dual-write otomatis. Berkas yang masuk selama jendela perpindahan dicatat operator dan diunggah sekali setelah AMS dibuka.

## 8. Rollback dan pemulihan

### Apply gagal sebelum commit transaksi

Pastikan seluruh write apply dibatalkan. Perbaiki penyebab, ulangi dry-run, lalu apply paket yang sama. Jangan menghapus tabel existing atau menjalankan down migration destruktif.

### Apply berhasil, tetapi akses belum dibuka

Pertahankan data dan arsip migrasi; tahan akses modul. Utamakan perbaikan aplikasi lalu verify ulang. Jika perlu membatalkan data migrasi, buat prosedur invers berdasarkan migration run dan target map setelah membuktikan belum ada referensi baru; jangan delete berdasarkan rentang tanggal saja.

### AMS sudah menerima data baru

Hentikan mutation absensi dan simpan snapshot PostgreSQL terbaru. Rollback aplikasi mengikuti release runbook dengan schema additive tetap tersedia. Jangan restore seluruh database AMS ke backup sebelum migrasi karena perubahan aset/tiket/lisensi yang tidak terkait dapat hilang.

Jika harus kembali sementara ke desktop, ekspor dan rekonsiliasi seluruh perubahan absensi setelah cutover terlebih dahulu. Tidak ada sinkronisasi balik otomatis dalam scope. Desktop hanya boleh dibuka lagi setelah dataset yang berwenang dan selisih pascacutover ditetapkan bersama HR.

Restore bencana dilakukan ke database terpisah terlebih dahulu mengikuti database-recovery runbook, verifikasi hasil, lalu pilih strategi pemulihan dengan mempertimbangkan perubahan semua modul AMS.

## 9. Bukti penutupan

Simpan release ID, dataset hash, mapping version/hash, snapshot hash, backup ID, laporan dry-run/apply/verify, hasil penerimaan HR, hasil restore rehearsal, dan waktu cutover. Ringkasan boleh masuk dokumentasi repository; file data personal, kredensial, snapshot dan mapping lengkap tetap di penyimpanan operator.

Migrasi selesai jika tidak ada blocker rekonsiliasi, modul baru menjadi sumber input tunggal, master/data bisnis terisolasi dari AMS, backup teruji, dan akses/layout memenuhi spec. Keberhasilan command apply saja belum memenuhi kriteria tersebut. Backup database yang sama memuat kedua domain; tidak boleh menganggap restore fisik seluruh database hanya memengaruhi absensi.
