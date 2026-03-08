#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups/db"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "${BACKUP_DIR}"

DB_URL="${DATABASE_URL:-file:./dev.db}"
if [[ "${DB_URL}" != file:* ]]; then
  echo "Only sqlite file: URLs are supported by this script."
  exit 1
fi

DB_PATH="${DB_URL#file:}"
if [[ "${DB_PATH}" != /* ]]; then
  DB_PATH="${ROOT_DIR}/${DB_PATH#./}"
fi

if [[ ! -f "${DB_PATH}" ]]; then
  echo "Database file not found: ${DB_PATH}"
  exit 1
fi

DEST="${BACKUP_DIR}/db-${TIMESTAMP}.sqlite"
cp "${DB_PATH}" "${DEST}"
echo "DB backup created: ${DEST}"

