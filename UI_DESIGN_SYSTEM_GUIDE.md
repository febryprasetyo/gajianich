# Master Desain GAJIANICH / AMS — Emerald Enterprise

> **Golden Rule**: Dilarang keras menggunakan gaya "AI Vibe" (background kartu gelap, gradient ungu/indigo/neon, glow shadow, floating glassmorphism, atau pill badge bertumpuk yang aneh).  
> **Dasar global**: token, identitas brand, shell, dan komponen bersama aplikasi saat ini. Referensi halaman pada bagian 8 merupakan contoh sesuai konteks, bukan template wajib.
> Seluruh halaman master data, rekapitulasi, pengaturan, dan transaksi di dashboard AMS **wajib** mengikuti struktur, warna, dan komponen di dokumen ini.

---


## 0. Status master dan aturan untuk agen

**Berlaku sejak 19 Oktober 2026.** Dokumen ini adalah acuan normatif tunggal untuk desain aplikasi.
Arah desain berasal dari instruksi pengguna untuk mempertahankan tema yang sudah dipakai.
Tidak diperlukan pemilihan arah visual baru untuk setiap fitur.

Urutan acuan visual:

1. Instruksi eksplisit pengguna untuk perubahan desain pada tugas yang sedang dikerjakan.
2. Master ini, termasuk aturan aksesibilitas pada bagian 10.
3. Komponen referensi pada bagian 8, sesuai jenis halaman.
4. Catatan kebutuhan halaman atau modul yang tetap tunduk pada master.

Contoh kelas dan rujukan kode menjelaskan pemakaian tema, bukan menentukan susunan semua halaman.
Saat mengadaptasi contoh, terapkan aturan label, fokus, kontras, dan target sentuh pada bagian 10.
Jangan menyalin logika bisnis, autentikasi, atau kekurangan aksesibilitas halaman referensi.

Permintaan fitur baru tidak mengizinkan agen mengubah identitas visual. Jangan mengubah master
atau token global agar desain buatan agen menjadi seolah-olah sesuai. Jika pola baru diperlukan,
susun kontennya dengan token dan komponen existing. Perubahan palet/font/shell memerlukan
permintaan eksplisit pengguna. Perbedaan pada halaman lama bukan preseden untuk gaya baru.

**Cakupan:** master data, HR, IT & aset, GA, transaksi, laporan, pengaturan, dan komponen bersama.
Dokumen cetak mempertahankan ukuran kertas dan struktur dokumen bisnisnya; jangan memaksakan
sidebar atau kartu dashboard ke hasil cetak. Login mempertahankan layout autentikasi existing.

## 1. Skema Warna Standar (Emerald Enterprise)

- **Warna Utama (Brand / Primary)**: Emerald (`emerald-600`, hover `emerald-700`, active `emerald-800`).
- **Warna Latar Permukaan (Surface / Background)**:
  - Page Background: `bg-slate-50/50` atau default layout background.
  - Card & Container: `bg-white border border-slate-200 shadow-sm rounded-2xl`.
  - Input & Form Fields: `bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900`.
- **Warna Teks**:
  - Judul Halaman: `text-2xl font-extrabold text-slate-900 tracking-tight`.
  - Subjudul / Helper: `text-xs text-slate-500`.
  - Label Kolom / Metric: `text-[11px] text-slate-400 uppercase tracking-wider font-mono`.
  - Isi Tabel / Data: `text-xs text-slate-700 font-medium`.
- **Status Tones**:
  - Aktif / Approved / Sukses: `bg-emerald-50 text-emerald-700 border border-emerald-200` (Dot: `bg-emerald-500`).
  - Menunggu / Pending: `bg-amber-50 text-amber-700 border border-amber-200` (Dot: `bg-amber-500`).
  - Nonaktif / Resign / Ditolak: `bg-slate-100 text-slate-600 border border-slate-200` atau `bg-rose-50 text-rose-700 border border-rose-200`.

---

## 2. Struktur halaman dan hierarki informasi global

