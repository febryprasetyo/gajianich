#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

BACKUP_DIR="${1:-/var/backups/gajianich/postgres}"
DB_USER="${PGUSER:-postgres}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"

log_info "Searching for newest verified PostgreSQL backup in $BACKUP_DIR..."

NEWEST_DUMP=$(find "$BACKUP_DIR" -maxdepth 1 -name "*.dump" -type f | sort -r | head -n 1)

if [ -z "$NEWEST_DUMP" ]; then
  die "No backup dump files found in $BACKUP_DIR to verify."
fi

log_info "Selected newest backup: $NEWEST_DUMP"

VERIFY_DB="ams_verify_$(date '+%Y%m%d_%H%M%S')"

cleanup() {
  log_info "Cleaning up verification database $VERIFY_DB..."
  PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGUSER="$DB_USER" psql -c "DROP DATABASE IF EXISTS \"$VERIFY_DB\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log_info "Creating temporary verification database: $VERIFY_DB..."
PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGUSER="$DB_USER" psql -c "CREATE DATABASE \"$VERIFY_DB\";" >/dev/null

log_info "Executing restore test into $VERIFY_DB..."
bash "$SCRIPT_DIR/restore-postgres.sh" "$NEWEST_DUMP" "$VERIFY_DB"

log_info "Testing database queries on $VERIFY_DB..."
PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGUSER="$DB_USER" psql -d "$VERIFY_DB" -c "SELECT 1;" >/dev/null

log_success "Backup verification PASSED: $NEWEST_DUMP is fully restorable and readable."
