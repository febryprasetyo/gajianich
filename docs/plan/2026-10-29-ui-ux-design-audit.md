# Audit UI/UX GAJIANICH — 29 Oktober 2026

Status: audit sampel selesai; rekomendasi belum diimplementasikan. Tidak ada perubahan kode produk atau data server.

## Cakupan dan metode

Produk: aplikasi operasional internal HR, GA, IT dan aset. Tujuan audit: konsistensi terhadap Emerald Enterprise, kemudahan menemukan dan mengolah data, serta akses mobile dan keyboard.

Acuan: `UI_DESIGN_SYSTEM_GUIDE.md`, `DESIGN.md`, komponen shared UI, dan skill UI UX Designer / UX Audit and Design Critique. Arah desain tetap emerald, permukaan putih, latar slate, header modul konsisten, KPI sebagai filter, aksi baris berupa ikon dan data reaktif.

Browser Chromium mengakses frontend lokal `http://127.0.0.1:3000`. Halaman login ditinjau secara visual pada desktop. Halaman aset, tiket dan vendor ditinjau pada lebar 360, 390 dan 1440 px dengan tinggi 1000 px. Pemeriksaan keyboard tambahan dilakukan pada viewport 390 × 844. Autentikasi dan seluruh `/api/v1/**` di browser audit menggunakan fixture lokal, termasuk pengguna superadmin serta kelompok CMC/MGM. Data fixture bukan data operasional; angka KPI tidak dipakai untuk menilai kebenaran data. Tidak ada login akun nyata, submit formulir, mutasi server atau pemeriksaan izin backend.

Metode: tinjauan hierarki visual, konsistensi, visibility of system status, user control, recognition, error recovery, serta pemeriksaan DOM, hit testing, ukuran kontrol dan navigasi keyboard. Ini audit sampel, bukan sertifikasi aksesibilitas atau audit semua modul/role.

## Scorecard kualitatif

| Aspek | Penilaian sampel | Dasar |
|---|---|---|
| Identitas dan hierarki desktop | Baik | Emerald konsisten, H1 jelas, kartu dan toolbar terpisah |
| Konsistensi master desain | Sebagian | Tiket paling dekat acuan; header aset dan statistik vendor berbeda |
| Mobile | Perlu perbaikan prioritas | Pemilih kelompok menutup tombol navigasi; aksi tabel vendor berada di luar viewport awal |
| Keyboard dan label | Perlu perbaikan prioritas | Shift+Tab keluar dari modal; filter tidak memiliki label terhubung |
| Keterbacaan | Perlu perbaikan | Helper 10 px dengan kontras sekitar 2,63:1 terhadap putih |
| Status dan pemulihan | Sebagian | Empty state terlihat jelas; reset filter aset belum tersedia; error jaringan belum disimulasikan |

## Temuan berprioritas

P1 = major, menghambat akses/fungsi atau keterbacaan informasi. P2 = medium, menambah usaha atau mengurangi konsistensi. P3 = minor. Effort bersifat relatif: kecil = komponen/lokal, sedang = beberapa komponen atau variasi layout. Tidak ada temuan critical yang dikonfirmasi dalam sampel ini.

### 1. P1 — Pemilih kelompok menutup tombol navigasi mobile

- Bukti browser: pada 390 px, tombol “Buka navigasi” berada di x=16–56, y=11,5–51,5. Select “Kelompok aktif” berada di x=16–206, y=13–50. Hit test pada pusat tombol navigasi mengenai elemen lain. Screenshot memperlihatkan select di posisi tombol menu.
- Sumber: `frontend/src/components/layout/DashboardLayout.tsx:626` dan `frontend/src/components/layout/OrganizationScopeSelector.tsx:7`.
- Dampak: pengguna sentuh tidak dapat mengaktifkan menu melalui pusat tombol menu; ini lebih berat daripada perbedaan dekorasi.
- Heuristik: user control, flexibility and efficiency.
- Perbaikan: alokasikan lebar tetap dengan `shrink-0` untuk pemicu menu; buat area kanan dapat menyusut; ringkas informasi akun pada mobile atau pindahkan pemilih kelompok ke baris kedua. Uji juga state tanpa kelompok dan label kelompok panjang.
- Effort: sedang. Verifikasi penerimaan: tombol menu tampak dan lulus hit test pada 360/390 px, drawer dapat dibuka dan ditutup.
- [Bukti mobile](2026-10-29-design-audit-evidence/tickets-390.png).

### 2. P1 — Shift+Tab pertama keluar dari modal vendor

- Bukti browser: buka “New Vendor”; initial focus berada pada DIV di dalam dialog. Satu `Shift+Tab` memindahkan fokus ke BUTTON di luar `[role="dialog"]`.
- Sumber: `frontend/src/components/ui/ModalShell.tsx:50` dan `:80`. Fokus awal diberikan ke container, tetapi pembatasan reverse Tab hanya menangani kondisi fokus tepat di elemen pertama.
- Dampak: navigasi keyboard bisa kembali ke halaman yang tertutup overlay; urutan interaksi menjadi membingungkan.
- Heuristik: user control, error prevention.
- Perbaikan: gunakan focus trap yang menangani fokus awal container, fokus dari luar, elemen tersembunyi/nonaktif dan siklus maju/mundur; pertahankan pengembalian fokus ke pemicu saat modal ditutup.
- Effort: sedang. Verifikasi: dari initial focus, Tab dan Shift+Tab tetap di dialog; Escape menutup dialog saat diizinkan; fokus kembali ke pemicu.

