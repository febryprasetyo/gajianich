# Diagnosis Gudang 2 dan SDK 6.3.1.55 — 30 Oktober 2026

Status: kegagalan autentikasi berhasil direproduksi; kompatibilitas konektor belum diperbaiki.

## Bukti

- Pengguna memberikan Gudang 2, ID pada aplikasi vendor 4, endpoint `192.168.0.80:4370`, MachineNumber 1, serial dari konfigurasi `NNE7234400009`, dan communication key. Key dipakai satu kali untuk uji, tidak dicatat dalam dokumen/laporan.
- Pengguna mengonfirmasi koneksi dan penarikan log melalui aplikasi Windows berhasil setelah SDK diperbarui. Runtime DLL, model, dan firmware mesin belum diverifikasi langsung.
- Uji CLI pada `2026-10-30T03:03:47.545Z` (10:03:47 WIB): TCP berhasil; autentikasi ditolak `AUTH_FAILED`, ZK code `2032`; identitas belum bisa dibaca. Durasi 180 ms.
- Pembanding MGM `192.168.10.4:4370`, key 0, pada `2026-10-30T03:03:47.727Z`: status `ok`, model X900, platform ZAM180_TFT, firmware `Ver 6.60 Aug 19 2021`, serial `WAE4242300038`; logout tanpa warning. Durasi 92 ms.
- Uji menggunakan `probeDevice` dari `backend/scripts/lib/zk-connection.mjs`; hanya koneksi/autentikasi/baca identitas/logout, tanpa penarikan log, penulisan database, atau perubahan pengaturan perangkat.
- ZIP baru `SDK Attendance Management 2025 (6.3.1.55).zip`: 56 entri; CRC seluruh arsip lulus. Pemeriksaan statis Python terhadap header PE dan VS_FIXEDFILEINFO: zkemkeeper.dll x86 machine 0x14c dan x64 machine 0x8664, keduanya file version 6.3.1.55. Tidak menjalankan DLL atau batch vendor. Tools REA tidak tersedia; ini hasil pemeriksaan shell/Python biasa, bukan hasil dekompilasi REA.
- SHA-256 zkemkeeper.dll x86: `8b7e5bd670c24d367dfe0297e9c2feb67972d062fb50b830f15873c65c6b34d9`.
- SHA-256 zkemkeeper.dll x64: `328ef8a151bb2def2dbc9600c1cbb76d361f4e3d80353eed2f17da1b012698c4`.

## Kesimpulan dan tindak lanjut

Kode produk `backend/src/services/zk/zkSessionManager.ts` dan CLI memakai Node TCP langsung dengan autentikasi legacy; tidak memuat SDK COM Windows. Menyalin DLL versi baru tidak memperbarui implementasi protokol ini. Penolakan terjadi sebelum log dibaca. Bukti mengarah pada ketidakcocokan autentikasi/protokol, tetapi belum membuktikan algoritma pengganti atau kebutuhan enkripsi tertentu. Tidak menyimpulkan communication key salah.

[Issue upstream pyzk #253](https://github.com/fananimi/pyzk/issues/253) melaporkan pola 6001/2032 pada firmware perangkat lain. Ini pembanding, bukan identifikasi firmware Gudang 2 atau bukti ADMS merupakan satu-satunya solusi: pengguna justru melaporkan SDK baru berhasil melakukan penarikan.

Diperlukan model/firmware Gudang 2 dari aplikasi Windows/menu mesin dan pembandingan handshake sesi SDK baru yang berhasil dengan konektor Linux sebelum mengubah autentikasi. Pertahankan jalur mesin lama yang sudah berfungsi. Kebutuhan Windows bridge atau ADMS belum diputuskan.

Tidak ada perubahan kode produk. Typecheck/lint/unit test tidak dijalankan karena perubahan hanya dokumentasi; verifikasi fungsional berupa dua uji perangkat nyata dan pemeriksaan integritas/metadata SDK. Koneksi Gudang 2 dari Gajianich tetap belum berhasil.

## Identitas dikonfirmasi dan pilihan solusi

Pengguna mengonfirmasi screenshot pertama berasal dari Gudang 2 `192.168.0.80`: Solution X900, serial `GSY1254900014`, platform `ZAM70_TFT`, firmware `Ver 6.60 Apr 28 2025`. Serial `NNE7234400009` dari tabel awal tidak dipakai sebagai identitas mesin ini. Screenshot kedua menunjukkan X900 `192.168.10.224`, serial `WAE4242900026`, platform `ZAM180_TFT`, firmware `Ver 6.60 Aug 19 2021`. Kedua identitas berasal dari screenshot dan konfirmasi pengguna; pembacaan identitas Gudang 2 melalui konektor Ubuntu tetap gagal.

Pemeriksaan situs vendor pada 30 Oktober 2026:
- https://www.solution.co.id/sdk.php menyebut ZKEM SDK ActiveX untuk X900. Tulisan Linux pada halaman itu berada pada bagian U.are.U SDK, sehingga tidak membuktikan SDK Linux untuk X900. Web Service SDK terpisah memerlukan dukungan firmware; X900 tidak disebut eksplisit pada daftar contohnya.
- https://www.solution.co.id/adms.php menjelaskan komunikasi HTTP dari mesin ke server dan mensyaratkan mesin mendukung ADMS. Belum ada bukti Gudang 2 mendukungnya atau API pengaturan jarak jauh tersedia. Pengambilan seluruh log historis juga perlu diuji terpisah.

Pilihan: (1) Linux langsung melalui dokumentasi/SDK vendor yang cocok atau investigasi handshake SDK baru; kesesuaian tujuan terbaik tetapi hasil/waktu belum dapat dijamin; (2) penerima ADMS pada Ubuntu bila dukungan unit dibuktikan, termasuk backfill log historis; (3) Windows worker memakai SDK 6.3.1.55 untuk mengirim log ke backend Ubuntu, jalur SDK sudah dilaporkan berhasil namun integrasi worker belum diuji dan memerlukan host Windows yang tersedia saat sinkronisasi.

Rekomendasi: prioritaskan validasi jalur Linux/ADMS untuk tujuan tanpa ketergantungan Windows; gunakan bridge SDK bila dibutuhkan pemulihan operasional lebih cepat dan host Windows tersedia. Pertahankan konektor lama untuk mesin yang berhasil. Semua jalur perlu menyimpan identitas mesin/PIN/timestamp asli, menahan data lokal ketika server gagal bila memakai worker, mencegah duplikasi saat retry, dan membuktikan log rentang historis sesuai aplikasi vendor. Tidak ada implementasi/pengaturan mesin yang diubah pada investigasi ini.
