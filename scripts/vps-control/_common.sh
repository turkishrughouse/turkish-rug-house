#!/usr/bin/env bash
set -euo pipefail

SITE_ID="${1:-}"
DOMAIN="${2:-}"
ROOT_PATH="${3:-}"
UPLOADS_PATH="${4:-}"
DB_PATH="${5:-}"
PROCESS_NAME="${6:-}"
STAGING_BRANCH="${7:-develop}"
LIVE_BRANCH="${8:-main}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-$PWD/backups/sites}"
mkdir -p "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}
