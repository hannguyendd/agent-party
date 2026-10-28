#!/usr/bin/env bash
# Agent Mesh: install this machine's node. Served by the team's world server:
#   curl -fsSL http://__SERVER__/install | bash
# Installs uv (if missing), the node server (dashboard included) and agentmesh-node, runs the node in the background
# now and at every login, adds an Office shortcut and opens the dashboard so you can join. Run it again to update.
# AGENTMESH_AUTOSTART=off skips start-at-login; AGENTMESH_NO_OPEN=1 skips opening the browser;
# AGENTMESH_UPDATE=1 (the in-app Update) keeps the current start-at-login choice.
set -euo pipefail

SERVER="__SERVER__"   # the world server this script came from (host:port)
OFFICE="__HOST__"     # what to prefill as "Office server" in the setup form
WHEEL="__WHEEL__"
ORG="__ORG__"         # organization name set on the server ("" when none)
TITLE="${ORG:+$ORG }Office"
BASE="http://$SERVER"
HOME_DIR="$HOME/.agentfleet"
BIN="$HOME/.local/bin"
PORT="${AGENTFLEET_PORT:-9100}"

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!! \033[0m %s\n' "$*"; }
die() { printf '\033[1;31mxx \033[0m %s\n' "$*" >&2; exit 1; }

say "Installing $TITLE on this machine"
[ -n "$WHEEL" ] || die "The server has no node package yet. Ask your admin to run 'make bundle' on the server."
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
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
curl -fsSL "$BASE/downloads/$WHEEL" -o "$tmp/$WHEEL"
uv tool install --force --reinstall --python 3.12 "$tmp/$WHEEL" >/dev/null
NODE="$(command -v agentfleet-node || echo "$BIN/agentfleet-node")"
[ -x "$NODE" ] || die "agentfleet-node was not installed"

# 3. agentmesh-node: lets your agents reach other machines.
if command -v agentmesh-node >/dev/null 2>&1; then
  say "agentmesh-node already installed"
elif curl -fsSL "$BASE/downloads/agentmesh-node-$OS-$ARCH" -o "$tmp/agentmesh-node" 2>/dev/null; then
  install -m 755 "$tmp/agentmesh-node" "$BIN/agentmesh-node"
  say "Installed agentmesh-node"
else
  warn "The server has no agentmesh-node for $OS-$ARCH. The Office works, but your agents can't reach other machines yet. Ask your admin."
fi

# 4. Claude Code runs the agents; it needs a login on this machine.
command -v claude >/dev/null 2>&1 || warn "Claude Code is not installed. Install it and log in (https://docs.claude.com/claude-code); your agents need it."

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

URL="http://127.0.0.1:$PORT/?server=$OFFICE"
say "Done. $TITLE is running at http://127.0.0.1:$PORT"
echo "    Open it any time from the '$TITLE' shortcut, or run: agentfleet-node   (menu: start, stop, start at login, update)"
if [ -z "${AGENTMESH_NO_OPEN:-}" ]; then
  if [ "$OS" = darwin ]; then open "$URL"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true; fi
fi
