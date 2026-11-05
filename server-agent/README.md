# GAJIANICH Server360 Telemetry Agent (`gajianich-server-agent`)

Agen telemetri real-time ringan berbasis **Node.js + TypeScript** untuk memantau kesehatan kernel Linux, perangkat keras, dan orkestrasi layanan (**Docker Containers, Database Engines, PM2 Processes, & Systemd Daemons**) serta mengirimkannya setiap 5 detik ke **GAJIANICH Server360 Hub**.

---

## Fitur Utama

1. **Real-Time Linux Kernel & Hardware Telemetry**:
   - **CPU & Scheduler**: Penggunaan CPU akurat dari `/proc/stat`, I/O Wait %, CPU Steal %, Load Average (`1m / 5m / 15m`), Context Switches/s, Interrupts/s, serta deteksi Zombie Processes.
   - **Memory & Swap**: Kalkulasi akurat dari `/proc/meminfo` (Total, Used, Available, Buffers/Cached, dan Swap Usage).
   - **Filesystem, Disk I/O & Inodes**: Kapasitas disk root (`df -B1`), pemakaian Inode (`df -i`), serta throughput Read/Write MB/s dan IOPS dari `/proc/diskstats`.
   - **Network & TCP Stack**: Throughput RX/TX dari `/proc/net/dev`, TCP Socket States (`ESTABLISHED`, `TIME_WAIT`, `SYN_RECV`) dari `/proc/net/tcp`, TCP Retransmission Rate dari `/proc/net/snmp`, File Descriptors (`/proc/sys/fs/file-nr`), dan Open Listening Ports (`ss -tlnp`).
2. **Multi-Service Discovery & Action Queue**:
   - **Docker Containers**: Inspeksi seluruh kontainer (`docker ps -a` & `docker stats --no-stream`), lengkap dengan streaming log dan eksekusi remote `docker restart`.
   - **Database Engines**: Deteksi otomatis instance PostgreSQL, TimescaleDB, Redis, MySQL, dan MariaDB beserta metrik CPU/RAM.
   - **PM2 Processes**: Integrasi penuh dengan `pm2 jlist` untuk memantau aplikasi Node.js yang dikelola PM2.
   - **Systemd Daemons**: Inspeksi status unit layanan sistem melalui `systemctl show`.
3. **Per-Server Unique API Key (`X-Agent-Key`)**:
   - Mendukung kunci autentikasi unik per mesin (`gjn_srv_<hostname>_<token>`) yang diverifikasi menggunakan hash SHA-256 di sisi server GAJIANICH.

---

## Cara Menjalankan dengan Docker Compose (Direkomendasikan)

Agen ini dirancang untuk berjalan di dalam kontainer Docker menggunakan namespace host (`network_mode: host`, `pid: host`, `privileged: true`) dan socket Docker agar tetap dapat membaca metrik asli dari host fisik/VPS.

### 1. Clone Repository

```bash
git clone https://github.com/febryprasetyo/gajianich-server-agent.git
cd gajianich-server-agent
```

### 2. Konfigurasi Environment (`.env`)

Salin file `.env.example` menjadi `.env` lalu masukkan `AGENT_API_KEY` unik yang didapat saat mendaftarkan server di menu **GAJIANICH -> Monitoring Server -> Registrasi Server**:

```bash
cp .env.example .env
nano .env
```

Contoh isi `.env`:
```env
GAJIANICH_HUB_URL=http://127.0.0.1:5000/api/v1/infrastructure/agent/telemetry
AGENT_API_KEY=gjn_srv_nama_host_token_unik_anda
AGENT_HOSTNAME=fastpec-MINI-S
AGENT_DISPLAY_NAME=fastpec-MINI-S (Local Host Server)
AGENT_SERVER_TYPE=Physical
AGENT_ROLE_BADGE=ON-PREMISE HOST
AGENT_INTERVAL_MS=5000
```

### 3. Jalankan Kontainer

```bash
docker compose up -d --build
```

Periksa status dan log kontainer:
```bash
docker ps --filter "name=gajianich_server_agent"
docker logs -f gajianich_server_agent
```

---

## Cara Menjalankan Secara Native (Node.js / PM2)

Jika ingin menjalankan langsung di host tanpa Docker:

```bash
npm install
npm run build
GAJIANICH_HUB_URL="http://127.0.0.1:5000/api/v1/infrastructure/agent/telemetry" \
AGENT_API_KEY="gjn_srv_..." \
AGENT_HOSTNAME="$(hostname)" \
npm start
```
