#!/usr/bin/env bats

setup() {
  export TEST_TMPDIR="$(mktemp -d)"
  export BACKUP_DIR="$TEST_TMPDIR/backups"
  export MOCK_BIN="$TEST_TMPDIR/bin"
  mkdir -p "$BACKUP_DIR" "$MOCK_BIN"
  export PATH="$MOCK_BIN:$PATH"

  # Create mock pg_dump
  cat << 'MOCK_PGDUMP' > "$MOCK_BIN/pg_dump"
#!/usr/bin/env bash
if [[ "$*" == *"-Fc"* ]]; then
  # Output a dummy custom format dump
  for arg in "$@"; do
    if [[ "$arg" == *.dump ]]; then
      echo "PGDUMP_HEADER_DUMMY" > "$arg"
    fi
  done
  exit 0
fi
echo "Mock pg_dump error" >&2
exit 1
MOCK_PGDUMP
  chmod +x "$MOCK_BIN/pg_dump"

  # Create mock pg_restore
  cat << 'MOCK_PGRESTORE' > "$MOCK_BIN/pg_restore"
#!/usr/bin/env bash
if [[ "$*" == *"--list"* ]]; then
  echo "; TOC Entry 1"
  exit 0
fi
if [[ "$*" == *"-d "* ]]; then
  echo "Restoring into database..."
  exit 0
fi
echo "Mock pg_restore error" >&2
exit 1
MOCK_PGRESTORE
  chmod +x "$MOCK_BIN/pg_restore"

  # Create mock psql
  cat << 'MOCK_PSQL' > "$MOCK_BIN/psql"
#!/usr/bin/env bash
if [[ "$*" == *"createdb"* || "$*" == *"CREATE DATABASE"* ]]; then
  echo "CREATE DATABASE"
  exit 0
fi
if [[ "$*" == *"DROP DATABASE"* ]]; then
  echo "DROP DATABASE"
  exit 0
fi
if [[ "$*" == *"SELECT"* ]]; then
  echo "1"
  exit 0
fi
exit 0
MOCK_PSQL
  chmod +x "$MOCK_BIN/psql"
}

teardown() {
  rm -rf "$TEST_TMPDIR"
}

@test "backup-postgres.sh creates custom format dump and sha256 checksum" {
  export DB_NAME="gajianich_test_db"
  run bash deploy/scripts/backup-postgres.sh "$BACKUP_DIR" "$DB_NAME"
  [ "$status" -eq 0 ]
  
  DUMP_COUNT=$(ls -1 "$BACKUP_DIR"/*.dump | wc -l)
  [ "$DUMP_COUNT" -ge 1 ]

  LATEST_DUMP=$(ls -1t "$BACKUP_DIR"/*.dump | head -n 1)
  [ -f "${LATEST_DUMP}.sha256" ]

  # Verify checksum validity
  cd "$BACKUP_DIR"
  run sha256sum -c "${LATEST_DUMP}.sha256"
  [ "$status" -eq 0 ]
}

@test "backup-postgres.sh enforces retention limits" {
  export DB_NAME="gajianich_test_db"
  export RETENTION_COUNT=3
  
  for i in {1..5}; do
    touch -d "$i days ago" "$BACKUP_DIR/gajianich_test_db_2026010${i}_000000.dump"
    touch -d "$i days ago" "$BACKUP_DIR/gajianich_test_db_2026010${i}_000000.dump.sha256"
  done

  run bash deploy/scripts/backup-postgres.sh "$BACKUP_DIR" "$DB_NAME"
  [ "$status" -eq 0 ]

  REMAINING_COUNT=$(ls -1 "$BACKUP_DIR"/*.dump | wc -l)
  [ "$REMAINING_COUNT" -le 4 ]
}

@test "restore-postgres.sh fails when missing required arguments" {
  run bash deploy/scripts/restore-postgres.sh
  [ "$status" -ne 0 ]
  [[ "$output" =~ "Usage:" ]]
}

@test "restore-postgres.sh refuses to overwrite active production DB without override flag" {
  DUMP_FILE="$BACKUP_DIR/test.dump"
  echo "PGDUMP_HEADER_DUMMY" > "$DUMP_FILE"
  sha256sum "$DUMP_FILE" > "${DUMP_FILE}.sha256"

  export PRODUCTION_DB_NAME="gajianich_prod_db"
  run bash deploy/scripts/restore-postgres.sh "$DUMP_FILE" "gajianich_prod_db"
  [ "$status" -ne 0 ]
  [[ "$output" =~ "Refusing to overwrite active production database" ]]
}

@test "restore-postgres.sh succeeds restoring into non-production target DB" {
  DUMP_FILE="$BACKUP_DIR/test.dump"
  echo "PGDUMP_HEADER_DUMMY" > "$DUMP_FILE"
  sha256sum "$DUMP_FILE" > "${DUMP_FILE}.sha256"

  export PRODUCTION_DB_NAME="gajianich_prod_db"
  run bash deploy/scripts/restore-postgres.sh "$DUMP_FILE" "gajianich_dev_recovery_db"
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Restore completed successfully" ]]
}

@test "verify-postgres-backup.sh restores into isolated temporary DB and runs checks" {
  DUMP_FILE="$BACKUP_DIR/gajianich_prod_db_20260820_120000.dump"
  echo "PGDUMP_HEADER_DUMMY" > "$DUMP_FILE"
  sha256sum "$DUMP_FILE" > "${DUMP_FILE}.sha256"

  run bash deploy/scripts/verify-postgres-backup.sh "$BACKUP_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Backup verification PASSED" ]]
}
