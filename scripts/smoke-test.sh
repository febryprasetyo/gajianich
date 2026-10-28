#!/usr/bin/env bash
set -euo pipefail

echo "⚡ Starting Docker Compose Smoke Test..."

cleanup() {
  echo "🧹 Cleaning up smoke test containers..."
  docker compose -f compose.dev.yml down -v >/dev/null 2>&1 || true
}

trap cleanup EXIT

# Initialize the fresh database before backend readiness starts checking required tables.
echo "📦 Starting smoke-test PostgreSQL..."
docker compose -f compose.dev.yml up -d --wait postgres
docker compose -f compose.dev.yml exec -T postgres psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-gajianich_dev_db}" -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='gajianich_smoke_runtime') THEN
    CREATE ROLE gajianich_smoke_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
SQL
docker compose -f compose.dev.yml run --rm --build --no-deps -e HR_AUDIT_RUNTIME_ROLE=gajianich_smoke_runtime backend npm run db:migrate
docker compose -f compose.dev.yml up -d --build

# 2. Wait for backend readiness
echo "⏳ Waiting for backend readiness on http://127.0.0.1:5000/health/ready..."
READY=0
for i in $(seq 1 30); do
  if curl -sSf http://127.0.0.1:5000/health/ready >/dev/null 2>&1; then
    READY=1
    echo "✅ Backend is ready (attempt $i)"
    break
  fi
  sleep 2
done

if [[ "$READY" -ne 1 ]]; then
  echo "❌ Error: Backend failed to become ready within timeout" >&2
  docker compose -f compose.dev.yml logs backend
  exit 1
fi

# 4. Verify backend health endpoint after migration
echo "🔍 Verifying backend health..."
HEALTH_RES=$(curl -sSf http://127.0.0.1:5000/health/ready)
echo "Backend response: $HEALTH_RES"

# 5. Verify frontend availability
echo "🔍 Verifying frontend UI availability on http://127.0.0.1:3000..."
FRONTEND_READY=0
for i in $(seq 1 20); do
  if curl -sSf http://127.0.0.1:3000 >/dev/null 2>&1; then
    FRONTEND_READY=1
    echo "✅ Frontend is reachable (attempt $i)"
    break
  fi
  sleep 2
done

if [[ "$FRONTEND_READY" -ne 1 ]]; then
  echo "❌ Error: Frontend failed to respond within timeout" >&2
  docker compose -f compose.dev.yml logs frontend
  exit 1
fi

echo "🎉 All smoke tests PASSED successfully!"
