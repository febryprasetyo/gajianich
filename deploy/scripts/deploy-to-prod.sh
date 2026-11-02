#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Script: deploy-to-prod.sh
# Purpose: One-click remote automated deployment to Production server via Docker
# Target: cmc@192.168.10.23 (Offline LAN / Air-gapped)
# ==============================================================================

PROD_HOST="${PROD_HOST:-cmc@192.168.10.23}"
PROD_DIR="${PROD_DIR:-/home/cmc/app/svc/ams-app}"
PROD_URL="${PROD_URL:-http://192.168.10.23:8080}"
ACTION="${1:-deploy}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}${BOLD}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}${BOLD}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}${BOLD}[ERROR]${NC} $1" >&2
}

check_ssh_connection() {
  log_info "Memeriksa koneksi SSH ke Production (${PROD_HOST})..."
  if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "$PROD_HOST" "echo ok" >/dev/null 2>&1; then
    log_error "Gagal terhubung ke $PROD_HOST melalui SSH."
    log_error "Pastikan SSH key sudah terpasang (ssh-copy-id $PROD_HOST) dan server Prod menyala."
    exit 1
  fi
  log_success "Koneksi SSH ke Production stabil."
}

do_sync() {
  log_info "Sinkronisasi source code dari Dev ke Production..."
  rsync -avz --delete \
    --exclude='.git/index.lock' \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='dist' \
    --exclude='*.log' \
    --exclude='.env*' \
    --exclude='.superpowers' \
    --exclude='.worktrees' \
    --exclude='test-results' \
    --exclude='coverage' \
    "$REPO_DIR/" "$PROD_HOST:$PROD_DIR/"
  log_success "Sinkronisasi source code selesai."
}

do_deploy() {
  local version="${2:-}"
  if [[ -z "$version" ]]; then
    # Auto-generate incremental timestamp tag jika tidak diberikan manual
    version="lan-$(date +%Y%m%d-%H%M%S)"
  fi

  echo -e "${BOLD}======================================================${NC}"
  echo -e "${BOLD}  🚀 MEMULAI DEPLOYMENT KE PRODUCTION LIVE            ${NC}"
  echo -e "  Target Host    : ${PROD_HOST}"
  echo -e "  Target Release : ${version}"
  echo -e "  Production URL : ${PROD_URL}"
  echo -e "${BOLD}======================================================${NC}"

  # 1. Periksa koneksi SSH
  check_ssh_connection

  # 2. Sinkronkan code
  do_sync

  # 3. Jalankan release production di server Prod
  log_info "Mengeksekusi proses build container & release di server Production..."
  ssh -t "$PROD_HOST" "cd '$PROD_DIR' && bash deploy/scripts/lan-production.sh release '$version'"

  # 4. Verifikasi Health Check dari Dev server
  log_info "Melakukan verifikasi HTTP readyz endpoint dari Dev ke Prod..."
  sleep 2
  local healthy=0
  for i in {1..10}; do
    if curl -sSf "${PROD_URL}/readyz" >/dev/null 2>&1; then
      healthy=1
      break
    fi
    log_warn "Menunggu server siap... (percobaan $i/10)"
    sleep 2
  done

  if [[ "$healthy" -eq 1 ]]; then
    echo -e "\n${GREEN}${BOLD}======================================================${NC}"
    echo -e "${GREEN}${BOLD}  🎉 DEPLOYMENT PRODUCTION BERHASIL & LIVE!          ${NC}"
    echo -e "  Release Version : ${version}"
    echo -e "  Production URL  : ${PROD_URL}"
    echo -e "  Status Health   : READY (200 OK)"
    echo -e "${GREEN}${BOLD}======================================================${NC}\n"
  else
    log_error "Endpoint ${PROD_URL}/readyz belum merespons OK. Silakan cek logs:"
    log_error "Jalankan: $0 logs"
    exit 1
  fi
}

case "$ACTION" in
  deploy)
    do_deploy "$@"
    ;;
  sync)
    check_ssh_connection
    do_sync
    ;;
  status)
    check_ssh_connection
    log_info "Status Container Production di $PROD_HOST:"
    ssh "$PROD_HOST" "cd '$PROD_DIR' && bash deploy/scripts/lan-production.sh status"
    ;;
  logs)
    check_ssh_connection
    log_info "Log Container Production di $PROD_HOST:"
    ssh "$PROD_HOST" "cd '$PROD_DIR' && bash deploy/scripts/lan-production.sh logs"
    ;;
  backup)
    check_ssh_connection
    log_info "Membuat backup database PostgreSQL di $PROD_HOST..."
    ssh "$PROD_HOST" "cd '$PROD_DIR' && bash deploy/scripts/lan-production.sh backup"
    ;;
  stop)
    check_ssh_connection
    log_info "Menghentikan layanan production di $PROD_HOST..."
    ssh "$PROD_HOST" "cd '$PROD_DIR' && bash deploy/scripts/lan-production.sh stop"
    ;;
  start)
    check_ssh_connection
    log_info "Menyalakan layanan production di $PROD_HOST..."
    ssh "$PROD_HOST" "cd '$PROD_DIR' && bash deploy/scripts/lan-production.sh start"
    ;;
  *)
    echo -e "${BOLD}Penggunaan: $0 {deploy [versi]|status|logs|backup|stop|start|sync}${NC}"
    echo -e "Contoh:"
    echo -e "  $0 deploy               # Deploy otomatis dengan tag timestamp baru"
    echo -e "  $0 deploy v1.2.0        # Deploy dengan tag versi tertentu"
    echo -e "  $0 status               # Cek status container live di server prod"
    echo -e "  $0 logs                 # Cek log aplikasi prod live"
    echo -e "  $0 backup               # Backup manual database PostgreSQL prod"
    exit 1
    ;;
esac
