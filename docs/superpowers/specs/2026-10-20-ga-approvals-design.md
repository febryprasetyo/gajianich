# Pendekatan Pengajuan GA — Odoo Approvals

Tanggal: 20 Oktober 2026. Status: rancangan pendekatan; belum diimplementasikan.

## Tujuan dan batas tahap awal

GA membuat dan mengelola pengajuan. Persetujuan dilakukan secara manual melalui tanda
tangan basah masing-masing pihak sesuai perannya pada dokumen cetak. Aplikasi digunakan
untuk pencatatan, penyusunan dokumen, lampiran bukti harga, cetak, dan pemantauan administrasi.

Pengguna menetapkan Odoo Approvals sebagai acuan pengelompokan jenis pengajuan dan
penyajian informasinya. Alur keputusan tetap mengikuti persetujuan manual yang ditetapkan
pengguna. Identitas visual tetap GAJIANICH / Emerald Enterprise, mengikuti
[master desain](../../../UI_DESIGN_SYSTEM_GUIDE.md) dan [DESIGN.md](../../../DESIGN.md).

Rekomendasi tahap pertama: pembelian barang, melanjutkan formulir, rincian barang,
bukti harga, dan cetak yang sudah ada di checkout. Peminjaman aset, kendaraan,
booking ruangan, dan perbaikan menjadi pengembangan berikutnya; jangan tampilkan
kategori sebagai layanan aktif sebelum formulir dan prosesnya tersedia.

## Pengalaman pengguna

### 1. Beranda Pengajuan GA

Katalog jenis pengajuan mengikuti gagasan Odoo Approvals. Pada tahap awal hanya ada
jenis Pembelian Barang, dengan deskripsi dan tombol Buat Pengajuan untuk petugas GA
yang memiliki izin. Karyawan umum tidak membuat pengajuan melalui alur ini.

Area kerja GA berisi Daftar Pengajuan dan filter status administrasi. Tabel menampilkan
nomor, tanggal, pembuat GA, nama pengaju pada dokumen, divisi, total estimasi, status,
dan tautan detail. Pencarian nomor/nama dan pagination diproses server dengan pembatasan
akses. Jumlah pengajuan berasal dari data nyata sesuai hak akses pengguna.

Tidak ada antrean keputusan bagi approver atau tombol Setujui/Tolak secara digital.

### 2. Formulir Pembelian Barang

- Pembuat: akun petugas GA yang memasukkan data, dicatat otomatis untuk audit.
- Identitas dokumen: nama pengaju, jabatan, divisi, dan tanggal pengajuan.
- Kebutuhan: judul singkat dan alasan pembelian.
- Rincian: nama barang, jumlah, estimasi harga satuan, subtotal, keterangan, bukti harga.
- Ringkasan: total estimasi dihitung server dan area pengesahan sesuai formulir existing.
- Aksi yang diusulkan: Simpan Draft, Simpan, dan Cetak Formulir.

Bedakan pembuat record dengan nama pada kolom Diajukan; nama pengaju mengikuti dokumen
bisnis, sedangkan aplikasi selalu mencatat akun GA pembuatnya. Pertahankan upload/paste
gambar, kompresi, pratinjau, dan cetak existing. Draft boleh belum lengkap; dokumen yang
siap dicetak wajib memenuhi validasi barang dan bukti harga existing. Input tidak hilang
ketika API gagal.

### 3. Dokumen dan tanda tangan basah

Pertahankan kolom pengesahan existing pada layar dan hasil cetak:

| Kolom | Pengesahan |
|---|---|
| Diajukan | Tanda tangan basah pihak yang mengajukan |
| Diketahui Oleh | Tanda tangan basah pihak yang mengetahui |
| Diperiksa | Tanda tangan basah pemeriksa |
| Disetujui | Tanda tangan basah pemberi persetujuan |
| Penjual | Tanda tangan basah penjual sesuai kebutuhan dokumen |

Nama pejabat, jabatan, dan ketentuan penandatanganan mengikuti SOP perusahaan. Jangan
mengarang pemetaan jabatan atau memaksakan urutan keputusan digital. Kolom Penjual tidak
secara otomatis menjadi syarat persetujuan internal sebelum pembelian.

Dokumen dicetak, diedarkan secara fisik untuk tanda tangan, kemudian ditindaklanjuti GA.
Aplikasi tidak mengisi gambar tanda tangan atau menganggap hasil cetak sebagai bukti
bahwa dokumen sudah ditandatangani.

### 4. Detail dan arsip

Detail menampilkan kebutuhan, identitas, rincian barang, total, bukti harga, dan lembar
pengesahan yang dapat dicetak. Rekomendasi pengembangan adalah unggah scan/foto dokumen
bertanda tangan sebagai arsip terpisah dari lampiran bukti harga per barang.

