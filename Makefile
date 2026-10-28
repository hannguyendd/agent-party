# Agent Mesh — run targets. `make help` lists them.
#
# Admin (always-on machine): `make server`, then everything else on http://<server ip>:7500/admin.
#   (Not `make serve`: that is a developer's own node on 127.0.0.1, unreachable from other computers.)
# Staff: `curl -fsSL http://<server ip>:7500/install | bash`, then join in the browser (name, server, join token).
# Developers: `make setup` once, then `make up`.
# Device settings can also come from node-server/.env (AGENTFLEET_OWNER, ...); the web setup overrides them.

SHELL := /bin/bash

NODE_DIR := node-server
DASH_DIR := dashboard
HUB_DIR  := hub

# This machine's LAN address unless given (macOS: en0/en1; Linux: first address).
HUB_HOST ?= $(shell ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $$1}')
HUB_PORT ?= 7400
HUB_URL  ?= http://$(if $(HUB_HOST),$(HUB_HOST),127.0.0.1):$(HUB_PORT)
DEVICE   ?=
WORLD_PORT ?= 7500
ORG ?=
HUB_DATA ?= ../hub/data
AGENTMESH_ONE ?=
# Agent Mesh release used for agentmesh-node (staff) and agentmesh-one (hub); the stack was verified on rc.10.
AGENTMESH_VERSION ?= v0.1.0-rc.10
# This checkout's version (scripts/release.sh bumps it); an office server without bun serves that GitHub release.
VERSION := $(shell sed -n 's/^version = "\(.*\)"$$/\1/p' node-server/pyproject.toml | head -1)
# Where `make server` puts tools it installs (on PATH for the targets below).
LOCAL_BIN := $(HOME)/.local/bin
export PATH := $(LOCAL_BIN):$(HOME)/.bun/bin:$(PATH)

.DEFAULT_GOAL := help
.PHONY: help setup up server server-check node-check doctor bundle install install-node install-dashboard test build serve dev dev-server dev-dashboard \
        mesh-node mesh-config hub hub-token world env codegraph clean site

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# staff: one-time setup, then run

setup: ## One-time setup on a staff machine: check tools, install deps, build the dashboard
	@command -v uv >/dev/null || { echo "missing: uv (https://docs.astral.sh/uv/)"; exit 1; }
	@command -v bun >/dev/null || { echo "missing: bun (https://bun.sh)"; exit 1; }
	@command -v claude >/dev/null || echo "warning: Claude Code CLI not found; agents can't run until it is installed and logged in"
	@command -v agentmesh-node >/dev/null || echo "warning: agentmesh-node not found; the Office works, but agents can't reach other machines until it is installed"
	@$(MAKE) --no-print-directory install build
	@echo; echo "Done. Run 'make up', then open http://127.0.0.1:9100 to join the team."

