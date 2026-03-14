#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PERSISTENT_UPLOADS_DIR="${UPLOAD_ROOT_DIR:-/var/www/uploads}"
PUBLIC_UPLOADS_PATH="${ROOT_DIR}/public/uploads"
BACKUP_DIR="${BACKUP_DIR:-/tmp/rughouse-public-uploads-backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "${PERSISTENT_UPLOADS_DIR}"
mkdir -p "${BACKUP_DIR}"

if [[ -L "${PUBLIC_UPLOADS_PATH}" ]]; then
  echo "public/uploads is already a symlink:"
  ls -ld "${PUBLIC_UPLOADS_PATH}"
  exit 0
fi

if [[ -d "${PUBLIC_UPLOADS_PATH}" ]]; then
  rsync -a "${PUBLIC_UPLOADS_PATH}/" "${PERSISTENT_UPLOADS_DIR}/"
  mv "${PUBLIC_UPLOADS_PATH}" "${BACKUP_DIR}/uploads-${TIMESTAMP}"
fi

ln -s "${PERSISTENT_UPLOADS_DIR}" "${PUBLIC_UPLOADS_PATH}"

echo "Persistent uploads ready."
ls -ld "${PUBLIC_UPLOADS_PATH}" "${PERSISTENT_UPLOADS_DIR}"
