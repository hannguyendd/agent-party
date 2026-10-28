#!/usr/bin/env bash
# Download official Agent Mesh release binaries (github.com/google/agentmesh), verify their checksums, and copy
# out the programs we need.
#   fetch-agentmesh.sh <version> node <dest>   agentmesh-node for every platform, named as the staff installer
#                                               expects: agentmesh-node-<darwin|linux>-<arm64|x86_64>,
#                                               agentmesh-node-windows-<amd64|arm64>.exe
#   fetch-agentmesh.sh <version> one <dest>    agentmesh-one for this machine (the hub)
#   fetch-agentmesh.sh <version> node-here <dest>  agentmesh-node for this machine only (a developer's node)
set -euo pipefail
VERSION="${1:?version, e.g. v0.1.0-rc.10}"; WHAT="${2:?node or one}"; DEST="${3:?destination folder}"
BASE="https://github.com/google/agentmesh/releases/download/$VERSION"
mkdir -p "$DEST"
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
curl -fsSL "$BASE/checksums.txt" -o "$work/checksums.txt"

sha() { if command -v shasum >/dev/null; then shasum -a 256 "$1" | cut -d' ' -f1; else sha256sum "$1" | cut -d' ' -f1; fi; }

# fetch <release OS> <release arch> <program> <output file>
fetch() {
  local os=$1 arch=$2 prog=$3 out=$4 ext=tar.gz exe=""
  [ "$os" = Windows ] && { ext=zip; exe=.exe; }
  local name="agentmesh_${os}_${arch}.$ext"
  [ -f "$work/$name" ] || curl -fsSL "$BASE/$name" -o "$work/$name"
  local want; want=$(grep " $name\$" "$work/checksums.txt" | cut -d' ' -f1)
  [ -n "$want" ] && [ "$(sha "$work/$name")" = "$want" ] || { echo "checksum mismatch for $name" >&2; exit 1; }
  rm -rf "$work/x"; mkdir -p "$work/x"
  if [ "$ext" = zip ]; then unzip -q -o "$work/$name" "$prog$exe" -d "$work/x"; else tar xzf "$work/$name" -C "$work/x" "$prog"; fi
  install -m 755 "$work/x/$prog$exe" "$out"
  echo "  $(basename "$out")  ($VERSION)"
}

if [ "$WHAT" = node ]; then
  fetch Darwin arm64   agentmesh-node "$DEST/agentmesh-node-darwin-arm64"
  fetch Darwin x86_64  agentmesh-node "$DEST/agentmesh-node-darwin-x86_64"
  fetch Linux x86_64   agentmesh-node "$DEST/agentmesh-node-linux-x86_64"
  fetch Linux arm64    agentmesh-node "$DEST/agentmesh-node-linux-arm64"
  fetch Windows x86_64 agentmesh-node "$DEST/agentmesh-node-windows-amd64.exe"
  fetch Windows arm64  agentmesh-node "$DEST/agentmesh-node-windows-arm64.exe"
  echo "$VERSION" > "$DEST/agentmesh.version"
else
  os=$(uname -s); arch=$(uname -m); [ "$arch" = aarch64 ] && arch=arm64
  if [ "$WHAT" = node-here ]; then fetch "$os" "$arch" agentmesh-node "$DEST/agentmesh-node"
  else fetch "$os" "$arch" agentmesh-one "$DEST/agentmesh-one"; fi
fi
