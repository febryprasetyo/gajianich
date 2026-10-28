# Attendance — page override

Referensi: screenshot Data Absensi yang diberikan pengguna, 25 September 2026. Dashboard GAJIANICH tetap menjadi shell dan identitas visual.

- ENERGY 1 / RHYTHM 1 / MOTION 1: halaman operasional padat, fokus pada tabel dan keterbacaan angka.
- Background slate-50, panel putih, border slate-200; aksi utama red-600 sesuai GAJIANICH. Status menggunakan teks serta warna semantik.
- Font body existing untuk label/nama, angka tabular untuk waktu/durasi. Tidak menambah font atau mengganti tema global.
- Header ringkas, toolbar tanggal/filter/pencarian, satu strip metrik horizontal, tabel yang bisa digulir. Kolom identitas tetap pada desktop, detail lewat tautan dan aksi baris.
- Semua data berasal dari repository; indikator diturunkan dari hasil filter, bukan konstanta visual.
- Lucide existing dipakai untuk fungsi navigasi, cari, unduh, unggah, kunci, dan edit agar konsisten dengan dashboard. Tidak memakai ikon dekoratif atau grafik tanpa sumber data.
- Mobile: kontrol membungkus, tabel scroll di panel, dialog mengikuti viewport dinamis dengan header/footer tetap, target interaksi minimal 40px, fokus keyboard terlihat.
- Dua total rekap utama: keterlambatan dan lembur, satuan jam-menit tanpa nominal uang. Penanda normalisasi merah disertai teks.
- Mode demo diberi label; loading, error, kosong, konflik, read-only, dan sukses ditampilkan sesuai keadaan aktual.

Aturan ini berlaku untuk Data Absensi, Impor/Review, Kartu, Laporan, Aktivitas, Master, Pemetaan dan Akses.
