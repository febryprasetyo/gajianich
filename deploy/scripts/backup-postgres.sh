#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
source "$SCRIPT_DIR/lib.sh"

BACKUP_DIR="${1:-/var/backups/gajianich/postgres}"
DB_NAME="${2:-${PGDATABASE:-gajianich_prod_db}}"
DB_USER="${PGUSER:-postgres}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
RETENTION_COUNT="${RETENTION_COUNT:-14}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILENAME="${DB_NAME}_${TIMESTAMP}.dump"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILENAME}"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

log_info "Initiating PostgreSQL backup for database '$DB_NAME'..."

# 1. Execute pg_dump with custom format (-Fc)
PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGUSER="$DB_USER" pg_dump -Fc "$DB_NAME" -f "$BACKUP_FILE"

# 2. Verify dump integrity using pg_restore --list
if ! pg_restore --list "$BACKUP_FILE" >/dev/null 2>&1; then
  rm -f "$BACKUP_FILE"
  die "Verification failed: pg_restore cannot read the generated backup $BACKUP_FILE"
fi

# 3. Generate SHA256 checksum
(
  cd "$BACKUP_DIR"
  sha256sum "$BACKUP_FILENAME" > "$CHECKSUM_FILE"
)

log_success "Backup created and verified: $BACKUP_FILE (checksum: $CHECKSUM_FILE)"

# 4. Prune old backups based on retention policy
log_info "Pruning backups in $BACKUP_DIR (retaining newest $RETENTION_COUNT)..."
DUMP_FILES=()
while IFS= read -r f; do
  DUMP_FILES+=("$f")
done < <(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}_*.dump" -type f | sort -r)

if [ "${#DUMP_FILES[@]}" -gt "$RETENTION_COUNT" ]; then
  for (( i=RETENTION_COUNT; i<${#DUMP_FILES[@]}; i++ )); do
    OLD_DUMP="${DUMP_FILES[$i]}"
    log_info "Removing old backup: $OLD_DUMP"
    rm -f "$OLD_DUMP" "${OLD_DUMP}.sha256"
  done
fi

log_success "Backup process finished successfully."