up: node-check ## Run this machine's node (dashboard + agents + mesh connection) at http://127.0.0.1:9100
	@test -d $(DASH_DIR)/dist || $(MAKE) --no-print-directory build
	@(sleep 2; command -v open >/dev/null && open http://127.0.0.1:9100 || command -v xdg-open >/dev/null && xdg-open http://127.0.0.1:9100) >/dev/null 2>&1 &
	cd $(NODE_DIR) && uv run agentfleet-node serve

# admin: the always-on team machine

server: server-check bundle ## Run hub + Office world server + staff installer; settings live on the admin page (/admin)
	@test -n "$(HUB_HOST)" || { echo "Could not find this machine's LAN address; run: make server HUB_HOST=<LAN IP>"; exit 1; }
	@echo "Server address: $(HUB_HOST) (detected; override with HUB_HOST=...)"
	@echo "Admin page (invite staff, see who is online): http://$(HUB_HOST):$(WORLD_PORT)/admin"
	@echo "Staff install (macOS/Linux): curl -fsSL http://$(HUB_HOST):$(WORLD_PORT)/install | bash"
	@echo "Staff install (Windows, PowerShell): irm http://$(HUB_HOST):$(WORLD_PORT)/install.ps1 | iex"
	@trap 'kill 0' EXIT INT TERM; \
	$(MAKE) --no-print-directory hub & \
	$(MAKE) --no-print-directory world & \
	wait

bundle: ## What the staff installer serves: node package with the dashboard inside (built here with bun, else the GitHub release) + agentmesh-node
	@if ! command -v bun >/dev/null; then \
	  echo "bun is not installed: using the released package for v$(VERSION) from GitHub instead of building it."; \
	  ./scripts/fetch-release.sh $(VERSION) dist/downloads; \
	else $(MAKE) --no-print-directory bundle-build; fi
	@# agentmesh-node for every staff platform, from the official release (checksums verified); kept until the version changes.
	@if [ "$$(cat dist/downloads/agentmesh.version 2>/dev/null)" != "$(AGENTMESH_VERSION)" ]; then \
	  echo "Fetching agentmesh-node $(AGENTMESH_VERSION) for macOS, Linux and Windows..."; \
	  ./scripts/fetch-agentmesh.sh $(AGENTMESH_VERSION) node dist/downloads; fi
	@ls dist/downloads

bundle-build: ## Build the node package here (dashboard inside); needs bun
	cd $(DASH_DIR) && bun install --frozen-lockfile >/dev/null && bun run build
	rm -rf $(NODE_DIR)/src/agentfleet_node/static && cp -R $(DASH_DIR)/dist $(NODE_DIR)/src/agentfleet_node/static
	@# A build id per bundle: installed nodes compare it with the server's to offer an update.
	@printf '{"build": "%s-%s"}\n' "$$(git rev-parse --short HEAD 2>/dev/null || echo local)" "$$(date +%Y%m%d%H%M%S)" > $(NODE_DIR)/src/agentfleet_node/static/build.json
	@# Build into a scratch folder and swap only on success, so a failed build never leaves the installer without a package.
	rm -rf dist/.wheel && mkdir -p dist/downloads dist/.wheel
	cd $(NODE_DIR) && uv build --wheel --out-dir ../dist/.wheel
	@ls dist/.wheel/agentfleet_node-*.whl >/dev/null
	rm -f dist/downloads/agentfleet_node-*.whl && mv dist/.wheel/agentfleet_node-*.whl dist/downloads/ && rm -rf dist/.wheel
	cp $(NODE_DIR)/src/agentfleet_node/static/build.json dist/downloads/build.json

release: ## Publish a new version for staff: make release BUMP=patch|minor|major|X.Y.Z (see docs/RELEASE.md)
	./scripts/release.sh $(or $(BUMP),patch)

server-check: ## What the office server needs (uv, agentmesh-one; bun only to build locally); offers to install what is missing
	@for p in $(HUB_PORT) $(WORLD_PORT); do \
	  if lsof -nP -iTCP:$$p -sTCP:LISTEN >/dev/null 2>&1; then \
	    echo "Port $$p is already in use (an earlier make server?):"; lsof -nP -iTCP:$$p -sTCP:LISTEN | awk 'NR>1 {print "  pid " $$2 "  " $$1}'; \
	    echo "Stop it first (Ctrl+C in its terminal, or: kill <pid>), then run make server again."; exit 1; fi; done
	@ask() { read -r -p "$$1 [Y/n] " a </dev/tty || a=n; case "$$a" in [nN]*) return 1;; *) return 0;; esac; }; \
	if ! command -v uv >/dev/null; then \
	  if ask "uv (Python tooling) is missing. Install it now?"; then curl -LsSf https://astral.sh/uv/install.sh | sh; \
	  else echo "Install uv: https://docs.astral.sh/uv/"; exit 1; fi; fi; \
	command -v bun >/dev/null || echo "bun is not installed: the staff package comes from the GitHub release v$(VERSION) (install bun to build it here)."; \
	if ! command -v agentmesh-one >/dev/null; then \
	  if ask "agentmesh-one (the hub) is missing. Install $(AGENTMESH_VERSION) into $(LOCAL_BIN)?"; then \
	    mkdir -p $(LOCAL_BIN) && ./scripts/fetch-agentmesh.sh $(AGENTMESH_VERSION) one $(LOCAL_BIN); \
	  else echo "Install agentmesh-one: https://github.com/google/agentmesh/releases"; exit 1; fi; fi; \
	echo "uv and agentmesh-one are ready."

doctor: ## Why other computers can't reach this office server: address, firewall, listening ports
	@echo "This machine's LAN address: $(HUB_HOST)"
	@echo "Staff and admin should open http://$(HUB_HOST):$(WORLD_PORT)/admin (hub on :$(HUB_PORT))."
	@echo; echo "Listening (needs 0.0.0.0 or * or $(HUB_HOST), not 127.0.0.1):"
	@(lsof -nP -iTCP:$(HUB_PORT) -iTCP:$(WORLD_PORT) -sTCP:LISTEN 2>/dev/null || ss -ltnp 2>/dev/null | grep -E ':($(HUB_PORT)|$(WORLD_PORT)) ') \
	  | awk 'NR==1 || /LISTEN/' || true
	@lsof -nP -iTCP:$(HUB_PORT) -iTCP:$(WORLD_PORT) -sTCP:LISTEN >/dev/null 2>&1 || ss -ltn 2>/dev/null | grep -qE ':($(HUB_PORT)|$(WORLD_PORT)) ' \
	  || echo "  nothing on $(HUB_PORT)/$(WORLD_PORT): run make server (not make serve)."
	@echo; echo "From this machine via the LAN address:"
	@curl -fsS -m 3 http://$(HUB_HOST):$(WORLD_PORT)/healthz >/dev/null 2>&1 && echo "  office server :$(WORLD_PORT) answers" || echo "  office server :$(WORLD_PORT) does NOT answer"
	@curl -fsS -m 3 -o /dev/null http://$(HUB_HOST):$(HUB_PORT)/ 2>/dev/null && echo "  hub :$(HUB_PORT) answers" || echo "  hub :$(HUB_PORT) does not answer on / (may be normal; check the listening list above)"
	@if [ -x /usr/libexec/ApplicationFirewall/socketfilterfw ]; then echo; \
	  /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate; \
	  echo "  If enabled: System Settings > Network > Firewall > Options, allow incoming for python3 and agentmesh-one"; \
	  echo "  (or answer Allow when macOS asks the first time make server runs)."; fi
	@echo; echo "Also check: both computers on the same network (no guest Wi-Fi / client isolation), and no VPN in between."

