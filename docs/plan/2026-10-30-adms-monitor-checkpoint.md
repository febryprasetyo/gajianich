# Aktivasi receiver dan monitoring ADMS — 30 Oktober 2026

Status: receiver development berjalan sehat dan halaman monitoring aktif. Belum menerima heartbeat/log dari mesin fisik; pengaturan ADMS perangkat belum diubah oleh agen. Tidak ada data presensi sintetis dimasukkan ke DB aktif.

## Aktivasi

- Container `gajianich-adms-adms-1`, listener [192.168.10.212:8081](http://192.168.10.212:8081/health/ready), readiness HTTP200, Docker healthy.
- Database bersama Gajianich development `ams_dev_db`, hostname service `postgres`, external network `ams-dev_default`. Alias `http://adms:8081/health/ready` terbukti dapat dijangkau dari container backend.
- Backup sebelum migrasi: `/tmp/adms-activation-ykh0bg7n.dump`, mode 0600. Konfigurasi `adms-server/.env` mode 0600 diabaikan Git; credential tidak dicetak.
- Kolom migrasi backend 0038 sudah ada; migrasi schema ADMS versi1 berhasil diterapkan. Backend/frontend memakai bindmount kode aktual, tidak membuat stack atau PostgreSQL kedua.
- Gudang 2 belum terdaftar pada database awal. Pengguna mengonfirmasi grup **CMC — Cahaya Mas Cemerlang**, kemudian mesin dibuat/didaftarkan sebagai ID **3**, nama **Absensi Gudang 2**, IP 192.168.0.80:4370, serial GSY1254900014, platform ZAM70_TFT, firmware Ver6.60 Apr28 2025. Allowlist 192.168.0.80/32, source_id NULL. Tidak menyamakan deviceId dengan attendanceSourceId.
- Saat verifikasi akhir: satu mesin ADMS terdaftar, online 0, receipt 0, dan seluruh log mentah Gajianich tetap **5430**. Ini kondisi aktual, bukan seed/demo. Perangkat menunggu alamat server 192.168.10.212 dan port 8081 diatur pada menu ADMS/Cloud Server.

## Monitoring

[Halaman aktif](http://192.168.10.212:3000/dashboard/attendance/adms), menu **Mesin Presensi → Monitoring ADMS**. Login Gajianich dan permission operasional `attendance.import` atau `attendance.manage`, scopeHR existing. Port 8081 tidak menyediakan admin monitoring publik.

- API GET `/api/v1/attendance/devices/adms/monitor`, health listener timeout 2500 ms dan semua ringkasan, mesin, jumlah receipt, filter dan pagination dibatasi grup organisasi. Tidak mengembalikan payload mentah/credential. Cache-Control no-store.
- UI memakai PageHeader, KpiGrid, FilterToolbar, TableShell, TablePagination, StatusBadge; master emerald, KPI yang dapat diklik untuk memfilter, empty/error/stale states dan polling berurutan setiap 5 detik tanpa refresh manual. Request 10 detik timeout, abort pada scope/query/unmount, kegagalan API tidak berarti server terbukti offline.
- Review independen menemukan izinmanage-only tidak cocok dan request yang macet dapat membuat status tersimpan tetap hijau. Keduanya diperbaiki, ditambahkan tes, review ulang menyatakan tertutup tanpa blocker lain.
- Keterangan KPI dibungkus pada mobile dengan override khusus halaman ini; komponen bersama atau halaman lain tidak dirombak.

## Verifikasi

- Backend unit/pure + PostgreSQL disposable monitoring: **3/3 lulus**, termasuk isolasi grup pada agregat/counter/pagination, filter, page di luar rentang, no secretpayload, healthfailed dan scopenonHR ditolak.
- Regresi backend terkait: **9/9 lulus** (dua tes monitoring unit juga termasuk dalam angka ini), typecheck `npm run build --prefix backend` lulus.
- Frontend tes akses/polling: **24/24 lulus**; typecheck `tsc --noEmit` serta ESLint file terkait lulus. Pengujian mencakup import-only/manage-only/view-only, cancel/unmount, request yang macet, timeout 10 detik, dan pemulihan pada polling berikutnya.
- Browser Chromium dengan Node 24 yang tersedia: API aktual 200, server ready true, Gudang 2 offline, receipt 0; polling berulang dan KPI dan reset filter berfungsi; desktop 1440×1000 dan mobile 390×844, tanpa error halaman atau overflow viewport. Kegagalan API 503 disimulasikan hanya di browser untuk membuktikan stale-warning dan pemulihan otomatis; Database tidak ditulis. Tanpa token API 401 dan browser dialihkan ke login dengan parameter redirect.
- Dua kegagalan harness awal bukan bug produk: Node18 tidak didukungPlaywright (beralih ke Node 24 yang tersedia), locator nama mesin harus sesuai `Absensi Gudang 2`, dan URL login menambahkan parameter redirect. Diperbaiki lalu diuji ulang.
- Evidence [desktop](./2026-10-30-adms-monitor-evidence/desktop.png), [mobile](./2026-10-30-adms-monitor-evidence/mobile.png). Log browser: `/tmp/gajianich-adms-monitor-browser-verification.log`.
- Scoped diffcheck lulus. Tidak mengklaim seluruh suite backend/frontend atau build produksi Next.js dijalankan. Perubahan/dokumen tugas lain dipertahankan.

## Batas hasil

Receiver sudah berjalan dan monitoring dapat dipakai. Dukungan protokol firmware fisik dan pengiriman ulang saat jaringan putus masih perlu diuji setelah pengaturan mesin diarahkan ke receiver. Kalkulasi hasil kehadiran final tetap melalui alur existing; monitoring hanya membaca status/log. Format ekspor fisik pengguna belum diberikan, impor historis tetap sesuai TSV yang didokumentasikan.

## Pengujian dialihkan ke Absensi Office

Pengguna memilih menguji mesin Absensi Office `192.168.10.224:4370`. Pemeriksaan menunjukkan mesin ID1, grupCMC, serial `WAE4242900026` masih Ethernet dan belum ada registrasi ADMS. Mesin tersebut didaftarkan melalui CLI dengan allowlist `192.168.10.224/32`; connection_type menjadi ADMS, sehingga endpoint tarik TCP tidak digunakan selama pengujian ini. Gudang2 tetap terdaftar. Tidak mengubah pengaturan mesin fisik.

Verifikasi CLI berhasil dan status registry menunjukkan Office menunggu heartbeat (`online=false`, last_seen_atNULL). Receipt tetap0 dan jumlah log mentah tetap5430. Status menampilkan255 log Office lama yang belum terpetakan; angka ini berasal dari riwayat existing, bukan data ADMS baru. Pengguna perlu mengarahkan ADMS Office ke192.168.10.212 port8081 bila firmware menyediakan menu tersebut.