Aturan global menetapkan bahasa visual dan hierarki informasi. Susunan konten dipilih
berdasarkan pekerjaan pengguna: daftar, detail, formulir, dashboard, laporan, atau pengaturan.
Tidak ada satu halaman existing yang menjadi template wajib untuk seluruh aplikasi.

- Halaman operasional menggunakan shell aplikasi yang sama. Padding, lebar konten,
  sidebar, topbar, dan breadcrumb mengikuti shell; jangan digandakan di setiap fitur.
- Setiap halaman memiliki judul utama yang jelas. Judul bagian berada pada hierarki
  di bawahnya; gunakan skala tipografi global, bukan ukuran baru per departemen.
- Deskripsi, ikon judul, breadcrumb tambahan, dan aksi header ditampilkan bila memberi
  konteks atau fungsi. Tidak wajib ada ikon dan subjudul pada setiap halaman.
- Kelompokkan informasi sesuai urutan kerja. Gunakan spacing, border, dan surface existing
  untuk membedakan bagian, tanpa mewajibkan setiap bagian dibungkus kartu.
- Pada desktop, judul dan aksi dapat berdampingan jika ruang cukup. Di layar kecil,
  susun atau bungkus kontrol agar terbaca dan dapat digunakan.
- Posisi aksi mengikuti objeknya: aksi halaman pada area halaman, aksi baris pada baris,
  aksi field dekat field, dan aksi simpan di area formulir/modal yang mudah dijangkau.
- Perubahan susunan untuk kebutuhan bisnis diperbolehkan selama tema, komponen,
  kepadatan informasi, dan perilaku interaksi tetap konsisten.

## 3. Komponen, surface, dan hierarki aksi global

Gunakan kembali komponen bersama yang sesuai fungsi dan API aktualnya. Komponen halaman
tertentu boleh menjadi referensi implementasi, tetapi tata letak dan datanya tidak otomatis
berlaku untuk halaman lain.

| Elemen | Aturan global |
|---|---|
| Surface/panel | Gunakan canvas slate, surface putih, border slate, radius, dan shadow sesuai token master. Jumlah panel mengikuti kelompok informasi. |
| Aksi utama | Gunakan gaya primary emerald untuk tindakan utama pada konteks tersebut; label menyebut tindakan sebenarnya. |
| Aksi sekunder | Gunakan surface putih/netral dan border existing; jangan bersaing dengan aksi utama. |
| Aksi berisiko | Gunakan tone destructive untuk tindakan yang berdampak merusak; konfirmasi sesuai dampaknya. |
| Input dan pilihan | Gunakan font, radius, border, fokus, label, dan validasi yang konsisten; pilih jenis kontrol sesuai nilai yang dimasukkan. |
| Status dan feedback | Gunakan tone semantik yang sama antarmodul, disertai teks yang menjelaskan keadaan. |
| Modal | Gunakan modal bersama untuk tugas yang memerlukan dialog; tugas panjang dapat memakai halaman form. |
| Ringkasan/metrik | Tambahkan hanya jika membantu keputusan pengguna dan memiliki data nyata; jumlah, ikon, dan grid tidak ditetapkan secara global. |

Jangan mewajibkan KPI, tiga/empat kartu ringkasan, tombol tambah, atau tombol muat ulang
pada semua halaman. Jika komponen baru dibutuhkan, susun dengan token existing dan perilaku
yang sejalan dengan komponen bersama; jangan menciptakan identitas visual baru.

## 4. Pencarian, filter, dan kontrol konteks global

Pencarian dan filter adalah alat untuk mengendalikan data yang sedang dilihat. Kehadirannya,
jenis kontrol, dan penempatannya mengikuti volume data serta kebutuhan pekerjaan.

- Sediakan pencarian hanya untuk objek/field yang memang dapat dicari. Label dan placeholder
  menjelaskan cakupannya; jangan menampilkan pencarian yang tidak berfungsi.
- Gunakan filter berdasarkan atribut domain yang relevan. Kontrol tanggal, status, kategori,
  atau pemohon tidak wajib muncul pada setiap halaman.
