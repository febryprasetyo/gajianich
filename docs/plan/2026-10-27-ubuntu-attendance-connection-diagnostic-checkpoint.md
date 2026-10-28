# Checkpoint konektor uji absensi Ubuntu — 27 Oktober 2026

Status: konektor diagnostik CLI diimplementasikan dan uji perangkat nyata berhasil. Belum dibuat commit. Penarikan log, endpoint/tombol aplikasi, scheduler dan penulisan database belum termasuk cakupan.

## Cakupan yang diotorisasi

Pengguna meminta konektor untuk menguji koneksi mesin langsung dari Ubuntu dan mendukung beberapa mesin absensi. Pengguna menyatakan ID karyawan Gajianich sudah sama dengan ID/PIN di mesin. Konektor tahap ini hanya membaca identitas perangkat; pencocokan karyawan diterapkan saat penarikan log ditambahkan.

## Implementasi

- [CLI](../../backend/scripts/attendance-device-test.mjs) dan [transport ZK TCP](../../backend/scripts/lib/zk-connection.mjs): Node.js tanpa dependency tambahan atau DLL Windows.
- [Konfigurasi contoh](../../backend/config/attendance-devices.example.json): X900 yang diketahui, serta satu mesin contoh nonaktif. Alamat contoh bukan mesin yang telah ditemukan.
- Daftar maksimal 64 mesin, ID dan endpoint aktif unik, IPv4, key 0–999999. Timeout, validasi sebelum koneksi, pemilihan satu/beberapa mesin, dan pemrosesan berurutan.
- Handshake serta autentikasi challenge dengan key konfigurasi, termasuk key 0 yang tetap diminta X900. Pembacaan firmware/serial/model/platform, checksum, pembatasan frame, timeout dan pelepasan socket.
- Status ok/partial/failed per mesin; JSON atau tabel, exit code terdefinisi, key tidak disertakan pada laporan hasil.
- Tidak ada CMD disable, clear/delete, set-time, penarikan log/user/biometrik, atau penulisan DB. Perintah dibatasi ke koneksi, autentikasi sesi, baca identitas dan logout.
- [Panduan penggunaan](../../backend/scripts/attendance-devices.README.md).

Folder backend/data ternyata dimiliki root dan tidak dapat ditulis pengguna. Hak aksesnya dipertahankan. Konfigurasi lokal disimpan pada [attendance-devices.local.json](../../backend/.attendance-diagnostics/attendance-devices.local.json); folder khusus `.attendance-diagnostics` diabaikan Git agar konfigurasi/key serta laporan tetap lokal.

## Uji perangkat nyata

CLI dipanggil pada host Ubuntu ini ke 192.168.10.224:4370, key 0. TCP, handshake ZK, challenge autentikasi dan pembacaan identitas berhasil; logout selesai. Laporan status ok, tanpa warning/error:

| Field | Hasil |
|---|---|
| Model | X900 |
| Platform | ZAM180_TFT |
| Firmware | Ver 6.60 Aug 19 2021 |
| Serial | WAE4242900026 |
| Durasi | 3171 ms |
| Timestamp bukti (UTC) | 2026-10-27T02:47:11.268Z |

[Laporan JSON perangkat nyata](../../backend/.attendance-diagnostics/solution-x900-connection-proof-2026-10-27.json).

Hanya mesin ini yang diuji langsung. Skenario beberapa mesin, autentikasi nonzero dan kegagalan diisolasi diuji menggunakan server loopback; ini bukan bukti mesin fisik lain sudah kompatibel.

## Verifikasi

- `npm run test:attendance-devices`: 15/15 lulus. Tes mencakup framing TCP terfragmentasi, paket invalid/checksum/sesi salah, key 0/nonzero, autentikasi ditolak, timeout, beberapa mesin, disabled entry, seleksi CLI, JSON dan exit code.
- `node --check` untuk CLI serta transport: lulus.
- CLI `--help`: berhasil.
- Review terpisah: tidak ada temuan critical/important; reviewer tidak menghubungi mesin nyata.
- `git diff --check`: lulus sebelum checkpoint akhir; tautan lokal serta JSON konfigurasi/laporan diperiksa.
- `npm test` backend: 360 tes, 357 lulus, 3 gagal, 0 skipped. Suite backend tidak dinyatakan hijau.

Nama kegagalan backend:
1. `GA API saves complete requests, protects evidence, handles drafts, status transitions, and signed documents`: PostgreSQL melaporkan terminating connection due to administrator command.
2. `clock validates identity and uses server instant in GPS zone; OUT retains initial zone`: assertion 0 != 1.
3. `Multi-clocking in default mode: multiple OUT clocks are allowed as PENDING, HR approval picks chosen one`: penolakan OUT karena guard minimal 30 menit.

Ketiga kegagalan berada pada area di luar skrip yang diubah. Tidak dilakukan perubahan untuk menanganinya dan tidak diklaim telah dibuktikan gagal pada baseline sebelum tugas. Log run lengkap: `/tmp/ams-attendance-connector-backend-tests.log`.

Tidak ada perubahan backend/src atau frontend pada tugas ini. Tidak ada verifikasi visual karena tidak ada UI yang diubah. Tes produk luas dijalankan sebagai regresi, bukan bukti integrasi pengambilan log sudah tersedia.

