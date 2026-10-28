#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

if [[ "$#" -lt 1 ]]; then
  echo "Usage: $0 <target-version> [--yes] [app-dir]" >&2
  exit 1
fi

TARGET_VERSION="$1"
CONFIRM_FLAG="${2:-}"
APP_DIR="${3:-/opt/gajianich}"

if [[ "$CONFIRM_FLAG" != "--yes" && -t 0 ]]; then
  read -r -p "Are you sure you want to rollback to $TARGET_VERSION? (y/N): " response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled by operator."
    exit 0
  fi
fi

COMPOSE_FILE="$APP_DIR/deploy/compose.prod.yml"
STATE_FILE="$APP_DIR/current-version"
ENV_FILE="$APP_DIR/.env"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  COMPOSE_FILE="$SCRIPT_DIR/../compose.prod.yml"
fi

acquire_lock "/tmp/gajianich_deploy.lock"

log_info "Initiating explicit rollback to version: $TARGET_VERSION"

# 1. Run Preflight checks
bash "$SCRIPT_DIR/preflight.sh" "$TARGET_VERSION" "$ENV_FILE"

# 2. Pull and start target version
APP_VERSION="$TARGET_VERSION" docker compose -f "$COMPOSE_FILE" pull backend frontend proxy
APP_VERSION="$TARGET_VERSION" docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# 3. Verify health
log_info "Verifying health for $TARGET_VERSION..."
HEALTHY=0
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
HEALTH_SLEEP="${HEALTH_SLEEP:-2}"
for i in $(seq 1 "$HEALTH_RETRIES"); do
  if curl -sSf http://127.0.0.1:5000/health/ready >/dev/null 2>&1; then
    HEALTHY=1
    log_success "Health check PASSED for $TARGET_VERSION (attempt $i)."
    break
  fi
  log_info "Waiting for healthy status... (attempt $i/$HEALTH_RETRIES)"
  sleep "$HEALTH_SLEEP"
done

if [[ "$HEALTHY" -ne 1 ]]; then
  die "Health check failed after rolling back to $TARGET_VERSION!"
fi

# 4. Atomically record state
echo "$TARGET_VERSION" > "${STATE_FILE}.tmp"
mv "${STATE_FILE}.tmp" "$STATE_FILE"

log_success "Rollback to $TARGET_VERSION SUCCESSFUL."
