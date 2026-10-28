# HR Attendance — frontend dengan fixture JSON

Instruksi pengguna: implementasikan frontend dari rancangan absensi, kelompok menu bernama HR, seluruh data contoh berada di JSON agar integrasi backend tidak mengubah komponen halaman.

## Keputusan pelaksanaan

- Instruksi terbaru menggantikan kewajiban backend produksi pada tahap ini. Login GAJIANICH tetap digunakan; hanya domain attendance memakai repository demo.
- Kerja pada branch `feat/hr-attendance-frontend` di checkout pengguna agar hasil dapat langsung ditinjau. File gambar pengguna tidak diubah atau dimasukkan commit.
- Data awal: `frontend/public/mock/attendance.json`. Data impor contoh: JSON terpisah. Tidak ada nama karyawan, record, angka ringkasan atau pilihan master yang ditulis di komponen.
- Repository async menjadi satu batas integrasi; hook/context menerima snapshot DTO. Implementasi demo mengambil JSON dan menyimpan perubahan ke sessionStorage per akun, tanpa menulis API bisnis GAJIANICH. Pengganti HTTP dapat menggabungkan endpoint pada spec melalui interface yang sama.
- Header demo menjelaskan bahwa ini data contoh dan perubahan hanya berada di browser. Kegagalan load tidak diganti data sukses palsu. Reset demo menghapus perubahan setelah konfirmasi.
- Semua durasi dihitung dari record final per employee/date. Koreksi menggantikan nilai, draft tidak masuk rekap. Tidak ada potongan/nominal uang.
- Jadwal demo menjadi atribut snapshot record JSON, bukan master shift atau aturan perhitungan baru. Penguncian demo berlaku untuk satu tanggal seluruh karyawan dan memblokir koreksi/commit pada tanggal itu; buka kunci perlu alasan.
- Scope tidak mencakup cutover, schema, API backend, parser BIFF, payroll, leave approval, timesheet proyek atau WFH.

## Halaman

Data Absensi (`/dashboard/attendance`), Impor (`/imports` dan `/imports/[id]`), Kartu (`/employees` dan `/employees/[id]`), Laporan (`/reports`), Aktivitas (`/activity`), Master Karyawan (`/master/employees`), Departemen (`/master/departments`), Lokasi (`/master/locations`), Pemetaan (`/identities`), Akses (`/access`). Semua path setelah halaman utama relatif ke `/dashboard/attendance`.

## Tahapan dan bukti

1. Kontrak, JSON dan repository: uji agregasi, filter, tanggal, CSV, invalid import, konflik, koreksi, lock, revisi, dan akses. Jalankan `node --test src/lib/attendance/*.test.mjs` dari frontend.
2. Shell HR, provider, komponen bersama, Data Absensi, Kartu, Laporan. Gunakan susunan referensi gambar dengan token GAJIANICH.
3. CRUD master, mapping, akses, audit, alur impor JSON → review → simpan. Beri panduan bahwa XLS/BIFF memerlukan backend; jangan mengklaim parser tersedia.
4. Periksa `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` di frontend; jalankan suite backend untuk mendeteksi regresi sesuai aturan repo.
5. Verifikasi browser desktop/mobile, filter, detail, koreksi, rekap, CSV, impor, master, lock dan navigasi. Review perubahan sebelum commit.

## Catatan awal

- Baseline frontend: 27 tes lulus.
- API produksi dan adapter auth existing tidak diubah untuk membuat demo bisa masuk. Verifikasi browser boleh memalsukan respons auth hanya pada harness tes.
