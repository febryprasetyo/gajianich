# Checkpoint tooling Solution X900 — 27 Oktober 2026

Status: instalasi alat dan verifikasi lokal selesai. Analisis aplikasi target dan implementasi integrasi belum dimulai. Belum dibuat commit.

## Target yang dikonfirmasi

- Windows 11 di komputer pengguna, terpisah dari host pengembangan.
- Aplikasi: `C:\Program Files (x86)\Solution\Att.exe`.
- Mesin LAN: `192.168.10.224`.
- Versi, arsitektur binary, bahasa implementasi, database, dan protokol belum diperiksa dari artefak sebenarnya.

## Instalasi

Seluruh komponen tambahan ditempatkan di `/home/fastpec/.local/share/rea-tools`, tanpa sudo dan tanpa mengubah runtime atau kode produk AMS.

| Komponen | Versi | Kondisi |
|---|---|---|
| REA | 6.7.0 | Registrasi Codex diperbarui |
| Ghidra | 12.1.4 | Provider REA tersedia, dekompilasi nyata lulus |
| Temurin full JDK | 21.0.13+9 | Runtime Ghidra lulus pemeriksaan |
| Frida binding Node | 17.23.2 | Binding prebuilt diaktifkan; hook pada fixture lokal lulus |
| TShark / capinfos | 4.2.2 | Ekstraksi paket Ubuntu lokal; pembacaan PCAP lulus |
| MDB Tools | 1.0.0 | CLI tersedia untuk snapshot Access bila target memakai format ini |
| 7-Zip | 23.01 | CLI ekstraksi tersedia |
| Process Monitor Windows | Paket resmi Microsoft | Disiapkan sebagai portable; belum dijalankan atau diperiksa Authenticode di Windows |

Ghidra dan JDK diunduh dari rilis GitHub resmi dan diverifikasi SHA-256. Metadata ada di `release-manifest.json` pada direktori alat. Paket Ubuntu diunduh menggunakan metadata apt lalu diekstrak lokal; tidak ada instalasi paket sistem. Launcher lokal ada di `bin/`, dan `env.sh` menyiapkan penggunaan CLI. IDA tidak dipasang karena Ghidra dipilih untuk memenuhi kebutuhan decompiler.

Konfigurasi `/home/fastpec/.codex/config.toml` ditambah lokasi Ghidra/JDK dan dua variabel tool PCAP khusus server REA. Pengaturan lain diverifikasi tetap sama lewat parsing TOML. Backup sebelum penambahan PCAP: `/home/fastpec/.codex/config.toml.rea-tools.3532aee210ff.backup`. Backup setup Ghidra: `/home/fastpec/.codex/config.toml.rea.backup.3e338ba89ef228fcbdbde98b5eea1b90530020ba2775df0fa3775e48cf8b8a88.recovery`.

## Bukti verifikasi

- Doctor khusus Codex + Ghidra: exit 0, `healthy: true`.
- Dekompilasi fixture C dengan fungsi `rea_fixture_add`: Ghidra mengembalikan `return right + left;`.
- Frida spawn/attach/hook pada fixture milik tugas: hasil fungsi 42 teramati; sesi dilepas dan proses milik tugas dibersihkan.
- Pembacaan PCAP UDP sintetis: sumber `192.0.2.1` dan port tujuan 54321 terbaca. Ini bukan trafik mesin X900.
- MCP diluncurkan dari konfigurasi Codex tersimpan: handshake lulus, 207 tools, `inspect_pcap_client` dan `list_frida_devices` berhasil dipanggil.
- TShark, capinfos, MDB Tools, dan 7-Zip: pemeriksaan versi exit 0.
- Arsip Windows: CRC seluruh anggota lulus; berisi README, manifest, executable Process Monitor dan EULA.
- Evidence lokal di `/home/fastpec/.local/share/rea-tools/verification/`: `ghidra-decompile.json`, `frida-runtime.json`, `pcap-analysis.json`, dan `mcp-configured-check.json`.

## Handoff dan batas verifikasi

[Panduan Windows](../operations/solution-x900-analysis-guide.md) dan [paket portable Windows](../operations/solution-x900-windows-tools.zip) tersedia. Panduan memakai capture filter `host 192.168.10.224`, satu penarikan log per capture, dan filter proses Att.exe di Process Monitor.

Restart Codex untuk memuat konfigurasi pada sesi baru. Pengujian MCP di atas menggunakan proses verifikasi tersendiri, bukan bukti sesi chat aktif sudah memuat tools REA.

Belum ada akses remote ke komputer Windows, attach ke Att.exe, capture trafik nyata, pembacaan database attendance, perubahan konfigurasi mesin, atau perubahan integrasi Gajianich. Runtime Frida lokal tidak otomatis memberikan akses ke PC Windows. Menunggu salinan Att.exe beserta DLL/OCX terkait dan rekaman `.pcapng` penarikan log. PML hanya disiapkan untuk Windows; tidak ada klaim REA dapat membaca PML.

Tidak ada verifikasi visual atau tes produk AMS karena kode produk tidak diubah dalam tugas ini. Perubahan paralel yang muncul pada checkout dipertahankan.

## SDK vendor yang tersedia di PC pengguna

Pengguna menyatakan SDK berada di `D:\Codes\standalone+sdk-6.3.1.55-doc-2.1.0-demo-1.1.15`. Direktori tersebut belum ditemukan pada lima kandidat mount/path lokal yang diperiksa; isinya dan kompatibilitas terhadap X900 belum diverifikasi.

Prioritas pemeriksaan berikutnya adalah dokumentasi dan demo SDK vendor: dukungan model/protokol, arsitektur dan dependensi runtime, koneksi LAN, identitas pengguna/mesin, pembacaan log, serta mekanisme incremental dan duplikasi. Analisis Att.exe dan capture tetap menjadi pelengkap bila perilaku diperlukan tidak dijelaskan SDK. Nama folder bukan bukti versi binary, format API, bahasa implementasi, atau dukungan Linux.

Langkah yang diperlukan: salin/unggah arsip folder SDK ke host atau chat ini agar dokumentasi, contoh, DLL/OCX dan identitas binary dapat diperiksa. Tidak ada koneksi atau pemanggilan SDK terhadap mesin yang dilakukan pada pembaruan ini.
