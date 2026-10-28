#!/usr/bin/env bats

setup() {
  export TEST_TMPDIR="$(mktemp -d)"
  export APP_DIR="$TEST_TMPDIR/opt/gajianich"
  export BACKUP_DIR="$TEST_TMPDIR/var/backups"
  export MOCK_BIN="$TEST_TMPDIR/bin"
  mkdir -p "$APP_DIR" "$BACKUP_DIR" "$MOCK_BIN"
  export PATH="$MOCK_BIN:$PATH"
  export HEALTH_RETRIES=2
  export HEALTH_SLEEP=0.01

  export STATE_FILE="$APP_DIR/current-version"
  export ENV_FILE="$APP_DIR/.env"

  # Create mock env file
  cat << 'MOCK_ENV' > "$ENV_FILE"
DATABASE_URL=postgresql://gajianich_app:secret@localhost:5432/gajianich_prod_db
JWT_SECRET=production-secret-min-32-chars-long-1234
JWT_REFRESH_SECRET=production-refresh-secret-min-32-chars-1234
AGENT_API_KEY=production-agent-key-min-32-chars-1234
MOCK_ENV

  # Create mock docker command
  cat << 'MOCK_DOCKER' > "$MOCK_BIN/docker"
#!/usr/bin/env bash
if [[ "$*" == *"compose"*"pull"* ]]; then
  echo "Mock docker compose pull"
  exit 0
fi
if [[ "$*" == *"compose"*"run"* ]]; then
  echo "Mock docker compose migration run"
  exit 0
fi
if [[ "$*" == *"compose"*"up"* ]]; then
  echo "Mock docker compose up"
  exit 0
fi
if [[ "$*" == *"compose"*"ps"* ]]; then
  echo "gajianich_proxy_prod running"
  exit 0
fi
exit 0
MOCK_DOCKER
  chmod +x "$MOCK_BIN/docker"

  # Create mock curl command
  cat << 'MOCK_CURL' > "$MOCK_BIN/curl"
#!/usr/bin/env bash
if [[ "${MOCK_CURL_FAIL:-0}" == "1" ]]; then
  exit 1
fi
echo '{"status":"READY"}'
exit 0
MOCK_CURL
  chmod +x "$MOCK_BIN/curl"

  # Create mock pg_isready
  cat << 'MOCK_PGISREADY' > "$MOCK_BIN/pg_isready"
#!/usr/bin/env bash
exit 0
MOCK_PGISREADY
  chmod +x "$MOCK_BIN/pg_isready"

  # Create mock pg_dump & pg_restore
  cat << 'MOCK_PGDUMP' > "$MOCK_BIN/pg_dump"
#!/usr/bin/env bash
for arg in "$@"; do
  if [[ "$arg" == *.dump ]]; then
    echo "PGDUMP_HEADER" > "$arg"
  fi
done
exit 0
MOCK_PGDUMP
  chmod +x "$MOCK_BIN/pg_dump"

  cat << 'MOCK_PGRESTORE' > "$MOCK_BIN/pg_restore"
#!/usr/bin/env bash
exit 0
MOCK_PGRESTORE
  chmod +x "$MOCK_BIN/pg_restore"
}

teardown() {
  rm -rf "$TEST_TMPDIR"
}

@test "preflight.sh validates version format and required environment" {
  run bash deploy/scripts/preflight.sh "invalid-version" "$ENV_FILE"
  [ "$status" -ne 0 ]
  [[ "$output" =~ "Semantic version format required" ]]

  run bash deploy/scripts/preflight.sh "v1.2.0" "$ENV_FILE"
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Preflight checks PASSED" ]]
}

@test "deploy.sh fails without version argument" {
  run bash deploy/scripts/deploy.sh
  [ "$status" -ne 0 ]
  [[ "$output" =~ "Usage:" ]]
}

@test "deploy.sh performs full deployment and records current-version on health success" {
  echo "v1.0.0" > "$STATE_FILE"
  
  run bash deploy/scripts/deploy.sh "v1.1.0" "$APP_DIR" "$BACKUP_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Deployment of v1.1.0 SUCCESSFUL" ]]

  CURRENT=$(cat "$STATE_FILE")
  [ "$CURRENT" == "v1.1.0" ]
}

@test "deploy.sh triggers rollback to previous version when healthcheck fails" {
  echo "v1.0.0" > "$STATE_FILE"
  export MOCK_CURL_FAIL=1

  run bash deploy/scripts/deploy.sh "v1.2.0-unhealthy" "$APP_DIR" "$BACKUP_DIR"
  [ "$status" -ne 0 ]
  [[ "$output" =~ "Rolling back to preceding version: v1.0.0" ]]

  CURRENT=$(cat "$STATE_FILE")
  [ "$CURRENT" == "v1.0.0" ]
}

@test "rollback.sh restores specified version tag" {
  echo "v1.2.0" > "$STATE_FILE"

  run bash deploy/scripts/rollback.sh "v1.1.0" --yes "$APP_DIR"
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Rollback to v1.1.0 SUCCESSFUL" ]]

  CURRENT=$(cat "$STATE_FILE")
  [ "$CURRENT" == "v1.1.0" ]
}