Riwayat administrasi mencatat pembuat, perubahan isi, perubahan status oleh GA, waktu,
dan catatan. Waktu input status oleh GA bukan waktu tanda tangan pejabat. Tidak membuat
catatan keputusan seolah-olah pejabat melakukan tindakan di aplikasi.

## Alur administrasi yang diusulkan

Draft → Siap Cetak → Menunggu Tanda Tangan → Persetujuan Manual Lengkap → Diproses → Selesai.

Alur ini merupakan rekomendasi pencatatan; arahan yang sudah ditetapkan pengguna adalah
GA sebagai pembuat dan tanda tangan basah sebagai mekanisme persetujuan.

- GA memperbarui status berdasarkan keadaan dokumen fisik dan mencatat alasannya.
- Mencetak dokumen tidak otomatis mengubah status menjadi sudah disetujui.
- Status Persetujuan Manual Lengkap berarti GA mencatat bahwa pengesahan internal yang
  diwajibkan SOP telah lengkap; ini bukan keputusan persetujuan digital oleh GA.
- Jika dokumen perlu direvisi, GA memperbaiki dan mencetak versi baru. Status kelengkapan
  tanda tangan versi sebelumnya tidak otomatis berlaku untuk isi yang berubah.
- Pembatalan mencatat alasan dan tetap mempertahankan riwayat.
- Selesai berarti kebutuhan telah dipenuhi, terpisah dari kelengkapan persetujuan manual.

## Integrasi dengan AMS

Alur existing berada di [komponen GA](../../../frontend/src/components/ga/GoodsRequestList.tsx)
dan [API GA](../../../backend/src/routes/goodsRequestRoutes.ts). Model saat ini menyimpan
identitas pengaju, rincian barang, dan lampiran; belum memiliki status proses administrasi.

Pertahankan penyimpanan, detail, dan cetak existing. Tambahan yang direncanakan meliputi
akun pembuat GA, status administrasi, judul/alasan, versi dokumen, riwayat perubahan,
dan arsip dokumen bertanda tangan. Tidak diperlukan mesin approval, akun approver,
penugasan keputusan digital, maupun notifikasi permintaan persetujuan digital.

Seluruh perubahan divalidasi di server berdasarkan izin, status, dan versi. Pembuat dan
petugas pencatat status berasal dari sesi akun, bukan input bebas. Akses lampiran mengikuti
izin pengajuan induk. Transaksi menjaga perubahan status dan audit tetap konsisten.
Jangan mengubah izin shared di modul lain; pembatasan pembuatan GA harus eksplisit pada
izin/rute GA. Record lama tetap dapat dibaca dan dicetak; jangan menganggapnya telah
mendapat persetujuan manual tanpa pemeriksaan dokumen.

Scan/foto tanda tangan adalah arsip dokumen fisik. Pengajuan pembelian belum berarti stok
atau PO otomatis tercipta. Email/WhatsApp dan pengelolaan pembelian lanjutan berada di luar
tahap pertama.

## Pola desain dan verifikasi implementasi

- Shell: [DashboardLayout](../../../frontend/src/components/layout/DashboardLayout.tsx).
- Daftar: [EmployeeDirectoryPage](../../../frontend/src/components/master/EmployeeDirectoryPage.tsx).
- Form: [LeaveRequestForm](../../../frontend/src/components/leaves/LeaveRequestForm.tsx)
  dan [GoodsRequestForm](../../../frontend/src/components/ga/GoodsRequestForm.tsx).
- Status: [StatusBadge](../../../frontend/src/components/ui/StatusBadge.tsx).
- Dialog: [ModalShell](../../../frontend/src/components/ui/ModalShell.tsx).

Gunakan primary emerald, canvas slate, panel putih, font global, radius serta fokus existing.
Status disertai teks. Katalog dan antrean memakai data nyata tanpa contoh angka atau tombol
untuk kategori yang belum tersedia.

Saat implementasi, uji pembatasan pembuatan kepada GA, draft tidak lengkap, validasi
siap cetak, kesesuaian lima kolom pengesahan pada layar/hasil cetak, perubahan status
administrasi, revisi versi dokumen, arsip bertanda tangan, akses lampiran, serta kompatibilitas
baca/cetak record lama. Periksa loading, kosong, error, retry, keyboard, fokus, label,
kontras, dan lebar 360/390/768/1280px sesuai checklist master.

Dokumen ini merupakan rancangan. Fungsi status administrasi dan arsip tanda tangan belum
diimplementasikan; verifikasi visual belum dilakukan.

## Sumber acuan produk

- [Odoo Approvals](https://www.odoo.com/app/approvals)
- [Odoo Approvals — Features](https://www.odoo.com/app/approvals-features)

Sumber produk telah ditinjau pada percakapan riset sebelumnya. Pengelompokan pengajuan mengacu pada
Odoo; pembuatan oleh GA dan persetujuan tanda tangan basah mengikuti arahan pengguna.
Status administrasi dan arsip merupakan rekomendasi untuk AMS.
