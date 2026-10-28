#!/usr/bin/env bash
# Download the released node package for a version from GitHub into a folder, for an office server without bun
# (`make bundle` uses it). Writes build.json next to it so installed Offices can compare builds.
#   scripts/fetch-release.sh 0.4.2 dist/downloads [owner/repo]
set -euo pipefail
VERSION=${1:?version, e.g. 0.4.2}
OUT=${2:?output folder}
REPO=${3:-${AGENTFLEET_RELEASE_REPO:-hannguyendd/agent-party}}
WHEEL="agentfleet_node-$VERSION-py3-none-any.whl"
BASE="https://github.com/$REPO/releases/download/v$VERSION"
mkdir -p "$OUT"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
echo "Downloading $WHEEL from $BASE"
if ! curl -fsSL "$BASE/$WHEEL" -o "$tmp/$WHEEL"; then
  echo "No GitHub release v$VERSION with $WHEEL yet." >&2
  echo "Either release it (scripts/release.sh, see docs/RELEASE.md) or install bun to build it here (https://bun.sh)." >&2
  exit 1
fi
if curl -fsSL "$BASE/SHA256SUMS" -o "$tmp/SHA256SUMS" 2>/dev/null; then
  (cd "$tmp" && grep " $WHEEL\$" SHA256SUMS | { command -v sha256sum >/dev/null && sha256sum -c - || shasum -a 256 -c -; }) >/dev/null \
    || { echo "checksum mismatch for $WHEEL" >&2; exit 1; }
fi
rm -f "$OUT"/agentfleet_node-*.whl
mv "$tmp/$WHEEL" "$OUT/"
printf '{"build": "v%s"}\n' "$VERSION" > "$OUT/build.json"
echo "Ready: $OUT/$WHEEL"
