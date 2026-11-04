# Implementation Plan: Redis Caching Integration for GAJIANICH

## 1. Overview
Integrasi Redis 7 sebagai fast in-memory caching layer untuk mempercepat response time API backend GAJIANICH, terutama user session validation, rekap KPI absensi harian, dan PIN resolution mesin absensi.

---

## 2. Phase-by-Phase Tasks

### Phase 1: Dependency & Client Setup
- [ ] Install `ioredis` dan `@types/ioredis` di subdirektori `backend/`.
- [ ] Buat modul singleton `backend/src/lib/redis.ts` dengan penanganan error gracefully (jika Redis offline, fungsi cache langsung pass-through ke DB).
- [ ] Buat automated unit test untuk `redis.ts` (test mock get/set/del/fallback saat offline).

### Phase 2: Docker Compose & Infrastructure
- [ ] Tambahkan service `redis` (`redis:7-alpine`, limit 128MB RAM) ke `deploy/compose.lan.yml` dan `deploy/compose.prod.yml`.
- [ ] Tambahkan konfigurasi `REDIS_URL=redis://redis:6379` pada environment `backend`.
- [ ] Pastikan healthcheck Redis aktif (`redis-cli ping`).

### Phase 3: Application Cache Integration
- [ ] Pasang caching pada `GET /api/v1/auth/session` di `backend/src/routes/auth.ts` / controller.
- [ ] Pasang cache invalidation saat user logout, password update, atau profile edit.
- [ ] Pasang caching pada KPI summary absensi di `backend/src/controllers/attendanceMobileController.ts` / `attendanceService.ts`.
- [ ] Pasang cache invalidation saat presensi baru berhasil dicatat.

### Phase 4: Automated Verification Loop & Deployment
- [ ] Jalankan unit test backend (`npm test --prefix backend`).
- [ ] Jalankan typecheck build (`npm run build --prefix backend`).
- [ ] Deploy ke server produksi (`cmc@192.168.10.23`) dengan `deploy/scripts/deploy-to-prod.sh deploy`.
- [ ] Verifikasi benchmark latency TTFB sebelum vs sesudah Redis pada endpoint API.

