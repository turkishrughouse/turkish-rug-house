#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_common.sh" "$@"
log "SSL enable requested for ${DOMAIN}."
log "Hook this script to your certbot/caddy/nginx automation."
echo "OK"
