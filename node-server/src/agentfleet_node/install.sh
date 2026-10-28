#!/usr/bin/env bash
# Agent Mesh: install this machine's node. Served by the team's office server, or attached to a GitHub release:
#   curl -fsSL http://<office server>:7500/install | bash
#   curl -fsSL https://github.com/<repo>/releases/download/v<version>/install.sh | bash -s -- --server <host>:7500
# Installs uv (if missing), the node server (dashboard included) and agentmesh-node, runs the node in the background
# now and at every login, adds an Office shortcut and opens the dashboard so you can join. Run it again to update.
# AGENTMESH_AUTOSTART=off skips start-at-login; AGENTMESH_NO_OPEN=1 skips opening the browser;
# AGENTMESH_UPDATE=1 (the in-app Update) keeps the current start-at-login choice.
set -euo pipefail

SERVER="__SERVER__"   # the office server this script came from (host:port; "" for the GitHub copy)
OFFICE="__HOST__"     # what to prefill as "Office server" in the setup form
WHEEL="__WHEEL__"
ORG="__ORG__"         # organization name set on the server ("" when none)
GITHUB="__GITHUB__"   # the GitHub release of this version: where to download when the office server can't serve it
# --server host:port (or AGENTMESH_SERVER): the office server (the GitHub copy doesn't know it). Downloads try it first.
if [ -z "$SERVER" ] && [ -n "${AGENTMESH_SERVER:-}" ]; then SERVER="$AGENTMESH_SERVER"; OFFICE="${SERVER%:*}"; fi
while [ $# -gt 0 ]; do
  case "$1" in
    --server) SERVER="${2:-}"; OFFICE="${SERVER%:*}"; shift 2 ;;
    --server=*) SERVER="${1#--server=}"; OFFICE="${SERVER%:*}"; shift ;;
    *) shift ;;
  esac
done
TITLE="${ORG:+$ORG }Office"
BASE="${SERVER:+http://$SERVER}"
HOME_DIR="$HOME/.agentfleet"
BIN="$HOME/.local/bin"
PORT="${AGENTFLEET_PORT:-9100}"

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!! \033[0m %s\n' "$*"; }
die() { printf '\033[1;31mxx \033[0m %s\n' "$*" >&2; exit 1; }

say "Installing $TITLE on this machine"
[ -n "$WHEEL" ] || die "The server has no node package yet. Ask your admin to run 'make server' again (it builds or downloads it)."
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
[ "$ARCH" = aarch64 ] && ARCH=arm64
AMVERSION="__AMVERSION__"   # Agent Mesh release, for the fallback download below
case "$OS" in darwin|linux) ;; *) die "Only macOS and Linux are supported for now (got $OS)." ;; esac
mkdir -p "$HOME_DIR/data" "$BIN"
export PATH="$BIN:$HOME/.cargo/bin:$PATH"

# 1. uv: installs the node and the Python it needs.
if ! command -v uv >/dev/null 2>&1; then
  say "Installing uv"
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
command -v uv >/dev/null 2>&1 || die "uv did not install; see https://docs.astral.sh/uv/"

# 2. The node server, with the dashboard built in.
say "Installing the Agent Mesh node ($WHEEL)"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# From the office server when there is one; else (or when that fails) from the GitHub release of the same version.
if [ -n "$BASE" ] && curl -fsSL "$BASE/downloads/$WHEEL" -o "$tmp/$WHEEL" 2>/dev/null; then
  :
elif [ -n "$GITHUB" ] && { say "Downloading from GitHub (${GITHUB#https://github.com/})"; curl -fsSL "$GITHUB/$WHEEL" -o "$tmp/$WHEEL"; }; then
  :
else
  die "Could not download the node package from ${BASE:-the office server}${GITHUB:+ or GitHub}. Check this computer can open ${BASE:-$GITHUB} in a browser; if not, ask IT to allow it."
fi
uv tool install --force --reinstall --python 3.12 "$tmp/$WHEEL" >/dev/null
NODE="$(command -v agentfleet-node || echo "$BIN/agentfleet-node")"
[ -x "$NODE" ] || die "agentfleet-node was not installed"

# 3. agentmesh-node: lets your agents reach other machines.
if command -v agentmesh-node >/dev/null 2>&1; then
  say "agentmesh-node already installed"
