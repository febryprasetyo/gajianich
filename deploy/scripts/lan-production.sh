#!/usr/bin/env bash
set -euo pipefail
umask 077
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="${GAJIANICH_PROD_DIR:-$(dirname "$REPO_DIR")/gajianich-production}"
ACTION="${1:-status}"
mkdir -p "$RUNTIME_DIR"
exec 9>"$RUNTIME_DIR/deploy.lock"
flock -n 9 || { echo 'Another production operation is running' >&2; exit 1; }
ENV_FILE="$RUNTIME_DIR/.env"

compose() {
  docker compose --env-file "$ENV_FILE" -p gajianich-live -f "$RELEASE_DIR/compose.yml" "$@"
}
load_current() {
  test -f "$RUNTIME_DIR/current-version" || { echo 'No active production release' >&2; exit 1; }
  VERSION="$(cat "$RUNTIME_DIR/current-version")"
  export APP_VERSION="$VERSION"
  RELEASE_DIR="$RUNTIME_DIR/releases/$VERSION"
}
backup() {
  mkdir -p "$RUNTIME_DIR/backups"
  local target
  target="$RUNTIME_DIR/backups/$(date -u +%Y%m%dT%H%M%S)-$VERSION.dump"
  compose exec -T postgres pg_dump -U gajianich_app -d gajianich_prod_db -Fc > "$target.tmp"
  compose exec -T postgres pg_restore --list < "$target.tmp" >/dev/null
  mv "$target.tmp" "$target"
  echo "Verified database backup: $target"
}
case "$ACTION" in
  init)
    test ! -e "$ENV_FILE" || { echo "Already initialized: $ENV_FILE"; exit 0; }
    python3 - "$RUNTIME_DIR" <<'PY'
from pathlib import Path
import secrets, sys, os
root = Path(sys.argv[1])
values = {'LAN_BIND_ADDRESS':'192.168.10.23', 'HTTP_PORT':'8080',
          'POSTGRES_PASSWORD':secrets.token_hex(32), 'JWT_SECRET':secrets.token_hex(32),
          'JWT_REFRESH_SECRET':secrets.token_hex(32), 'AGENT_API_KEY':secrets.token_hex(32)}
# Only hex avoids URL encoding and accidental placeholder patterns.
for name, content in [('.env', ''.join(f'{k}={v}\n' for k,v in values.items())),
                      ('initial-admin-password', 'Aa9!' + secrets.token_hex(24) + '\n')]:
    fd=os.open(root/name, os.O_WRONLY|os.O_CREAT|os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f: f.write(content)
print(f'Production env and initial admin password created in {root} (mode 600)')
PY
    ;;
  release)
    test -f "$ENV_FILE" || { echo 'Run init first' >&2; exit 1; }
    VERSION="${2:?Usage: lan-production.sh release <unique-version>}"
    [[ "$VERSION" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$ ]] || { echo 'Invalid version' >&2; exit 1; }
    RELEASE_DIR="$RUNTIME_DIR/releases/$VERSION"
    test ! -e "$RELEASE_DIR" || { echo 'Version already exists; use a new version' >&2; exit 1; }
    for image in backend frontend; do
      if docker image inspect "gajianich-lan-$image:$VERSION" >/dev/null 2>&1; then
        echo "Image tag already exists: gajianich-lan-$image:$VERSION; use a new version" >&2; exit 1
      fi
    done
    # Build from a source snapshot, so edits during a build cannot mix revisions.
    BUILD_DIR="$(mktemp -d "$RUNTIME_DIR/build.XXXXXX")"
    trap 'rm -rf "$BUILD_DIR"' EXIT
    tar -C "$REPO_DIR" --exclude=node_modules --exclude=.next --exclude=dist --exclude=.git --exclude='.env*' --exclude=.superpowers --exclude=.worktrees -cf - backend frontend | tar -C "$BUILD_DIR" -xf -
    docker build --target production --memory 2g --cpu-quota 200000 -t "gajianich-lan-backend:$VERSION" "$BUILD_DIR/backend"
    docker build --target production --memory 2g --cpu-quota 200000 -t "gajianich-lan-frontend:$VERSION" "$BUILD_DIR/frontend"
    mkdir -p "$RELEASE_DIR"
    python3 - "$BUILD_DIR" "$RELEASE_DIR/source-sha256" <<'PY'
from pathlib import Path
import hashlib, sys
root=Path(sys.argv[1])
with open(sys.argv[2], 'w') as out:
    for path in sorted(root.rglob('*')):
        if path.is_file():
            out.write(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(root)}\n')
PY
    cp "$REPO_DIR/deploy/compose.lan.yml" "$RELEASE_DIR/compose.yml"
    cp "$REPO_DIR/deploy/compose.migrate.yml" "$RELEASE_DIR/compose.migrate.yml"
    if [ -f "$REPO_DIR/deploy/nginx.lan.conf" ]; then
      cp "$REPO_DIR/deploy/nginx.lan.conf" "$RELEASE_DIR/nginx.conf"
    else
      cp "$REPO_DIR/deploy/nginx.lan.conf.example" "$RELEASE_DIR/nginx.conf"
    fi
    git -C "$REPO_DIR" rev-parse HEAD > "$RELEASE_DIR/source-commit"
    git -C "$REPO_DIR" diff --stat > "$RELEASE_DIR/source-changes"
    PREVIOUS=""
    if test -f "$RUNTIME_DIR/current-version"; then
      PREVIOUS="$(cat "$RUNTIME_DIR/current-version")"
      export APP_VERSION="$PREVIOUS"
      RELEASE_DIR="$RUNTIME_DIR/releases/$PREVIOUS"
      backup
      RELEASE_DIR="$RUNTIME_DIR/releases/$VERSION"
    fi
    export APP_VERSION="$VERSION"
    compose config -q
    compose up -d --wait postgres
    docker compose --env-file "$ENV_FILE" -p gajianich-live -f "$RELEASE_DIR/compose.yml" -f "$RELEASE_DIR/compose.migrate.yml" run --rm --no-deps -T backend node dist/db/migrate.js
    if test -z "$PREVIOUS"; then
      INITIAL_ADMIN_PASSWORD="$(cat "$RUNTIME_DIR/initial-admin-password")"
      export INITIAL_ADMIN_PASSWORD
      compose run --rm -T -e INITIAL_ADMIN_PASSWORD backend node dist/db/seed.js
      unset INITIAL_ADMIN_PASSWORD
    fi
    if ! compose up -d --wait --wait-timeout 180; then
      echo 'Release failed health checks.' >&2
      if test -n "$PREVIOUS"; then
        export APP_VERSION="$PREVIOUS"
        RELEASE_DIR="$RUNTIME_DIR/releases/$PREVIOUS"
        compose up -d --wait --wait-timeout 180
        echo "Application restored to $PREVIOUS; database migrations were not reversed." >&2
      fi
      exit 1
    fi
    printf '%s\n' "$VERSION" > "$RUNTIME_DIR/current-version.tmp"
    mv "$RUNTIME_DIR/current-version.tmp" "$RUNTIME_DIR/current-version"
    echo "Production release $VERSION is healthy."
    ;;
  status) load_current; compose ps ;;
  logs) load_current; compose logs --tail 80 ;;
  backup) load_current; backup ;;
  stop) load_current; compose stop ;;
  start) load_current; compose up -d --wait --wait-timeout 180 ;;
  *) echo 'Usage: lan-production.sh {init|release <version>|status|logs|backup|stop|start}' >&2; exit 1 ;;
esac