### 3. P1 — Label pencarian/filter dan label form belum terhubung

- Bukti DOM: pencarian vendor, pencarian aset + tiga select, dan pencarian tiket + empat select tidak memiliki label terhubung atau `aria-label`. Placeholder/option awal tidak memberi label persisten untuk tujuan kontrol. Pemeriksaan kode form vendor juga menemukan `<label>` yang tidak terhubung lewat `htmlFor`/`id` dan tidak membungkus input.
- Sumber: `frontend/src/components/assets/AssetFilters.tsx:38`, `frontend/src/components/ui/FilterToolbar.tsx:43`, `frontend/src/app/dashboard/master/vendors/page.tsx:137`, `frontend/src/components/master/VendorFormModal.tsx:101`.
- Dampak: tujuan filter sulit dipahami pengguna pembaca layar, terutama setelah pilihan berubah. Label visual form tidak memindahkan fokus ke input saat diklik.
- Heuristik: recognition rather than recall, consistency.
- Perbaikan: label terlihat atau `sr-only` dengan `htmlFor`/`id`; beri nama seperti “Cari aset”, “Kategori aset”, “Lokasi aset”, “Status tiket”. Hubungkan semua label form ke input. Scope button dalam `FilterToolbar` juga sebaiknya mengumumkan pilihan melalui `aria-pressed`.
- Effort: kecil–sedang. Verifikasi: setiap kontrol memiliki accessible name yang tetap bermakna setelah diisi/dipilih.

### 4. P1 — Teks sekunder terlalu pucat dan kecil

