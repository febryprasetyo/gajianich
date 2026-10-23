# Mobile Attendance Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Dokumen ini hanya rencana; jangan mulai implementasi tanpa instruksi pengguna.

**Goal:** Memperbaiki tujuh temuan audit tanpa mengubah aturan approval yang sudah disepakati.

**Architecture:** Pertahankan service transaksi clock/proyeksi dan resolver jadwal existing; tambahkan perlindungan konflik pada sumber data independen serta satu resolusi penugasan aktif untuk jadwal dan approval. Perbaiki kontrak summary kosong, state permintaan halaman presensi, dan dialog detail melalui komponen bersama. Tidak merencanakan migrasi database.

**Tech Stack:** TypeScript, Express, Drizzle/PostgreSQL, Next.js/React, node:test/tsx, Playwright.

**Spec:** [Spesifikasi perbaikan](../specs/2026-10-23-mobile-attendance-audit-fixes-design.md).

## Global Constraints

- Pertahankan tema GAJIANICH / Emerald Enterprise, token global, DashboardLayout, ModalShell, dan StatusBadge existing.
- Pertahankan perubahan pengguna dan proses lain di checkout; koordinasikan pemilik file sebelum implementasi.
- Saklar aktif berarti otomatis disetujui; default mati berarti review HRD. Masuk dan pulang memiliki aturan terpisah.
- Karyawan tanpa penugasan shift aktif wajib review masuk dan pulang meskipun jadwal memakai shift default.
- PENDING dan REJECTED tidak dihitung sebagai kehadiran; koreksi hanya keterangan dengan waktu, zona dan lokasi asli.
- Pemeriksaan wajah tetap di server; tanpa acuan atau tidak cocok ditolak. Foto pertama langsung aktif; penggantian menunggu HRD.
- Waktu presensi berdasarkan GPS WIB/WITA/WIT; pulang mempertahankan zona presensi masuk.
- Akses reviewer tetap melalui attendance.mobile.verify. Koordinat dan peta tetap memakai integrasi yang sudah diizinkan pengguna.

## Review Focus

1. Impor/manual masuk di antara pengajuan PENDING dan approval: keputusan gagal atomik, bukti independen tetap utuh (Task 1).
2. Shift individual nonaktif tetapi shift divisi aktif: jadwal dan approval menggunakan divisi; fallback default tidak otomatis menyetujui (Task 2).
3. Jam mesin lintas tengah malam atau tidak lengkap: durasi benar atau --, tanpa mengubah record (Task 3).
4. Respons periode lama datang setelah periode baru: tidak mengganti daftar; error summary tidak menjadi status wajah palsu (Task 5).
5. Koreksi sedang dikirim ketika Escape/backdrop diklik: dialog tetap terbuka dan keterangan bertahan saat error (Task 6).

## Peta file dan urutan

| Task | File produksi | Tes |
|---|---|---|
| 1 / FIX-01 | backend/src/services/mobileAttendanceService.ts | backend/src/services/mobileClock.integration.test.ts; mobileApprovals.integration.test.ts pada direktori sama |
| 2 / FIX-02 | backend/src/domain/attendanceSchedule.ts; backend/src/services/mobileAttendanceService.ts | backend/src/domain/mobileApproval.test.ts; backend/src/services/mobileClock.integration.test.ts |
| 3 / FIX-03 | backend/src/services/mobileAttendanceService.ts | backend/src/services/mobileApprovals.integration.test.ts |
| 4 / FIX-05 | backend/src/services/mobileAttendanceService.ts; frontend/src/lib/attendance/mobileApi.ts; frontend/src/app/m/beranda/page.tsx | backend/src/services/mobileApprovals.integration.test.ts; tests/mobile-attendance-approval.spec.ts |
| 5 / FIX-04 | frontend/src/app/m/presensi/page.tsx | tests/mobile-attendance-approval.spec.ts |
| 6 / FIX-06 | frontend/src/components/mobile/DayDetailSheet.tsx; AttendanceEventDetails.tsx pada direktori sama | tests/mobile-attendance-approval.spec.ts |
| 7 / FIX-07 | frontend/src/components/attendance/MobileApprovalsPage.tsx | tests/mobile-attendance-approval.spec.ts |

