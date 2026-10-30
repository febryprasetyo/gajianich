# ADMS Monitoring Implementation Plan

**Goal:** Jalankan container receiver dan monitoring terautentikasi yang menampilkan data aktual.
**Spec:** ../specs/2026-10-30-adms-monitor-design.md
**Architecture:** ADMS standalone pada DBexisting; backend APIreadonly scoped; React polling memakai reusable UI.

- [x] Backup, konfigurasi .env private, migrasi receiver dan start container; registrasi hanya setelah grup diketahui.
- [x] Tulis tes validasi/probe/query; implementasikan monitoring backend dan rute dengan permission/scope.
- [x] Implementasikan halaman, navigasi dan akses route; states fresh/stale/error/empty dan polling5detik.
- [x] Jalankan tes scoped backend/frontend dan verifikasi browser, reviewkode, checkpoint/todo.

## Review focus

- Semua jalur query group-scoped termasuk agregat dan countpagination.
- Tidak ada payload atau credential dalam JSONmonitoring.
- Stale client data tidak tampil sebagai live dan requestscope lama dibatalkan.
- DBaktif tidak diberi seeddata/simulasireceipt.
- Listener healthy tidak sama dengan mesin sudah terhubung; laporkan keduanya.

## Hasil eksekusi

- GrupGudang2 diminta dan dikonfirmasiCMC sebelum penciptaan/registrasimesin. IDaktual3.
- Backup/migrasi/receiveraktif di developmentexisting; tidak membuat data presensisimulasi.
- Reviewmenemukan mismatchizinmanage-only dan polltanpadeadline; diperbaiki dan direviewulang.
- Backendquerytest terisolasi, frontendtype/lint/24tests, sertabrowseraktual desktop/mobile/poll/filter/errorrecovery/loginredirect lulus. Rincian dan batasbukti pada docs/plan/2026-10-30-adms-monitor-checkpoint.md.
