#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

TARGET_VERSION="${1:-}"
ENV_FILE="${2:-/opt/gajianich/.env}"

if [[ -z "$TARGET_VERSION" ]]; then
  die "Usage: $0 <version-tag> [env-file]"
fi

# 1. Validate Semantic Version format (v*.*.*)
if ! [[ "$TARGET_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
  die "Invalid version format '$TARGET_VERSION'. Semantic version format required (e.g., v1.0.0, v1.2.3-beta.1)."
fi
log_info "Version format '$TARGET_VERSION' valid."

# 2. Check and load environment file
if [[ ! -f "$ENV_FILE" ]]; then
  die "Environment file '$ENV_FILE' not found."
fi

# Export variables from env file without printing secrets
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# 3. Validate required runtime variables
require_var "DATABASE_URL"
require_var "JWT_SECRET"
require_var "JWT_REFRESH_SECRET"
require_var "AGENT_API_KEY"

# 4. Check available disk space (require at least 500MB)
AVAILABLE_KB=$(df -k . | awk 'NR==2 {print $4}')
if [[ "$AVAILABLE_KB" -lt 512000 ]]; then
  die "Insufficient disk space: only ${AVAILABLE_KB}KB available (at least 500MB required)."
fi
log_info "Disk space check passed (${AVAILABLE_KB}KB available)."

# 5. Check Docker availability
if ! command -v docker >/dev/null 2>&1; then
  die "Docker command not found."
fi

# 6. Check PostgreSQL connectivity
if command -v pg_isready >/dev/null 2>&1; then
  if ! pg_isready >/dev/null 2>&1; then
    log_warn "pg_isready check returned non-zero (PostgreSQL may be starting or remote)."
  else
    log_info "PostgreSQL readiness verified via pg_isready."
  fi
fi

log_success "Preflight checks PASSED for $TARGET_VERSION."