Task 1 didahulukan karena risiko perubahan bukti absensi. Kerjakan task berurutan pada checkout bersama; jangan membuat agen paralel yang menulis service atau tes yang sama. Tidak perlu membuat abstraksi baru untuk perbaikan teks atau tipe saja.

## Task 1: Cegah mobile menimpa record independen

**Interfaces:** Pertahankan recordMobileClock, projectApprovedLog dan verifyAttendanceRecord beserta bentuk responsnya. Error konflik menggunakan jalur error controller existing. Jangan memperluas API koreksi.

- [x] Tambahkan tes clock: insert record impor dengan scanIn/rawScanIn=08:00 dan sourceBatchId nyata; mobile IN ditolak; jumlah log dan foto tidak bertambah; seluruh field record tetap sama. Ulangi sumber manual dan record dengan OUT yang sudah ada.
- [x] Tambahkan tes review: buat mobile IN PENDING, lalu insert record mesin sebelum approval; review ditolak; log tetap PENDING dan record identik. Uji transaksi paralel memakai penguncian tanggal existing.
- [x] Jalankan dua berkas tes service Task 1 dari backend dengan npx tsx --test --test-concurrency=1; pastikan tes baru gagal pada perilaku lama, bukan karena fixture rusak.
- [x] Perbaiki pemeriksaan duplikat dalam transaksi clock dan pemeriksaan konflik sebelum proyeksi. Gunakan urutan lock karyawan lalu tanggal yang konsisten dengan jalur existing. Bedakan record proyeksi mobile yang terbukti dimiliki alur ini dari record independen; tolak kepemilikan ambigu. Jangan merombak helper penyaring legacy tanpa kebutuhan yang dibuktikan tes.
- [x] Tambahkan kontrol positif: mobile IN approved lalu OUT approved tetap memperbarui record miliknya; pending/rejected tetap tidak dihitung. Jalankan kembali dua berkas sampai seluruh tes lulus.
- [x] Review diff dan buat checkpoint hanya dari berkas milik task setelah memeriksa perubahan proses lain; jangan git add seluruh checkout.

## Task 2: Gunakan penugasan aktif yang sama

**Interfaces:** Tambahkan export resolveAssignedEmployeeShift(employee, shifts, assignments): WorkShift | null pada attendanceSchedule.ts, dengan tipe parameter sama seperti resolveEmployeeShift. resolveEmployeeShift tetap menghasilkan WorkShift dan memakai resolver baru sebelum fallback. shiftForEmployee memakai hasil resolver baru sebagai approvalShift.

- [x] Tambahkan tes urutan individual aktif > divisi aktif, individual nonaktif > divisi aktif, keduanya tidak aktif > null. Tambahkan tes integrasi masuk/pulang dengan kombinasi flag true/false berbeda untuk membuktikan flag yang dipakai berasal dari shift yang sama dengan jadwal.
- [x] Jalankan mobileApproval.test.ts dan mobileClock.integration.test.ts dari backend; konfirmasi regresi penugasan gagal sebelum implementasi.
- [x] Terapkan resolver aktif dan gunakan pada kedua jalur; shift default hanya untuk jadwal jika tidak ada penugasan.
- [x] Jalankan dua berkas tes hingga lulus; verifikasi tanpa penugasan tetap PENDING meskipun shift default menyalakan kedua saklar.
- [x] Review diff dan simpan checkpoint task dengan berkas spesifik.

## Task 3: Pulihkan durasi mesin

**Interfaces:** Bentuk respons getMobileAttendanceHistory tetap sama; workHours tetap string. Gunakan formatDurationMinutes existing. Tidak menambah approvalStatus untuk record mesin.