# setup pieces

install: install-node install-dashboard ## Install all dependencies

install-node: ## Install node-server Python deps (uv)
	cd $(NODE_DIR) && uv sync

install-dashboard: ## Install dashboard deps (bun)
	cd $(DASH_DIR) && bun install

env: ## Create node-server/.env for this device (OWNER=<name>)
	@test -n "$(OWNER)" || { echo "usage: make env OWNER=<your name>"; exit 1; }
	@test ! -f $(NODE_DIR)/.env || { echo "$(NODE_DIR)/.env already exists"; exit 1; }
	@printf 'AGENTFLEET_OWNER=%s\nAGENTFLEET_MESH_API_TOKEN_PATH=./data/mesh-api-token\n' "$(OWNER)" > $(NODE_DIR)/.env
	@echo "wrote $(NODE_DIR)/.env"

# checks

test: ## Run node-server tests
	cd $(NODE_DIR) && uv run pytest

build: ## Build the dashboard into dashboard/dist (served by the node server)
	cd $(DASH_DIR) && bun run build

# device

node-check: ## agentmesh-node on this machine (lets your agents reach other machines); offers to install it
	@if ! command -v agentmesh-node >/dev/null; then \
	  read -r -p "agentmesh-node is missing (your agents can't reach other machines without it). Install $(AGENTMESH_VERSION) into $(LOCAL_BIN)? [Y/n] " a </dev/tty || a=n; \
	  case "$$a" in [nN]*) echo "Skipped: the Office works, but agents stay on this machine.";; \
	    *) mkdir -p $(LOCAL_BIN) && ./scripts/fetch-agentmesh.sh $(AGENTMESH_VERSION) node-here $(LOCAL_BIN);; esac; fi

serve: node-check build ## Developer: your own node on 127.0.0.1:9100 (NOT the team's office server: that is make server)
	@echo "This is your own node on http://127.0.0.1:9100 (other computers can't reach it). The team's office server is: make server"
	cd $(NODE_DIR) && uv run agentfleet-node serve

dev: ## Run node server + dashboard dev server with hot reload (http://localhost:5173)
	@trap 'kill 0' EXIT INT TERM; \
	$(MAKE) --no-print-directory dev-server & \
	$(MAKE) --no-print-directory dev-dashboard & \
	wait

dev-server:
	cd $(NODE_DIR) && uv run agentfleet-node serve

dev-dashboard:
	cd $(DASH_DIR) && bun dev

mesh-node: ## Run this device's agentmesh-node (HUB_URL=http://<hub>:7400)
	cd $(NODE_DIR) && HUB_URL=$(HUB_URL) ./scripts/start-mesh-node.sh

mesh-config: ## Regenerate and print agentmesh-node.yaml from this device's agents
	cd $(NODE_DIR) && uv run agentfleet-node mesh-config

# hub (always-on machine)

hub: ## Run the hub (HUB_HOST=<fixed LAN IP or hostname>)
	@test -n "$(HUB_HOST)" || { echo "usage: make hub HUB_HOST=<fixed LAN IP or hostname>"; exit 1; }
	cd $(HUB_DIR) && HUB_HOST=$(HUB_HOST) HUB_PORT=$(HUB_PORT) ./start-hub.sh

hub-token: ## Mint a single-use join token for a device (DEVICE="han laptop")
	@test -n "$(DEVICE)" || { echo 'usage: make hub-token DEVICE="han laptop"'; exit 1; }
	cd $(HUB_DIR) && HUB_PORT=$(HUB_PORT) ./mint-token.sh "$(DEVICE)"

world: ## Run the Office world server (one per team, on the hub machine; port WORLD_PORT, default 7500)
	cd $(NODE_DIR) && uv run agentfleet-node world --port $(WORLD_PORT) --downloads ../dist/downloads --org "$(ORG)" --hub-data "$(HUB_DATA)" --hub-port $(HUB_PORT) $(if $(AGENTMESH_ONE),--agentmesh-one "$(AGENTMESH_ONE)",)

codegraph: ## Refresh the codegraph index (.codegraph/, local only)
	codegraph sync .

site: ## Preview the public intro page (site/) as GitHub Pages will serve it, at http://localhost:8090
	./scripts/build-site.sh dist/site
	@echo "Open http://localhost:8090 (Ctrl+C to stop)"
	cd dist/site && python3 -m http.server 8090

clean: ## Remove build output and caches (keeps data/ and node identities)
	rm -rf $(DASH_DIR)/dist $(NODE_DIR)/.pytest_cache
	find $(NODE_DIR) -name __pycache__ -type d -prune -exec rm -rf {} +
