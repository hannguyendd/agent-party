#!/usr/bin/env bash
# Run this device's agentmesh-node, publishing the agents listed in the generated agentmesh-node.yaml.
# First run: put the bootstrap token from the hub admin in data/bootstrap-token.
# Usage: HUB_URL=http://hub.local:7400 ./scripts/start-mesh-node.sh
# Restart it after adding or removing agents (the node reads its services only at startup).
set -euo pipefail
cd "$(dirname "$0")/.."

HUB_URL="${HUB_URL:?set HUB_URL, e.g. http://hub.local:7400}"
DATA_DIR="${AGENTFLEET_DATA_DIR:-$PWD/data}"
NODE_BIND="${NODE_BIND:-127.0.0.1:8080}"
mkdir -p "$DATA_DIR/mesh-node"

# The node API token the Python server uses for discovery and the /mesh proxy.
TOKEN_FILE="$DATA_DIR/mesh-api-token"
[[ -s "$TOKEN_FILE" ]] || { openssl rand -hex 32 > "$TOKEN_FILE"; chmod 600 "$TOKEN_FILE"; }

[[ -f "$DATA_DIR/agentmesh-node.yaml" ]] || uv run agentfleet-node mesh-config >/dev/null

args=(
  --control-plane "$HUB_URL"
  --config "$DATA_DIR/agentmesh-node.yaml"
  --data-dir "$DATA_DIR/mesh-node"
  --bind-addr "$NODE_BIND"
  --api-token-path "$TOKEN_FILE"
  --allow-loopback
)
# v1 is LAN-only over plain http: trust the hub on this network.
[[ "$HUB_URL" == http://* ]] && args+=(--insecure-control-plane)
# Enroll with the single-use token only until this node has an identity.
[[ -f "$DATA_DIR/bootstrap-token" && ! -f "$DATA_DIR/mesh-node/agent.db" ]] && args+=(--bootstrap-token-path "$DATA_DIR/bootstrap-token")
[[ -n "${MESH_LISTEN:-}" ]] && args+=(--listen "$MESH_LISTEN")

exec agentmesh-node run "${args[@]}"
