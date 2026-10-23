# Spesifikasi Perbaikan Hasil Audit Presensi Mobile

Tanggal: 23 Oktober 2026. Status: direncanakan, belum diimplementasikan.

Dokumen ini mendefinisikan perbaikan enam temuan audit dan satu koreksi teks. Brief approval yang sudah disepakati tetap berlaku. Penyusunan dokumen tidak menandakan implementasi atau pengujian perbaikan telah selesai.

## Acuan

- [Master desain](../../../UI_DESIGN_SYSTEM_GUIDE.md) dan [arah desain](../../../DESIGN.md).
- [Aturan frontend](../../../frontend/AGENTS.md) dan [backend](../../../backend/AGENTS.md).
- [Rencana perbaikan](../plans/2026-10-23-mobile-attendance-audit-fixes.md).
- [TODO aktif](../../readme.md).
- [Laporan verifikasi implementasi awal](../../mobile-attendance-approval-verification.md), sebagai bukti historis, bukan hasil verifikasi perbaikan ini.

## Batas dan aturan tetap

- Pertahankan tema GAJIANICH / Emerald Enterprise, token global, DashboardLayout, ModalShell, dan StatusBadge existing.
- Pertahankan perubahan pengguna dan proses lain di checkout; koordinasikan pemilik file sebelum implementasi.
- Saklar aktif berarti otomatis disetujui; default mati berarti review HRD. Masuk dan pulang memiliki aturan terpisah.
- Karyawan tanpa penugasan shift aktif wajib review masuk dan pulang meskipun jadwal memakai shift default.
- PENDING dan REJECTED tidak dihitung sebagai kehadiran; koreksi hanya keterangan dengan waktu, zona dan lokasi asli.
- Pemeriksaan wajah tetap di server; tanpa acuan atau tidak cocok ditolak. Foto pertama langsung aktif; penggantian menunggu HRD.
- Waktu presensi berdasarkan GPS WIB/WITA/WIT; pulang mempertahankan zona presensi masuk.
- Akses reviewer tetap melalui attendance.mobile.verify. Koordinat dan peta tetap memakai integrasi yang sudah diizinkan pengguna.

## Temuan dan perilaku yang diwajibkan

### FIX-01 / P1: Lindungi absensi mesin, impor dan perubahan manual

Bukti audit: record impor dengan scanIn dan rawScanIn 08:00 berubah menjadi 12:59 setelah mobile IN disetujui, sementara sourceBatchId tetap 1.

- Permintaan mobile IN harus ditolak jika record tanggal kerja itu sudah memiliki IN independen dari mesin, impor atau input manual. Berikan pesan bahwa presensi masuk sudah tercatat.
- Penolakan tidak menambah log, tidak mengubah record, dan tidak menyisakan foto baru tanpa log.
- Proyeksi approval wajib memeriksa ulang konflik dalam transaksi. Kasus IN masih PENDING lalu record mesin diimpor sebelum HRD menyetujui harus ditolak secara atomik; pengajuan tetap PENDING.
- Pertahankan scanIn, rawScanIn, scanOut, rawScanOut, sourceBatchId, revision, status dan metrik record independen pada konflik.
- Record hasil proyeksi mobile milik alur yang sama tetap dapat diperbarui ketika OUT disetujui. Kepemilikan harus dapat dibuktikan; konflik atau kepemilikan ambigu tidak boleh diam-diam menimpa record.
- Pemeriksaan konflik mengikuti penguncian tanggal yang sama dengan jalur impor/manual, selain penguncian karyawan, agar transaksi paralel tidak melewati pemeriksaan.

### FIX-02 / P2: Samakan sumber shift jadwal dan approval

Bukti audit: shift individual nonaktif, shift divisi ACTIVE dengan autoApproveIn=true; jadwal memakai ACTIVE tetapi presensi tetap PENDING.

Urutan resolusi penugasan aktif: individual aktif, lalu divisi aktif. Penugasan individual ke shift nonaktif tidak memblokir divisi aktif. Jadwal dan flag approval harus berasal dari hasil resolusi aktif yang sama. Jika keduanya tidak ada, gunakan jadwal fallback existing tetapi approval tetap manual. Uji masuk dan pulang secara terpisah serta prioritas individual terhadap divisi.

### FIX-03 / P2: Pulihkan durasi riwayat absensi mesin

Bukti audit: record mesin 08:00–17:00 menampilkan kedua jam tersebut tetapi workHours bernilai --.

