#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPLOADS_DIR="${ROOT_DIR}/public/uploads"
BACKUP_DIR="${ROOT_DIR}/backups/uploads"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "${BACKUP_DIR}"

if [[ ! -d "${UPLOADS_DIR}" ]]; then
  echo "Uploads directory not found: ${UPLOADS_DIR}"
  exit 1
fi

DEST="${BACKUP_DIR}/uploads-${TIMESTAMP}.tar.gz"
tar -czf "${DEST}" -C "${ROOT_DIR}/public" uploads
echo "Uploads backup created: ${DEST}"