- Kelompokkan kontrol yang memengaruhi kumpulan data yang sama. Boleh memakai toolbar,
  area di atas konten, atau panel filter sesuai kompleksitas; tidak wajib satu bilah putih.
- Pertahankan gaya input, select, tombol, dan active state dari master. Perbedaan jenis filter
  tidak menjadi alasan mengganti font, palet, atau bentuk kontrol.
- Perubahan filter harus terlihat hasilnya. Tampilkan pilihan aktif dan cara mereset bila
  diperlukan; angka hasil hanya ditampilkan jika benar dan berguna.
- Bedakan kondisi data memang kosong, pencarian tanpa hasil, proses memuat, dan kegagalan.
- Pada layar kecil, kontrol membungkus atau tersusun vertikal. Jangan memaksa filter penting
  keluar layar; filter tambahan boleh ditempatkan dalam area yang dapat dibuka dengan jelas.

## 5. Penyajian data dan konten global

Pilih bentuk penyajian berdasarkan informasi dan tindakan pengguna. Tabel digunakan untuk
membandingkan record dengan atribut serupa; detail, formulir, kalender, daftar, atau riwayat
menggunakan bentuk yang sesuai tanpa harus disulap menjadi tabel.

- Semua bentuk penyajian mengikuti font, surface, border, radius, spacing, dan tone semantik
  master. Struktur konten boleh berbeda antarmodul, identitas visual tetap sama.
- Jika memakai tabel, heading kolom jelas, selaras dengan isinya, dan memiliki struktur HTML
  semantik. Gunakan pemisah dan hover yang konsisten dengan surface aplikasi.
- Nama, kode, tanggal, uang, jumlah, dan status mengikuti makna datanya. Angka pembanding
  disejajarkan konsisten; satuan dan formatnya jelas. Tidak semua teks harus monospace,
  uppercase, berupa badge, atau memakai titik status.
- Kolom dan aksi ditentukan kebutuhan domain. Kolom KODE/NIK, NAMA, STATUS, dan AKSI dari
  direktori karyawan tidak menjadi struktur wajib seluruh tabel.
- Tautan membuka tujuan yang nyata; tombol menjalankan aksi. Aksi penting tidak hanya
  muncul saat hover sehingga tetap dapat diakses di perangkat sentuh dan keyboard.
- Gunakan pagination, sorting, atau pilihan massal hanya jika diperlukan oleh jumlah data
  dan proses pengguna; pertahankan perilaku yang konsisten ketika tersedia.
- Konten lebar dapat digulir dalam panelnya. Pada ponsel, pilih scroll tabel atau susunan
  alternatif yang tetap mempertahankan informasi serta tindakan penting.
- Loading, kosong, error, read-only, dan sukses mengikuti kondisi nyata. Hindari mengisi
  ruang dengan data contoh, kartu tambahan, atau visual tanpa fungsi.

---

## 6. Aturan Input Angka (Form Numbers)

Hilangkan spin buttons default browser yang mengganggu:
```tsx
<input
  type="number"
  className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-semibold"
/>
```

---

## 7. Hal Yang Dilarang (DON'T)

❌ Jangan menggunakan tema gelap terpisah (`dark:bg-slate-950`, `dark:border-slate-800`) di komponen modul jika halaman master lainnya adalah light ERP.  
❌ Jangan gunakan background header yang tebal atau card header gelap dengan gradien.  
❌ Jangan gunakan aksen ungu (violet), indigo, atau neon glow. Gunakan selalu keluarga **Emerald**.  
❌ Jangan biarkan spin arrow (up/down counter) default browser muncul di input angka form cuti/kehadiran.  
❌ Jangan membuat card yang melengkung berlebihan atau mengambang (floating) tanpa border pemisah yang jelas. Gunakan `rounded-2xl border border-slate-200 shadow-sm`.

## 8. Peta sumber dan komponen wajib

Semua path di bawah relatif terhadap root proyek dan menunjuk sumber yang sudah ada.

