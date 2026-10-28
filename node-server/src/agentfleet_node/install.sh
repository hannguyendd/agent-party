#!/usr/bin/env bash
# Agent Mesh: install this machine's node. Served by the team's world server:
#   curl -fsSL http://__SERVER__/install | bash
# Installs uv (if missing), the node server (dashboard included) and agentmesh-node, starts the node at login,
# then opens the dashboard so you can join the team. Safe to run again to update.
# AGENTMESH_NO_SERVICE=1 starts the node for this session only; AGENTMESH_NO_OPEN=1 skips opening the browser.
set -euo pipefail

SERVER="__SERVER__"   # the world server this script came from (host:port)
OFFICE="__HOST__"     # what to prefill as "Office server" in the setup form
WHEEL="__WHEEL__"
ORG="__ORG__"         # organization name set on the server ("" when none)
TITLE="${ORG:+$ORG }Office"
BASE="http://$SERVER"
HOME_DIR="$HOME/.agentfleet"
BIN="$HOME/.local/bin"
PORT=9100

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
uv tool install --force --python 3.12 "$tmp/$WHEEL" >/dev/null
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

# 5. Start the node now and at every login. It keeps its data in ~/.agentfleet.
say "Starting the node"
if [ -n "${AGENTMESH_NO_SERVICE:-}" ]; then
  START_ONCE=1
elif [ "$OS" = darwin ]; then
  PLIST="$HOME/Library/LaunchAgents/com.agentmesh.node.plist"
  mkdir -p "$(dirname "$PLIST")"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.agentmesh.node</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>serve</string></array>
  <key>WorkingDirectory</key><string>$HOME_DIR</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$PATH:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    <key>AGENTFLEET_DATA_DIR</key><string>$HOME_DIR/data</string>
    <key>AGENTFLEET_MESH_NODE_CONFIG_PATH</key><string>$HOME_DIR/data/agentmesh-node.yaml</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME_DIR/node.log</string>
  <key>StandardErrorPath</key><string>$HOME_DIR/node.log</string>
</dict></plist>
PLIST
  launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
elif command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
  UNIT="$HOME/.config/systemd/user/agentmesh-node.service"
  mkdir -p "$(dirname "$UNIT")"
  cat > "$UNIT" <<UNIT
[Unit]
Description=Agent Mesh node
[Service]
ExecStart=$NODE serve
WorkingDirectory=$HOME_DIR
Environment=PATH=$PATH:/usr/local/bin:/usr/bin:/bin
Environment=AGENTFLEET_DATA_DIR=$HOME_DIR/data
Environment=AGENTFLEET_MESH_NODE_CONFIG_PATH=$HOME_DIR/data/agentmesh-node.yaml
Restart=on-failure
[Install]
WantedBy=default.target
UNIT
  systemctl --user daemon-reload
  systemctl --user enable --now agentmesh-node.service >/dev/null
  systemctl --user restart agentmesh-node.service
else
  warn "No launchd/systemd user session: starting the node for this session only."
  START_ONCE=1
fi
if [ -n "${START_ONCE:-}" ]; then
  (cd "$HOME_DIR" && AGENTFLEET_DATA_DIR="$HOME_DIR/data" AGENTFLEET_MESH_NODE_CONFIG_PATH="$HOME_DIR/data/agentmesh-node.yaml" \
    nohup "$NODE" serve </dev/null >>"$HOME_DIR/node.log" 2>&1 &)  # detached: a piped `curl | bash` can end
fi

for _ in $(seq 1 40); do
  curl -fsS "http://127.0.0.1:$PORT/api/node" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -fsS "http://127.0.0.1:$PORT/api/node" >/dev/null 2>&1 || die "The node did not start; see $HOME_DIR/node.log"

URL="http://127.0.0.1:$PORT/?server=$OFFICE"
say "Done. Opening $URL to join the team."
if [ -n "${AGENTMESH_NO_OPEN:-}" ]; then :; elif [ "$OS" = darwin ]; then open "$URL"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true; fi
echo "If no browser opened, visit $URL"
