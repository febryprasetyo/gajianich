# Accurate Multi-Server Monitoring

## Alur data

- `accurate_agent.ps1` berjalan pada setiap server Accurate.
- Heartbeat pertama mendaftarkan server berdasarkan hostname.
- Heartbeat berikutnya memperbarui IP, OS, uptime, service/process Accurate dan
  Firebird, serta mengganti snapshot file `.gdb` milik server tersebut.
- Membuka halaman monitoring hanya membaca PostgreSQL.
- Daftar lisensi berubah hanya ketika pengguna menekan **Sync Semua Lisensi** atau
  **Sync lisensi** pada satu server.
- Sync lisensi mengganti snapshot server target secara atomik. Kegagalan satu server
  tidak menghapus snapshot server lain.

## Konfigurasi backend

Tambahkan secret yang sama pada environment backend development/production:

```env
AGENT_API_KEY=<random-secret-minimal-32-character>
```

Pada development, backend default hanya bind ke localhost. Agar agent dari server lain di LAN dapat mendaftar, isi root `.env`:

```env
BACKEND_BIND_ADDRESS=0.0.0.0
```

Buka TCP port 5000 pada firewall hanya dari subnet atau alamat server Accurate yang dipercaya. PostgreSQL tetap bind ke localhost. Gunakan IP LAN mesin GAJIANICH pada `apiUrl` agent, bukan `localhost`.

Jalankan migration sebelum menerima signal agent:

```bash
npm run db:migrate --prefix backend
```

## Konfigurasi setiap server Accurate

1. Salin `docs/accurate_agent.ps1` ke server.
2. Salin `docs/accurate_agent.config.example.json` menjadi `config.json` pada folder
   yang sama.
3. Isi `apiUrl`, `apiKey`, dan `scanPaths` sesuai server tersebut.
4. Pastikan `apiKey` sama dengan `AGENT_API_KEY` backend.
5. Uji satu kali:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\accurate_agent.ps1 -Once
```

Payload mode `-Once` menampilkan data yang akan dikirim. Secret tidak ditampilkan
oleh script, tetapi console dan `agent.log` tetap harus dibatasi untuk administrator.

Setelah valid, jalankan agent melalui Windows Task Scheduler saat startup dengan akun
yang memiliki akses baca ke seluruh `scanPaths`. Server tambahan tidak memerlukan
perubahan kode GAJIANICH; cukup gunakan script/config yang sama dengan hostname server yang
unik.

## Keamanan

- Endpoint agent tidak memakai JWT pengguna, tetapi wajib `X-Agent-Key`.
- `config.json` berisi secret dan tidak boleh dimasukkan ke Git.
- Jangan menggunakan example key pada production.
- Batasi endpoint backend dan port License Server pada jaringan lokal.
- Rotasi `AGENT_API_KEY` dengan memperbarui backend dan seluruh agent secara
  terkoordinasi.
