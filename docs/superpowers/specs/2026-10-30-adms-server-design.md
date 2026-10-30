# ADMS server dan impor historis

Permintaan pengguna: layanan di folder/container Docker terpisah, database sama dengan Gajianich; otomatis via ADMS dan impor manual untuk riwayat fisik. Implementasi tidak memerlukan perubahan UI atau firmware.

Layanan `adms-server/` memakai Node HTTP dan PostgreSQL. Endpoint `/iclock/cdata`, `/iclock/getrequest`, `/iclock/devicecmd` menerima protokol PUSH teks. Serial dan jaringan asal wajib didaftarkan melalui CLI operator. Tidak ada endpoint admin publik atau perintah penghapusan/perubahan perangkat. Tidak menganggap serial sebagai password; listener harus berada pada LAN/VPN terpercaya, tanpa mempercayai X-Forwarded-For.

Database bersama: schema `adms` menyimpan registrasi, watermark, dan receipt payload byte asli. ATTLOG divalidasi seluruh batch sebelum transaksi yang menyimpan receipt, log mentah Gajianich dan watermark. ACK hanya setelah commit. Batch invalid disimpan sebagai REJECTED tanpa ACK sukses, watermark tidak bergerak; kegagalan DB mengembalikan 503. Tabel lain diarsipkan tanpa memproses biometrik. Payload dibatasi 1 MiB/default, waktu request dan query dibatasi.

Impor TSV operator memakai pipeline yang sama, dry-run default, `--commit` eksplisit. Kolom dapat dipilih untuk ekspor USB karena format berkas pengguna belum tersedia. Tidak mengklaim semua format biner/Excel didukung. Simpan PIN sebagai string, waktu sebagai wall clock mesin tanpa konversi UTC. Pemetaan employee_number/barcode dibatasi grup mesin; PIN tidak dikenal tetap tersimpan. Pemetaan identitas kustom hanya jika attendance source didaftarkan eksplisit.

Dedup log mentah lintas PUSH/impor/pull berdasarkan device, PIN, timestamp detik, kode status dan verifikasi (fallback label untuk data lama). Kolom fingerprint nullable baru dan unique index tidak menghapus data lama; trigger mengecek log sebelum migrasi. Perbedaan workcode disimpan sebagai receipt meskipun dianggap scan identik oleh kalkulasi lama. Penarikan backend tidak lagi mengganti/menghapus riwayat. Backend mengenali status ADMS dari komunikasi terakhir; kalkulasi shift tetap memakai menu kalkulasi existing, tidak menulis hasil final otomatis dari listener.

Compose terpisah bergabung ke network DB existing; port host default loopback agar tidak terbuka tanpa konfigurasi. Tidak membuat PostgreSQL kedua. Migrasi eksplisit, tanpa migrasi produksi otomatis saat server start. Pengujian memakai PostgreSQL container disposable saja.

Kriteria: batch ulang/konkuren dan overlap manual tidak menggandakan log; rollback tidak ACK; invalid/unknown source/disabled ditolak; unmapped dipertahankan; group isolation, tanggal valid, PIN padded, 0/1/4/5 status tetap dibedakan; health/readiness dan Docker build terverifikasi. Kompatibilitas firmware fisik baru diklaim setelah mesin menghubungi listener.