elif [ -n "$BASE" ] && curl -fsSL "$BASE/downloads/agentmesh-node-$OS-$ARCH" -o "$tmp/agentmesh-node" 2>/dev/null; then
  install -m 755 "$tmp/agentmesh-node" "$BIN/agentmesh-node"
  touch "$HOME_DIR/installed-agentmesh-node"   # so the uninstaller knows it may remove it
  say "Installed agentmesh-node"
else
  # Not on the office server: take it from the official release instead.
  rel_os=$([ "$OS" = darwin ] && echo Darwin || echo Linux)
  say "Downloading agentmesh-node $AMVERSION from github.com/google/agentmesh"
  if curl -fsSL "https://github.com/google/agentmesh/releases/download/$AMVERSION/agentmesh_${rel_os}_${ARCH}.tar.gz" -o "$tmp/am.tar.gz" \
     && tar xzf "$tmp/am.tar.gz" -C "$tmp" agentmesh-node; then
    install -m 755 "$tmp/agentmesh-node" "$BIN/agentmesh-node"
    touch "$HOME_DIR/installed-agentmesh-node"
    say "Installed agentmesh-node"
  else
    warn "Could not get agentmesh-node for $OS-$ARCH. The Office works, but your agents can't reach other machines yet. Ask your admin."
  fi
fi

# 4. Claude Code runs the agents; it needs a login on this machine.
if ! command -v claude >/dev/null 2>&1; then
  warn "Claude Code is not installed. Install it and log in (https://docs.claude.com/claude-code); your agents need it."
  warn "The setup page checks it too and shows what to do."
fi

# 5. Run it, and at every login: the node is a quiet background service. Being online or offline is chosen in the
#    app (account menu, or walking out of the door), so nobody needs to think about the node after this.
#    AGENTMESH_AUTOSTART=off skips start-at-login; the in-app Update keeps whatever is set now.
uv tool update-shell >/dev/null 2>&1 || true   # puts ~/.local/bin on PATH for new terminals
if [ -z "${AGENTMESH_UPDATE:-}" ] && [ -z "${AGENTMESH_AUTOSTART:-}" ]; then
  AGENTMESH_AUTOSTART=on
fi
if [ "${AGENTMESH_AUTOSTART:-}" = on ]; then
  "$NODE" autostart on
elif [ "${AGENTMESH_AUTOSTART:-}" = off ]; then
  "$NODE" autostart off >/dev/null   # a "no" also turns off start-at-login set up by an earlier install
  "$NODE" restart >/dev/null
else
  "$NODE" restart >/dev/null   # in the background, for this session (or under start-at-login if it was on)
fi
curl -fsS "http://127.0.0.1:$PORT/api/node" >/dev/null 2>&1 || die "The node did not start; see $HOME_DIR/node.log"

# 6. A shortcut that opens the Office (and starts the node if it isn't running).
if [ "$OS" = darwin ]; then
  APP="$HOME/Applications/$TITLE.app"
  mkdir -p "$APP/Contents/MacOS"
  printf '#!/bin/bash\n"%s" open\n' "$NODE" > "$APP/Contents/MacOS/agentmesh-open"
  chmod +x "$APP/Contents/MacOS/agentmesh-open"
  cat > "$APP/Contents/Info.plist" <<APPPLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>$TITLE</string>
  <key>CFBundleIdentifier</key><string>com.agentmesh.office</string>
  <key>CFBundleExecutable</key><string>agentmesh-open</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
</dict></plist>
APPPLIST
else
  mkdir -p "$HOME/.local/share/applications"
  printf '[Desktop Entry]\nType=Application\nName=%s\nExec="%s" open\nTerminal=false\nCategories=Office;\n' "$TITLE" "$NODE" \
    > "$HOME/.local/share/applications/agentmesh-office.desktop"
fi

URL="http://127.0.0.1:$PORT/${OFFICE:+?server=$OFFICE}"
say "Done. $TITLE is running at http://127.0.0.1:$PORT"
echo "    Open it any time from the '$TITLE' shortcut. To remove it: Settings > This computer > Uninstall."
if [ -z "${AGENTMESH_NO_OPEN:-}" ]; then
  if [ "$OS" = darwin ]; then open "$URL"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true; fi
fi