| Kebutuhan | Referensi / komponen | Ketentuan |
|---|---|---|
| Identitas brand | `frontend/src/lib/gajianichBrand.ts` | Pakai konstanta brand, jangan mengetik brand baru di setiap modul. |
| Token dan font global | `frontend/src/app/globals.css` | Gunakan token yang ada; jangan menimpa dari CSS modul. |
| Shell, sidebar, topbar, breadcrumb | `frontend/src/components/layout/DashboardLayout.tsx` | Gunakan shell existing; pertahankan collapse, drawer mobile, dan izin menu. |
| Contoh direktori data | `frontend/src/components/master/EmployeeDirectoryPage.tsx` | Contoh penerapan tema pada list karyawan; bukan template wajib untuk semua list, transaksi, atau modul. |
| Contoh form master | `frontend/src/components/master/EmployeeFormPage.tsx`, `EmployeeFormFields.tsx` pada direktori yang sama | Referensi gaya field dan aksi; pengelompokan field mengikuti domain fitur. |
| Contoh form transaksi | `frontend/src/components/leaves/LeaveRequestForm.tsx` | Referensi penerapan tema; struktur dan aturan cuti tidak diwajibkan pada transaksi lain. |
| Modal umum | `frontend/src/components/ui/ModalShell.tsx` | Pakai prop aktual: `isOpen`, `onClose`, `title`, `children`, `footer`, `isLoading`; jangan membuat overlay sendiri. |
| Konfirmasi hapus/aksi berisiko | `frontend/src/components/ui/ConfirmDeleteModal.tsx` | Tampilkan nama objek, alasan, loading/error, dan aksi spesifik; jangan gunakan `window.confirm` / `alert`. |
| Status umum | `frontend/src/components/ui/StatusBadge.tsx` | Pakai variant semantik aktual: `success`, `warning`, `danger`, `slate`, `default`, atau `info`. |
| HR khusus absensi | `frontend/src/components/attendance/shared.tsx`, `attendance.css` pada direktori yang sama | Reuse untuk kebutuhan absensi; jangan menjadikannya stylesheet global modul GA/IT. |
| Proteksi navigasi | `frontend/src/lib/access/routes.ts`, `frontend/src/lib/access/permissions.ts` | Menu baru mengikuti pemeriksaan izin, rute aktif, dan landing existing. |

`StatusBadge` memiliki alias kompatibilitas `purple` yang saat ini menghasilkan warna amber.
Jangan gunakan nama alias itu untuk merancang status baru. Nama utilitas lama seperti
`.glass-panel` atau `.text-gradient-red` juga tidak berarti izin membuat glassmorphism atau tema merah.
Acuannya adalah token aktual dan master ini.

## 9. Token yang dikunci dan struktur halaman

Nilai hex berikut berasal dari `globals.css` dan `gajianichBrand.ts`. Ini mendokumentasikan
nilai CSS variable yang sudah ada; jangan membuat set token paralel dalam setiap fitur.
Tailwind utility dalam resep mengikuti konfigurasi Tailwind aktif; CSS variable dan utility
bernama serupa tidak harus menghasilkan nilai hex persis sama.

| Peran | Token global | Nilai CSS variable saat ini |
|---|---|---|
| Primary | `--color-primary` | `#059669` |
| Mint pendamping | `--color-mint` | `#10B981` |
| Teks di primary | `--color-on-primary` | `#FFFFFF` |
| Secondary lembut | `--color-secondary` | `#D1FAE5` |
| Accent/perhatian | `--color-accent` | `#F59E0B` |
| Canvas | `--color-background` | `#F8FAFC` |
| Teks utama | `--color-foreground` | `#0F172A` |
| Muted surface | `--color-muted` | `#F1F5F9` |
| Border | `--color-border` | `#E2E8F0` |
| Destructive | `--color-destructive` | `#B91C1C` |

- Font teks dan heading: **Plus Jakarta Sans**, mengikuti font global.
- Font kode, ID, dan angka operasional yang memerlukan monospace: **JetBrains Mono**.
- Ikon: **lucide-react** yang sudah terpasang. Ukuran aksi 16px, ikon judul 24px,
  ikon kartu 20px. Pilih ikon berdasarkan fungsi; jangan mengganti pustaka per departemen.
