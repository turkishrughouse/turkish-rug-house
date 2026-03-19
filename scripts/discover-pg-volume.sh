#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <docker-volume-name>" >&2
  exit 1
fi

volume_name="$1"
script_dir="$(cd "$(dirname "$0")" && pwd)"

docker run --rm \
  -e SOURCE_VOLUME_NAME="$volume_name" \
  -v "${volume_name}:/source:ro" \
  -v "${script_dir}/inspect-pg-copy-inside-container.sh:/inspect.sh:ro" \
  --tmpfs /var/lib/postgresql/data \
  postgres:16 \
  bash /inspect.sh