- [x] Tambahkan tes history mesin 08:00–17:00 = 09h 00m; jadwal malam 22:00–06:00 = 08h 00m; jam hilang/tidak valid = --. Pastikan fixture record tidak memiliki self log.
- [x] Jalankan mobileApprovals.integration.test.ts dari backend dan konfirmasi fallback durasi belum memenuhi tes.
- [x] Tambahkan fallback durasi hanya untuk record independen tanpa event mobile. Validasi jam sebelum menghitung, dan gunakan jadwal untuk lintas tengah malam; pertahankan occurredAt untuk pasangan mobile approved.
- [x] Uji mobile IN approved/OUT pending serta rejected tetap --; pastikan record tidak berubah sesudah history dibaca. Jalankan tes hingga lulus.
- [x] Review diff dan simpan checkpoint task.

## Task 4: Benarkan status summary dan detail beranda

**Interfaces:** MobileTodayAttendance.approvalStatus berubah menjadi PENDING | APPROVED | REJECTED | null; status event dan respons clock tetap non-null. getMobileTodaySummary mengirim null hanya jika tidak ada event. Pemakai summary menangani null secara eksplisit.

- [x] Tambahkan tes summary tanpa log: checkedIn=false, checkedOut=false, approvalStatus=null. Tambahkan browser fixture tanpa event: Belum ada pengajuan tampil dan badge Disetujui tidak tampil.
- [x] Tambahkan browser test detail NOT_CHECKED_IN, CHECKED_IN, COMPLETED; hasil masing-masing Belum absen, Sudah absen masuk, Presensi lengkap. Uji COMPLETED yang masih PENDING/REJECTED agar kedua dimensi status tetap terpisah.
- [x] Jalankan service test dan Playwright terkait; pastikan assertion baru gagal pada implementasi lama.
- [x] Perbaiki summary kosong, tipe API, state attendanceState beranda, dan semua cabang badge/kartu pengajuan terakhir. Hilangkan inferensi TEPAT_WAKTU dari CHECKED_IN.
- [x] Jalankan tes, TypeScript backend/frontend, dan pencarian semua pemakai approvalStatus dari summary agar tidak ada cabang null yang dianggap approved/pending.
- [x] Review diff dan simpan checkpoint task.

## Task 5: Kelola error dan respons periode presensi

**Interfaces:** Pertahankan fetchMobileSummary() dan fetchMobileHistory(period). Kelola hasilnya secara independen di halaman; gunakan identitas permintaan agar hanya respons periode aktif yang diterapkan. Tidak mengubah kontrak API untuk state loading/error lokal.

- [x] Tambahkan browser test history gagal: pesan error dan Coba lagi tampil, pesan data kosong tidak tampil. Retry sukses menampilkan record periode yang sama.
- [x] Tambahkan browser test summary gagal/history sukses: riwayat tetap dapat dibaca, tombol scan dinonaktifkan, dan kegagalan tidak dianggap wajah belum terdaftar.
- [x] Tambahkan browser test respons CURRENT lambat, pindah PREVIOUS lalu respons PREVIOUS sukses: respons CURRENT yang tiba kemudian tidak mengubah daftar. Tambahkan hasil sukses kosong sebagai kontrol.
- [x] Jalankan Playwright terkait dan konfirmasi tes gagal pada penanganan catch(() => null) existing.
- [x] Pisahkan state pemuatan/error summary dan history; invalidasi daftar saat berganti periode, abaikan respons usang, sediakan retry berlabel Coba lagi dan blokir scan saat summary belum valid. Ikuti alur error sesi existing.
- [x] Jalankan Playwright hingga lulus, termasuk perubahan periode saat request retry berjalan. Review diff dan simpan checkpoint task.

## Task 6: Pindahkan detail dan koreksi ke ModalShell

**Interfaces:** Pertahankan props publik DayDetailSheet. Tambahkan onBusyChange?: (busy: boolean) => void pada AttendanceEventDetails; laporkan perubahan pending request koreksi ke parent. DayDetailSheet meneruskannya ke isLoading ModalShell, serta mereset state busy saat ditutup/dibuka kembali tanpa request aktif.