- Panel utama: `rounded-2xl`; input/tombol `rounded-xl`; aksi ikon `rounded-lg`.
  `rounded-full` tetap untuk status/avatar, bukan semua elemen.
- Pemisah bagian: `space-y-6`; gap umum `gap-3` / `gap-4`; padding panel `p-4`,
  form/modal mengikuti komponen referensi. Jangan menambah whitespace ala landing page.
- Bayangan panel `shadow-sm`; bayangan modal mengikuti `ModalShell`. Jangan menambah glow,
  gradien dekoratif, atau efek melayang pada setiap kartu operasional.
- Animasi hanya untuk feedback, transisi singkat, dan loading. Hormati reduced motion.
- Light ERP adalah tema operasional aktif. Jangan menambah dark mode khusus modul.

### Pemilihan pola halaman

Bagian 2–5 berlaku lintas jenis halaman. Pilih struktur sesuai tugas pengguna:

- Direktori/list: penelusuran dan perbandingan data, dengan filter atau tabel bila diperlukan.
- Detail: identitas objek, informasi terkait, riwayat, dan tindakan yang relevan.
- Form: kelompok field sesuai urutan pengisian, validasi, serta aksi simpan/ajukan.
- Dashboard/laporan: ringkasan dan visualisasi yang menjawab kebutuhan operasional dari data nyata.
- Pengaturan: kelompok konfigurasi dengan penjelasan dampak dan pola penyimpanan yang jelas.

Gunakan shell dan ritme spacing existing. Urutan header, KPI, toolbar, dan tabel dari halaman
tertentu tidak menjadi kewajiban global. Contoh halaman dipilih untuk mengadaptasi bagian
relevan saja, bukan untuk menyalin keseluruhan susunannya.

### Penambahan menu

Gunakan `navGroups` pada `DashboardLayout` dan aturan akses existing. Tambahkan menu pada
kelompok bisnis yang benar, dengan nama, ikon fungsional, tujuan rute nyata, dan izin yang sesuai.
Pertahankan menu aktif berwarna emerald, accordion, breadcrumb, dan perilaku drawer mobile.
Jangan membuat sidebar sendiri atau mengganti urutan menu lain tanpa kebutuhan tugas.

## 10. Interaksi, aksesibilitas, dan responsive

Aturan pada bagian ini mengoreksi kekurangan pada contoh atau komponen lama, bukan mengubah tema.

- Kondisi wajib: loading, data kosong, hasil filter kosong, error dengan pemulihan,
  disabled/submitting, sukses, dan akses ditolak/read-only jika relevan.
- Data kosong berbeda dengan API gagal. Jangan menampilkan contoh angka sebagai data nyata.
- Tombol simpan menampilkan proses dan mencegah submit ganda; error tidak menghapus input pengguna.
- Setiap field punya label yang terhubung. Placeholder bukan pengganti label.
- Tombol hanya ikon punya nama aksesibel (`aria-label`); label status harus berupa teks,
  tidak bergantung pada warna atau titik saja.
- Pertahankan `:focus-visible` global (outline 3px primary, offset 3px).
  Jangan menghapus outline tanpa pengganti yang terlihat.
- Teks normal wajib memiliki kontras minimal 4.5:1; teks besar minimal 3:1.
  Resep lama `text-slate-400` untuk teks kecil dan teks putih pada primary harus diperiksa
  pada warna hasil render yang sebenarnya. Jika tidak cukup, gunakan tone lebih gelap dari
  keluarga yang sama, misalnya slate-600 atau emerald-700; jangan mengganti palet aplikasi.
- Target sentuh minimal 40×40px, disarankan 44×44px. Ikon boleh 16px di dalam target lebih besar.
- Verifikasi di lebar 360px, 390px, 768px, dan 1280px. Halaman tidak boleh overflow horizontal;
  tabel lebar boleh bergulir di panel `overflow-x-auto`. Jangan mengandalkan `body overflow-x:hidden`
  untuk menyembunyikan layout yang rusak.
