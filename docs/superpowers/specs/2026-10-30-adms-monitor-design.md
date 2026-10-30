# Aktivasi dan monitoring ADMS

Permintaan: jalankan receiver ADMS dan buat tampilan monitoring sederhana. Pengguna memilih antislop selama pembuatan. Gunakan master emerald dan komponen reusable, tanpa tombol refresh manual.

Keputusan implementasi: receiver standalone tetap di Docker/network PostgreSQL development existing. Monitoring berada di aplikasi Gajianich `/dashboard/attendance/adms`, memakai autentikasi/permission operasional attendance.import/attendance.manage dan scope grup existing. Tidak membuka data admin pada listener mesin.

API readonly `/attendance/devices/adms/monitor` mengembalikan health listener (probe server-side timeout2500ms), summary dan mesin menurut grup yang diizinkan, serta receipt paginated/search/outcome/source. Tidak menyertakan payload mentah, credential, allowed network atau data grup lain. Summary lifetime data ATTLOG; unmapped adalah jumlah log mentah saat ini. Online mensyaratkan mesin enabled, transport dan serial cocok, heartbeat180detik.

UI: header statusserver dan waktu update, KPI klik untukfilter, tabel mesin dan pengiriman terakhir, pencarian/dropdown dan pagination. Auto polling5detik dengan abort saat query/scope/unmount; error tidak menampilkan cached status sebagai fresh. Kosong harus dibedakan dari server mati. Link ke logmentah existing.

Aktivasi: backup private database sebelum migrasi additive; ambil credential dari lingkungan existing tanpa mencetaknya, tulis .env mode0600 yang diabaikanGit. Listener192.168.10.212:8081, networkams-dev_default. Gudang2 belum ada pada database; grup pemilik diminta pengguna sebelum registrasi. Tidak menulis data absensi sintetis ke DBaktif dan tidak mengubah pengaturan mesin fisik.

Verifikasi: query validation, isolasi grup/pagination/metrics melalui database disposable, probe healthfail, backend tsc+regresi, frontend lint/typecheck dan browser screenshot. Setelah itu checkpoint dan todo diperbarui.

## Koreksi kebutuhan: review ADMS terpisah dari TCP

Pengguna meminta Office dapat menjalankan tarik TCP normal bersamaan dengan ADMS review. Semua registrasi/heartbeat/penerimaan ADMS kini hanya mengubah schema adms; tidak mengganti transport, status TCP atau data presensi utama. Review log disimpan terpisah, termasuk backfill dari receipt lama tanpa menghapus data utama yang sudah terlanjur diterima. Monitoring menampilkan log per scan dalam tab ADMS terpisah. Permintaan historis opsional hanya menggunakan DATA QUERY ATTLOG dengan rentang tanggal terbatas dan status konfirmasi; tidak ada command arbitrer, clear, reboot atau pengaturan perangkat. Fitur diuji pada fixture dahulu, tidak mengirim perintah fisik otomatis.