- [x] Tambahkan browser test fokus masuk dialog, Tab/Shift+Tab tidak keluar, Escape menutup, dan fokus kembali ke baris/pemicu.
- [x] Tambahkan browser test koreksi tertunda: Escape/backdrop tidak menutup dan submit kedua dicegah. Saat API gagal, dialog, isi keterangan dan pesan error tetap tersedia; retry dapat dijalankan.
- [x] Jalankan tes dan konfirmasi kekurangan interaksi pada dialog lama.
- [x] Gunakan ModalShell existing, hapus overlay/scroll-lock lokal yang digantikannya, hubungkan status pengiriman koreksi, dan pertahankan foto, peta, riwayat, serta onUpdated setelah sukses. Hindari id judul tetap yang dapat ganda.
- [x] Uji 360, 390, 768 dan 1280 px: tanpa overflow halaman, konten panjang dapat digulir, judul dan aksi tetap terjangkau. Periksa label, fokus, kontras dan target sentuh sesuai master.
- [x] Review diff dan simpan checkpoint task.

## Task 7: Selaraskan teks antrean

**Interfaces:** API reviewer dan batas query tidak berubah.

- [x] Pastikan tidak ada proses lain yang sedang menulis MobileApprovalsPage.tsx sebelum mulai; instruksi penghindaran file pada pekerjaan sebelumnya tetap menjadi konteks koordinasi.
- [x] Ubah teks menjadi persis: Seluruh pengajuan menunggu review dan 500 keputusan terbaru.
- [x] Perbarui assertion browser reviewer untuk teks baru; pastikan pending lama tetap terlihat ketika jumlah keputusan melewati 500 melalui tes integrasi existing. Tidak perlu unit test yang hanya mencocokkan string sumber.
- [x] Jalankan tes terkait dan review diff, lalu simpan checkpoint task.

## Task 8: Verifikasi gabungan dan penutupan

Perintah dijalankan dari direktori yang disebut. Database integrasi harus memakai HR_AUDIT_TEST_DATABASE_URL yang diterima helper createHrAuditTestDatabase; jangan mengarahkan fixture ke database utama.

- [x] Backend, subset inti setelah setiap task service:

```bash
npx tsx --test --test-concurrency=1 src/domain/mobileApproval.test.ts src/domain/attendanceTime.test.ts src/domain/approvedMobileAttendance.test.ts src/services/mobileClock.integration.test.ts src/services/mobileApprovals.integration.test.ts src/routes/mobileApprovalAccess.integration.test.ts
```

- [x] Backend, setelah seluruh perubahan service selesai:

```bash
npm test
npx tsc --noEmit
```

- [x] Frontend, setelah perubahan UI selesai:

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

- [x] Root proyek, gunakan server verifikasi yang dikontrol pelaksana dan base URL aktual:

```bash
npx playwright test tests/mobile-attendance-approval.spec.ts --project=chromium --reporter=list
```

Jika server sudah tersedia, set PLAYWRIGHT_BASE_URL ke URL tersebut agar konfigurasi tidak memulai server kedua. Kegagalan build akibat cache milik proses lain harus dicatat dan diselesaikan lewat lingkungan verifikasi terisolasi; jangan menghapus cache yang sedang dipakai proses lain.

- [x] Root proyek: git diff --check. Review regresi wajah, zona waktu, permission, peta dan koreksi dengan suite existing; jangan mengklaim kamera fisik atau akurasi biometrik sudah diuji dari fixture browser.
- [x] Catat hasil aktual di laporan verifikasi baru untuk perbaikan ini, termasuk command, hasil gagal/retry, batas pengujian dan checklist master. Jangan menimpa bukti historis agar terlihat seolah tes lama mencakup perbaikan baru.
- [x] Update TODO docs/readme.md hanya setelah item benar-benar diterapkan dan bukti relevan tersedia. Jangan menandai checklist rencana berdasarkan tes baseline.

## Self-review rencana

Pemetaan lengkap: FIX-01 → Task 1; FIX-02 → Task 2; FIX-03 → Task 3; FIX-04 → Task 5; FIX-05 → Task 4; FIX-06 → Task 6; FIX-07 → Task 7. Task 8 menguji gabungan dan mendokumentasikan hasil. Lima Review Focus memiliki tes pada task pemiliknya. Status dokumen: Selesai dan terverifikasi penuh pada 23 Oktober 2026.