- Form satu kolom di ponsel; kolom tambahan hanya bila ruang cukup. Toolbar dan aksi membungkus.
- Modal memakai `ModalShell`: backdrop existing, header/footer tetap, body scroll,
  `max-h-[92dvh] sm:max-h-[88vh]`. Pastikan judul aksesibel, fokus berada di dialog,
  Escape sesuai keadaan proses, dan fokus kembali setelah ditutup.
- Untuk komponen konfirmasi existing, uji kebutuhan keyboard/fokus pada alur yang dipakai;
  jangan menganggap semua komponen lama sudah lolos aksesibilitas hanya karena reusable.

## 11. Penerapan untuk departemen GA

Pengajuan pembelian GA wajib menjadi bagian visual dari aplikasi yang sama:

- Shell dan sidebar existing; identitas GA tidak diberi warna brand atau font sendiri.
- List pengajuan mengikuti pola direktori: header, filter, status, tabel, dan aksi.
- Form mengikuti panel/form existing: rincian pemohon, daftar barang, estimasi harga,
  bukti harga, dan aksi simpan/ajukan sesuai aturan bisnis yang disepakati.
- Area paste screenshot memakai panel putih, border slate, radius existing, petunjuk singkat,
  pratinjau, serta aksi hapus/ganti dengan pola tombol aplikasi.
- Status Draft/Diajukan/Disetujui/Ditolak memakai tone semantik slate/amber/emerald/rose.
- Upload, kompresi, error, dan retry tampil sebagai keadaan proses; tidak menambah gaya halaman baru.

Ini adalah batas visual untuk implementasi mendatang, bukan klaim fitur GA sudah tersedia.

## 12. Checklist wajib sebelum menyerahkan perubahan UI

Agen mencatat rujukan pola dan bukti pemeriksaan yang benar-benar dilakukan.

- [ ] Master ini dibaca; halaman/komponen referensi yang dipakai disebutkan dalam laporan.
- [ ] Font, primary, canvas, border, radius, kepadatan, dan ikon mengikuti master.
- [ ] Shell dan komponen bersama digunakan sesuai API aktual; tidak ada tema per modul.
- [ ] Susunan halaman mengikuti tugas pengguna; tidak ada KPI atau dekorasi tanpa fungsi.
- [ ] Label, keyboard, fokus, kontras, dan target sentuh diperiksa.
- [ ] Mobile dan desktop diperiksa; tabel dan modal tidak memotong kontrol.
- [ ] Loading, kosong, error, submitting, sukses, dan izin diperiksa sesuai alur fitur.
- [ ] Menu baru punya rute dan izin yang benar; active state dan breadcrumb diperiksa.
- [ ] Pemeriksaan kode yang relevan dijalankan; hasil visual hanya diklaim jika benar-benar diperiksa.
- [ ] Perubahan tema global atau penyimpangan memiliki instruksi eksplisit pengguna sebagai dasar.

Dokumen desain khusus halaman hanya boleh menambah kebutuhan domain, pemetaan komponen,
dan layout konten yang belum tercakup. Tidak boleh membuat token atau master tema alternatif.

### 4.4 Larangan Keras Tombol Refresh Manual (No Manual Refresh Buttons)

> **ATURAN MUTLAK**: **Dilarang keras menyediakan tombol "Refresh", "Segarkan", "Muat Ulang", atau tombol berikon `RefreshCw`/`RotateCw` untuk reload data di header halaman, action toolbar, filter, maupun footer.**

1. **Reaktif & Otomatis**: Semua data tabel, ringkasan, dan kartu KPI wajib dimuat secara reaktif (otomatis load saat komponen di-mount, saat parameter query/filter/pagination berubah, dan otomatis refetch saat aksi create/edit/delete di modal selesai).
2. **Kenapa dilarang**: Tombol refresh manual adalah antipattern di aplikasi web modern, mengotori antarmuka (visual noise), membingungkan pengguna, dan mengganggu efisiensi navigasi.
3. **Pengecualian terbatas**: Hanya diizinkan untuk tombol sinkronisasi integrasi eksternal eksplisit (misal trigger sync API Accurate Server) atau pembacaan sensor fisik perangkat (misal update koordinat GPS pada mobile presensi).
