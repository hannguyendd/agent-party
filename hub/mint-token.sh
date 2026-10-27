#!/usr/bin/env bash
# Mint a single-use bootstrap token for one teammate's device.
# Usage: ./mint-token.sh "han laptop"   (prints the token; send it to the teammate privately)
set -euo pipefail
cd "$(dirname "$0")"
HUB_PORT="${HUB_PORT:-7400}"
exec agentmesh-one token create \
  --server "http://127.0.0.1:$HUB_PORT" \
  --data-dir "${DATA_DIR:-$PWD/data}" \
  --description "${1:?describe the device}" \
  --max-usages 1
