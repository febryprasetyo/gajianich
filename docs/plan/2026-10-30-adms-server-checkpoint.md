# Checkpoint ADMS terpisah dan impor historis — 30 Oktober 2026

Status: implementasi dan verifikasi lokal selesai; belum diaktifkan ke database/mesin produksi. Belum commit/push. Gudang 2 belum menghubungi receiver ini, sehingga kompatibilitas firmware fisik belum diklaim.

## Implementasi

- Folder [adms-server](../../adms-server/README.md), image produksi `gajianich-adms:local`, Dockerfile Node 22 non-root, Compose standalone memakai external network PostgreSQL existing. Tidak membuat DB produksi kedua. Listener default loopback port 8081.
- Endpoint PUSH teks `/iclock/cdata`, `/iclock/getrequest`, `/iclock/devicecmd`; heartbeat/options, ACK setelah commit, receipt byte asli, watermark, batas ukuran/waktu, serial + jaringan sumber allowlist, tanpa perintah mutasi perangkat.
- Schema `adms` untuk registrasi, receipt dan cursor pada database sama. Runtime role dapat dipisahkan dari migration owner; grant minimum disediakan. Mesin/grup/serial harus cocok dan aktif.
- ATTLOG dan impor manual menuju log mentah Gajianich. PIN belum dikenal tetap disimpan, format invalid dikarantina tanpa watermark maju, kegagalan DB rollback tanpa ACK sukses. Status unmapped/rejected dan ekspor receipt tersedia melalui CLI operator.
- Impor UTF-8 TSV dry-run default, `--commit` eksplisit, pemilihan urutan kolom USB, validasi seluruh file sebelum batch transaksi 5000 baris. Format fisik pengguna belum diberikan; binary/Excel tidak diklaim didukung. File maksimal 32 MiB/500000 baris.
- Dedup fingerprint + unique index untuk retry konkuren dan overlap sumber, termasuk pencocokan log sebelum migrasi tanpa menghapusnya. Receipt tetap menyimpan asal setiap pengiriman. Workcode bukan pembeda scan kalkulasi; rawLine/payload tetap disimpan.
- Backend menerima heartbeat ADMS (timestamptz, timeout 180 detik), melarang aksi TCP pada mesin ADMS, dan mengganti overwrite pull menjadi merge tanpa penghapusan rentang. PIN unresolved tidak dibuang saat pull.
- Ditemukan lewat regresi nyata: pull sebelumnya mengubah 07:55 lokal ke 00:55 sebelum menulis timestamp. Jalur baru menulis wall clock secara eksplisit. Riwayat lama tidak dikoreksi otomatis.
- Pemetaan ulang memperhatikan grup serta sumber identitas eksplisit. Review independen menemukan fallback kalkulator dapat memetakan PIN unresolved ke karyawan grup lain; tes nyata diamati gagal sebelum perbaikan. Sekarang hanya ID karyawan terverifikasi dalam grup log diteruskan; raw unresolved tetap tersimpan, count `totalUnmappedRawLogs` tersedia, fallback alias PIN pada kalkulasi controller dihapus. Review ulang tidak menemukan blocker tambahan.
- Migrasi backend [0038_adms_ingestion_columns.sql](../../backend/drizzle/0038_adms_ingestion_columns.sql). Nomor 0037 sudah digunakan pekerjaan lain; entri/migrasi tersebut dipertahankan.

Kalkulasi shift/penyimpanan hasil kehadiran final tetap lewat alur kalkulasi existing. Receiver hanya menerima dan menyimpan log otomatis; tidak menimpa payroll otomatis.

## Verifikasi akhir

- `bash adms-server/scripts/test-docker.sh`: lulus; 9 tes parser/HTTP + 10 hitungan tes PostgreSQL termasuk parent. Startup Node 22 read-only/non-root container terhadap DB disposable ready. Resource milik skrip dibersihkan otomatis.
- `test/gajianich.integration.mjs`: 6 hitungan tes termasuk parent lulus pada DB disposable dengan **seluruh migrasi backend asli**, handler nyata dan runtime role non-superuser. Membuktikan status/daftar log, pemetaan lintas grup ditolak, guard TCP, CLI dry-run tidak menulis, impor ulang dedup, dan legacy pull merge mempertahankan riwayat.
- Regresi backend terpilih: 28/28 lulus (transport ADMS, pemetaan PIN, kalkulasi, protokol/session ZK dan rute mesin). Tidak mengklaim seluruh suite backend/frontend dijalankan.
- `npm run build --prefix backend`: lulus; `npm run check --prefix adms-server`: lulus; Compose `config --quiet` dan `bash -n`: lulus.
- Image final produksi `gajianich-adms:local` berhasil dibangun. Tidak berjalan terhadap DB aktif.
- Migrasi backend lengkap pertama gagal karena fixture belum punya role audit runtime wajib; setelah role test nonprivileged dibuat, migrasi lengkap berhasil. Bukan perubahan aturan audit produksi.
- Diff whitespace dalam lingkup ADMS lulus. `git diff --check` global melaporkan blank line EOF pada dua dokumen mobile hybrid milik pekerjaan lain; tidak disentuh.
- Log Docker: `/tmp/gajianich-adms-docker-verification.log`; regresi backend: `/tmp/gajianich-adms-backend-regression.log`; build produksi: `/tmp/gajianich-adms-production-build.log`.

## Aktivasi berikutnya

Ikuti [README deployment dan impor](../../adms-server/README.md): konfigurasi `.env` DB/network/listener; backup + migrasi; pastikan ID mesin Gajianich dan grup Gudang 2 benar; daftarkan serial `GSY1254900014` dengan jaringan asal yang tepat; jalankan container; baru arahkan ADMS mesin ke listener. ID 4 pada Att.exe tidak dianggap otomatis sama dengan ID Gajianich. Jangan aktifkan listener ke internet terbuka, karena SN bukan credential. Uji satu mesin, kirim scan baru, putus/sambung koneksi dan cocokkan ekspor manual yang overlap sebelum meluas.

Pekerjaan lain yang muncul selama checkout (seed, office shift, hrMasterMutations, dokumen hybrid/desain) dipertahankan tanpa diubah oleh tugas ADMS.

## Pembaruan aktivasi dan monitoring

Receiver development sekarang berjalan sehat, Gudang2 telah didaftarkan keCMC berdasarkan jawabanpengguna, dan monitoringbrowser tersedia. Status sebelumnya yang menyebut belum diaktifkan bersifat historis. Lihat [checkpoint aktivasi/monitoring](./2026-10-30-adms-monitor-checkpoint.md).
