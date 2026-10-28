#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dev}"

if [[ "$MODE" == "dev" ]]; then
  FILE="compose.dev.yml"
  if [[ ! -f "$FILE" ]]; then
    echo "❌ Error: $FILE not found" >&2
    exit 1
  fi

  CONTENT=$(cat "$FILE")

  for svc in postgres backend frontend; do
    if ! grep -q "^  ${svc}:" "$FILE"; then
      echo "❌ Error: Missing service '$svc' in $FILE" >&2
      exit 1
    fi
  done

  if ! echo "$CONTENT" | grep -q "gajianich_dev_pgdata"; then
    echo "❌ Error: Missing named volume 'gajianich_dev_pgdata' in $FILE" >&2
    exit 1
  fi

  if ! echo "$CONTENT" | grep -E -q "127.0.0.1:.*5432"; then
    echo "❌ Error: PostgreSQL port 5432 must be bound to 127.0.0.1 only in $FILE" >&2
    exit 1
  fi

  if ! echo "$CONTENT" | grep -q "health/ready"; then
    echo "❌ Error: Backend healthcheck must check /health/ready in $FILE" >&2
    exit 1
  fi

  if ! echo "$CONTENT" | grep -q "condition: service_healthy"; then
    echo "❌ Error: Expected service dependencies with 'condition: service_healthy' in $FILE" >&2
    exit 1
  fi

  if command -v docker >/dev/null 2>&1; then
    docker compose -f "$FILE" config >/dev/null
  fi

  echo "✅ $FILE validated successfully!"

elif [[ "$MODE" == "prod" ]]; then
  FILE="deploy/compose.prod.yml"
  NGINX_CONF="deploy/nginx.conf"
  ENV_EXAMPLE="deploy/.env.example"

  if [[ ! -f "$FILE" ]]; then
    echo "❌ Error: $FILE not found" >&2
    exit 1
  fi

  if [[ ! -f "$NGINX_CONF" ]]; then
    echo "❌ Error: $NGINX_CONF not found" >&2
    exit 1
  fi

  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    echo "❌ Error: $ENV_EXAMPLE not found" >&2
    exit 1
  fi

  CONTENT=$(cat "$FILE")

  for svc in proxy backend frontend; do
    if ! grep -q "^  ${svc}:" "$FILE"; then
      echo "❌ Error: Missing service '$svc' in $FILE" >&2
      exit 1
    fi
  done

  if ! echo "$CONTENT" | grep -q "APP_VERSION"; then
    echo "❌ Error: Production Compose must use APP_VERSION variable" >&2
    exit 1
  fi

  if echo "$CONTENT" | grep -q ":latest"; then
    echo "❌ Error: Production Compose must never use :latest tag" >&2
    exit 1
  fi

  if echo "$CONTENT" | grep -q "docker.sock"; then
    echo "❌ Error: Production Compose must never mount docker.sock" >&2
    exit 1
  fi

  NGINX_CONTENT=$(cat "$NGINX_CONF")
  if ! echo "$NGINX_CONTENT" | grep -q "location /api/v1"; then
    echo "❌ Error: nginx.conf must route /api/v1 to backend" >&2
    exit 1
  fi

  if command -v docker >/dev/null 2>&1; then
    APP_VERSION="v1.0.0" DATABASE_URL="postgresql://user:pass@host.docker.internal:5432/gajianich_prod_db" AGENT_API_KEY="validation-agent-key" CORS_ALLOWED_ORIGINS="https://gajianich.example.com" JWT_SECRET="prod-secret-12345" JWT_REFRESH_SECRET="prod-refresh-12345" docker compose -f "$FILE" config >/dev/null
  fi

  echo "✅ Production Compose and Nginx configuration validated successfully!"
else
  echo "❌ Unknown validation mode: $MODE (expected 'dev' or 'prod')" >&2
  exit 1
fi
