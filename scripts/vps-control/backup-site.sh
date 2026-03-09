#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_common.sh" "$@"
ZIP_PATH="${BACKUP_DIR}/${SITE_ID}-${TIMESTAMP}.zip"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -d "$ROOT_PATH" ]]; then
  mkdir -p "$TMP_DIR/code"
  cp -R "$ROOT_PATH"/. "$TMP_DIR/code/"
fi

if [[ -n "$DB_PATH" && -f "$DB_PATH" ]]; then
  mkdir -p "$TMP_DIR/db"
  cp "$DB_PATH" "$TMP_DIR/db/"
fi

if [[ -d "$UPLOADS_PATH" ]]; then
  mkdir -p "$TMP_DIR/uploads"
  cp -R "$UPLOADS_PATH"/. "$TMP_DIR/uploads/"
fi

cd "$TMP_DIR"
zip -r "$ZIP_PATH" . >/dev/null
log "Backup created: $ZIP_PATH"
echo "$ZIP_PATH"
