#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_common.sh" "$@"
if [[ -z "$ROOT_PATH" || ! -d "$ROOT_PATH" ]]; then
  echo "Invalid ROOT_PATH: $ROOT_PATH"
  exit 1
fi
log "Deploy staging for ${SITE_ID} (${DOMAIN})"
cd "$ROOT_PATH"
git fetch --all --prune
git checkout "$STAGING_BRANCH"
git pull --ff-only origin "$STAGING_BRANCH"
npm ci
npm run build
if [[ -n "$PROCESS_NAME" ]]; then
  pm2 reload "$PROCESS_NAME" --update-env || pm2 restart "$PROCESS_NAME" --update-env
fi
echo "Staging deploy done"
