#!/usr/bin/env bash
# Run the Agent Mesh hub (control plane + router + console) on the always-on LAN machine.
# Usage: HUB_HOST=hub.local ./start-hub.sh
set -euo pipefail
cd "$(dirname "$0")"

HUB_HOST="${HUB_HOST:?set HUB_HOST to the fixed LAN IP or hostname of this machine}"
HUB_PORT="${HUB_PORT:-7400}"
DATA_DIR="${DATA_DIR:-$PWD/data}"
mkdir -p "$DATA_DIR"

# --policy-file only seeds the policy on first boot; afterwards the hub database is the source of truth.
exec agentmesh-one \
  --data-dir "$DATA_DIR" \
  --port "$HUB_PORT" \
  --external-url "http://$HUB_HOST:$HUB_PORT" \
  --policy-file "$PWD/policy.json" \
  --no-join-token \
  --enroll-qr=false
