# Mobile Attendance Approval Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline for this approved scope.

**Goal:** Approval per shift, koreksi keterangan, approval foto, validasi wajah server, waktu lokal Indonesia.

**Architecture:** Self logs menyimpan pengajuan dan snapshot jadwal/zona. Hanya APPROVED diproyeksikan ke attendance_records. Foto diperiksa server dengan model pengenalan wajah lokal.

**Tech Stack:** Express, Drizzle/PostgreSQL, Next.js, face-api, sharp, tz-lookup.

**Spec:** Keputusan pengguna pada chat: sakelar aktif = otomatis disetujui; default mati; tanpa shift wajib HRD; foto pertama langsung aktif, perubahan wajib approval; zona presensi awal dipakai sampai pulang.

## Global Constraints
- Pertahankan perubahan pengguna pada login, DashboardLayout, dan access/routes.
- Ikuti DESIGN.md dan UI_DESIGN_SYSTEM_GUIDE.md; gunakan shell Emerald existing.
- PENDING/REJECTED tidak dihitung pada rekap.

## Review Focus
- Presensi paralel tidak menggandakan event.
- Pulang boleh saat masuk pending, termasuk lintas tanggal/zona.
- Wajah kosong/tidak cocok tidak menyimpan kehadiran.
- Perubahan foto pending tidak mengganti acuan aktif.
- Endpoint dan navigasi reviewer memakai permission yang sama.

## Tasks
- [x] Uji policy default, per-event switch, zona GPS dan overnight (red/green).
- [x] Migrasi flags shift, snapshot log, history review, pengajuan wajah, dan foto employee.
- [x] Ekstraksi wajah nyata server; tolak blank/multiple/mismatch, tanpa descriptor klien.
- [x] Transaksi clock, proyeksi approved-only, review, dan koreksi; integration tests.
- [x] API dan UI approval absensi/foto serta pengaturan shift.
- [x] Scanner, profil, lokasi, peta riwayat dan koreksi mobile.
- [x] Test backend/frontend, build, dan verifikasi UI yang tersedia.

## Ledger
- Terminal sandbox gagal inisialisasi; eskalasi disetujui otomatis. Lokasi fisik checkout /mnt/Data/code/ams-app.
- Perubahan existing dipertahankan; tidak ada deployment atau migrasi database live tanpa kebutuhan pengujian terisolasi.

- Review independen menemukan regresi zona meridian, legacy pending recap, legacy enrollment kosong, dan starvation antrean. Semua diperbaiki dengan tes regresi.
- Penyaringan recap legacy dilakukan saat membaca, tanpa penghapusan data asli; provenance membedakan impor/manual/koreksi.
- Runtime grants tabel/sequence diuji menggunakan role database non-owner.
- Pengguna mengizinkan pengiriman koordinat ke OpenStreetMap/Nominatim setelah pertanyaan izin eksplisit.
- MobileApprovalsPage.tsx diserahkan ke proses lain sesuai instruksi pengguna; hanya dibaca dan diuji setelah instruksi tersebut.
- Catatan untuk pemilik halaman approval: teks batas daftar perlu menyebut semua pending dan 500 keputusan terbaru.
- Build frontend dilakukan pada snapshot /tmp dengan webpack karena cache dev checkout dimiliki Docker dan Turbopack menolak symlink dependency snapshot.
- Build menemukan kontrak params tiket lama; koreksi hanya tipe Promise, tanpa perubahan perilaku.
