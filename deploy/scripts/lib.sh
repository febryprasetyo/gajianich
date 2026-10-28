#!/usr/bin/env bash
set -euo pipefail

# ANSI Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" >&2
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" >&2
}

die() {
  log_error "$*"
  exit 1
}

# Require non-empty variable
require_var() {
  local var_name="$1"
  local val="${!var_name:-}"
  if [[ -z "$val" ]]; then
    die "Required environment variable '$var_name' is missing or empty."
  fi
}

# Acquire file lock using flock
acquire_lock() {
  local lock_file="${1:-/tmp/gajianich_deploy.lock}"
  exec 200>"$lock_file"
  if ! flock -n 200; then
    die "Another deployment or maintenance process holds the lock ($lock_file). Exiting."
  fi
  log_info "Acquired lock on $lock_file"
}
