# Uji koneksi mesin absensi dari Ubuntu

Diagnostik CLI untuk mesin keluarga ZKTeco/Solution dengan protokol ZK TCP.
Memerlukan Node.js 18+; tidak ada dependency atau SDK Windows tambahan.

Dari direktori `backend`:

```bash
mkdir -p .attendance-diagnostics
cp -n config/attendance-devices.example.json .attendance-diagnostics/attendance-devices.local.json
npm run attendance:devices:test -- --config .attendance-diagnostics/attendance-devices.local.json
```

Konfigurasi contoh berisi X900 `192.168.10.224:4370`, key 0, dan satu contoh
mesin kedua yang **nonaktif**. `192.0.2.2` adalah alamat contoh, bukan mesin
pengguna. Ubah IP dan aktifkan entri tersebut hanya setelah alamat sebenarnya
tersedia. Tambahkan objek dalam `devices` untuk mesin berikutnya.

```json
{
  "devices": [
    {
      "id": "solution-x900-utama",
      "name": "Solution X900 Utama",
      "ip": "192.168.10.224",
      "port": 4370,
      "commKey": 0,
      "timeoutMs": 5000,
      "enabled": true
    }
  ]
}
```

ID konfigurasi adalah identitas mesin pada laporan, bukan PIN karyawan.
Maksimal 64 mesin, ID unik, alamat IPv4, port 1–65535, key 0–999999.
Timeout 100–30000 ms berlaku per koneksi/perintah. Mesin diperiksa berurutan;
kegagalan satu mesin dilaporkan dan pemeriksaan berlanjut ke mesin berikutnya.
Entri nonaktif dilewati. Format dan seluruh konfigurasi divalidasi sebelum
koneksi pertama; endpoint aktif yang sama tidak boleh ditulis dua kali.

Uji satu mesin atau beberapa mesin terpilih:

```bash
npm run attendance:devices:test -- --config .attendance-diagnostics/attendance-devices.local.json --device solution-x900-utama
# --device dapat diulang untuk ID lain yang telah dikonfigurasi.
```

Output JSON tanpa banner npm, untuk disimpan atau dikonsumsi program lain:

```bash
node scripts/attendance-device-test.mjs --config .attendance-diagnostics/attendance-devices.local.json --json
```

Tambahkan redirection ke file baru bila ingin menyimpan hasil. File di `.attendance-diagnostics/`
bersifat lokal dan diabaikan Git. Laporan tidak mencantumkan commKey.

## Yang diuji

1. TCP dapat dibuka.
2. Handshake protokol ZK berhasil; challenge autentikasi dijawab dengan key
   yang dikonfigurasi, termasuk bila key 0 tetap membutuhkan challenge.
   Challenge 2005 dan 6001 ditangani; autentikasi ditolak tidak dianggap sebagai
   bukti tunggal password salah karena kompatibilitas firmware juga berpengaruh.
3. Pembacaan firmware, nomor seri, model, dan platform.
4. Logout sesi dan pelepasan socket.

Status laporan:

- `ok`: handshake dan seluruh identitas berhasil, logout terkonfirmasi.
- `partial`: handshake berhasil, tetapi metadata tertentu tidak tersedia atau
  logout tidak terkonfirmasi; lihat `warnings`.
- `failed`: suatu tahap tes gagal; `tcpConnected` dan `protocolConnected`
  menunjukkan tahap yang sudah terbukti, dan `error` menunjukkan sebab gagal.

Exit code: 0 jika semua `ok`; 1 bila ada `partial`/`failed`; 2 untuk argumen atau
konfigurasi tidak valid. `--json` tetap mengeluarkan laporan saat exit code 1.

Alat ini hanya melakukan koneksi, autentikasi sesi, pembacaan identitas dan
logout. Tidak ada penonaktifan mesin, penghapusan data, perubahan waktu,
penarikan log/user/biometrik, atau penulisan database Gajianich. Belum ada
endpoint/tombol aplikasi, scheduler, UDP fallback, atau sinkronisasi absensi.

User telah mengonfirmasi ID karyawan Gajianich sama dengan PIN pada mesin.
Saat penarikan log ditambahkan, gunakan PIN eksternal sebagai string dan
pertahankan identitas mesin; jangan memakai UID internal mesin atau menganggap
PIN adalah primary key database. Pencocokan log belum termasuk diagnostik ini.

## Tes

```bash
npm run test:attendance-devices
```

Suite menggunakan server TCP loopback dan executable CLI, tanpa menghubungi
mesin LAN. Mencakup framing terfragmentasi, checksum, sesi, autentikasi,
timeout, beberapa mesin, entri nonaktif, pemilihan mesin, dan laporan JSON.
Nonzero commKey diuji pada fixture; perangkat nyata yang tersedia memakai 0.

## Bukti perangkat nyata

Uji dari Ubuntu ke `192.168.10.224:4370` dengan key 0 berhasil membaca:

- Model X900, platform ZAM180_TFT.
- Firmware `Ver 6.60 Aug 19 2021`.
- Serial `WAE4242900026`.

Uji lanjutan juga berhasil pada mesin `192.168.10.4` (nama konfigurasi MGM),
model X900, platform ZAM180_TFT, firmware yang sama, serial WAE4242300038.
Kedua mesin sudah diuji dalam satu pemanggilan CLI dengan hasil ok. Mesin lain
tetap perlu diuji dengan IP/key masing-masing. Perangkat selain keluarga protokol ZK belum
tercakup.

Referensi format protokol dan challenge:
- https://github.com/adrobinoga/zk-protocol/blob/master/protocol.md
- https://github.com/caobo171/node-zklib/blob/master/utils.js

Implementasi diagnostik memakai Node `net` langsung; tidak memasang atau
memakai library di atas sebagai dependency.

## Hasil tiga target tambahan

IP 192.168.0.80, 192.168.1.199 dan 192.168.1.242 dapat dijangkau TCP 4370,
tetapi handshake mengembalikan 6001. Setelah satu respons autentikasi dengan
key uji 0, ketiganya menolak dengan kode 2032. Key alternatif yang diberikan
pengguna juga diuji sekali pada masing-masing target dan tetap ditolak dengan
kode yang sama. Identitas/firmware ketiga target belum berhasil dibaca.

Jangan menyimpulkan password salah hanya dari hasil ini. Lihat model, firmware,
pengaturan komunikasi/enkripsi, atau hasil koneksi aplikasi vendor untuk
menentukan jalur protokol berikutnya. Belum ada perubahan mesin atau reset.

Referensi observasi serupa pada firmware lain (bukan bukti model tiga mesin ini):
https://github.com/fananimi/pyzk/issues/253
