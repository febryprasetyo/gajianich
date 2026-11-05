# GAJIANICH Server360 Telemetry Agent (`server-agent`)

Agen ringan lintas platform (Linux & Windows) untuk mengirimkan metrik realtime server (CPU, RAM, Storage, Inodes, TCP Descriptors, Open Ports, PM2, Docker, Database, dan Systemd) setiap 5 detik ke aplikasi **GAJIANICH**.

## Menjalankan Agent

```bash
cd server-agent
npm install
GAJIANICH_HUB_URL="http://127.0.0.1:5000/api/v1/infrastructure/agent/telemetry" \
AGENT_API_KEY="<ISI_AGENT_API_KEY>" \
AGENT_HOSTNAME="srv-local-onprem" \
npm run dev
```

Atau jalankan di latar belakang menggunakan PM2:
```bash
pm2 start "npx tsx src/index.ts" --name collector-agent
```
