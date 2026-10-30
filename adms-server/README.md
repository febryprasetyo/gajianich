# ADMS Gajianich: peninjauan terpisah

Receiver menyimpan PUSH/ADMS pada schema `adms` di database PostgreSQL Gajianich yang sama. ATTLOG masuk ke **`adms.review_logs` saja**. Receiver, registrasi, heartbeat, impor manual, dan replay receipt tidak menulis `attendance_device_raw_logs`, `attendance_device_sync_logs`, atau metadata `attendance_devices`. Data review tidak masuk kalkulasi absensi/payroll otomatis.

Mesin tetap dapat memakai koneksi TCP/Ethernet normal pada menu Mesin Absensi. Registrasi ADMS terpisah tidak mengubah `connection_type`, status, serial, jadwal pull, atau sesi TCP mesin. Status review/heartbeat berada pada `adms.devices`; status TCP tetap dikelola aplikasi utama. `adms.devices.enabled` mengaktifkan/menonaktifkan penerimaan review, terpisah dari jenis transport; mesin utama juga harus tetap aktif dan cocok serial/grupnya.

## Persiapan

1. Backup seluruh database, termasuk schema `public` dan `adms`.
2. Salin `.env.example` menjadi `.env` (izin `0600`). Isi URL database existing, network Docker, IP LAN listener, dan port8081. Jangan memakai `localhost` sebagai host PostgreSQL di container atau mempublikasikan port PostgreSQL ke LAN.
3. Gunakan role runtime ADMS khusus yang sudah dibuat, bukan role backend bersama. Migrasi memakai role pemilik schema/tabel; `ADMS_RUNTIME_ROLE` memberi runtime akses baca tabel utama dan akses tulis schema ADMS. Runtime tidak memerlukan izin UPDATE/INSERT pada tabel utama. Jangan memberikan role backend bersama sebagai `ADMS_RUNTIME_ROLE`, karena migrasi002 mencabut izin tulis tabel utama dari role tersebut.

```bash
docker compose build
# DATABASE_URL di .env memakai role runtime khusus.
# MIGRATION_DATABASE_URL di shell memakai role pemilik (simpan melalui secret deployment).
docker compose run --rm --no-deps \
  -e DATABASE_URL="$MIGRATION_DATABASE_URL" \
  -e ADMS_RUNTIME_ROLE=gajianich_adms \
  adms node src/cli.mjs migrate
```

Migrasi001 dipertahankan sebagai riwayat pemasangan; migrasi002 menambahkan ledger review dan menandai receipt sebelumnya `MAIN_LEGACY`. Receipt baru memakai `storage_target='REVIEW'`. Counter receipt lama tidak diubah. Trigger dedup tabel utama dipertahankan untuk penarikan TCP normal; receiver tidak menulis tabel tersebut. Migrasi003 menambahkan antrean permintaan ATTLOG baca saja; readiness mensyaratkan versi3.

## Registrasi mesin

Pastikan perangkat utama sudah memiliki serial yang benar, grup organisasi, dan status aktif. Gunakan **ID database Gajianich**, bukan ID vendor atau source ID. Registrasi hanya mengikat serial/grup/IP pada `adms.devices`; serial kosong atau berbeda ditolak dan harus diperbaiki melalui pengaturan berotorisasi dahulu.

```bash
# Contoh: gunakan ID aktual hasil pemeriksaan database.
docker compose run --rm --no-deps adms node src/cli.mjs register \
  --device-id 3 --serial GSY1254900014 --source-cidr 192.168.0.80/32

docker compose up -d --build
docker compose exec adms node src/cli.mjs status
```

Allowlist memakai alamat socket aktual; `X-Forwarded-For` tidak dipercaya. Gunakan IP mesin tepat pada LAN/VPN terkontrol. Jika NAT terlibat, verifikasi alamat sumber yang terlihat receiver sebelum memperbarui allowlist. Jangan membuka listener HTTP langsung ke internet. Serial bukan kredensial.

Pemetaan review membaca employee number/barcode dalam grup mesin. PIN dengan nol depan dipertahankan. Fallback numerik hanya berlaku jika unik; PIN yang belum cocok tetap disimpan dengan `employee_id=NULL`. Opsi `--source-id` hanya untuk source absensi yang benar-benar diketahui dan berbeda dari device ID.

## Penerimaan dan status

- GET options/heartbeat hanya memperbarui `adms.devices.last_seen_at`.
- ATTLOG divalidasi seluruh batch. Receipt payload asli, baris review, counter, dan watermark di-commit bersama sebelum respons `OK: N`.
- `N` menghitung baris valid termasuk duplikat. `total_inserted` pada receipt REVIEW menghitung baris review baru.
- Fingerprint SHA-256 menggabungkan serial, PIN numerik tanpa nol depan, waktu lokal sampai detik, raw status, dan raw verify. Workcode disimpan, tetapi bukan pembeda scan. Timestamp tidak digeser ke UTC.
- ATTLOG sah dari mesin memperbarui `last_data_at` dan stamp ADMS; impor manual/replay tidak menggeser heartbeat atau watermark.
- Payload rusak diarsipkan sebagai REJECTED, dibalas non-2xx, dan tidak menghasilkan sebagian baris atau menggeser watermark. Gangguan DB dibalas503 tanpa ACK sukses.
- OPERLOG/DEVICECMD dan payload non-ATTLOG diarsipkan, tanpa menulis karyawan, template, atau pengaturan mesin.

