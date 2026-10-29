#!/usr/bin/env bash
# Party Agent: remove this machine's node. Served by the team's office server:
#   curl -fsSL http://<office server>:7500/uninstall | bash   (or Settings > This computer > Uninstall)
# Stops the node, removes start-at-login, the Office shortcut and the package (and agentmesh-node if the installer
# put it there). Your agents and chats in ~/.agentfleet are kept unless you say so.
set -uo pipefail
HOME_DIR="$HOME/.agentfleet"
BIN="$HOME/.local/bin"
say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
export PATH="$BIN:$PATH"

purge=""
if [ -d "$HOME_DIR" ] && { : </dev/tty; } 2>/dev/null; then
  printf '\033[1;36m?? \033[0m Also delete your agents, chats and setup in %s? [y/N] ' "$HOME_DIR" >/dev/tty
  read -r answer </dev/tty || answer=""
  case "$answer" in [yY]*) purge="--purge" ;; esac
fi

if command -v agentfleet-node >/dev/null 2>&1; then
  say "Removing the node"
  agentfleet-node uninstall $purge || true
else
  # No CLI left: undo what the installer did by hand.
  launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.agentmesh.node.plist" 2>/dev/null || true
  rm -f "$HOME/Library/LaunchAgents/com.agentmesh.node.plist"
  systemctl --user disable --now agentmesh-node.service 2>/dev/null || true
  rm -f "$HOME/.config/systemd/user/agentmesh-node.service" "$HOME/.local/share/applications/agentmesh-office.desktop"
  [ -n "$purge" ] && rm -rf "$HOME_DIR"
fi
# The installer's shortcut carries a marker file.
for app in "$HOME/Applications/"*.app; do
  [ -e "$app/Contents/MacOS/agentmesh-open" ] && rm -rf "$app"
done
if [ -f "$HOME_DIR/installed-agentmesh-node" ] || { [ -n "$purge" ] && [ -x "$BIN/agentmesh-node" ]; }; then
  rm -f "$BIN/agentmesh-node" "$HOME_DIR/installed-agentmesh-node"
  say "Removed agentmesh-node"
fi
sleep 1
say "Done.${purge:+ Your data was deleted.}${purge:- Your data is kept in $HOME_DIR (delete that folder to remove it).}"