## Uji dua mesin fisik — 27 Oktober 2026

Pengguna memberikan dua endpoint port TCP 4370: 192.168.10.4 dan 192.168.10.224. IP .4 sudah ada pada konfigurasi lokal dengan nama MGM tetapi nonaktif; entri tersebut diaktifkan untuk uji. Nama, ID, key, dan pengaturan lain dipertahankan, dan backup konfigurasi dibuat sebelum perubahan.

Keduanya berhasil diuji dalam satu pemanggilan CLI dari Ubuntu, bukan hanya uji port:

| IP | Nama konfigurasi | Model | Platform | Serial | Status |
|---|---|---|---|---|---|
| 192.168.10.224 | Solution X900 Utama | X900 | ZAM180_TFT | WAE4242900026 | ok |
| 192.168.10.4 | MGM | X900 | ZAM180_TFT | WAE4242300038 | ok |

Kedua perangkat melaporkan firmware Ver 6.60 Aug 19 2021. Handshake, autentikasi yang diperlukan, pembacaan identitas dan logout berhasil, tanpa warning/error. Serial berbeda membuktikan dua identitas perangkat berbeda. [Laporan JSON dua mesin](../../backend/.attendance-diagnostics/multi-machine-connection-paw89jbz.json).

Pembaruan ini tidak mengubah kode konektor atau dependensi. Verifikasi adalah uji CLI nyata dua perangkat, pemeriksaan laporan JSON, status konfigurasi aktif, dan referensi dokumentasi. Suite tes tidak diulang karena implementasi tidak berubah. Pengambilan log dan sinkronisasi database belum termasuk uji ini. Catatan sebelumnya bahwa baru satu mesin diuji bersifat historis.

## Uji lima target dan challenge 6001 — 27 Oktober 2026

Lima target yang diberikan pengguna diuji: 192.168.10.4, 192.168.10.224, 192.168.0.80, 192.168.1.199 dan 192.168.1.242. Seluruh TCP 4370 terjangkau. Dua X900 lama tetap berhasil membaca identitas, sedangkan tiga target baru mengembalikan handshake 6001. Rute ke subnet 0.x dan 1.x melewati gateway 192.168.10.1 pada host ini.

Diagnosis sumber primer https://github.com/fananimi/pyzk/issues/253 melaporkan pola firmware lain dengan challenge 6001 dan penolakan legacy auth 2032. Ini petunjuk kompatibilitas, bukan identifikasi firmware target pengguna. Konektor diperbarui untuk menjawab challenge 6001 dengan satu key terkonfigurasi saja. Dua tes regresi ditulis dan diamati gagal sebelum perubahan, lalu 17 tes diagnostik lulus.

Tiga target baru diuji dengan key 0, kemudian satu kali lagi per target memakai key alternatif yang diberikan pengguna. Seluruh respons autentikasi tetap 2032. Password tidak ditebak, tidak ada retry otomatis dengan key berbeda, dan tidak ada reset/perubahan pengaturan mesin. Nilai key tidak dicantumkan di laporan ini. Key kandidat tersimpan pada konfigurasi lokal yang diabaikan Git; validitasnya belum terbukti. Dua mesin 192.168.10.x tetap memakai key 0.

| IP | TCP | Hasil protokol terbaru | Identitas |
|---|---|---|---|
| 192.168.10.4 | terhubung | ok | WAE4242300038 |
| 192.168.10.224 | terhubung | ok | WAE4242900026 |
| 192.168.0.80 | terhubung | AUTH_FAILED / 2032 | belum terbaca |
| 192.168.1.199 | terhubung | AUTH_FAILED / 2032 | belum terbaca |
| 192.168.1.242 | terhubung | AUTH_FAILED / 2032 | belum terbaca |

[Laporan gabungan observasi terbaru per endpoint](../../backend/.attendance-diagnostics/five-machine-latest-2026-10-27.json). Bukti awal: [lima target](../../backend/.attendance-diagnostics/five-machine-connection-wq02cz_e.json), [challenge 6001 dengan key 0](../../backend/.attendance-diagnostics/three-machine-auth6001-evur0cs0.json), dan [key kandidat pengguna](../../backend/.attendance-diagnostics/three-machine-provided-key-8savm7nm.json). Timestamp setiap hasil dipertahankan; laporan gabungan bukan satu sesi probe baru.

Penolakan 2032 belum cukup untuk menentukan password salah atau kebutuhan protokol/enkripsi lain. Model, firmware dan pengaturan komunikasi ketiga perangkat perlu diperiksa dari perangkat atau aplikasi vendor. Pesan error konektor diperjelas agar meminta pemeriksaan key **dan** kompatibilitas protokol. Tidak ada akses identitas/log ketiga perangkat yang berhasil diklaim.

Verifikasi pembaruan: 17/17 tes diagnostik lulus, pemeriksaan sintaks transport lulus, laporan JSON dan tautan lokal diperiksa. Suite backend luas tidak diulang untuk perubahan terisolasi pada skrip diagnostik; hasil terdahulu 357/360 dengan tiga kegagalan GA/mobile tetap berlaku sebagai catatan run sebelumnya. Tidak ada perubahan backend/src/frontend, penarikan log, atau perubahan DB.