Endpoint: `/health/live`, `/health/ready`, `/iclock/cdata`, `/iclock/getrequest`, `/iclock/devicecmd`. Monitoring lengkap melalui aplikasi Gajianich berautentikasi. Pada mesin gunakan IP LAN host (contoh `192.168.10.212:8081`), bukan alamat container; konektivitas dan dukungan firmware harus diuji pada mesin fisik.

Antrean historis hanya mengizinkan `DATA QUERY ATTLOG` dengan rentang waktu. Tidak ada perintah yang otomatis dimasukkan saat startup; permintaan harus dibuat operator lewat aplikasi berautentikasi. Tidak tersedia perintah clear/delete/reboot, ubah jam, ubah pengguna, atau template. Dukungan query historis dan retry nyata tetap bergantung firmware; ACK perintah bukan bukti seluruh riwayat sudah diterima.

## Review receipt lama tanpa mengubah absensi utama

Receipt sebelum migrasi002 tetap bertarget `MAIN_LEGACY`. Baris utama yang pernah ditulis versi lama **tidak dihapus atau diubah**. Replay menyalin payload ATTLOG ACCEPTED ke review dengan dedup, tanpa receipt baru dan tanpa mengubah counter/target receipt lama.

```bash
docker compose exec adms node src/cli.mjs backfill-review
# Atau batasi satu serial:
docker compose exec adms node src/cli.mjs backfill-review --serial GSY1254900014
```

Replay bertransaksi per receipt. Jika sebuah receipt gagal, receipt terdahulu yang sudah selesai tetap tersalin; perbaiki penyebab dan ulangi secara idempotent. Grup dan serial utama harus masih cocok. Payload impor lama dengan susunan kolom nonstandar memerlukan metadata `columns` yang benar; jangan menebak susunannya.

## Impor manual untuk review

CLI operator mendukung UTF-8 TSV satu scan per baris, bukan file USB biner/Excel atau rekap harian:

```text
PIN<TAB>YYYY-MM-DD HH:mm:ss<TAB>STATUS<TAB>VERIFY<TAB>WORKCODE
```

Maksimum file32MiB/500.000 baris, transaksi5000 baris. File divalidasi sebelum commit pertama. Untuk urutan berbeda gunakan `--columns pin,timestamp,device,verify,status,workcode` hanya jika sesuai berkas asli; gunakan `--skip-header` bila ada header.

```bash
mkdir -p imports
# Preview tanpa menulis database.
docker compose run --rm --no-deps -v "$PWD/imports:/imports:ro" adms \
  node src/cli.mjs import --serial GSY1254900014 --file /imports/history.tsv
# Setelah preview sesuai, tulis hanya ke review.
docker compose run --rm --no-deps -v "$PWD/imports:/imports:ro" adms \
  node src/cli.mjs import --serial GSY1254900014 --file /imports/history.tsv --commit
```

Status0/4 masuk,1/5 pulang; raw status/verify asli selalu dipertahankan. Tahun2000–2099 dan kalender divalidasi. Simpan ekspor asli sampai rekonsiliasi selesai.

```bash
docker compose exec adms node src/cli.mjs receipts --serial GSY1254900014
docker compose run --rm --no-deps -v "$PWD/imports:/imports" adms \
  node src/cli.mjs export-receipt --id 123 --output /imports/rejected-123.tsv
```

Ekspor tidak menimpa file existing. Payload berisi data personal; batasi akses dan backup operator.

## Verifikasi pengembang

```bash
# Parser/HTTP, PostgreSQL disposable, isolasi main tables, concurrency, replay, startup.
bash scripts/test-docker.sh
# Node22+ lokal:
npm ci
npm test
npm run check
```

Tes PostgreSQL hanya menerima database disposable `gajianich_adms_test`, bukan database aktif. Tes `npm run test:gajianich` membutuhkan database disposable `gajianich_adms_backend_test` yang sudah dimigrasikan backend, role runtime `adms_backend_runtime` (password pengujian `adms-runtime-test-only`), dan build backend; tes ini memastikan jalur review tetap terpisah dari handler log utama.

Protokol PUSH terenkripsi, handshake registry/security baru, file USB biner, dan XLS/XLSX belum didukung. Referensi implementasi: https://github.com/aslisubhash/essl-web-login-software/blob/main/docs/adms-protocol.md ; bukan sertifikasi firmware X900.
