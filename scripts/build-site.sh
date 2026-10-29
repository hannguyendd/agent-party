#!/usr/bin/env bash
# Assembles the public intro page (site/) with the Office art it uses, into a folder ready to publish or serve.
# Used by .github/workflows/pages.yml and `make site`.
#   scripts/build-site.sh [out_dir]      default: dist/site
#   OFFICE_3D_DIR=<dir>                  take the 3D office from another folder
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-dist/site}
rm -rf "$OUT"
mkdir -p "$OUT/office"
cp -R site/. "$OUT/"
rm -f "$OUT/CLAUDE.md"
# Only the art the page loads (see site/CLAUDE.md); never the art sources.
for d in map characters characters48 ui; do cp -R "dashboard/public/office/$d" "$OUT/office/"; done
# The 3D office (models + layout3d.json), when it exists. OFFICE_3D_DIR previews another copy, for example the
# 3D art worktree: OFFICE_3D_DIR=../internal-agent-fleet-3d/dashboard/public/office/3d make site
SRC_3D=${OFFICE_3D_DIR:-dashboard/public/office/3d}
if [ -f "$SRC_3D/layout3d.json" ]; then
  mkdir -p "$OUT/office/3d"
  cp -R "$SRC_3D/layout3d.json" "$SRC_3D/models3d.json" "$SRC_3D/props" "$SRC_3D/kit" "$SRC_3D/characters" "$OUT/office/3d/"
  echo "with the 3D office from $SRC_3D"
else
  echo "no 3D office yet: the 3D switch tilts the 2D map"
fi
touch "$OUT/.nojekyll"
echo "site assembled in $OUT"
