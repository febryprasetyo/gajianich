#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
adms_test_suffix="$$"
adms_test_network="gajianich-adms-test-${adms_test_suffix}"
adms_test_database="gajianich-adms-db-${adms_test_suffix}"
adms_test_service="gajianich-adms-service-${adms_test_suffix}"
cleanup() {
  docker rm -fv "$adms_test_service" "$adms_test_database" >/dev/null 2>&1 || true
  docker network rm "$adms_test_network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build --target test -t gajianich-adms:test .
docker network create "$adms_test_network" >/dev/null
docker run -d --name "$adms_test_database" --network "$adms_test_network" \
  -e POSTGRES_PASSWORD=adms-test-only -e POSTGRES_DB=gajianich_adms_test postgres:16-alpine >/dev/null
for ((adms_test_attempt=0; adms_test_attempt<30; adms_test_attempt++)); do
  if docker exec "$adms_test_database" pg_isready -U postgres -d gajianich_adms_test >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$adms_test_database" pg_isready -U postgres -d gajianich_adms_test

docker run --rm gajianich-adms:test npm test
docker run --rm --network "$adms_test_network" \
  -e TEST_DATABASE_URL="postgresql://postgres:adms-test-only@${adms_test_database}:5432/gajianich_adms_test" \
  gajianich-adms:test npm run test:integration

docker run -d --name "$adms_test_service" --network "$adms_test_network" --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true \
  -e DATABASE_URL="postgresql://postgres:adms-test-only@${adms_test_database}:5432/gajianich_adms_test" \
  gajianich-adms:test node src/server.mjs >/dev/null
for ((adms_test_attempt=0; adms_test_attempt<30; adms_test_attempt++)); do
  if docker exec "$adms_test_service" node -e "fetch('http://127.0.0.1:8081/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo 'ADMS container ready against disposable PostgreSQL'
    exit 0
  fi
  sleep 1
done
echo 'ADMS readiness failed' >&2
exit 1
