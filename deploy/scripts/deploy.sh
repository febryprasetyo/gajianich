#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

if [[ "$#" -lt 1 ]]; then
  echo "Usage: $0 <version-tag> [app-dir] [backup-dir]" >&2
  exit 1
fi

TARGET_VERSION="$1"
APP_DIR="${2:-/opt/gajianich}"
BACKUP_DIR="${3:-/var/backups/gajianich/postgres}"
COMPOSE_FILE="$APP_DIR/deploy/compose.prod.yml"
STATE_FILE="$APP_DIR/current-version"
ENV_FILE="$APP_DIR/.env"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  # Fallback to local workspace relative path if APP_DIR is custom
  COMPOSE_FILE="$SCRIPT_DIR/../compose.prod.yml"
fi

acquire_lock "/tmp/ams_deploy.lock"

log_info "======================================================"
log_info "Starting deployment of AMS version: $TARGET_VERSION"
log_info "======================================================"

# 1. Run Preflight checks
bash "$SCRIPT_DIR/preflight.sh" "$TARGET_VERSION" "$ENV_FILE"

# 2. Record preceding version
PREVIOUS_VERSION=""
if [[ -f "$STATE_FILE" ]]; then
  PREVIOUS_VERSION=$(tr -d '[:space:]' < "$STATE_FILE")
  log_info "Currently active version recorded as: $PREVIOUS_VERSION"
fi

# 3. Execute pre-deployment PostgreSQL backup
log_info "Creating pre-deployment verified backup..."
bash "$SCRIPT_DIR/backup-postgres.sh" "$BACKUP_DIR"

# 4. Pull target release images
log_info "Pulling release images for $TARGET_VERSION..."
APP_VERSION="$TARGET_VERSION" docker compose -f "$COMPOSE_FILE" pull backend frontend proxy

# 5. Run Database Migration once
log_info "Executing journal-based database migration for $TARGET_VERSION..."
if APP_VERSION="$TARGET_VERSION" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -f "$SCRIPT_DIR/../compose.migrate.yml" run --rm --no-deps backend node dist/db/migrate.js; then
  log_success "Database migration succeeded."
else
  die "Database migration FAILED! Aborting deployment."
fi

# 6. Start/Replace containers
log_info "Replacing application containers with $TARGET_VERSION..."
APP_VERSION="$TARGET_VERSION" docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# 7. Health check verification with retry loop
log_info "Verifying application health..."
HEALTHY=0
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
HEALTH_SLEEP="${HEALTH_SLEEP:-2}"
for i in $(seq 1 "$HEALTH_RETRIES"); do
  if curl -sSf http://127.0.0.1/healthz >/dev/null 2>&1 && curl -sSf http://127.0.0.1:5000/health/ready >/dev/null 2>&1; then
    HEALTHY=1
    log_success "Application health check PASSED (attempt $i)."
    break
  fi
  log_info "Waiting for healthy status... (attempt $i/30)"
  sleep "$HEALTH_SLEEP"
done

# 8. Handle healthcheck failure with automatic application rollback
if [[ "$HEALTHY" -ne 1 ]]; then
  log_error "Post-deployment health checks FAILED for $TARGET_VERSION!"
  if [[ -n "$PREVIOUS_VERSION" ]]; then
    log_warn "Rolling back to preceding version: $PREVIOUS_VERSION..."
    APP_VERSION="$PREVIOUS_VERSION" docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
    # Wait for rollback health
    sleep 3
    if curl -sSf http://127.0.0.1:5000/health/ready >/dev/null 2>&1; then
      log_success "Successfully rolled back to preceding version $PREVIOUS_VERSION."
    else
      log_error "Rollback health check also failed! Manual intervention required."
    fi
  else
    log_error "No preceding version found to roll back to."
  fi
  die "Deployment FAILED. Application containers reverted without database down-migration."
fi

# 9. Atomically record current-version state on success
echo "$TARGET_VERSION" > "${STATE_FILE}.tmp"
mv "${STATE_FILE}.tmp" "$STATE_FILE"

log_success "======================================================"
log_success "Deployment of $TARGET_VERSION SUCCESSFUL!"
log_success "Current version updated to $TARGET_VERSION"
log_success "======================================================"
