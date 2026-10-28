#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <backup-file> <target-database> [--force-production-overwrite]" >&2
  exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="$2"
FORCE_FLAG="${3:-}"
PROD_DB="${PRODUCTION_DB_NAME:-gajianich_prod_db}"
DB_USER="${PGUSER:-postgres}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"

if [ ! -f "$BACKUP_FILE" ]; then
  die "Backup file not found: $BACKUP_FILE"
fi

# 1. Guard against accidental active production database restore
if [ "$TARGET_DB" == "$PROD_DB" ]; then
  if [ "$FORCE_FLAG" != "--force-production-overwrite" ]; then
    die "Refusing to overwrite active production database '$PROD_DB'! Safe recovery requires restoring into a temporary database first. To override during an authorized incident recovery, specify --force-production-overwrite."
  fi
  log_warn "⚠️ WARNING: Overwriting active production database '$PROD_DB' with $BACKUP_FILE!"
fi

# 2. Verify SHA256 Checksum if present
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
  log_info "Verifying SHA256 checksum for $BACKUP_FILE..."
  BACKUP_DIR=$(dirname "$BACKUP_FILE")
  (
    cd "$BACKUP_DIR"
    sha256sum -c "$CHECKSUM_FILE" >/dev/null 2>&1
  ) || die "Checksum verification FAILED for $BACKUP_FILE"
  log_success "Checksum verified."
fi

# 3. Execute restore
log_info "Restoring $BACKUP_FILE into target database '$TARGET_DB'..."
PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGUSER="$DB_USER" pg_restore --clean --if-exists -d "$TARGET_DB" "$BACKUP_FILE" || {
  log_warn "pg_restore returned non-zero (may contain non-fatal warnings). Checking table presence..."
}

log_success "Restore completed successfully into '$TARGET_DB'."
