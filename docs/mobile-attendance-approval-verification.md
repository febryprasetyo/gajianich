# Verifikasi approval presensi mobile

Implementasi memakai master GAJIANICH / Emerald Enterprise, DashboardLayout, ModalShell, StatusBadge, font dan token existing. Tidak ada tema atau shell baru. ENERGY 1 / RHYTHM 1 / MOTION 1 mengikuti aplikasi ERP.

## Bukti pengujian

- Frontend: 192 tes lulus; lint seluruh frontend lulus.
- Backend suite terakhir: 300 tes, 299 lulus, satu tes `GA API saves complete requests, protects evidence, handles drafts, status transitions, and signed documents` terputus dengan `terminating connection due to administrator command`. Tes GA tersebut lulus pada pengujian ulang terpisah.
- Pengujian integrasi approval/clock terbaru: 13 tes lulus.
- Regresi khusus terbaru: approval, koreksi, pending masuk/pulang terpisah, rekap legacy, status riwayat mesin, wajah tanpa acuan/mismatch, enrollment awal/legacy kosong, penggantian foto, antrean melebihi 500 keputusan, permission reviewer, akses privat foto, runtime grants, WIB/WITA/WIT dan shift malam.
- Build backend lulus. Build frontend produksi dengan webpack pada snapshot temporer lulus, termasuk route approval dan ketiga halaman mobile.
- Tujuh skenario Playwright Chromium lulus: mobile pada 360/768/1280px, reviewer pada 360/1280px, scanner mismatch dan scan ulang, serta pendaftaran foto pertama/perubahan pending.
- Kamera pada pengujian browser memakai stream simulasi. Detektor model server diuji menolak gambar tanpa wajah; tes transaksi memakai recognizer terisolasi. Kamera fisik dan akurasi wajah pada perangkat pengguna belum diuji.
- Review independen selesai, seluruh temuan P1/P2 yang dilaporkan sudah diperbaiki dan diuji ulang.

## Checklist desain untuk perubahan yang dikerjakan

- PASS: identitas visual dan pola komponen mengikuti master; tidak mengganti font, palet, ikon atau shell.
- PASS: aksi baru memiliki handler/API nyata dan permission server; role khusus dibuktikan melalui HTTP dan browser.
- PASS: loading, kosong, error, submitting dan penolakan ditampilkan; tidak ada skor kecocokan atau klaim liveness simulasi.
- PASS: label formulir terhubung, tombol memiliki nama aksesibel, Escape menutup scanner, dan fokus memakai komponen/global existing.
- PASS: CTA baru memakai emerald-700 dengan teks putih; status memakai varian semantik StatusBadge.
- PASS: layout mobile dan reviewer tidak overflow pada viewport yang diuji setelah breadcrumb shell diperbaiki.
- PASS: foto, status pendaftaran dan daftar review berasal dari API; data contoh hanya ada pada fixture tes.
- PASS: implementasi berada pada sumber TS/TSX dan skema/migrasi SQL, tanpa patch runtime antarmuka.
- PASS: git diff --check bersih; perubahan pengguna yang sudah ada dipertahankan.

## Catatan operasional dan serah-terima

- Migrasi baru: backend/drizzle/0023_mobile_approvals.sql. Pengujian migrasi dilakukan pada database disposable. Tidak melakukan deployment atau migrasi database produksi.
- Pengaturan aktif berarti otomatis disetujui. Default shift baru nonaktif; tanpa penugasan shift selalu HRD.
- OpenStreetMap/Nominatim telah diizinkan eksplisit oleh pengguna.
- Pengguna meminta MobileApprovalsPage.tsx tidak diedit karena dikerjakan proses lain. File itu dibaca dan diuji tanpa ditulis setelah instruksi tersebut. Pemilik halaman perlu mengganti teks batas daftar menjadi: "Seluruh pengajuan menunggu review dan 500 keputusan terbaru."
