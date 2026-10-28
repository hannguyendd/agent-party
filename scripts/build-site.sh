#!/usr/bin/env bash
# Assembles the public intro page (site/) with the Office art it uses, into a folder ready to publish or serve.
# Used by .github/workflows/pages.yml and `make site`.
#   scripts/build-site.sh [out_dir]      default: dist/site
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-dist/site}
rm -rf "$OUT"
mkdir -p "$OUT/office"
cp -R site/. "$OUT/"
rm -f "$OUT/CLAUDE.md"
# Only the art the page loads (see site/CLAUDE.md); never the 3D models or the art sources.
for d in map characters characters48 ui; do cp -R "dashboard/public/office/$d" "$OUT/office/"; done
touch "$OUT/.nojekyll"
echo "site assembled in $OUT"
