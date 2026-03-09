#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_common.sh" "$@"
log "Delete requested for ${SITE_ID} (${DOMAIN})"
log "This script is intentionally non-destructive by default."
log "Implement your deletion policy here (archive first, then remove)."
echo "Delete placeholder complete"
