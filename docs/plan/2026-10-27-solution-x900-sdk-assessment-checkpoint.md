# Checkpoint pemeriksaan SDK Solution X900 — 27 Oktober 2026

Status: pemeriksaan statis SDK yang diunggah selesai; belum dibuat commit. Uji mesin dan implementasi integrasi belum dilakukan.

- Integritas ZIP lengkap lulus CRC; arsip diidentifikasi dengan SHA-256.
- 88 berkas relevan diekstrak untuk analisis; source demo baru dan manual vendor dibaca.
- DLL x86/x64 diukur sebagai Windows native PE, file/product version 6.3.1.55.
- Jalur koneksi LAN, penarikan log historis, periodik, baru, dan event realtime ditemukan pada manual/source. Port 4370 adalah default dokumentasi, belum hasil uji mesin.
- Pembatasan firmware pada API periode/log baru dan efek EnableDevice pada demo dicatat.
- [Hasil analisis dan referensi bukti](../operations/solution-x900-sdk-assessment.md).

Verifikasi hanya integritas, pembacaan dokumen, identitas binary, dan konsistensi referensi. Tidak menjalankan DLL/script vendor, mendaftarkan COM, menghubungi 192.168.10.224, mengubah produk, atau mengklaim kompatibilitas perangkat. Tahap berikutnya memerlukan uji SDK dari Windows pada mesin pengguna.

Pembaruan konfigurasi dari pengguna: IP `192.168.10.224`, port `4370` terkonfirmasi dari screenshot Att.exe; communication key `0` dikonfirmasi pengguna. Parameter koneksi untuk uji SDK telah lengkap, tetapi uji SDK belum dijalankan. [Rincian konfigurasi](../operations/solution-x900-sdk-assessment.md#konfigurasi-mesin-yang-dikonfirmasi-pengguna).

Panduan uji manual Windows dibuat berdasarkan label dan handler source demo: [langkah uji SDK](../operations/solution-x900-sdk-windows-test.md). Prasyarat .NET diverifikasi ke dokumentasi resmi Microsoft untuk membedakan Windows 11 sampai 25H2 dan 26H1+. Panduan menjelaskan bahwa ReadAttLog tanpa periode membaca semua log dan demo sementara menonaktifkan perangkat. Verifikasi dokumentasi/source selesai; belum ada klaim uji SDK pada mesin lulus.

## Hasil uji dari pengguna

Empat screenshot menunjukkan koneksi demo SDK, pembacaan identitas X900 dan log historis berhasil; setidaknya satu event realtime diterima. Footer SDK aktif melaporkan 6.3.1.43, berbeda dari DLL paket 6.3.1.55. Hasil ini tidak memverifikasi runtime DLL paket 6.3.1.55. [Laporan bukti dan batas kesimpulan](../operations/solution-x900-sdk-runtime-results.md). Pencocokan record SDK vs Att.exe, kelengkapan log, dan implementasi penghubung masih belum selesai. Status sebelumnya yang menyatakan belum ada hasil uji pengguna kini bersifat historis. Belum dibuat commit.

## Arah integrasi Ubuntu langsung

Pengguna mengonfirmasi hasil log SDK dan Att.exe sama persis setelah pencocokan manual; screenshot berbeda karena urutan tampilan. Tujuan diperjelas: penarikan langsung melalui Gajianich di Ubuntu, tanpa ketergantungan Windows. Uji pembukaan TCP host 192.168.10.212 ke 192.168.10.224:4370 berhasil tanpa mengirim perintah aplikasi. [Laporan kelayakan dan batas bukti](../operations/solution-x900-ubuntu-feasibility.md). Uji protokol Linux dan implementasi masih belum dilakukan.