- Bukti browser: helper “Menunggu penanganan” pada KPI tiket berukuran 10 px, warna computed `lab(65.5349 -2.25151 -14.5072)` di atas putih. Konversi browser ke sRGB menghasilkan sekitar RGB(144,161,185); perhitungan luminansi memberi kontras 2,63:1.
- Sumber: `frontend/src/modules/ticket/components/TicketStats.tsx` dan helper serupa di `frontend/src/components/ui/KpiGrid.tsx:98`.
- Dampak: deskripsi status lebih sulit dibaca, terutama pada layar kecil. Kontras rendah juga berasal dari token yang direkomendasikan panduan master, sehingga perlu penyelarasan panduan dan komponen.
- Acuan: teks normal membutuhkan minimal 4,5:1 menurut [W3C SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Perbaikan: gunakan slate yang lebih gelap, ukur kembali terhadap background aktual, dan naikkan helper penting ke 12 px atau lebih sesuai kepadatan yang dibutuhkan. Pertahankan hierarki melalui weight/spacing.
- Effort: kecil. Verifikasi: ukur pasangan warna di semua state normal/aktif.

### 5. P2 — Halaman master aset sendiri menyimpang dari header baku

- Bukti visual/kode: aset menggunakan ikon emerald tanpa kotak latar emerald; tiket menggunakan kotak emerald. Subtitle serta CTA aset banyak memakai monospace dan bahasa Inggris, sementara tiket memakai Bahasa Indonesia. Header aksi aset membungkus menjadi dua baris pada desktop sampel.
- Sumber: `frontend/src/app/dashboard/assets/page.tsx:202`; bandingkan `frontend/src/components/ui/PageHeader.tsx` dan panduan master.
- Dampak: halaman referensi tidak memberi contoh tunggal yang konsisten untuk pengembangan berikutnya.
- Heuristik: consistency and standards.
- Perbaikan: selaraskan header aset dengan `PageHeader`, label aksi utama serta urutan aksi. Tetapkan istilah bahasa antarmodul; pertahankan istilah teknis yang diperlukan.
- Effort: kecil–sedang. [Bukti aset desktop](2026-10-29-design-audit-evidence/assets-1440.png).

### 6. P2 — Statistik vendor tidak berfungsi sebagai filter dan daftar belum berpaginasi

- Bukti: dua kartu “Registered Vendors”/“With Contact Person” dibuat sebagai DIV tanpa handler. Filter daftar hanya berdasarkan pencarian. Halaman merender seluruh hasil vendor tanpa `TablePagination`.
- Sumber: `frontend/src/app/dashboard/master/vendors/page.tsx:109`, `:158`; `frontend/src/components/master/VendorTable.tsx:68`.
- Dampak: pola KPI berbeda dari tiket dan persyaratan master; daftar panjang menambah scrolling. Dampak volume besar belum diuji karena fixture hanya satu vendor.
- Heuristik: consistency, flexibility and efficiency.
- Perbaikan: gunakan `KpiGrid` dengan filter semua/berkontak dan badge Aktif; tambahkan pagination dan info rentang record melalui komponen baku.
- Effort: sedang. Verifikasi: klik KPI mengubah hasil; perubahan filter mengembalikan halaman ke awal.

### 7. P2 — Filter aset belum menyediakan Reset Filter

- Bukti kode: `AssetFilters` hanya menerima search dan tiga select; tidak ada tombol atau callback reset terpadu. Pencarian vendor juga tidak memiliki clear/reset khusus.
- Sumber: `frontend/src/components/assets/AssetFilters.tsx:32`.
- Dampak: setelah kombinasi pencarian/kategori/lokasi/status menghasilkan kosong, pengguna perlu mengembalikan pilihan satu per satu.
- Heuristik: user control, error recovery.
- Perbaikan: tampilkan Reset Filter saat ada filter aktif, kosongkan pencarian, kembalikan select ke ALL dan halaman ke 1; ikuti `FilterToolbar`.
- Effort: kecil. Verifikasi: reset membersihkan seluruh filter dalam satu aksi dan memuat hasil otomatis.

### 8. P2 — Aksi tabel vendor sulit ditemukan pada mobile

- Bukti visual: pada 390 px hanya kolom awal dan sebagian kontak terlihat; kolom aksi berada di sisi kanan area scroll horizontal. Tidak ada petunjuk geser yang terlihat di screenshot. Scroll berada di container tabel, bukan overflow halaman secara keseluruhan.
- Sumber: `frontend/src/components/master/VendorTable.tsx:53` dan `:103`.
- Dampak: pengguna bisa tidak menemukan edit/hapus sebelum menggeser tabel.
- Heuristik: recognition rather than recall, flexibility.
- Perbaikan: pertahankan tabel desktop; untuk mobile gunakan baris ringkas/kartu dengan aksi selalu terlihat atau kolom aksi sticky yang tidak menutup data. Petunjuk geser dapat membantu bila tabel tetap dipakai.
- Effort: sedang. [Bukti vendor mobile](2026-10-29-design-audit-evidence/vendors-390.png).

### 9. P2 — Target aksi baris kecil untuk sentuhan

- Bukti browser: tombol edit/hapus vendor 26 × 26 px; CTA tambah vendor/tiket/aset sekitar 32 px tinggi. `RowActionButton` memakai ikon 14 px dengan padding 6 px, sehingga default-nya juga sekitar 26 px tanpa override.
- Sumber: `frontend/src/components/master/VendorTable.tsx:105`, `frontend/src/components/ui/RowActionButton.tsx:35`.
- Dampak: aksi berdampingan membutuhkan ketelitian sentuh. Tombol vendor memakai title tetapi belum memiliki `aria-label` eksplisit sesuai aturan proyek; title dapat memberi fallback accessible name, sehingga tidak dinyatakan sepenuhnya tanpa nama.
- Perbaikan: target praktis 44 × 44 px pada layar sentuh, ikon boleh tetap kecil; gunakan komponen bersama dan label spesifik konteks.
- Catatan standar: ukuran 26 px bukan otomatis pelanggaran minimum AA; [W3C SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) menetapkan 24 × 24 px dengan pengecualian. Rekomendasi 44 px di sini untuk kenyamanan sentuhan.
- Effort: kecil–sedang.

## Lima perbaikan awal

1. Pulihkan ruang pemicu navigasi pada header mobile (#1).
2. Tangani reverse Tab dari initial focus modal (#2).
3. Hubungkan label search/filter/form (#3).
4. Gelapkan helper text dan ukur kontras ulang (#4).
5. Tambahkan reset terpadu pada aset (#7).

Tahap berikutnya: konsistensi header, KPI/pagination vendor, aksi tabel mobile dan ukuran target (#5, #6, #8, #9). Tidak diperlukan penggantian total identitas visual.

## Hasil verifikasi dan batasnya

- Sembilan kombinasi halaman/viewport selesai dirender dan diukur; metrik tersimpan di [metrics.json](2026-10-29-design-audit-evidence/metrics.json).
- Hit testing header, fokus KPI, dan reverse Tab modal dicatat di [browser-output.txt](2026-10-29-design-audit-evidence/browser-output.txt).
- Fokus KPI tiket tetap memiliki outline terlihat pada runtime yang diuji; kelas `focus:outline-none` tidak dijadikan temuan hilangnya fokus karena bukti browser tidak mendukungnya.
- Tidak ditemukan overflow horizontal dokumen pada tiga halaman dan tiga ukuran sampel. Overflow tabel vendor memang berada di container tersendiri.
- Angka KPI tiket dan daftar kosong berasal dari fixture independen; perbedaan keduanya bukan temuan inkonsistensi data.
- Login hanya diperiksa visual desktop. Seluruh modul HR, GA, presensi `/m`, role selain superadmin, kondisi data padat, error jaringan, zoom 200%, pembaca layar dan browser lain belum diaudit.
- Tidak menjalankan typecheck/lint/unit test karena audit tidak mengubah kode produk; pemeriksaan browser ini tidak menyatakan suite aplikasi lulus.
- Checkpoint: laporan dan bukti tersedia lokal, belum ada implementasi perbaikan, commit atau deployment.