- Record independen tanpa event mobile dengan dua jam valid harus menampilkan durasi, contoh 08:00–17:00 menjadi 09h 00m.
- Shift malam 22:00–06:00 mengikuti jadwal lintas hari dan menghasilkan 08h 00m; jam tidak lengkap atau tidak valid menghasilkan --.
- Event mobile memakai selisih occurredAt; durasi baru tersedia jika IN dan OUT keduanya APPROVED. Jangan menggunakan fallback mesin untuk menyamarkan event mobile PENDING/REJECTED.
- Perbaikan hanya pada nilai tampilan riwayat, tanpa mengubah record mesin atau kebijakan rekap.

### FIX-04 / P2: Bedakan kegagalan API, kosong, dan data lama

Pada halaman /m/presensi, kegagalan summary dan history saat ini diubah menjadi null tanpa pesan.

- Summary dan history memiliki keadaan loading/error masing-masing; keberhasilan salah satunya tetap dapat ditampilkan.
- API history gagal harus menampilkan pesan dan tombol Coba lagi, bukan pesan belum ada catatan.
- Pergantian periode langsung menonaktifkan tampilan daftar lama. Respons periode sebelumnya yang datang terlambat tidak boleh mengganti periode terpilih.
- Bila summary gagal, nonaktifkan aksi presensi sampai status terbaru berhasil dimuat. Jangan menyimpulkan wajah belum terdaftar dari kegagalan API.
- Retry mempertahankan periode yang dipilih; history kosong hanya ditampilkan setelah respons sukses dengan records kosong. Error sesi mengikuti alur autentikasi existing.

### FIX-05 / P2: Status beranda sesuai kejadian sebenarnya

- Tanpa event mobile pada tanggal kerja, summary mengirim approvalStatus=null. Teks pengguna: Belum ada pengajuan; tidak menampilkan Disetujui atau Menunggu review.
- Kontrak MobileTodayAttendance.approvalStatus menjadi PENDING | APPROVED | REJECTED | null. Ini tidak mengubah enum status event atau status pada endpoint clock.
- Semua pemakai summary, termasuk badge dan kartu pengajuan terakhir di beranda, menangani null secara eksplisit.
- Detail NOT_CHECKED_IN menampilkan Belum absen; CHECKED_IN menampilkan Sudah absen masuk; COMPLETED menampilkan Presensi lengkap.
- CHECKED_IN bukan bukti tepat waktu. Hindari status TEPAT_WAKTU tanpa perhitungan keterlambatan yang mendukungnya.
- Status kehadiran dan keputusan HRD tetap terpisah; presensi lengkap dapat masih menunggu review atau ditolak.

### FIX-06 / P2: Dialog detail dan koreksi mengikuti master

Gunakan ModalShell untuk DayDetailSheet dengan API publik data, isOpen, onClose dan onUpdated tetap kompatibel. Pertahankan detail kejadian, peta, foto dan form koreksi.

Fokus masuk dialog saat dibuka; Tab/Shift+Tab tetap di dialog; Escape menutup saat tidak mengirim; fokus kembali ke pemicu. Saat koreksi sedang dikirim, cegah submit ganda dan penutupan dialog. Error tetap terlihat dan keterangan tidak hilang. Header/footer tetap tersedia dengan body bergulir. Tidak ada overflow pada 360, 390, 768 dan 1280 px.

### FIX-07 / P3: Perbaiki keterangan antrean reviewer

Ganti teks batas daftar dengan persis: “Seluruh pengajuan menunggu review dan 500 keputusan terbaru.” Tidak mengubah query atau batas data API.

## Cakupan yang tidak diperluas

Tidak ada perubahan model wajah, threshold, geofence, aturan dinas luar, skema database, deployment, atau migrasi data historis dalam rencana ini. Dukungan OUT mobile setelah IN mesin belum diputuskan dalam brief; jangan menambahnya diam-diam. Perubahan tambahan harus dijelaskan sebagai perubahan cakupan sebelum dikerjakan.

## Penerimaan dan bukti

Setiap FIX memiliki tes regresi pada rencana. Jalankan integrasi hanya pada database disposable dengan helper proyek, bukan database utama. Gunakan stream kamera simulasi untuk browser dan nyatakan batasnya; jangan menyebutnya validasi akurasi biometrik nyata.

Baseline audit: 25 tes backend terkait dan 192 tes frontend lulus; TypeScript backend/frontend dan lint frontend lulus. Tiga temuan backend tetap dapat direproduksi meskipun baseline hijau. Kolom approval dan tabel pengajuan foto terdeteksi pada database yang dikonfigurasi saat audit; ini bukan bukti deployment semua lingkungan.

Selesai berarti FIX-01 sampai FIX-07 diterapkan, tes regresi dan checklist desain lulus, hasil aktual dicatat, dan TODO diperbarui dengan bukti. Seluruh checklist tetap terbuka sampai pekerjaan benar-benar dikerjakan.
