#!/usr/bin/env bash
# Publish a new version of the Office for staff.
#
#   scripts/release.sh            # 0.4.1 -> 0.4.2 (patch)
#   scripts/release.sh minor      # 0.4.1 -> 0.5.0
#   scripts/release.sh major      # 0.4.1 -> 1.0.0
#   scripts/release.sh 0.6.0      # exact version
#   add --yes to skip the question, --dry-run to only print what would happen
#   releases come from the develop branch (the project's main branch); --any-branch allows another one
#
# Bumps the version (node-server/pyproject.toml + uv.lock, dashboard/package.json), stamps CHANGELOG.md
# ("## Unreleased" becomes the version; without it, the feat/fix commits are listed) on a release/vX.Y.Z branch, merges
# it into develop through a pull request (develop only accepts pull requests; needs the GitHub CLI `gh`, logged in),
# then tags the merged commit vX.Y.Z and pushes the tag. Pushing the tag starts .github/workflows/release.yml on GitHub, which runs the tests,
# builds the node package (dashboard inside) and publishes a GitHub Release with the package and the installers.
# After that: on the office server `git pull && make server` serves the new version, and every Office shows
# "Update available". Same steps for a person or an agent; see docs/RELEASE.md.
set -euo pipefail
cd "$(dirname "$0")/.."

BUMP=patch DRY=0 YES=0 ANY=0
MAIN_BRANCH=develop
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --yes|-y) YES=1 ;;
    --any-branch) ANY=1 ;;
    patch|minor|major) BUMP=$a ;;
    [0-9]*.[0-9]*.[0-9]*) BUMP=$a ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "unknown argument: $a (see --help)" >&2; exit 2 ;;
  esac
done

die() { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }
say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }

CURRENT=$(sed -n 's/^version = "\(.*\)"$/\1/p' node-server/pyproject.toml | head -1)
[[ "$CURRENT" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || die "can't read the version in node-server/pyproject.toml (got '$CURRENT')"
MA=${BASH_REMATCH[1]} MI=${BASH_REMATCH[2]} PA=${BASH_REMATCH[3]}
case "$BUMP" in
  patch) NEXT="$MA.$MI.$((PA + 1))" ;;
  minor) NEXT="$MA.$((MI + 1)).0" ;;
  major) NEXT="$((MA + 1)).0.0" ;;
  *) NEXT=$BUMP ;;
esac
TAG="v$NEXT"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
command -v gh >/dev/null 2>&1 || die "the GitHub CLI is needed (https://cli.github.com), then: gh auth login"
# The repository's current name (it may have been renamed since the remote was added).
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || git remote get-url origin | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')

# Release only what is committed and pushed-able.
git diff --quiet && git diff --cached --quiet || die "commit or stash your changes first (git status)"
[ "$BRANCH" != HEAD ] || die "not on a branch"
[ "$BRANCH" = "$MAIN_BRANCH" ] || [ $ANY = 1 ] || die "releases come from $MAIN_BRANCH (you are on $BRANCH): merge into $MAIN_BRANCH first, or add --any-branch"
git fetch -q origin "$BRANCH" --tags
[ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")" ] || die "$BRANCH is not the same as origin/$BRANCH: git pull (or push) first"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "tag $TAG already exists"
git ls-remote --exit-code --tags origin "$TAG" >/dev/null 2>&1 && die "tag $TAG already exists on GitHub"
[ "$(printf '%s\n%s\n' "$CURRENT" "$NEXT" | sort -V | tail -1)" = "$NEXT" ] && [ "$CURRENT" != "$NEXT" ] || die "$NEXT is not newer than $CURRENT"

say "Release $CURRENT -> $NEXT from branch $BRANCH ($REPO)"
say "What's new in $TAG (CHANGELOG.md, shown in the Office after the update):"
python3 scripts/changelog.py "$NEXT" --print | sed 's/^/    /'
if [ $DRY = 1 ]; then echo "dry run: nothing changed"; exit 0; fi
if [ $YES = 0 ]; then
  if [ -t 0 ]; then read -r -p "Go ahead? [y/N] " ok; else ok=n; fi
  case "$ok" in [yY]*) ;; *) die "cancelled (non-interactive? add --yes)" ;; esac
fi

WORK="release/$TAG"
git checkout -q -b "$WORK"
sed -i.bak "s/^version = \"$CURRENT\"$/version = \"$NEXT\"/" node-server/pyproject.toml && rm node-server/pyproject.toml.bak
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEXT\"/" dashboard/package.json && rm dashboard/package.json.bak
(cd node-server && uv lock -q)
python3 scripts/changelog.py "$NEXT" >/dev/null
git add node-server/pyproject.toml node-server/uv.lock dashboard/package.json CHANGELOG.md
git commit -q -m "chore(release): $TAG"
git push -q -u origin "$WORK"
say "Merging $WORK into $BRANCH (pull request)"
gh pr create -R "$REPO" --base "$BRANCH" --head "$WORK" --title "chore(release): $TAG" --body "Version bump for $TAG (scripts/release.sh)." >/dev/null
gh pr merge "$WORK" -R "$REPO" --merge --delete-branch >/dev/null || die "could not merge the release pull request; merge it on GitHub, then: git checkout $BRANCH && git pull && git tag -a $TAG -m $TAG && git push origin $TAG"
git checkout -q "$BRANCH"
git pull -q --ff-only origin "$BRANCH"
git branch -q -D "$WORK" 2>/dev/null || true
grep -q "^version = \"$NEXT\"$" node-server/pyproject.toml || die "$BRANCH doesn't have version $NEXT after the merge"
git tag -a "$TAG" -m "$TAG"
git push -q origin "$TAG"

say "Pushed $TAG. GitHub is building the release (tests, package, installers): https://github.com/$REPO/actions"
echo "    When it's green: https://github.com/$REPO/releases/tag/$TAG"
echo "    Then on the office server: git pull && make server   (every Office shows 'Update available')"
